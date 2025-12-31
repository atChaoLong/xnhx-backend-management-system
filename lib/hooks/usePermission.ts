/**
 * 前端权限控制 Hook
 * 用于在 React 组件中检查权限
 */

'use client'

import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import { hasPermission, hasAnyPermission, getPermissions } from '@/lib/permissions'
import { RESOURCES, ACTIONS, Role, Resource, Action } from '@/lib/permissions'

/**
 * 权限控制 Hook
 */
export function usePermission() {
  const { user, isLoading } = useCurrentUser()
  const role = user?.role as Role | undefined

  /**
   * 检查是否有指定权限
   */
  const checkPermission = (resource: Resource, action: Action): boolean => {
    if (!user) {
      console.warn('[usePermission] 用户未登录')
      return false
    }
    if (!role) {
      console.warn('[usePermission] 用户角色未定义', user)
      return false
    }
    return hasPermission(role, resource, action)
  }

  /**
   * 检查是否有任意一个权限
   */
  const checkAnyPermission = (permissions: Array<{ resource: Resource; action: Action }>): boolean => {
    return hasAnyPermission(role, permissions)
  }

  /**
   * 获取指定资源的所有权限
   */
  const getResourcePermissions = (resource: Resource): Action[] => {
    return getPermissions(role, resource)
  }

  /**
   * 快捷检查方法 - 线索
   */
  const leads = {
    view: () => checkPermission(RESOURCES.leads, ACTIONS.view),
    create: () => checkPermission(RESOURCES.leads, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.leads, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.leads, ACTIONS.delete),
    feedback: () => checkPermission(RESOURCES.leads, ACTIONS.feedback),
    convert: () => checkPermission(RESOURCES.leads, ACTIONS.convert),
  }

  /**
   * 快捷检查方法 - 试听
   */
  const trialLessons = {
    view: () => checkPermission(RESOURCES.trialLessons, ACTIONS.view),
    create: () => checkPermission(RESOURCES.trialLessons, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.trialLessons, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.trialLessons, ACTIONS.delete),
    matchTeacher: () => checkPermission(RESOURCES.trialLessons, ACTIONS.matchTeacher),
    confirmTeacher: () => checkPermission(RESOURCES.trialLessons, ACTIONS.confirmTeacher),
    confirmTime: () => checkPermission(RESOURCES.trialLessons, ACTIONS.confirmTime),
    addLink: () => checkPermission(RESOURCES.trialLessons, ACTIONS.addLink),
    convert: () => checkPermission(RESOURCES.trialLessons, ACTIONS.convert),
  }

  /**
   * 快捷检查方法 - 学生
   */
  const students = {
    view: () => checkPermission(RESOURCES.students, ACTIONS.view),
    create: () => checkPermission(RESOURCES.students, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.students, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.students, ACTIONS.delete),
    schedule: () => checkPermission(RESOURCES.students, ACTIONS.schedule),
    manageHours: () => checkPermission(RESOURCES.students, ACTIONS.manageHours),
    visit: () => checkPermission(RESOURCES.students, ACTIONS.visit),
  }

  /**
   * 快捷检查方法 - 订单
   */
  const formalOrders = {
    view: () => checkPermission(RESOURCES.formalOrders, ACTIONS.view),
    create: () => checkPermission(RESOURCES.formalOrders, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.formalOrders, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.formalOrders, ACTIONS.delete),
    addLink: () => checkPermission(RESOURCES.formalOrders, ACTIONS.addLink),
  }

  /**
   * 快捷检查方法 - 异动
   */
  const transactions = {
    view: () => checkPermission(RESOURCES.transactions, ACTIONS.view),
    create: () => checkPermission(RESOURCES.transactions, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.transactions, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.transactions, ACTIONS.delete),
    verifyHours: () => checkPermission(RESOURCES.transactions, ACTIONS.verifyHours),
    payment: () => checkPermission(RESOURCES.transactions, ACTIONS.payment),
    verifyPerformance: () => checkPermission(RESOURCES.transactions, ACTIONS.verifyPerformance),
  }

  /**
   * 快捷检查方法 - 老师面试
   */
  const teacherCandidates = {
    view: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.view),
    interview: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.interview),
    evaluate: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.evaluate),
    uploadVideo: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.uploadVideo),
    reviewVideo: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.reviewVideo),
  }

  /**
   * 快捷检查方法 - 老师库
   */
  const teachers = {
    view: () => checkPermission(RESOURCES.teachers, ACTIONS.view),
    create: () => checkPermission(RESOURCES.teachers, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.teachers, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.teachers, ACTIONS.delete),
    notes: () => checkPermission(RESOURCES.teachers, ACTIONS.notes),
  }

  /**
   * 快捷检查方法 - 字典
   */
  const dictionaries = {
    view: () => checkPermission(RESOURCES.dictionaries, ACTIONS.view),
    create: () => checkPermission(RESOURCES.dictionaries, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.dictionaries, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.dictionaries, ACTIONS.delete),
  }

  /**
   * 快捷检查方法 - 用户
   */
  const users = {
    view: () => checkPermission(RESOURCES.users, ACTIONS.view),
    create: () => checkPermission(RESOURCES.users, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.users, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.users, ACTIONS.delete),
  }

  return {
    user,
    role,
    isLoading,
    checkPermission,
    checkAnyPermission,
    getResourcePermissions,
    // 快捷方法
    leads,
    trialLessons,
    students,
    formalOrders,
    transactions,
    teacherCandidates,
    teachers,
    dictionaries,
    users,
  }
}
