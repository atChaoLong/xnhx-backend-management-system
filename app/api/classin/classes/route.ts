import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { requireClassInOpsProfile } from '@/lib/server-classin-ops'
import { getAccessibleFormalOrderIds, hasScopedIdAccess } from '@/lib/server-business-scope'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'
import { ensureClassInStudentAccount } from '@/lib/server-classin-students'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('ClassIn:Classes')

const CLASSIN_CLASS_SELECT = [
  'course_id',
  'course_name',
  'creator_name:creater_name',
  'sync_time',
  'add_time',
].join(',')

interface CreateClassFromOrderBody {
  formal_order_id?: string
  name?: string
  description?: string
  head_teacher_id?: string
  teacher_ids?: string[]
  student_ids?: string[]
}

function toPositiveClassInId(value: unknown, label: string): number {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value.trim())
      : NaN

  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new Error(`${label}无效`)
  }

  return numeric
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)))
}

async function findTeacherClassInUid(teacherName: string): Promise<number | null> {
  const { data } = await supabaseServer
    .from('teacher_classin')
    .select('uid')
    .eq('name', teacherName)
    .eq('is_del', 0)
    .maybeSingle()

  if (!data?.uid) return null

  return toPositiveClassInId(data.uid, '老师 ClassIn UID')
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const { searchParams } = new URL(request.url)
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    // 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('class_classin')
      .select('course_id', { count: 'exact', head: true })

    // 分页查询数据
    const { data, error } = await supabaseServer
      .from('class_classin')
      .select(CLASSIN_CLASS_SELECT)
      .order('add_time', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('查询 ClassIn 班级失败', summarizeError(error))
      return NextResponse.json(
        { error: '查询失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: unknown) {
    logger.error('获取 ClassIn 班级数据异常', summarizeError(error))
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

    const body = (await request.json().catch(() => ({}))) as CreateClassFromOrderBody
    const formalOrderId = typeof body.formal_order_id === 'string' ? body.formal_order_id.trim() : ''
    const courseName = typeof body.name === 'string' ? body.name.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const teacherIds = getStringArray(body.teacher_ids)
    const studentIds = getStringArray(body.student_ids)

    if (!formalOrderId) {
      return NextResponse.json({ error: '缺少正式订单ID' }, { status: 400 })
    }

    if (!courseName) {
      return NextResponse.json({ error: '班级名称不能为空' }, { status: 400 })
    }

    if (!body.head_teacher_id) {
      return NextResponse.json({ error: '请选择班主任' }, { status: 400 })
    }

    if (teacherIds.length === 0) {
      return NextResponse.json({ error: '请至少选择一位任课老师' }, { status: 400 })
    }

    if (studentIds.length === 0) {
      return NextResponse.json({ error: '请至少选择一位学生' }, { status: 400 })
    }

    const accessibleOrderIds = await getAccessibleFormalOrderIds(access.profile)
    if (!hasScopedIdAccess(accessibleOrderIds, formalOrderId)) {
      logger.warn('创建 ClassIn 班级失败 - 无权访问订单', {
        orderId: formalOrderId,
        profileId: access.profile.id,
      })
      return NextResponse.json({ error: '无权为该订单创建班级' }, { status: 403 })
    }

    const { data: order, error: orderError } = await supabaseServer
      .from('formal_orders')
      .select('id, order_number, student_id, total_sessions, total_hours, subjects, teacher_names')
      .eq('id', formalOrderId)
      .single()

    if (orderError || !order) {
      logger.error('创建 ClassIn 班级失败 - 订单不存在', {
        orderId: formalOrderId,
        error_summary: summarizeError(orderError),
      })
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    if (order.student_id && !studentIds.includes(order.student_id)) {
      return NextResponse.json(
        { error: '所选学生必须包含订单关联学生' },
        { status: 400 }
      )
    }

    const { data: existingCourse, error: existingCourseError } = await supabaseServer
      .from('courses')
      .select('id, classin_course_id, course_name')
      .eq('order_id', formalOrderId)
      .maybeSingle()

    if (existingCourseError) {
      logger.error('创建 ClassIn 班级失败 - 查询本地课程失败', {
        orderId: formalOrderId,
        error_summary: summarizeError(existingCourseError),
      })
      return NextResponse.json({ error: '查询本地课程失败' }, { status: 500 })
    }

    if (existingCourse?.classin_course_id) {
      return NextResponse.json(
        { error: '该订单已有关联的 ClassIn 班级' },
        { status: 409 }
      )
    }

    const { data: selectedTeachers, error: teachersError } = await supabaseServer
      .from('teachers')
      .select('id, name, subjects, classin_uid')
      .in('id', teacherIds)

    if (teachersError) {
      logger.error('创建 ClassIn 班级失败 - 查询老师失败', {
        teacherCount: teacherIds.length,
        error_summary: summarizeError(teachersError),
      })
      return NextResponse.json({ error: '查询老师失败' }, { status: 500 })
    }

    if (!selectedTeachers || selectedTeachers.length !== teacherIds.length) {
      return NextResponse.json({ error: '所选老师不存在或不可用' }, { status: 400 })
    }

    const firstTeacher = selectedTeachers.find((teacher: any) => teacher.id === teacherIds[0]) || selectedTeachers[0]
    const firstTeacherName = firstTeacher?.name || order.teacher_names?.[0] || ''
    let firstTeacherUid = firstTeacher?.classin_uid
      ? toPositiveClassInId(firstTeacher.classin_uid, '老师 ClassIn UID')
      : null

    if (!firstTeacherUid && firstTeacherName) {
      firstTeacherUid = await findTeacherClassInUid(firstTeacherName)
    }

    if (!firstTeacherUid) {
      return NextResponse.json(
        { error: `教师未绑定 ClassIn：${firstTeacherName || '所选老师'}` },
        { status: 400 }
      )
    }

    const { data: selectedStudents, error: studentsError } = await supabaseServer
      .from('students')
      .select('id, student_name, grade_code, classin_uid, parent_phone')
      .in('id', studentIds)

    if (studentsError) {
      logger.error('创建 ClassIn 班级失败 - 查询学生失败', {
        studentCount: studentIds.length,
        error_summary: summarizeError(studentsError),
      })
      return NextResponse.json({ error: '查询学生失败' }, { status: 500 })
    }

    if (!selectedStudents || selectedStudents.length !== studentIds.length) {
      return NextResponse.json({ error: '所选学生不存在或不可用' }, { status: 400 })
    }

    const studentMissingPhone = selectedStudents.find((student: any) => !student.classin_uid && !student.parent_phone)
    if (studentMissingPhone) {
      return NextResponse.json(
        { error: `学生缺少手机号，无法加入 ClassIn 课程：${studentMissingPhone.student_name || studentMissingPhone.id}` },
        { status: 400 }
      )
    }

    const subject = Array.isArray(order.subjects) ? order.subjects[0] : null
    const orderStudent = selectedStudents.find((student: any) => student.id === order.student_id) || selectedStudents[0]
    const grade = orderStudent?.grade_code || null
    const teacherProfile = firstTeacherName
      ? await supabaseServer
        .from('user_profiles')
        .select('id')
        .eq('name', firstTeacherName)
        .maybeSingle()
      : { data: null }

    const sdk = getClassInSDKService()
    const classinCourseId = await sdk.createCourse({ courseName })

    try {
      await supabaseServer
        .from('class_classin')
        .upsert(
          {
            course_id: classinCourseId,
            course_name: courseName,
            creator_uid: firstTeacherUid,
            creater_name: firstTeacherName,
            add_time: Math.floor(Date.now() / 1000),
            course_state: 1,
            sync_time: new Date().toISOString(),
            notes: description || `通过订单创建，订单号：${order.order_number || order.id}`,
          },
          { onConflict: 'course_id' }
        )
    } catch (error) {
      logger.warn('写入 class_classin 失败（非致命）', {
        orderId: formalOrderId,
        classinCourseId,
        error_summary: summarizeError(error),
      })
    }

    let localCourseId = existingCourse?.id || null
    const coursePayload = {
      classin_course_id: classinCourseId,
      course_name: courseName,
      subject,
      grade,
      teacher_id: teacherProfile.data?.id || null,
      teacher_name: firstTeacherName,
      session_count: Number(order.total_sessions || 0),
      total_hours: Number(order.total_hours || 0),
      course_status: 'active',
      course_consumption_info: JSON.stringify({
        totalSessions: Number(order.total_sessions || 0),
        completedSessions: 0,
        progress: 0,
        totalHours: Number(order.total_hours || 0),
        actualHours: 0,
        lastSyncTime: new Date().toISOString(),
      }),
      notes: description || `通过订单创建 ClassIn 班级，订单号：${order.order_number || order.id}`,
    }

    if (existingCourse) {
      const { error: updateCourseError } = await supabaseServer
        .from('courses')
        .update(coursePayload)
        .eq('id', existingCourse.id)

      if (updateCourseError) {
        logger.error('创建 ClassIn 班级失败 - 回填本地课程失败', {
          orderId: formalOrderId,
          classinCourseId,
          error_summary: summarizeError(updateCourseError),
        })
        return NextResponse.json({ error: '回填本地课程失败' }, { status: 500 })
      }
    } else {
      const { data: insertedCourse, error: insertCourseError } = await supabaseServer
        .from('courses')
        .insert({
          ...coursePayload,
          order_id: formalOrderId,
          student_id: order.student_id,
        })
        .select('id')
        .single()

      if (insertCourseError) {
        logger.error('创建 ClassIn 班级失败 - 创建本地课程失败', {
          orderId: formalOrderId,
          classinCourseId,
          error_summary: summarizeError(insertCourseError),
        })
        return NextResponse.json({ error: '创建本地课程失败' }, { status: 500 })
      }

      localCourseId = insertedCourse?.id || null
    }

    const warnings: string[] = []
    for (const student of selectedStudents as any[]) {
      try {
        let studentClassInUid = student.classin_uid
          ? toPositiveClassInId(student.classin_uid, '学生 ClassIn UID')
          : null

        if (!studentClassInUid) {
          const binding = await ensureClassInStudentAccount({
            telephone: student.parent_phone,
            nickname: student.student_name,
          })

          if (!binding.uid) {
            warnings.push(`${student.student_name || student.id} 未绑定 ClassIn：${binding.error || '未知错误'}`)
            continue
          }

          studentClassInUid = binding.uid

          const { error: updateStudentError } = await supabaseServer
            .from('students')
            .update({ classin_uid: studentClassInUid })
            .eq('id', student.id)

          if (updateStudentError) {
            logger.warn('更新学生 classin_uid 失败', {
              studentId: student.id,
              error_summary: summarizeError(updateStudentError),
            })
          }
        }

        await sdk.addCourseStudent({
          courseId: classinCourseId,
          studentUid: studentClassInUid,
          identity: 1,
          studentName: student.student_name,
        })
      } catch (error) {
        logger.warn('添加学生到 ClassIn 课程失败', {
          studentId: student.id,
          classinCourseId,
          error_summary: summarizeError(error),
        })
        warnings.push(`${student.student_name || student.id} 加入 ClassIn 课程失败`)
      }
    }

    logger.info('创建 ClassIn 班级成功', {
      orderId: formalOrderId,
      classinCourseId,
      localCourseId,
      teacherCount: teacherIds.length,
      studentCount: studentIds.length,
      warningCount: warnings.length,
    })

    return NextResponse.json({
      success: true,
      data: {
        course_id: classinCourseId,
        local_course_id: localCourseId,
        course_name: courseName,
        warnings,
      },
    }, { status: 201 })
  } catch (error: unknown) {
    logger.error('创建 ClassIn 班级异常', { error_summary: summarizeError(error) })
    return NextResponse.json(
      { error: '创建 ClassIn 班级失败', code: 'CLASSIN_CLASS_CREATE_FAILED' },
      { status: 500 }
    )
  }
}
