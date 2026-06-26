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

const TEACHER_PROFILE_FALLBACK_SELECT = [
  'id',
  'name',
  'classin_uid',
  'subjects',
  'grade_levels',
  'available_times',
  'student_regions',
  'student_levels',
  'status',
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
    // 1. 从 teacher_classin 表获取已注册 ClassIn 的老师
    const { data, error } = await supabaseServer
      .from('teacher_classin')
      .select(CLASSIN_TEACHER_SELECT)
      .eq('is_del', 0)
      .order('name', { ascending: true })

    if (error) {
      logger.error('获取教师列表失败', { error_summary: summarizeError(error) })
      return NextResponse.json({ error: '获取教师列表失败' }, { status: 500 })
    }

    const classinTeachers = data || []
    const classinUids = uniqueValues(classinTeachers.map((item) => Number(item.uid)).filter((uid) => Number.isFinite(uid)))
    const classinTeacherNames = uniqueValues(classinTeachers.map((item) => item.name?.trim()).filter(Boolean))

    // 2. 从 teachers 表获取所有老师（包括未注册 ClassIn 的）
    let { data: allTeachers, error: allTeachersError } = await supabaseServer
      .from('teachers')
      .select(TEACHER_PROFILE_SELECT)
      .order('name', { ascending: true })

    if (allTeachersError) {
      const fallbackResult = await supabaseServer
        .from('teachers')
        .select(TEACHER_PROFILE_FALLBACK_SELECT)
        .order('name', { ascending: true })
      allTeachers = fallbackResult.data
      allTeachersError = fallbackResult.error
    }

    if (allTeachersError) {
      logger.warn('获取老师库存失败', { error_summary: summarizeError(allTeachersError) })
    }

    const profiles: TeacherProfile[] = []

    if (classinUids.length > 0) {
      let { data: uidProfiles, error: uidProfileError } = await supabaseServer
        .from('teachers')
        .select(TEACHER_PROFILE_SELECT)
        .in('classin_uid', classinUids)

      if (uidProfileError) {
        const fallbackResult = await supabaseServer
          .from('teachers')
          .select(TEACHER_PROFILE_FALLBACK_SELECT)
          .in('classin_uid', classinUids)
        uidProfiles = fallbackResult.data
        uidProfileError = fallbackResult.error
      }

      if (uidProfileError) {
        logger.warn('按 ClassIn UID 获取老师画像失败', { error_summary: summarizeError(uidProfileError) })
      } else if (uidProfiles) {
        profiles.push(...(uidProfiles as unknown as TeacherProfile[]))
      }
    }

    if (classinTeacherNames.length > 0) {
      let { data: nameProfiles, error: nameProfileError } = await supabaseServer
        .from('teachers')
        .select(TEACHER_PROFILE_SELECT)
        .in('name', classinTeacherNames)

      if (nameProfileError) {
        const fallbackResult = await supabaseServer
          .from('teachers')
          .select(TEACHER_PROFILE_FALLBACK_SELECT)
          .in('name', classinTeacherNames)
        nameProfiles = fallbackResult.data
        nameProfileError = fallbackResult.error
      }

      if (nameProfileError) {
        logger.warn('按姓名获取老师画像失败', { error_summary: summarizeError(nameProfileError) })
      } else if (nameProfiles) {
        profiles.push(...(nameProfiles as unknown as TeacherProfile[]))
      }
    }

    // Also include all teachers from the teachers table
    if (allTeachers) {
      profiles.push(...(allTeachers as unknown as TeacherProfile[]))
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

    // 3. Build result from teacher_classin entries (already registered in ClassIn)
    const seenNames = new Set<string>()
    const teachers = classinTeachers.map(item => {
      const profile = profilesByUid.get(Number(item.uid)) || profilesByName.get(item.name?.trim() || '')
      const profileSubjects = Array.isArray(profile?.subjects) ? profile.subjects : []
      const teacherName = item.name?.trim() || ''
      if (teacherName) seenNames.add(teacherName)

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

    // 4. Add teachers from teachers table that are NOT in teacher_classin (not yet registered in ClassIn)
    if (allTeachers) {
      for (const teacher of allTeachers as unknown as TeacherProfile[]) {
        const teacherName = teacher.name?.trim() || ''
        if (!teacherName || seenNames.has(teacherName)) continue
        seenNames.add(teacherName)

        const profileSubjects = Array.isArray(teacher.subjects) ? teacher.subjects : []
        teachers.push({
          id: teacher.id,
          teacher_name: teacher.name,
          teacher_subject: profileSubjects.join('、') || '',
          classin_uid: teacher.classin_uid || 0,
          subjects: profileSubjects,
          grade_levels: Array.isArray(teacher.grade_levels) ? teacher.grade_levels : [],
          available_times: Array.isArray(teacher.available_times) ? teacher.available_times : [],
          student_regions: Array.isArray(teacher.student_regions) ? teacher.student_regions : [],
          student_levels: Array.isArray(teacher.student_levels) ? teacher.student_levels : [],
          status: teacher.status || null,
          teacher_level: teacher.teacher_level || null,
          total_hours: teacher.total_hours ?? null,
        })
      }
    }

    logger.info('获取教师列表成功', { count: teachers.length, classin_count: classinTeachers.length })

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
