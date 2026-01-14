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

export interface EditClassroomParams {
  courseId: number
  classId: number
  className?: string
  beginTime?: number
  endTime?: number
  teacherUid?: number
  teacherName?: string
  record?: number
  live?: number
  replay?: number
}

export interface DeleteClassroomParams {
  courseId: number
  classId: number
}

export async function getClassrooms(
  from: number = 0,
  to: number = 19,
  filters?: {
    studentId?: string
    dateFrom?: string
    dateTo?: string
    status?: string
  }
): Promise<{ data: Classroom[]; count: number }> {
  const params = new URLSearchParams({
    from: from.toString(),
    to: to.toString(),
  })

  if (filters?.studentId) {
    params.append('studentId', filters.studentId)
  }
  if (filters?.dateFrom) {
    params.append('dateFrom', filters.dateFrom)
  }
  if (filters?.dateTo) {
    params.append('dateTo', filters.dateTo)
  }
  if (filters?.status) {
    params.append('status', filters.status)
  }

  const response = await api.get(`/api/classroom-classin?${params.toString()}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "获取课堂列表失败" }))
    throw new Error(error.error || "获取课堂列表失败")
  }
  const result = await response.json()
  return { data: result.data as Classroom[], count: result.count || 0 }
}

export async function editClassroom(params: EditClassroomParams): Promise<any> {
  const response = await api.put("/api/classin/classrooms", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "修改课节失败" }))
    throw new Error(error.error || "修改课节失败")
  }
  
  return await response.json()
}

export async function deleteClassroom(params: DeleteClassroomParams): Promise<any> {
  const queryString = new URLSearchParams(params as any).toString()
  const response = await api.delete(`/api/classin/classrooms?${queryString}`)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "删除课节失败" }))
    throw new Error(error.error || "删除课节失败")
  }
  
  return await response.json()
}

export const ClassroomsService = {
  getClassrooms,
  editClassroom,
  deleteClassroom,
}

