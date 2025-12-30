/**
 * 初始化超级管理员
 * 用于系统中第一次创建超级管理员账号
 * 注意：此接口应该在系统初始化后立即使用，使用后应删除或禁用
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseServer } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Init:Admin')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, full_name } = body

    // 验证必填字段
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码为必填项' },
        { status: 400 }
      )
    }

    logger.info('开始创建超级管理员', { email, full_name })

    // 检查是否已经存在超级管理员
    const { data: existingAdmins, error: checkError } = await supabaseServer
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin')

    if (checkError) {
      logger.error('检查现有管理员失败', { error: checkError.message })
      return NextResponse.json(
        { error: '检查现有管理员失败' },
        { status: 500 }
      )
    }

    if (existingAdmins && existingAdmins.length > 0) {
      logger.warn('超级管理员已存在', { count: existingAdmins.length })
      return NextResponse.json(
        {
          error: '超级管理员已存在',
          count: existingAdmins.length,
          hint: '如需重置管理员账号，请直接在数据库中操作'
        },
        { status: 400 }
      )
    }

    // 使用 Supabase Admin API 创建用户
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: full_name || email.split('@')[0],
        role: 'admin',
      },
    })

    if (createError || !user) {
      logger.error('创建用户失败', { error: createError?.message })
      return NextResponse.json(
        { error: createError?.message || '创建用户失败' },
        { status: 500 }
      )
    }

    // 创建用户档案
    // 策略：先检查是否已存在该 ID 的 profile，如果有则删除
    // 然后直接使用 supabaseAdmin 插入（绕过 RLS）

    logger.info('检查并清理可能存在的旧 profile', { userId: user.id })

    // 1. 检查是否已存在该 ID 的 profile
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existingProfile) {
      logger.warn('发现已存在的 profile，准备删除', { userId: user.id })
      await supabaseAdmin
        .from('user_profiles')
        .delete()
        .eq('id', user.id)
      logger.info('旧 profile 已删除', { userId: user.id })
    }

    // 2. 使用 supabaseAdmin 创建 profile（绕过 RLS）
    logger.info('创建 user_profile', { userId: user.id, email })
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: user.id,
        username: email.split('@')[0],
        name: full_name || email.split('@')[0],
        email: email,
        role: 'admin',
        team_name: '小牛好学',
        is_active: true,
      })

    if (profileError) {
      logger.error('创建用户档案失败', {
        error: profileError.message,
        code: profileError.code,
        userId: user.id
      })
      // 删除已创建的用户
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      return NextResponse.json(
        { error: `创建用户档案失败: ${profileError.message}` },
        { status: 500 }
      )
    }

    logger.info('超级管理员创建成功', {
      userId: user.id,
      email: user.email,
    })

    return NextResponse.json({
      success: true,
      message: '超级管理员创建成功',
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: full_name || email.split('@')[0],
        },
      },
      instructions: [
        '请保存好管理员账号信息',
        '建议首次登录后立即修改密码',
        '创建完成后应删除或禁用此初始化接口',
      ],
    })

  } catch (error: any) {
    logger.error('初始化管理员异常', { message: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message || '创建超级管理员失败' },
      { status: 500 }
    )
  }
}

// GET 方法返回初始化状态
export async function GET() {
  try {
    // 检查是否已存在超级管理员
    const { data: existingAdmins, error } = await supabaseServer
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin')

    if (error) {
      return NextResponse.json(
        { error: '检查管理员状态失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      initialized: existingAdmins && existingAdmins.length > 0,
      adminCount: existingAdmins?.length || 0,
      message: existingAdmins && existingAdmins.length > 0
        ? '超级管理员已初始化'
        : '尚未初始化超级管理员',
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '检查失败' },
      { status: 500 }
    )
  }
}
