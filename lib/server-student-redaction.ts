import type { CurrentProfile } from "@/lib/server-data-scope"

type StudentLike = Record<string, any>

export function canViewStudentClassInSecrets(profile: CurrentProfile | null): boolean {
  return profile?.role === "admin" || profile?.role === "academic_affairs"
}

export function canViewStudentPhone(profile: CurrentProfile | null): boolean {
  return profile?.role === "admin"
}

export function redactStudentClassInSecrets<T extends StudentLike>(student: T, profile: CurrentProfile | null): T {
  if (!student) return student

  const redacted: StudentLike = { ...student }

  if (!canViewStudentClassInSecrets(profile)) {
    redacted.classin_initial_password = null
    redacted.classin_uid = null
  }

  if (!canViewStudentPhone(profile)) {
    redacted.parent_phone = null
  }

  return redacted as T
}

export function redactStudentsClassInSecrets<T extends StudentLike>(students: T[], profile: CurrentProfile | null): T[] {
  return students.map((student) => redactStudentClassInSecrets(student, profile))
}
