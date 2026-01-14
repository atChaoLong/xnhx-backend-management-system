import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const logger = createLogger("API:ClassroomClassIn")

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

    if (id) {
      const { data, error } = await supabaseServer
        .from("classroom_classin")
        .select("*")
        .eq("class_id", id)
        .single()
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ data })
    }

    let query = supabaseServer
      .from("classroom_classin")
      .select("*")

    // 按学生筛选（通过 class_sessions 关联）
    let classroomIds: number[] = []

    if (studentId) {
      // 步骤1: 查询该学生的课程ID
      const { data: courses, error: coursesError } = await supabaseServer
        .from("courses")
        .select("id")
        .eq("student_id", studentId)

      if (coursesError) {
        logger.error("查询学生课程失败", { error: coursesError.message, studentId })
        return NextResponse.json({ error: "查询学生课程失败" }, { status: 500 })
      }

      if (!courses || courses.length === 0) {
        // 没有找到课程，返回空结果
        return NextResponse.json({
          data: [],
          count: 0,
          from,
          to,
        })
      }

      const courseIds = courses.map((c: any) => c.id)

      // 步骤2: 查询这些课程关联的课节，获取 classroom_id
      const { data: sessions, error: sessionsError } = await supabaseServer
        .from("class_sessions")
        .select("classroom_id")
        .in("course_id", courseIds)

      if (sessionsError) {
        logger.error("查询学生课节失败", { error: sessionsError.message, studentId })
        return NextResponse.json({ error: "查询学生课节失败" }, { status: 500 })
      }

      if (sessions && sessions.length > 0) {
        classroomIds = sessions.map((s: any) => s.classroom_id).filter((id: any) => id !== null)
      }

      // 如果有 classroom_ids，添加到查询条件
      if (classroomIds.length > 0) {
        query = query.in("class_id", classroomIds)
      } else {
        // 如果没有有效的 classroom_id，返回空结果
        return NextResponse.json({
          data: [],
          count: 0,
          from,
          to,
        })
      }
    }

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
        return NextResponse.json({ error: fetchError.message }, { status: 400 })
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
      const { count } = await supabaseServer
        .from("classroom_classin")
        .select("*", { count: "exact", head: true })

      totalCount = count || 0

      const { data: fetchData, error } = await query
        .order("start_time", { ascending: false })
        .range(from, to)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      data = fetchData || []
    }

    return NextResponse.json({
      data: data || [],
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    logger.error("获取 classroom_classin 异常", { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || "获取课堂失败" }, { status: 500 })
  }
}

