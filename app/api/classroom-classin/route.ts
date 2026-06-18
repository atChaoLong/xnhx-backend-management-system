import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { getCurrentProfile } from "@/lib/server-data-scope"
import { getAccessibleCourseIds, restrictByIds } from "@/lib/server-business-scope"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger("API:ClassroomClassIn")
const EMPTY_NUMERIC_ID = -1
const CLASSROOM_CLASSIN_SELECT = [
  "class_id",
  "created_at",
  "updated_at",
  "name",
  "class_status",
  "class_type",
  "start_time",
  "end_time",
  "course_id",
  "course_name",
  "activity_id",
  "stu_num",
  "audit_num",
  "sync_time",
].join(",")

type ClassroomAccessFilter =
  | { unrestricted: true }
  | { unrestricted: false; classIds: number[]; classInCourseIds: number[] }

function uniqueNumbers(values: any[]): number[] {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    )
  )
}

function applyAccessFilter(query: any, accessFilter: ClassroomAccessFilter) {
  if (accessFilter.unrestricted === true) return query

  const filters = []
  if (accessFilter.classIds.length > 0) {
    filters.push(`class_id.in.(${accessFilter.classIds.join(",")})`)
  }
  if (accessFilter.classInCourseIds.length > 0) {
    filters.push(`course_id.in.(${accessFilter.classInCourseIds.join(",")})`)
  }

  if (filters.length === 0) {
    return query.eq("class_id", EMPTY_NUMERIC_ID)
  }

  return query.or(filters.join(","))
}

async function getClassroomAccessFilter(
  request: NextRequest,
  studentId: string | null
): Promise<{ accessFilter?: ClassroomAccessFilter; response?: NextResponse }> {
  const profile = await getCurrentProfile(request)
  if (!profile) {
    return {
      response: NextResponse.json(
        { error: "用户档案未配置，请联系管理员" },
        { status: 403 }
      ),
    }
  }

  const accessibleCourseIds = await getAccessibleCourseIds(profile)
  if (accessibleCourseIds === null && !studentId) {
    return { accessFilter: { unrestricted: true } }
  }

  let courseQuery = supabaseServer
    .from("courses")
    .select("id, classin_course_id")

  courseQuery = restrictByIds(courseQuery, "id", accessibleCourseIds)

  if (studentId) {
    courseQuery = courseQuery.eq("student_id", studentId)
  }

  const { data: courses, error: coursesError } = await courseQuery
  if (coursesError) {
    logger.error("查询可访问课程失败", {
      ...summarizeError(coursesError),
      hasStudentFilter: Boolean(studentId),
    })
    return {
      response: NextResponse.json({ error: "查询可访问课程失败" }, { status: 500 }),
    }
  }

  const localCourseIds = (courses || []).map((course: any) => course.id).filter(Boolean)
  const classInCourseIds = uniqueNumbers(
    (courses || []).map((course: any) => course.classin_course_id)
  )

  let classIds: number[] = []
  if (localCourseIds.length > 0) {
    const { data: sessions, error: sessionsError } = await supabaseServer
      .from("class_sessions")
      .select("classroom_id")
      .in("course_id", localCourseIds)

    if (sessionsError) {
      logger.error("查询可访问课节失败", {
        ...summarizeError(sessionsError),
        hasStudentFilter: Boolean(studentId),
      })
      return {
        response: NextResponse.json({ error: "查询可访问课节失败" }, { status: 500 }),
      }
    }

    classIds = uniqueNumbers((sessions || []).map((session: any) => session.classroom_id))
  }

  return {
    accessFilter: {
      unrestricted: false,
      classIds,
      classInCourseIds,
    },
  }
}

function hasClassroomAccess(row: any, accessFilter: ClassroomAccessFilter): boolean {
  if (accessFilter.unrestricted === true) return true
  const classId = Number(row?.class_id)
  const classInCourseId = Number(row?.course_id)
  return (
    accessFilter.classIds.includes(classId) ||
    accessFilter.classInCourseIds.includes(classInCourseId)
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const from = parseInt(searchParams.get("from") || "0")
    const to = parseInt(searchParams.get("to") || "19")

    // 筛选参数
    const studentId = searchParams.get("studentId") // 学生 UUID
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const status = searchParams.get("status")

    const access = await getClassroomAccessFilter(request, studentId)
    if (access.response) return access.response
    const accessFilter = access.accessFilter!

    if (id) {
      const { data, error } = await supabaseServer
        .from("classroom_classin")
        .select(CLASSROOM_CLASSIN_SELECT)
        .eq("class_id", id)
        .single()
      if (error) {
        logger.warn("查询单个 classroom_classin 失败", summarizeError(error))
        return NextResponse.json({ error: "获取课堂失败" }, { status: 400 })
      }
      if (!hasClassroomAccess(data, accessFilter)) {
        return NextResponse.json({ error: "无权访问该课堂" }, { status: 403 })
      }
      return NextResponse.json({ data })
    }

    let query = supabaseServer
      .from("classroom_classin")
      .select(CLASSROOM_CLASSIN_SELECT)
    query = applyAccessFilter(query, accessFilter)

    // 按时间范围筛选
    if (dateFrom) {
      const fromDate = new Date(dateFrom).getTime() / 1000
      query = query.gte("start_time", fromDate)
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      query = query.lte("start_time", toDate.getTime() / 1000)
    }

    // 按状态筛选（需要先获取所有数据，然后在内存中筛选）
    let totalCount = 0
    let data: any[] = []

    if (status) {
      // 如果有状态筛选，需要先获取所有符合其他条件的数据
      const { data: allData, error: fetchError } = await query.order("start_time", { ascending: false })

      if (fetchError) {
        logger.warn("查询 classroom_classin 状态筛选数据失败", summarizeError(fetchError))
        return NextResponse.json({ error: "获取课堂失败" }, { status: 400 })
      }

      const now = Date.now() / 1000
      data = (allData || []).filter((c: any) => {
        const startTime = c.start_time || 0
        const endTime = c.end_time || 0

        if (status === 'scheduled') {
          // 未开始
          return startTime > now
        } else if (status === 'ongoing') {
          // 进行中
          return startTime <= now && endTime >= now
        } else if (status === 'completed') {
          // 已结束
          return endTime < now
        }
        return true
      })

      totalCount = data.length
      // 应用分页
      data = data.slice(from, to + 1)
    } else {
      // 没有状态筛选，可以直接使用数据库查询
      let countQuery = supabaseServer
        .from("classroom_classin")
        .select("class_id", { count: "exact", head: true })
      countQuery = applyAccessFilter(countQuery, accessFilter)

      if (dateFrom) {
        const fromDate = new Date(dateFrom).getTime() / 1000
        countQuery = countQuery.gte("start_time", fromDate)
      }

      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        countQuery = countQuery.lte("start_time", toDate.getTime() / 1000)
      }

      const { count } = await countQuery

      totalCount = count || 0

      const { data: fetchData, error } = await query
        .order("start_time", { ascending: false })
        .range(from, to)

      if (error) {
        logger.warn("查询 classroom_classin 分页数据失败", summarizeError(error))
        return NextResponse.json({ error: "获取课堂失败" }, { status: 400 })
      }

      data = fetchData || []
    }

    return NextResponse.json({
      data: data || [],
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: unknown) {
    logger.error("获取 classroom_classin 异常", summarizeError(error))
    return NextResponse.json({ error: "获取课堂失败" }, { status: 500 })
  }
}
