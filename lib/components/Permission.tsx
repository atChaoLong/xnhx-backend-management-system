/**
 * 权限控制组件
 * 用于在 React 组件中根据权限渲染内容
 */

'use client'

import React from 'react'
import { usePermission } from '@/lib/hooks/usePermission'
import { RESOURCES, ACTIONS, Resource, Action } from '@/lib/permissions'

/**
 * 单个权限控制组件 Props
 */
interface PermissionProps {
  resource: Resource
  action: Action
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * 权限控制组件
 * 只有当用户有权限时才渲染 children
 */
export function Permission({ resource, action, fallback = null, children }: PermissionProps) {
  const { checkPermission } = usePermission()

  if (checkPermission(resource, action)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}

/**
 * 多个权限控制组件 Props（满足任意一个即可）
 */
interface PermissionAnyProps {
  permissions: Array<{ resource: Resource; action: Action }>
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * 权限控制组件（多个权限，满足任意一个即可）
 */
export function PermissionAny({ permissions, fallback = null, children }: PermissionAnyProps) {
  const { checkAnyPermission } = usePermission()

  if (checkAnyPermission(permissions)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
