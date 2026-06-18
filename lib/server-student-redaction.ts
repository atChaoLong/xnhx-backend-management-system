import type { CurrentProfile } from "@/lib/server-data-scope"

type StudentLike = Record<string, any>

export function canViewStudentClassInSecrets(profile: CurrentProfile | null): boolean {
  return profile?.role === "admin" || profile?.role === "academic_affairs"
}

export function redactStudentClassInSecrets<T extends StudentLike>(student: T, profile: CurrentProfile | null): T {
  if (!student || canViewStudentClassInSecrets(profile)) return student

  return {
    ...student,
    classin_initial_password: null,
    classin_uid: null,
  }
}

export function redactStudentsClassInSecrets<T extends StudentLike>(students: T[], profile: CurrentProfile | null): T[] {
  return students.map((student) => redactStudentClassInSecrets(student, profile))
}
