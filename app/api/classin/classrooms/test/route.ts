import { NextRequest, NextResponse } from 'next/server'
import { getClassInSDKService } from '@/lib/services/classin-sdk/service'
import { supabaseServer } from '@/lib/supabase'
import { requireClassInOpsProfile } from '@/lib/server-classin-ops'
import { createLogger } from '@/lib/logger'
import { summarizeError } from '@/lib/safe-error'

const logger = createLogger('ClassIn:ClassroomTest')

export async function POST(request: NextRequest) {
  try {
    const access = await requireClassInOpsProfile(request)
    if (access.ok === false) return access.response

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
          .select('class_id, activity_id')
          .eq('class_id', params.classId)
          .single()

        if (fetchError || !existingClass) {
          if (fetchError) {
            logger.warn('查询测试修改课节失败', summarizeError(fetchError))
          }
          return NextResponse.json(
            { error: '课节不存在' },
            { status: 404 }
          )
        }

        const editService = getClassInSDKService()
        const editResult = await editService.updateClassroom({
          courseId: params.courseId,
          classId: params.classId,
          activityId: existingClass.activity_id || params.classId,
          name: params.name || params.className,
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
          .select('class_id, activity_id')
          .eq('class_id', params.classId)
          .single()

        if (deleteFetchError || !existingDeleteClass) {
          if (deleteFetchError) {
            logger.warn('查询测试删除课节失败', summarizeError(deleteFetchError))
          }
          return NextResponse.json(
            { error: '课节不存在' },
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
  } catch (error: unknown) {
    logger.error('测试课节操作异常', summarizeError(error))
    return NextResponse.json(
      { error: '测试操作失败' },
      { status: 500 }
    )
  }
}

// GET 方法用于查看API使用说明
export async function GET(request: NextRequest) {
  const access = await requireClassInOpsProfile(request)
  if (access.ok === false) return access.response

  return NextResponse.json({
    message: 'ClassIn 课节管理测试API',
    usage: {
      edit: {
        method: 'POST',
        body: {
          action: 'edit',
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
          courseId: 442447,
          classId: 23644
        }
      }
    },
    note: '仅 admin / academic_affairs 可用；请确保服务端环境变量 CLASSIN_SID 和 CLASSIN_SECRET 已配置'
  })
}
