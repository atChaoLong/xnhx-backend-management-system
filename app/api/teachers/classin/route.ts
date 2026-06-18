import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { checkPermission } from "@/lib/middleware"
import { ACTIONS, RESOURCES } from "@/lib/permissions"
import { summarizeError } from "@/lib/safe-error"

const logger = createLogger('API:TeachersClassIn')
const CLASSIN_TEACHER_SELECT = 'uid, name, position'
const TEACHER_PROFILE_SELECT = [
  'id',
  'name',
  'classin_uid',
  'subjects',
  'grade_levels',
  'available_times',
  'student_regions',
  'student_levels',
  'status',
  'teacher_level',
  'total_hours',
].join(', ')

type TeacherProfile = {
  id: string
  name: string | null
  classin_uid: number | null
  subjects: string[] | null
  grade_levels: string[] | null
  available_times: string[] | null
  student_regions: string[] | null
  student_levels: string[] | null
  status: string | null
  teacher_level: string | null
  total_hours: number | null
}

function uniqueValues<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export async function GET(request: NextRequest) {
  return checkPermission(request, RESOURCES.teachers, ACTIONS.view, async () => {
  try {
    // 从 teacher_classin 表获取试听匹配/确认所需的 ClassIn 老师目录
    const { data, error } = await supabaseServer
      .from('teacher_classin')
      .select(CLASSIN_TEACHER_SELECT)
      .eq('is_del', 0) // 只获取未删除的教师
      .order('name', { ascending: true })

    if (error) {
      logger.error('获取教师列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json({ error: '获取教师列表失败' }, { status: 500 })
    }

    const classinTeachers = data || []
    const classinUids = uniqueValues(classinTeachers.map((item) => Number(item.uid)).filter((uid) => Number.isFinite(uid)))
    const teacherNames = uniqueValues(classinTeachers.map((item) => item.name?.trim()).filter(Boolean))
    const profiles: TeacherProfile[] = []

    if (classinUids.length > 0) {
      const { data: uidProfiles, error: uidProfileError } = await supabaseServer
        .from('teachers')
        .select(TEACHER_PROFILE_SELECT)
        .in('classin_uid', classinUids)

      if (uidProfileError) {
        logger.warn('按 ClassIn UID 获取老师画像失败', { error_summary: summarizeError(uidProfileError) })
      } else if (uidProfiles) {
        profiles.push(...(uidProfiles as unknown as TeacherProfile[]))
      }
    }

    if (teacherNames.length > 0) {
      const { data: nameProfiles, error: nameProfileError } = await supabaseServer
        .from('teachers')
        .select(TEACHER_PROFILE_SELECT)
        .in('name', teacherNames)

      if (nameProfileError) {
        logger.warn('按姓名获取老师画像失败', { error_summary: summarizeError(nameProfileError) })
      } else if (nameProfiles) {
        profiles.push(...(nameProfiles as unknown as TeacherProfile[]))
      }
    }

    const profilesByUid = new Map<number, TeacherProfile>()
    const profilesByName = new Map<string, TeacherProfile>()
    profiles.forEach((profile) => {
      if (profile.classin_uid) {
        profilesByUid.set(profile.classin_uid, profile)
      }
      if (profile.name?.trim()) {
        profilesByName.set(profile.name.trim(), profile)
      }
    })

    const teachers = classinTeachers.map(item => {
      const profile = profilesByUid.get(Number(item.uid)) || profilesByName.get(item.name?.trim() || '')
      const profileSubjects = Array.isArray(profile?.subjects) ? profile.subjects : []

      return {
        id: String(item.uid),
        teacher_name: item.name,
        teacher_subject: item.position || profileSubjects.join('、') || '',
        classin_uid: item.uid,
        subjects: profileSubjects,
        grade_levels: Array.isArray(profile?.grade_levels) ? profile.grade_levels : [],
        available_times: Array.isArray(profile?.available_times) ? profile.available_times : [],
        student_regions: Array.isArray(profile?.student_regions) ? profile.student_regions : [],
        student_levels: Array.isArray(profile?.student_levels) ? profile.student_levels : [],
        status: profile?.status || null,
        teacher_level: profile?.teacher_level || null,
        total_hours: profile?.total_hours ?? null,
      }
    })

    logger.info('获取教师列表成功', { count: teachers.length })

    return NextResponse.json({
      success: true,
      data: teachers
    })
  } catch (error: any) {
    logger.error('获取教师列表异常', { error_summary: summarizeError(error) })
    return NextResponse.json({ error: '获取教师列表失败' }, { status: 500 })
  }
  })
}
