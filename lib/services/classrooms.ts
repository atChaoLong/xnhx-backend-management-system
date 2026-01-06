import { api } from "@/lib/fetch"

export interface Classroom {
  class_id: number
  created_at: string
  updated_at: string
  name: string
  class_status?: number
  class_type?: number
  start_time?: number
  end_time?: number
  course_id?: number
  course_name?: string
  activity_id?: number
}

export async function getClassrooms(from: number = 0, to: number = 19): Promise<{ data: Classroom[]; count: number }> {
  const response = await api.get(`/api/classroom-classin?from=${from}&to=${to}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "获取课堂列表失败" }))
    throw new Error(error.error || "获取课堂列表失败")
  }
  const result = await response.json()
  return { data: result.data as Classroom[], count: result.count || 0 }
}

export const ClassroomsService = {
  getClassrooms,
}

