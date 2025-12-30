'use client'

import { useApp } from '@/lib/app-context'
import { usePermission } from '@/lib/hooks/usePermission'
import { ROLES, RESOURCES, ACTIONS } from '@/lib/permissions'

export default function DebugPermissionsPage() {
  const { user } = useApp()
  const { role, checkPermission, leads, isLoading } = usePermission()

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">权限调试页面</h1>

      {isLoading ? (
        <div className="p-4 bg-gray-100 rounded">
          <p>⏳ 正在加载用户信息...</p>
        </div>
      ) : (
        <>
          {/* 用户信息 */}
          <section className="mb-8 p-4 bg-blue-50 rounded">
        <h2 className="text-lg font-semibold mb-2">用户信息</h2>
        {user ? (
          <div className="space-y-1">
            <p><strong>ID:</strong> {user.id}</p>
            <p><strong>邮箱:</strong> {user.email}</p>
            <p><strong>姓名:</strong> {user.name}</p>
            <p><strong>角色:</strong> <span className="font-mono bg-blue-100 px-2 py-1 rounded">{user.role || 'undefined'}</span></p>
          </div>
        ) : (
          <p className="text-red-600">❌ 用户未登录</p>
        )}
      </section>

      {/* 权限检查结果 */}
      <section className="mb-8 p-4 bg-green-50 rounded">
        <h2 className="text-lg font-semibold mb-2">权限检查</h2>
        <div className="space-y-2">
          <p><strong>Role:</strong> <span className="font-mono bg-green-100 px-2 py-1 rounded">{role || 'undefined'}</span></p>

          <div className="mt-4">
            <h3 className="font-medium mb-2">线索权限测试:</h3>
            <ul className="space-y-1 ml-4">
              <li>leads.view(): {leads.view() ? '✅ 有权限' : '❌ 无权限'}</li>
              <li>leads.create(): {leads.create() ? '✅ 有权限' : '❌ 无权限'}</li>
              <li>leads.edit(): {leads.edit() ? '✅ 有权限' : '❌ 无权限'}</li>
              <li>leads.delete(): {leads.delete() ? '✅ 有权限' : '❌ 无权限'}</li>
              <li>leads.feedback(): {leads.feedback() ? '✅ 有权限' : '❌ 无权限'}</li>
            </ul>
          </div>

          <div className="mt-4">
            <h3 className="font-medium mb-2">直接调用 checkPermission:</h3>
            <ul className="space-y-1 ml-4">
              <li>
                checkPermission(leads, view):{' '}
                {checkPermission(RESOURCES.leads, ACTIONS.view) ? '✅' : '❌'}
              </li>
              <li>
                checkPermission(leads, create):{' '}
                {checkPermission(RESOURCES.leads, ACTIONS.create) ? '✅' : '❌'}
              </li>
              <li>
                checkPermission(leads, edit):{' '}
                {checkPermission(RESOURCES.leads, ACTIONS.edit) ? '✅' : '❌'}
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 所有可用角色 */}
      <section className="mb-8 p-4 bg-yellow-50 rounded">
        <h2 className="text-lg font-semibold mb-2">系统角色列表</h2>
        <ul className="space-y-1 ml-4">
          {Object.entries(ROLES).map(([key, value]) => (
            <li key={key}>
              <code>{key}</code>: <span className="font-mono bg-yellow-100 px-2 py-1 rounded">{value}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 调试信息 */}
      <section className="p-4 bg-gray-50 rounded">
        <h2 className="text-lg font-semibold mb-2">调试信息</h2>
        <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-x-auto text-sm">
          {JSON.stringify({
            user: user ? {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role
            } : null,
            roleFromHook: role,
            permissions: {
              leads: {
                view: leads.view(),
                create: leads.create(),
                edit: leads.edit(),
                delete: leads.delete(),
                feedback: leads.feedback(),
              }
            }
          }, null, 2)}
        </pre>
      </section>

      {/* 快速修复建议 */}
      <section className="mt-8 p-4 bg-orange-50 border border-orange-200 rounded">
        <h2 className="text-lg font-semibold mb-2">如果权限不工作</h2>
        <ol className="list-decimal ml-5 space-y-2">
          <li>检查是否已登录（查看上方用户信息）</li>
          <li>检查用户角色是否在 <code>user_profiles</code> 表中正确设置</li>
          <li>确保角色值是以下之一：
            <ul className="list-disc ml-5 mt-1">
              <li>admin (超级管理员)</li>
              <li>operator (运营人员)</li>
              <li>sales (销售顾问)</li>
              <li>head_teacher (班主任)</li>
              <li>teacher (教师)</li>
              <li>academic_affairs (教务)</li>
              <li>finance (财务)</li>
              <li>hr (人事)</li>
            </ul>
          </li>
          <li>打开浏览器控制台查看警告信息</li>
          <li>刷新页面重新加载用户信息</li>
        </ol>
      </section>
        </>
      )}
    </div>
  )
}
