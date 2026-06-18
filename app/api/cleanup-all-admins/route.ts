/**
 * 清理所有 admin 用户
 * POST /api/cleanup-test-admins
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'
import { checkPermission } from '@/lib/middleware'
import { ACTIONS, RESOURCES } from '@/lib/permissions'

const logger = createLogger('Cleanup:Admins')

function isAdminResetApiEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_ADMIN_RESET_API === 'true'
}

export async function POST(request: NextRequest) {
  if (!isAdminResetApiEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return checkPermission(request, RESOURCES.users, ACTIONS.delete, async () => {
    try {
      logger.info('开始清理所有 admin 用户')

      // 查找所有 role = 'admin' 的用户，只读取删除所需 ID。
      const { data: allAdmins, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')

      if (error) {
        logger.error('查询 admin 用户失败', { error_summary: summarizeError(error) })
        return NextResponse.json({ error: '查询 admin 用户失败' }, { status: 500 })
      }

      if (!allAdmins || allAdmins.length === 0) {
        logger.info('没有找到 admin 用户')
        return NextResponse.json({
          success: true,
          message: '没有找到 admin 用户',
          deleted: 0,
        })
      }

      logger.info('找到 admin 用户', { count: allAdmins.length })

      // 删除这些用户
      let deletedCount = 0
      for (const admin of allAdmins) {
        logger.info('正在删除 admin 用户', {
          id: admin.id,
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
              error_summary: summarizeError(profileError)
            })
          }

          // 2. 删除 auth.users
          const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(admin.id)

          if (userError) {
            logger.warn('删除 auth.users 失败', {
              userId: admin.id,
              error_summary: summarizeError(userError)
            })
          }

          if (!profileError && !userError) {
            deletedCount += 1
          }
        } catch (err: any) {
          logger.error('删除用户异常', {
            userId: admin.id,
            error_summary: summarizeError(err)
          })
        }
      }

      logger.info('清理完成', {
        total: allAdmins.length,
        deleted: deletedCount
      })

      return NextResponse.json({
        success: true,
        message: `已删除 ${deletedCount}/${allAdmins.length} 个 admin 用户`,
        total: allAdmins.length,
        deleted: deletedCount,
        failed: allAdmins.length - deletedCount
      })

    } catch (error: any) {
      logger.error('清理 admin 用户失败', summarizeError(error))
      return NextResponse.json(
        { error: '清理 admin 用户失败' },
        { status: 500 }
      )
    }
  })
}
