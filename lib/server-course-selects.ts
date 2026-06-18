export const COURSE_RESPONSE_SELECT = `
  id,
  order_id,
  student_id,
  classin_course_id,
  course_name,
  subject,
  grade,
  teacher_id,
  teacher_name,
  session_count,
  total_hours,
  course_status,
  course_consumption_info,
  notes,
  created_at,
  updated_at,
  teacher:teacher_id(id, name),
  formal_orders(id, order_number, student_id)
`

export const SCHEDULED_COURSE_SELECT = `
  id,
  order_id,
  student_id,
  classin_course_id,
  course_name,
  subject,
  grade,
  teacher_id,
  teacher_name,
  session_count,
  total_hours,
  course_status,
  course_consumption_info,
  notes,
  created_at,
  updated_at,
  teacher:teacher_id(id, name),
  student:student_id(id, student_name),
  formal_orders(id, order_number)
`

export function formatCourseResponse(course: any) {
  if (!course) return course

  return {
    ...course,
    teacher_name: course.teacher?.name || course.teacher_name,
    student_id: course.student_id || course.formal_orders?.student_id,
    order_number: course.formal_orders?.order_number,
  }
}
