import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { handleDatabaseError } from "@/lib/utils"
import { getClassInSDKService } from "@/lib/services/classin-sdk/service"

const logger = createLogger('API:Teachers')

// GET: 获取老师列表（支持ID查询单个和分页）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    logger.debug('获取老师数据', { id, from, to })

    // 如果提供了ID，查询单个老师
    if (id) {
      const { data, error } = await supabaseServer
        .from('teacher_profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取老师失败', { id, message: error.message, code: error.code })
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      logger.debug('获取老师成功', { id })
      return NextResponse.json({ data })
    }

    // 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('teacher_profiles')
      .select('*', { count: 'exact', head: true })

    // 分页查询数据，按创建时间降序排序
    const { data, error } = await supabaseServer
      .from('teacher_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('获取老师列表失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.debug('获取老师列表成功', { count: data?.length || 0 })
    return NextResponse.json({
      data: data || [],
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取老师异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取老师失败' },
      { status: 500 }
    )
  }
}

/**
 * 创建新老师，并可选注册到 ClassIn 系统
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.debug('创建老师 - 接收到的数据', { body })

    // 后端验证：必填字段
    const requiredFields = ['teacher_name', 'gender', 'wechat', 'classin_phone', 'location', 'subjects', 'grade_levels', 'education', 'university']
    for (const field of requiredFields) {
      if (!body[field] || (Array.isArray(body[field]) && body[field].length === 0)) {
        logger.error(`创建老师失败 - ${field} 为空`, { body })
        return NextResponse.json(
          { error: `${field}不能为空` },
          { status: 400 }
        )
      }
    }

    const insertData = {
      teacher_name: body.teacher_name.trim(),
      gender: body.gender,
      wechat: body.wechat.trim(),
      classin_phone: body.classin_phone.trim(),
      location: body.location.trim(),
      subjects: body.subjects,
      grade_levels: body.grade_levels,
      used_classin: body.used_classin !== undefined ? body.used_classin : false,
      has_certificate: body.has_certificate !== undefined ? body.has_certificate : false,
      education: body.education,
      university: body.university,
      available_times: body.available_times || null,
      textbook_versions: body.textbook_versions || null,
      student_regions: body.student_regions || null,
      student_levels: body.student_levels || null,
      teaching_years: body.teaching_years || null,
      teaching_style: body.teaching_style || null,
      success_cases: body.success_cases || null,
      photo_url: body.photo_url || null,
      review_screenshots: body.review_screenshots || null,
      notes: body.notes || null,
      bank_card_info: body.bank_card_info || null,
    }

    logger.debug('创建老师 - 准备插入的数据', { insertData })

    const { data, error } = await supabaseServer
      .from('teacher_profiles')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('创建老师失败', { message: error.message, code: error.code, details: error.details })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建老师成功', { id: data.id, teacher_name: data.teacher_name })

    // 可选：注册到 ClassIn（参考 /api/teachers/register-classin）
    const registerToClassIn = true
    const classinPassword: string | undefined = "test123456"

    if (registerToClassIn) {
      if (!classinPassword || !insertData.classin_phone) {
        return NextResponse.json(
          { error: '注册到 ClassIn 需要提供 classin_password 且必须有 classin_phone' },
          { status: 400 }
        )
      }

      const sdk = getClassInSDKService()

      try {
        const uid = await sdk.registerTeacher({
          telephone: insertData.classin_phone,
          nickname: insertData.teacher_name,
          password: classinPassword,
        })

        logger.info('ClassIn 老师注册成功', { uid })

        // 保存 ClassIn 映射到主表
        const { error: updateError } = await supabaseServer
          .from('teacher_profiles')
          .update({
            used_classin: true,
            classin_uid: uid,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id)

        if (updateError) {
          logger.error('更新老师 ClassIn UID 失败', { id: data.id, error: updateError })
          return NextResponse.json(
            { error: '注册成功但保存 UID 失败' },
            { status: 500 }
          )
        }

        // 同步到 teacher_classin 表
        try {
          await supabaseServer
            .from('teacher_classin')
            .upsert({
              uid: uid,
              name: insertData.teacher_name,
              mobile: insertData.classin_phone,
              is_del: 0,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'uid'
            })

          logger.info('老师信息同步到 teacher_classin 表成功', { uid })
        } catch (error: any) {
          logger.warn('同步到 teacher_classin 表失败（非致命）', {
            message: error.message
          })
        }

        // 将 uid 回填到响应
        const merged = { ...data, classin_uid: uid, used_classin: true }
        return NextResponse.json({ data: merged }, { status: 201 })
      } catch (err: any) {
        logger.error('注册老师到 ClassIn 异常', { message: err.message, stack: err.stack })
        return NextResponse.json(
          { error: err.message || '注册到 ClassIn 失败' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建老师异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建老师失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新老师
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少老师ID' },
        { status: 400 }
      )
    }

    logger.debug('更新老师 - 接收到的数据', { id, updateData })

    const updatePayload: any = {}
    const optionalFields = [
      'teacher_name', 'gender', 'wechat', 'classin_phone', 'location',
      'subjects', 'grade_levels', 'used_classin', 'has_certificate',
      'education', 'university', 'available_times', 'textbook_versions',
      'student_regions', 'student_levels', 'teaching_years',
      'teaching_style', 'success_cases',
      'photo_url', 'review_screenshots', 'notes', 'bank_card_info'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新老师 - 准备更新的数据', { id, updatePayload })

    const { data, error } = await supabaseServer
      .from('teacher_profiles')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('更新老师失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新老师成功', { id, teacher_name: data.teacher_name })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新老师异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新老师失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除老师
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少老师ID' },
        { status: 400 }
      )
    }

    logger.debug('删除老师', { id })

    const { error } = await supabaseServer
      .from('teacher_profiles')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除老师失败', { id, message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('删除老师成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除老师异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除老师失败' },
      { status: 500 }
    )
  }
}
