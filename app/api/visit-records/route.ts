import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:VisitRecords')

// GET: 获取回访记录列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('student_id')
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    logger.debug('获取回访记录', { studentId, from, to })

    let query = supabaseServer
      .from('visit_records')
      .select('*')

    // 如果指定了学生ID，添加过滤条件
    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    // 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('visit_records')
      .select('*', { count: 'exact', head: true })

    // 获取数据
    query = query.order('visit_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
    const { data, error } = await query

    if (error) {
      logger.error('获取回访记录失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.debug('获取回访记录成功', { count: data?.length || 0 })
    return NextResponse.json({
      data: data || [],
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取回访记录异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取回访记录失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新回访记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    logger.debug('创建回访记录 - 接收到的数据', { body })

    // 后端验证：必填字段
    if (!body.student_id || typeof body.student_id !== 'string') {
      logger.error('创建回访记录失败 - 学生ID为空', { body })
      return NextResponse.json(
        { error: '学生ID不能为空' },
        { status: 400 }
      )
    }

    if (!body.visit_date) {
      logger.error('创建回访记录失败 - 回访日期为空', { body })
      return NextResponse.json(
        { error: '回访日期不能为空' },
        { status: 400 }
      )
    }

    if (!body.visit_method || typeof body.visit_method !== 'string') {
      logger.error('创建回访记录失败 - 回访方式为空', { body })
      return NextResponse.json(
        { error: '回访方式不能为空' },
        { status: 400 }
      )
    }

    if (!body.visit_notes || typeof body.visit_notes !== 'string' || !body.visit_notes.trim()) {
      logger.error('创建回访记录失败 - 回访备注为空', { body })
      return NextResponse.json(
        { error: '回访备注不能为空' },
        { status: 400 }
      )
    }

    // 获取当前用户
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const insertData = {
      student_id: body.student_id,
      visit_date: body.visit_date,
      visit_method: body.visit_method,
      parent_attitude: body.parent_attitude || null,
      visit_notes: body.visit_notes.trim(),
      visit_personnel: user.id,
      next_visit_date: body.next_visit_date || null,
    }

    logger.debug('创建回访记录 - 准备插入的数据', { insertData })

    const { data, error } = await supabaseServer
      .from('visit_records')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('创建回访记录失败', { message: error.message, code: error.code, details: error.details })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('创建回访记录成功', { id: data.id })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    logger.error('创建回访记录异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建回访记录失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新回访记录
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: '缺少回访记录ID' },
        { status: 400 }
      )
    }

    logger.debug('更新回访记录 - 接收到的数据', { id, updateData })

    const updatePayload: any = {}
    const optionalFields = [
      'visit_date', 'visit_method',
      'parent_attitude', 'visit_notes',
      'next_visit_date'
    ]

    optionalFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatePayload[field] = updateData[field]
      }
    })

    logger.debug('更新回访记录 - 准备更新的数据', { id, updatePayload })

    const { data, error } = await supabaseServer
      .from('visit_records')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('更新回访记录失败', { id, message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('更新回访记录成功', { id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新回访记录异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新回访记录失败' },
      { status: 500 }
    )
  }
}

// DELETE: 删除回访记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: '缺少回访记录ID' },
        { status: 400 }
      )
    }

    logger.debug('删除回访记录', { id })

    const { error } = await supabaseServer
      .from('visit_records')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('删除回访记录失败', { id, message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    logger.info('删除回访记录成功', { id })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('删除回访记录异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '删除回访记录失败' },
      { status: 500 }
    )
  }
}
