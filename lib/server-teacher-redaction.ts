import type { CurrentProfile } from "@/lib/server-data-scope"

type TeacherLike = Record<string, any>

export function canViewTeacherClassInSecrets(profile: CurrentProfile | null): boolean {
  return profile?.role === "admin" || profile?.role === "academic_affairs"
}

export function canViewTeacherPhone(profile: CurrentProfile | null): boolean {
  return profile?.role !== "head_teacher"
}

export function canViewTeacherInternalContact(profile: CurrentProfile | null): boolean {
  return profile?.role === "admin" ||
    profile?.role === "academic_affairs" ||
    profile?.role === "operator" ||
    profile?.role === "teacher"
}

export function redactTeacherSensitiveFields<T extends TeacherLike>(teacher: T, profile: CurrentProfile | null): T {
  if (!teacher) return teacher

  const redactedTeacher: TeacherLike = { ...teacher }

  if (!canViewTeacherClassInSecrets(profile)) {
    redactedTeacher.classin_phone = null
    redactedTeacher.classin_uid = null
    redactedTeacher.classin_initial_password = null
  }

  if (!canViewTeacherPhone(profile)) {
    redactedTeacher.mobile = null
    redactedTeacher.classin_phone = null
  }

  if (!canViewTeacherInternalContact(profile)) {
    redactedTeacher.wechat = null
  }

  return redactedTeacher as T
}

export function redactTeachersSensitiveFields<T extends TeacherLike>(teachers: T[], profile: CurrentProfile | null): T[] {
  return teachers.map((teacher) => redactTeacherSensitiveFields(teacher, profile))
}

export const redactTeacherClassInSecrets = redactTeacherSensitiveFields
export const redactTeachersClassInSecrets = redactTeachersSensitiveFields
