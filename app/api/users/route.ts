/**
 * 用户管理 API
 * GET: 获取所有用户列表（包含角色信息）
 * POST: 创建新用户（同时创建auth.users和user_profiles）
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'

const logger = createLogger('API:Users')

// 验证用户是否为超级管理员
async function isAdmin(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string }> {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return { isAdmin: false }
    }

    const { data: { user }, error } = await supabaseServer.auth.getUser(token)

    if (error || !user) {
      return { isAdmin: false }
    }

    // 查询用户角色（直接用 id = auth.uid）
    const { data: profile } = await supabaseServer
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)  // 使用 id 而不是 user_id
      .single()

    return {
      isAdmin: profile?.role === 'admin',
      userId: user.id
    }
  } catch (error) {
    console.error('验证管理员权限失败:', error)
    return { isAdmin: false }
  }
}

/**
 * GET /api/users
 * 获取所有用户列表（包含角色信息）
 */
export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const { isAdmin: isAdminUser } = await isAdmin(request)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: '权限不足，只有超级管理员可以查看用户列表' },
        { status: 403 }
      )
    }

    // 获取所有用户及其角色信息
    const { data: users, error } = await supabaseServer
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('获取用户列表失败:', error)
      return NextResponse.json(
        { error: '获取用户列表失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: users || [],
    })

  } catch (error: any) {
    console.error('获取用户列表错误:', error)
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * 创建新用户（同时创建auth.users和user_profiles）
 */
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const { isAdmin: isAdminUser, userId: adminUserId } = await isAdmin(request)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: '权限不足，只有超级管理员可以创建用户' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, password, phone, name, role, team_name } = body

    // 验证必填字段
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: '账号/邮箱、密码和角色为必填项' },
        { status: 400 }
      )
    }

    // 处理账号或邮箱
    // 如果输入包含 @，当作邮箱直接使用
    // 如果不包含 @，当作账号，自动拼接成 @xiaoniuhaoxue.com
    let finalEmail = email
    if (!email.includes('@')) {
      finalEmail = `${email}@xiaoniuhaoxue.com`
      logger.info('账号转邮箱', { account: email, email: finalEmail })
    }

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度不能少于6位' },
        { status: 400 }
      )
    }

    // 验证角色是否有效
    const validRoles = ['admin', 'operator', 'sales', 'head_teacher', 'teacher', 'academic_affairs', 'finance', 'hr']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `无效的角色，必须是以下之一: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    logger.info('创建用户', { email: finalEmail, role, name })

    // 创建用户（使用 admin API client）
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true, // 自动确认邮箱
      user_metadata: {
        name: name || finalEmail.split('@')[0],
        role: role,
      },
    })

    if (createError || !user) {
      console.error('创建用户失败:', createError)
      return NextResponse.json(
        { error: createError?.message || '创建用户失败' },
        { status: 500 }
      )
    }

    // 创建用户档案
    // 策略：直接使用 supabaseAdmin 插入（绕过 RLS），避免重复插入问题
    logger.info('创建 user_profile', { userId: user.id, email: finalEmail })

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
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: user.id,
        username: finalEmail.split('@')[0],
        name: name || finalEmail.split('@')[0],
        email: finalEmail,
        phone: phone || null,
        role: role,
        team_name: team_name || null,
        is_active: true,
      })
      .select('*')
      .single()

    if (profileError) {
      logger.error('创建用户档案失败', {
        error: profileError.message,
        code: profileError.code,
        userId: user.id
      })
      // 删除已创建的认证用户
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      return NextResponse.json(
        { error: `创建用户档案失败: ${profileError.message}` },
        { status: 500 }
      )
    }

    // 若角色为教师或班主任，自动注册到 ClassIn 并写回 uid
    if (role === 'teacher' || role === 'head_teacher') {
      try {
        const telephone = phone || null
        const nickname = (name && name.trim()) || finalEmail.split('@')[0]
        const classinPassword = password

        if (!telephone) {
          logger.warn('教师/班主任缺少手机号，跳过 ClassIn 注册', { userId: user.id })
        } else {
          const sdk = getClassInSDKService()
          const uid = await sdk.registerTeacher({
            telephone,
            nickname,
            password: classinPassword,
          })

          const { error: uidUpdateError } = await supabaseAdmin
            .from('user_profiles')
            .update({
              classin_uid: uid,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)

          if (uidUpdateError) {
            logger.warn('ClassIn UID 写回失败（非致命）', { userId: user.id, message: uidUpdateError.message })
          } else {
            logger.info('ClassIn 教师注册成功并写回 UID', { userId: user.id, uid })
          }
        }
      } catch (e: any) {
        logger.warn('ClassIn 教师注册失败（用户已创建）', { userId: user.id, message: e?.message })
      }
    }

    // 记录操作日志
    await supabaseServer.from('admin_operation_logs').insert({
      operator_id: adminUserId,
      target_user_id: user.id,
      operation: 'create_user',
      details: {
        email,
        role: role,
      },
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      data: {
        user_id: user.id,
        profile: profileData,
      },
      message: '用户创建成功',
    }, { status: 201 })

  } catch (error: any) {
    console.error('创建用户错误:', error)
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/users
 * 更新用户档案信息
 */
export async function PUT(request: NextRequest) {
  try {
    // 验证管理员权限
    const { isAdmin: isAdminUser, userId: adminUserId } = await isAdmin(request)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: '权限不足，只有超级管理员可以更新用户' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, name, role, phone, wechat, team_name, is_active } = body

    if (!id) {
      return NextResponse.json(
        { error: '用户ID不能为空' },
        { status: 400 }
      )
    }

    // 如果更新角色，验证角色是否有效
    if (role) {
      const validRoles = ['admin', 'operator', 'sales', 'head_teacher', 'teacher', 'academic_affairs', 'finance', 'hr']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `无效的角色，必须是以下之一: ${validRoles.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // 更新用户档案
    const { data: profile, error: updateError } = await supabaseServer
      .from('user_profiles')
      .update({
        name,
        role,
        phone,
        wechat,
        team_name,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)  // 使用 id 而不是 user_id
      .select('*')
      .single()

    if (updateError) {
      console.error('更新用户失败:', updateError)
      return NextResponse.json(
        { error: '更新用户失败' },
        { status: 500 }
      )
    }

    // 记录操作日志
    await supabaseServer.from('admin_operation_logs').insert({
      operator_id: adminUserId,
      target_user_id: id,
      operation: 'update_user',
      details: {
        updated_fields: Object.keys(body).filter(key => key !== 'id'),
      },
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      data: profile,
      message: '用户更新成功',
    })

  } catch (error: any) {
    console.error('更新用户错误:', error)
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users
 * 删除用户（同时删除auth.users和user_profiles）
 */
export async function DELETE(request: NextRequest) {
  try {
    // 验证管理员权限
    const { isAdmin: isAdminUser, userId: adminUserId } = await isAdmin(request)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: '权限不足，只有超级管理员可以删除用户' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json(
        { error: '用户ID不能为空' },
        { status: 400 }
      )
    }

    // 不允许删除自己
    if (adminUserId === userId) {
      return NextResponse.json(
        { error: '不能删除自己的账号' },
        { status: 400 }
      )
    }

    // 先删除认证用户（使用 admin API）
    logger.info('删除认证用户', { userId })
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      logger.error('删除认证用户失败', { error: authDeleteError.message, userId })
      console.error('删除认证用户失败:', authDeleteError)
      return NextResponse.json(
        { error: '删除认证用户失败' },
        { status: 500 }
      )
    }

    // 删除用户档案
    logger.info('删除用户档案', { userId })
    const { error: profileDeleteError } = await supabaseServer
      .from('user_profiles')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      logger.error('删除用户档案失败', { error: profileDeleteError.message, userId })
      console.error('删除用户档案失败:', profileDeleteError)
      return NextResponse.json(
        { error: '删除用户档案失败' },
        { status: 500 }
      )
    }

    // 记录操作日志
    await supabaseServer.from('admin_operation_logs').insert({
      operator_id: adminUserId,
      target_user_id: userId,
      operation: 'delete_user',
      details: {},
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      message: '用户删除成功',
    })

  } catch (error: any) {
    console.error('删除用户错误:', error)
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    )
  }
}
