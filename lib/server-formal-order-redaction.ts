import type { CurrentProfile } from "@/lib/server-data-scope"

type FormalOrderLike = Record<string, any>
type TrialLessonLike = Record<string, any>

export function canViewPaymentProof(profile: CurrentProfile | null): boolean {
  return profile?.role === "admin" || profile?.role === "finance" || profile?.role === "academic_affairs"
}

export function canViewClassInStudentIdentifier(profile: CurrentProfile | null): boolean {
  return profile?.role === "admin" || profile?.role === "academic_affairs"
}

export function redactFormalOrderSensitiveFields<T extends FormalOrderLike>(order: T, profile: CurrentProfile | null): T {
  if (!order || canViewPaymentProof(profile)) return order

  return {
    ...order,
    payment_proof: null,
  }
}

export function redactFormalOrdersSensitiveFields<T extends FormalOrderLike>(orders: T[], profile: CurrentProfile | null): T[] {
  return orders.map((order) => redactFormalOrderSensitiveFields(order, profile))
}

export function redactTrialLessonSensitiveFields<T extends TrialLessonLike>(lesson: T, profile: CurrentProfile | null): T {
  if (!lesson) return lesson

  const redactedLesson: TrialLessonLike = { ...lesson }

  if (!canViewPaymentProof(profile)) {
    redactedLesson.payment_proof = null
  }

  if (!canViewClassInStudentIdentifier(profile)) {
    redactedLesson.classin_student_bound = Boolean(lesson.classin_student_uid)
    redactedLesson.classin_student_uid = null
  }

  return redactedLesson as T
}

export function redactTrialLessonsSensitiveFields<T extends TrialLessonLike>(lessons: T[], profile: CurrentProfile | null): T[] {
  return lessons.map((lesson) => redactTrialLessonSensitiveFields(lesson, profile))
}
