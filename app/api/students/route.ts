import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:Students')

// GET: 获取学生列表（支持ID查询单个）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    logger.debug('获取学生数据', { id })

    // 如果提供了ID，查询单个学生
    if (id) {
      const { data, error } = await supabaseServer
        .from('students')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        logger.error('获取学生失败', { id, message: error.message, code: error.code })
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      logger.debug('获取学生成功', { id })
      return NextResponse.json({ data })
    }

    // 否则获取所有学生
    const { data, error } = await supabaseServer
      .from('students')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('获取学生列表失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.debug('获取学生列表成功', { count: data?.length || 0 })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('获取学生异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取学生失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新学生
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.debug('创建学生 - 接收到的数据', { body, student_name: body?.student_name, student_name_type: typeof body?.student_name })

    // 后端验证：学生姓名必填
    if (!body.student_name || typeof body.student_name !== 'string' || !body.student_name.trim()) {
      logger.error('创建学生失败 - 学生姓名为空', { body })
      return NextResponse.json(
        { error: '学生姓名不能为空' },
        { status: 400 }
      )
    }

    const insertData = {
      student_number: body.student_number?.trim() || null,
      student_name: body.student_name.trim(),
      grade_code: body.grade_code || null,
      region: body.region || null,
      school: body.school?.trim() || null,
      parent_phone: body.parent_phone?.trim() || null,
      head_teacher_id: body.head_teacher_id || null,
      status: body.status || 'active',
    }

    logger.debug('创建学生 - 准备插入的数据', { insertData })

    const { data, error } = await supabaseServer
      .from('students')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('创建学生失败', { message: error.message, code: error.code, details: error.details })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('创建学生成功', { id: data.id, student_name: data.student_name })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建学生异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建学生失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新学生
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少学生ID' },
        { status: 400 }
      )
    }

    logger.debug('更新学生 - 接收到的数据', { id, updateData, student_name: updateData?.student_name })

    // 后端验证：学生姓名必填
    if (!updateData.student_name || typeof updateData.student_name !== 'string' || !updateData.student_name.trim()) {
      logger.error('更新学生失败 - 学生姓名为空', { id, updateData })
      return NextResponse.json(
        { error: '学生姓名不能为空' },
        { status: 400 }
      )
    }

    const updatePayload = {
      student_number: updateData.student_number?.trim() || null,
      student_name: updateData.student_name.trim(),
      grade_code: updateData.grade_code || null,
      region: updateData.region || null,
      school: updateData.school?.trim() || null,
      parent_phone: updateData.parent_phone?.trim() || null,
      head_teacher_id: updateData.head_teacher_id || null,
      status: updateData.status || 'active',
    }

    logger.debug('更新学生 - 准备更新的数据', { id, updatePayload })

    const { data, error } = await supabaseServer
      .from('students')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('更新学生失败', { id, message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('更新学生成功', { id, student_name: data.student_name })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新学生异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新学生失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除学生
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少学生ID' },
        { status: 400 }
      )
    }

    logger.debug('删除学生', { id })

    const { error } = await supabaseServer
      .from('students')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除学生失败', { id, message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('删除学生成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除学生异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除学生失败' },
      { status: 500 }
    )
  }
}
