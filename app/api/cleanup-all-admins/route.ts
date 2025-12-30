/**
 * 清理所有 admin 用户
 * POST /api/cleanup-test-admins
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const logger = createLogger('Cleanup:Admins')

export async function POST() {
  try {
    logger.info('开始清理所有 admin 用户')

    // 查找所有 role = 'admin' 的用户
    const { data: allAdmins, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, name, role')
      .eq('role', 'admin')

    if (error) {
      logger.error('查询 admin 用户失败', { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!allAdmins || allAdmins.length === 0) {
      logger.info('没有找到 admin 用户')
      return NextResponse.json({
        success: true,
        message: '没有找到 admin 用户',
        deleted: 0,
        users: []
      })
    }

    logger.info('找到 admin 用户', { count: allAdmins.length })

    // 删除这些用户
    const deletedUsers = []
    for (const admin of allAdmins) {
      logger.info('正在删除 admin 用户', {
        id: admin.id,
        email: admin.email,
        name: admin.name
      })

      try {
        // 1. 删除 user_profiles
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .delete()
          .eq('id', admin.id)

        if (profileError) {
          logger.warn('删除 user_profiles 失败', {
            userId: admin.id,
            error: profileError.message
          })
        }

        // 2. 删除 auth.users
        const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(admin.id)

        if (userError) {
          logger.warn('删除 auth.users 失败', {
            userId: admin.id,
            error: userError.message
          })
        }

        if (!profileError && !userError) {
          deletedUsers.push({
            id: admin.id,
            email: admin.email,
            name: admin.name
          })
        }
      } catch (err: any) {
        logger.error('删除用户异常', {
          userId: admin.id,
          error: err.message
        })
      }
    }

    logger.info('清理完成', {
      total: allAdmins.length,
      deleted: deletedUsers.length
    })

    return NextResponse.json({
      success: true,
      message: `已删除 ${deletedUsers.length}/${allAdmins.length} 个 admin 用户`,
      total: allAdmins.length,
      deleted: deletedUsers.length,
      failed: allAdmins.length - deletedUsers.length,
      users: deletedUsers.map(u => `${u.email} (${u.name})`)
    })

  } catch (error: any) {
    logger.error('清理 admin 用户失败', { error: error.message, stack: error.stack })
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
