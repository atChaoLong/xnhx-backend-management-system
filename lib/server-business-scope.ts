import { supabaseServer } from '@/lib/supabase'
import type { CurrentProfile } from '@/lib/server-data-scope'
import {
  leadCreatedByEqualsProfileFilter,
  leadGrabWechatEqualsProfileFilter,
} from '@/lib/server-lead-access'

export const EMPTY_UUID = '00000000-0000-0000-0000-000000000000'

type Profile = CurrentProfile | null
type ScopedIds = string[] | null

function uniqueIds(rows: any[], column = 'id'): string[] {
  return Array.from(new Set((rows || []).map((row: any) => row?.[column]).filter(Boolean)))
}

export function restrictByIds(query: any, column: string, ids: ScopedIds) {
  if (ids === null) return query
  if (ids.length === 0) return query.eq(column, EMPTY_UUID)
  return query.in(column, ids)
}

export function hasScopedIdAccess(ids: ScopedIds, id: string | null | undefined): boolean {
  if (ids === null) return true
  if (!id) return false
  return ids.includes(id)
}

export async function getAccessibleLeadIds(profile: Profile): Promise<string[]> {
  if (!profile) return []

  const meName = profile.name || ''
  let query = supabaseServer.from('leads').select('id')

  if (profile.role === 'sales') {
    query = query.or([
      `grab_user_id.eq.${profile.id}`,
      leadGrabWechatEqualsProfileFilter(profile),
      leadCreatedByEqualsProfileFilter(profile),
    ].filter(Boolean).join(','))
  } else if (profile.role === 'operator') {
    query = query.or([
      `operator_id.eq.${profile.id}`,
      meName ? `created_by.eq.${meName}` : '',
    ].filter(Boolean).join(','))
  } else if (profile.role === 'head_teacher') {
    query = query.or([
      `operator_id.eq.${profile.id}`,
      `grab_user_id.eq.${profile.id}`,
      meName ? `created_by.eq.${meName}` : '',
    ].filter(Boolean).join(','))
  } else {
    return []
  }

  const { data } = await query
  return uniqueIds(data || [])
}

export async function getHeadTeacherStudentIds(profile: Profile): Promise<string[]> {
  if (!profile || profile.role !== 'head_teacher') return []

  const { data } = await supabaseServer
    .from('students')
    .select('id')
    .eq('head_teacher_id', profile.id)

  return uniqueIds(data || [])
}

export async function getAccessibleStudentIds(profile: Profile): Promise<ScopedIds> {
  if (!profile) return []
  if (profile.role === 'admin' || profile.role === 'academic_affairs' || profile.role === 'finance') return null

  if (profile.role === 'head_teacher') {
    return getHeadTeacherStudentIds(profile)
  }

  if (profile.role === 'teacher') {
    const meName = profile.name || ''
    const filters = [
      `teacher_id.eq.${profile.id}`,
      meName ? `teacher_name.ilike.%${meName}%` : '',
    ].filter(Boolean)

    if (filters.length === 0) return []

    const { data } = await supabaseServer
      .from('courses')
      .select('student_id')
      .or(filters.join(','))

    return uniqueIds(data || [], 'student_id')
  }

  if (profile.role === 'sales' || profile.role === 'operator') {
    const leadIds = await getAccessibleLeadIds(profile)
    if (leadIds.length === 0) return []

    const { data } = await supabaseServer
      .from('formal_orders')
      .select('student_id')
      .in('lead_id', leadIds)

    return uniqueIds(data || [], 'student_id')
  }

  return []
}

export async function getAccessibleStudentNames(profile: Profile): Promise<string[] | null> {
  const ids = await getAccessibleStudentIds(profile)
  if (ids === null) return null
  if (ids.length === 0) return []

  const { data } = await supabaseServer
    .from('students')
    .select('student_name')
    .in('id', ids)

  return uniqueIds(data || [], 'student_name')
}

export async function getAccessibleFormalOrderIds(profile: Profile): Promise<ScopedIds> {
  if (!profile) return []
  if (profile.role === 'admin' || profile.role === 'academic_affairs' || profile.role === 'finance') return null

  const meName = profile.name || ''
  const [leadIds, headTeacherStudentIds] = await Promise.all([
    getAccessibleLeadIds(profile),
    getHeadTeacherStudentIds(profile),
  ])
  const filters = [
    meName ? `consultant_teacher.ilike.%${meName}%` : '',
    leadIds.length > 0 ? `lead_id.in.(${leadIds.join(',')})` : '',
    headTeacherStudentIds.length > 0 ? `student_id.in.(${headTeacherStudentIds.join(',')})` : '',
  ].filter(Boolean)

  if (filters.length === 0) return []

  const { data } = await supabaseServer
    .from('formal_orders')
    .select('id')
    .or(filters.join(','))

  return uniqueIds(data || [])
}

export async function getAccessibleTrialLessonIds(profile: Profile): Promise<ScopedIds> {
  if (!profile) return []
  if (profile.role === 'admin' || profile.role === 'academic_affairs') return null

  if (
    profile.role !== 'sales' &&
    profile.role !== 'head_teacher' &&
    profile.role !== 'operator' &&
    profile.role !== 'teacher'
  ) {
    return []
  }

  const meName = profile.name || ''
  const [leadIds, studentIds] = await Promise.all([
    getAccessibleLeadIds(profile),
    getAccessibleStudentIds(profile),
  ])
  const filters = [
    meName ? `assigned_consultant.ilike.%${meName}%` : '',
    leadIds.length > 0 ? `lead_id.in.(${leadIds.join(',')})` : '',
    studentIds && studentIds.length > 0 ? `student_id.in.(${studentIds.join(',')})` : '',
  ].filter(Boolean)

  if (filters.length === 0) return []

  const { data } = await supabaseServer
    .from('trial_lessons')
    .select('id')
    .or(filters.join(','))

  return uniqueIds(data || [])
}

export async function getAccessibleCourseIds(profile: Profile): Promise<ScopedIds> {
  if (!profile) return []
  if (profile.role === 'admin' || profile.role === 'academic_affairs' || profile.role === 'finance') return null

  const meName = profile.name || ''

  if (profile.role === 'teacher') {
    const filters = [
      `teacher_id.eq.${profile.id}`,
      meName ? `teacher_name.ilike.%${meName}%` : '',
    ].filter(Boolean)

    if (filters.length === 0) return []

    const { data } = await supabaseServer
      .from('courses')
      .select('id')
      .or(filters.join(','))

    return uniqueIds(data || [])
  }

  const [orderIds, headTeacherStudentIds] = await Promise.all([
    getAccessibleFormalOrderIds(profile),
    getHeadTeacherStudentIds(profile),
  ])
  if (orderIds === null) return null
  const filters = [
    orderIds.length > 0 ? `order_id.in.(${orderIds.join(',')})` : '',
    headTeacherStudentIds.length > 0 ? `student_id.in.(${headTeacherStudentIds.join(',')})` : '',
  ].filter(Boolean)

  if (filters.length === 0) return []

  const { data } = await supabaseServer
    .from('courses')
    .select('id')
    .or(filters.join(','))

  return uniqueIds(data || [])
}
