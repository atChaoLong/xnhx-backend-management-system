import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { handleDatabaseError } from '@/lib/utils'
import { batchCalculateLeadStatus } from '@/lib/status-calculator'

const logger = createLogger('API:Leads')

// 获取当前用户信息
async function getCurrentUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return null
    }

    const { data: { user }, error } = await supabaseServer.auth.getUser(token)

    if (error || !user) {
      return null
    }

    // 获取用户档案信息
    const { data: profile } = await supabaseServer
      .from('user_profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    // 返回用户姓名
    return profile?.name || user.email?.split('@')[0] || '未知用户'
  } catch (error) {
    logger.error('获取当前用户失败', { error })
    return null
  }
}

// GET: 获取所有线索
export async function GET(request: NextRequest) {
  try {
    logger.debug('获取线索列表')

    // 获取分页参数
    const { searchParams } = new URL(request.url)
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    // 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('leads')
      .select('*', { count: 'exact', head: true })

    // 分页查询数据
    const { data, error } = await supabaseServer
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('获取线索失败', { message: error.message, code: error.code })
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // 计算线索状态
    const leadsWithStatus = []
    if (data && data.length > 0) {
      const statusResults = await batchCalculateLeadStatus(data)

      // 获取所有unique的operator_id
      const operatorIds = Array.from(new Set(data.map(lead => lead.operator_id).filter(Boolean)))
      
      // 批量查询运营人员信息
      let operatorMap = new Map<string, string>()
      if (operatorIds.length > 0) {
        const { data: operators } = await supabaseServer
          .from('user_profiles')
          .select('id, name')
          .in('id', operatorIds)
        
        if (operators) {
          operators.forEach(op => {
            operatorMap.set(op.id, op.name)
          })
        }
      }

      // 合并状态到数据
      for (let i = 0; i < data.length; i++) {
        const lead = data[i]
        const status = statusResults[i]

        leadsWithStatus.push({
          ...lead,
          // 添加状态字段
          add_status: status.addStatus,
          add_status_name: status.addStatusName,
          convert_status: status.convertStatus,
          convert_status_name: status.convertStatusName,
          // 添加运营人员名字
          operator_name: operatorMap.get(lead.operator_id) || lead.operator_id,
        })
      }
    }

    logger.info('获取线索成功', { count: leadsWithStatus.length || 0 })
    return NextResponse.json({
      data: leadsWithStatus,
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error('获取线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取线索失败' },
      { status: 500 }
    )
  }
}

// POST: 创建新线索
export async function POST(request: NextRequest) {
  try {
    const leadData = await request.json()

    // 获取当前用户
    const currentUser = await getCurrentUser(request)

    logger.info('创建新线索', {
      orderSerial: leadData.report_number,
      sourceAccount: leadData.xhs_source,
      createdBy: currentUser,
    })

    const { data, error } = await supabaseServer
      .from('leads')
      .insert({
        ...leadData,
        // 确保日期格式正确
        entry_date: leadData.entry_date || new Date().toISOString().split('T')[0],
        // 记录创建人和更新人信息
        created_by: currentUser,
        updated_by: currentUser,
      })
      .select()
      .single()

    if (error) {
      logger.error('创建线索失败', { message: error.message, code: error.code })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('创建线索成功', { leadId: data.id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('创建线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建线索失败' },
      { status: 500 }
    )
  }
}

// PUT: 更新线索
export async function PUT(request: NextRequest) {
  try {
    const leadData = await request.json()

    if (!leadData.id) {
      logger.warn('更新线索缺少 ID')
      return NextResponse.json(
        { error: '线索 ID 必填' },
        { status: 400 }
      )
    }

    // 获取当前用户
    const currentUser = await getCurrentUser(request)

    logger.info('更新线索', {
      leadId: leadData.id,
      updatedBy: currentUser,
    })

    const { data, error } = await supabaseServer
      .from('leads')
      .update({
        ...leadData,
        updated_at: new Date().toISOString(),
        // 记录更新人信息
        updated_by: currentUser,
      })
      .eq('id', leadData.id)
      .select()
      .single()

    if (error) {
      logger.error('更新线索失败', {
        leadId: leadData.id,
        message: error.message,
        code: error.code,
      })
      const { message, status } = handleDatabaseError(error)
      return NextResponse.json({ error: message }, { status })
    }

    logger.info('更新线索成功', { leadId: data.id })
    return NextResponse.json({ data })
  } catch (error: any) {
    logger.error('更新线索异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '更新线索失败' },
      { status: 500 }
    )
  }
}
