"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, User, Phone, MessageSquare, BookOpen, Clock, MapPin, Award, Image as ImageIcon } from "lucide-react"
import { api } from "@/lib/fetch"

interface TeacherDetailsTabProps {
  candidateId: string
}

interface TeacherDetail {
  id: string
  created_at: string
  teacher_name: string
  gender: string
  wechat: string
  classin_phone: string
  location: string
  subjects: string[]
  grade_levels: string[]
  used_classin: string
  has_certificate: string
  education: string
  university: string
  teaching_years: number
  available_times: string[]
  textbook_versions: string[]
  student_regions: string[]
  student_levels: string[]
  teaching_style: string
  teaching_experience: string
  success_cases: string
  notes: string | null
  photo_url: string | null
  review_screenshots: string[] | null
}

function joinArray(arr: string[] | null | undefined): string {
  if (!arr || !Array.isArray(arr)) return "-"
  return arr.filter(Boolean).join("、") || "-"
}

export function TeacherDetailsTab({ candidateId }: TeacherDetailsTabProps) {
  const [detail, setDetail] = useState<TeacherDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setIsLoading(true)
        const response = await api.get(`/api/teacher-form-submissions?candidate_id=${encodeURIComponent(candidateId)}`)
        if (!response.ok) {
          setNotFound(true)
          return
        }
        const result = await response.json()
        if (!result.data) {
          setNotFound(true)
          return
        }
        setDetail(result.data)
      } catch {
        setNotFound(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDetail()
  }, [candidateId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <User className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">老师尚未填写信息采集表</p>
        <p className="text-xs text-muted-foreground mt-1">请将信息采集链接或二维码发送给老师填写</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" /> 基本信息
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <InfoField label="姓名" value={detail.teacher_name} />
          <InfoField label="性别" value={detail.gender} />
          <InfoField label="微信" value={detail.wechat} />
          <InfoField label="ClassIn手机号" value={detail.classin_phone} icon={<Phone className="h-3.5 w-3.5" />} />
          <InfoField label="所在地" value={detail.location} icon={<MapPin className="h-3.5 w-3.5" />} />
          <InfoField label="是否用过ClassIn" value={detail.used_classin} />
          <InfoField label="是否有教师资格证" value={detail.has_certificate} />
          <InfoField label="学历" value={detail.education} icon={<Award className="h-3.5 w-3.5" />} />
          <InfoField label="毕业院校" value={detail.university} />
          <InfoField label="教龄（年）" value={String(detail.teaching_years ?? "-")} />
        </CardContent>
      </Card>

      {/* 教学信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> 教学信息
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <InfoField label="可授科目" value={joinArray(detail.subjects)} />
          <InfoField label="可授年级" value={joinArray(detail.grade_levels)} />
          <InfoField label="教材版本" value={joinArray(detail.textbook_versions)} full />
          <InfoField label="可授课时间段" value={joinArray(detail.available_times)} icon={<Clock className="h-3.5 w-3.5" />} full />
          <InfoField label="可教学生类型" value={joinArray(detail.student_levels)} full />
          <InfoField label="可教学生地区" value={joinArray(detail.student_regions)} full />
        </CardContent>
      </Card>

      {/* 教学风格与经验 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> 教学风格与经验
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <InfoField label="教学风格" value={detail.teaching_style || "-"} full />
          <InfoField label="教学经验" value={detail.teaching_experience || "-"} full />
          <InfoField label="成功案例" value={detail.success_cases || "-"} full />
          {detail.notes && <InfoField label="备注" value={detail.notes} full />}
        </CardContent>
      </Card>

      {/* 照片与截图 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ImageIcon className="h-4 w-4" /> 照片与评价截图
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.photo_url && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">个人照片</p>
              <img src={detail.photo_url} alt="个人照片" className="max-w-[200px] rounded-lg border" />
            </div>
          )}
          {detail.review_screenshots && Array.isArray(detail.review_screenshots) && detail.review_screenshots.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">评价截图（{detail.review_screenshots.length}张）</p>
              <div className="flex flex-wrap gap-3">
                {detail.review_screenshots.map((url, idx) => (
                  <img key={idx} src={url} alt={`评价截图${idx + 1}`} className="max-w-[200px] rounded-lg border" />
                ))}
              </div>
            </div>
          )}
          {!detail.photo_url && (!detail.review_screenshots || detail.review_screenshots.length === 0) && (
            <p className="text-sm text-muted-foreground">未上传照片或截图</p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        提交时间：{new Date(detail.created_at).toLocaleString('zh-CN')}
      </p>
    </div>
  )
}

function InfoField({ label, value, icon, full }: { label: string; value: string; icon?: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 space-y-1" : "space-y-1"}>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  )
}
