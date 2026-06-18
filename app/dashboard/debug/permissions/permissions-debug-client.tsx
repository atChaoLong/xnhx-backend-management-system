"use client"

import { usePermission } from "@/lib/hooks/usePermission"
import { ROLES, RESOURCES, ACTIONS } from "@/lib/permissions"

export function PermissionsDebugClient() {
  const { user, role, checkPermission, leads, isLoading } = usePermission()

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">权限调试页面</h1>
        <div className="p-4 bg-gray-100 rounded">
          <p>正在加载用户信息...</p>
        </div>
      </div>
    )
  }

  if (role !== "admin") {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">无权访问</h1>
        <div className="p-4 bg-gray-100 rounded text-sm text-muted-foreground">
          权限调试页面仅限管理员在调试环境中使用。
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">权限调试页面</h1>

      <section className="mb-8 p-4 bg-blue-50 rounded">
        <h2 className="text-lg font-semibold mb-2">用户信息</h2>
        {user ? (
          <div className="space-y-1">
            <p><strong>ID:</strong> {user.id}</p>
            <p><strong>邮箱:</strong> {user.email ? "已配置" : "未配置"}</p>
            <p><strong>姓名:</strong> {user.name}</p>
            <p><strong>角色:</strong> <span className="font-mono bg-blue-100 px-2 py-1 rounded">{user.role || "undefined"}</span></p>
          </div>
        ) : (
          <p className="text-red-600">用户未登录</p>
        )}
      </section>

      <section className="mb-8 p-4 bg-green-50 rounded">
        <h2 className="text-lg font-semibold mb-2">权限检查</h2>
        <div className="space-y-2">
          <p><strong>Role:</strong> <span className="font-mono bg-green-100 px-2 py-1 rounded">{role || "undefined"}</span></p>

          <div className="mt-4">
            <h3 className="font-medium mb-2">线索权限测试:</h3>
            <ul className="space-y-1 ml-4">
              <li>leads.view(): {leads.view() ? "有权限" : "无权限"}</li>
              <li>leads.create(): {leads.create() ? "有权限" : "无权限"}</li>
              <li>leads.edit(): {leads.edit() ? "有权限" : "无权限"}</li>
              <li>leads.delete(): {leads.delete() ? "有权限" : "无权限"}</li>
              <li>leads.feedback(): {leads.feedback() ? "有权限" : "无权限"}</li>
            </ul>
          </div>

          <div className="mt-4">
            <h3 className="font-medium mb-2">直接调用 checkPermission:</h3>
            <ul className="space-y-1 ml-4">
              <li>
                checkPermission(leads, view):{" "}
                {checkPermission(RESOURCES.leads, ACTIONS.view) ? "通过" : "拒绝"}
              </li>
              <li>
                checkPermission(leads, create):{" "}
                {checkPermission(RESOURCES.leads, ACTIONS.create) ? "通过" : "拒绝"}
              </li>
              <li>
                checkPermission(leads, edit):{" "}
                {checkPermission(RESOURCES.leads, ACTIONS.edit) ? "通过" : "拒绝"}
              </li>
            </ul>
          </div>
        </div>
      </section>

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

      <section className="p-4 bg-gray-50 rounded">
        <h2 className="text-lg font-semibold mb-2">调试信息</h2>
        <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-x-auto text-sm">
          {JSON.stringify({
            user: user ? {
              id: user.id,
              hasEmail: Boolean(user.email),
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
    </div>
  )
}
