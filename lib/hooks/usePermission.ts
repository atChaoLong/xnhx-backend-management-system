"use client"

import { useAuthContext } from "@/contexts/AuthContext"
import { hasPermission, hasAnyPermission, getPermissions } from "@/lib/permissions"
import { RESOURCES, ACTIONS, type Role, type Resource, type Action } from "@/lib/permissions"

export function usePermission() {
  const { user, isLoading } = useAuthContext()
  const role = user?.role as Role | undefined

  const checkPermission = (resource: Resource, action: Action): boolean => {
    if (!user || !role) return false
    return hasPermission(role, resource, action)
  }

  const checkAnyPermission = (permissions: Array<{ resource: Resource; action: Action }>): boolean => {
    return hasAnyPermission(role, permissions)
  }

  const getResourcePermissions = (resource: Resource): Action[] => {
    return getPermissions(role, resource)
  }

  const leads = {
    view: () => checkPermission(RESOURCES.leads, ACTIONS.view),
    create: () => checkPermission(RESOURCES.leads, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.leads, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.leads, ACTIONS.delete),
    feedback: () => checkPermission(RESOURCES.leads, ACTIONS.feedback),
    convert: () => checkPermission(RESOURCES.leads, ACTIONS.convert),
  }

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

  const students = {
    view: () => checkPermission(RESOURCES.students, ACTIONS.view),
    create: () => checkPermission(RESOURCES.students, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.students, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.students, ACTIONS.delete),
    schedule: () => checkPermission(RESOURCES.students, ACTIONS.schedule),
    manageHours: () => checkPermission(RESOURCES.students, ACTIONS.manageHours),
    visit: () => checkPermission(RESOURCES.students, ACTIONS.visit),
  }

  const formalOrders = {
    view: () => checkPermission(RESOURCES.formalOrders, ACTIONS.view),
    create: () => checkPermission(RESOURCES.formalOrders, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.formalOrders, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.formalOrders, ACTIONS.delete),
    addLink: () => checkPermission(RESOURCES.formalOrders, ACTIONS.addLink),
  }

  const classSessions = {
    view: () => checkPermission(RESOURCES.classSessions, ACTIONS.view),
    create: () => checkPermission(RESOURCES.classSessions, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.classSessions, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.classSessions, ACTIONS.delete),
  }

  const transactions = {
    view: () => checkPermission(RESOURCES.transactions, ACTIONS.view),
    create: () => checkPermission(RESOURCES.transactions, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.transactions, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.transactions, ACTIONS.delete),
    verifyHours: () => checkPermission(RESOURCES.transactions, ACTIONS.verifyHours),
    payment: () => checkPermission(RESOURCES.transactions, ACTIONS.payment),
    verifyPerformance: () => checkPermission(RESOURCES.transactions, ACTIONS.verifyPerformance),
  }

  const teacherCandidates = {
    view: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.view),
    create: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.evaluate),
    delete: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.delete),
    interview: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.interview),
    evaluate: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.evaluate),
    confirmEntry: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.confirmEntry),
    uploadVideo: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.uploadVideo),
    reviewVideo: () => checkPermission(RESOURCES.teacherCandidates, ACTIONS.reviewVideo),
  }

  const teachers = {
    view: () => checkPermission(RESOURCES.teachers, ACTIONS.view),
    create: () => checkPermission(RESOURCES.teachers, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.teachers, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.teachers, ACTIONS.delete),
    notes: () => checkPermission(RESOURCES.teachers, ACTIONS.notes),
  }

  const dictionaries = {
    view: () => checkPermission(RESOURCES.dictionaries, ACTIONS.view),
    create: () => checkPermission(RESOURCES.dictionaries, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.dictionaries, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.dictionaries, ACTIONS.delete),
  }

  const todos = {
    view: () => checkPermission(RESOURCES.todos, ACTIONS.view),
    create: () => checkPermission(RESOURCES.todos, ACTIONS.create),
    edit: () => checkPermission(RESOURCES.todos, ACTIONS.edit),
    delete: () => checkPermission(RESOURCES.todos, ACTIONS.delete),
  }

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
    leads,
    trialLessons,
    students,
    formalOrders,
    classSessions,
    transactions,
    teacherCandidates,
    teachers,
    dictionaries,
    todos,
    users,
  }
}
