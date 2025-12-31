/**
 * 获取用户档案列表
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:UserProfiles')

export async function GET(request: NextRequest) {
  try {
    // 获取所有用户档案
    const { data: profiles, error } = await supabaseServer
      .from('user_profiles')
      .select('id, email, name, role, avatar_url, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('获取用户档案失败', { error: error.message })
      return NextResponse.json(
        { error: '获取用户档案失败' },
        { status: 500 }
      )
    }

    logger.info('获取用户档案成功', { count: profiles?.length || 0 })

    return NextResponse.json({
      data: profiles || [],
    })
  } catch (error: any) {
    logger.error('获取用户档案异常', { error: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '获取用户档案失败' },
      { status: 500 }
    )
  }
}
