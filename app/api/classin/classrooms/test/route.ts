import { NextRequest, NextResponse } from 'next/server'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'
import { supabaseServer } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'edit':
        // 测试修改课节
        if (!params.courseId || !params.classId) {
          return NextResponse.json(
            { error: '缺少必需参数: courseId, classId' },
            { status: 400 }
          )
        }

        // 先检查课节是否存在
        const { data: existingClass, error: fetchError } = await supabaseServer
          .from('classroom_classin')
          .select('*')
          .eq('class_id', params.classId)
          .single()

        if (fetchError || !existingClass) {
          return NextResponse.json(
            { error: '课节不存在', details: `class_id: ${params.classId}` },
            { status: 404 }
          )
        }

        const editService = getClassInSDKService()
        const editResult = await editService.updateClassroom({
          courseId: params.courseId,
          classId: params.classId,
          activityId: existingClass.activity_id || params.classId,
          name: params.name,
        })
        return NextResponse.json({
          success: true,
          action: 'edit',
          data: editResult,
          message: '课节修改测试成功'
        })

      case 'delete':
        // 测试删除课节
        if (!params.courseId || !params.classId) {
          return NextResponse.json(
            { error: '缺少必需参数: courseId, classId' },
            { status: 400 }
          )
        }

        // 先检查课节是否存在
        const { data: existingDeleteClass, error: deleteFetchError } = await supabaseServer
          .from('classroom_classin')
          .select('*')
          .eq('class_id', params.classId)
          .single()

        if (deleteFetchError || !existingDeleteClass) {
          return NextResponse.json(
            { error: '课节不存在', details: `class_id: ${params.classId}` },
            { status: 404 }
          )
        }

        const deleteService = getClassInSDKService()
        const deleteResult = await deleteService.deleteClassroom({
          courseId: parseInt(params.courseId),
          classId: parseInt(params.classId),
          activityId: existingDeleteClass.activity_id || parseInt(params.classId),
        })
        return NextResponse.json({
          success: true,
          action: 'delete',
          data: deleteResult,
          message: '课节删除测试成功'
        })

      default:
        return NextResponse.json(
          { error: '不支持的操作类型，请使用 edit 或 delete' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('测试课节操作出错:', error)
    return NextResponse.json(
      { 
        error: '测试操作失败', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// GET 方法用于查看API使用说明
export async function GET() {
  return NextResponse.json({
    message: 'ClassIn 课节管理测试API',
    usage: {
      edit: {
        method: 'POST',
        body: {
          action: 'edit',
          SID: "your-classin-sid",
          safeKey: "your-classin-safekey",
          timeStamp: "1484719085",
          courseId: 442447,
          classId: 23644,
          className: "修改后的课节名称",
          beginTime: 1484739085,
          endTime: 1484739085,
          teacherUid: 1001001,
          record: 1,
          live: 1,
          replay: 1
        }
      },
      delete: {
        method: 'POST',
        body: {
          action: 'delete',
          SID: "your-classin-sid",
          safeKey: "your-classin-safekey",
          timeStamp: "1484719085",
          courseId: 442447,
          classId: 23644
        }
      }
    },
    note: '请确保在环境变量中配置了 CLASSIN_SID 和 CLASSIN_SECRET'
  })
}
