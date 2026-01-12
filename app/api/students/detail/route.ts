import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:Students:Detail')

// GET: 获取学生详情（包含所有相关数据）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('id')

    if (!studentId) {
      return NextResponse.json(
        { error: '学生ID必填' },
        { status: 400 }
      )
    }

    logger.debug('获取学生详情', { studentId })

    // 1. 获取学生基本信息
    const { data: student, error: studentError } = await supabaseServer
      .from('students')
      .select(`
        id,
        created_at,
        updated_at,
        student_code,
        student_name,
        grade_code,
        region,
        school,
        parent_phone,
        head_teacher_id,
        status,
        classin_initial_password,
        classin_uid
      `)
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      logger.error('获取学生信息失败', { studentId, message: studentError?.message })
      return NextResponse.json(
        { error: studentError?.message || '学生不存在' },
        { status: 404 }
      )
    }

    // 2. 获取班主任信息
    let headTeacher = null
    if (student.head_teacher_id) {
      const { data: teacher } = await supabaseServer
        .from('user_profiles')
        .select('id, name, email, phone')
        .eq('id', student.head_teacher_id)
        .single()

      if (teacher) {
        headTeacher = teacher
      }
    }

    // 3. 获取正式订单列表
    const { data: formalOrders, error: formalOrdersError } = await supabaseServer
      .from('formal_orders')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (formalOrdersError) {
      logger.warn('获取正式订单失败', { studentId, message: formalOrdersError.message })
    }

    // 4. 获取试听课列表
    const { data: trialLessons, error: trialLessonsError } = await supabaseServer
      .from('trial_lessons')
      .select('*')
      .eq('phone', student.parent_phone || '')
      .order('created_at', { ascending: false })

    if (trialLessonsError) {
      logger.warn('获取试听课失败', { studentId, message: trialLessonsError.message })
    }

    // 5. 获取 ClassIn 课堂记录（通过学生手机号关联）
    const { data: classrooms, error: classroomsError } = await supabaseServer
      .from('classroom_classin')
      .select('*')
      .ilike('student_account', student.parent_phone || '')
      .order('start_time', { ascending: false })
      .limit(50)

    if (classroomsError) {
      logger.warn('获取ClassIn课堂记录失败', { studentId, message: classroomsError.message })
    }

    // 组装返回数据
    const detailData = {
      student: {
        ...student,
        head_teacher: headTeacher,
      },
      orders: formalOrders || [],
      trialLessons: trialLessons || [],
      classrooms: classrooms || [],
      // 统计信息
      stats: {
        formalOrdersCount: formalOrders?.length || 0,
        trialLessonsCount: trialLessons?.length || 0,
        classroomsCount: classrooms?.length || 0,
        totalFormalHours: formalOrders?.reduce((sum, order) => sum + (order.total_hours || 0), 0) || 0,
        totalFormalAmount: formalOrders?.reduce((sum, order) => sum + (order.payment_amount || 0), 0) || 0,
      },
    }

    logger.debug('获取学生详情成功', { studentId })
    return NextResponse.json({ data: detailData })

  } catch (error: any) {
    logger.error('获取学生详情异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取学生详情失败' },
      { status: 500 }
    )
  }
}
