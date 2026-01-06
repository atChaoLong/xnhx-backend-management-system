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

    const { count: totalCount } = await supabaseServer
      .from("classroom_classin")
      .select("*", { count: "exact", head: true })

    const { data, error } = await supabaseServer
      .from("classroom_classin")
      .select("*")
      .order("start_time", { ascending: false })
      .range(from, to)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
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

