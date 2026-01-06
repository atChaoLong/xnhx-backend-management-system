"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { TeacherCandidatesService, TeacherCandidate } from "@/lib/services/teacherCandidates"
import { useToast } from "@/hooks/use-toast"

export default function EntryPreviewPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [candidate, setCandidate] = useState<TeacherCandidate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [teacherCode, setTeacherCode] = useState("")
  const [initialPassword, setInitialPassword] = useState("123456")

  const candidateId = params.id as string

  useEffect(() => {
    const fetchCandidate = async () => {
      try {
        setIsLoading(true)
        const data = await TeacherCandidatesService.getTeacherCandidateById(candidateId)
        setCandidate(data)
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "加载失败",
          description: error.message || "无法加载候选人信息",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchCandidate()
  }, [candidateId])

  const handleConfirmEntry = async () => {
    if (!candidate) return
    if (!teacherCode.trim()) {
      toast({
        variant: "destructive",
        title: "校验失败",
        description: "请先填写老师编号",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const resp = await fetch("/api/teacher-entries/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidate.id,
          teacher_code: teacherCode.trim(),
          initial_password: initialPassword,
          status: "active",
        }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "老师入库失败" }))
        throw new Error(err.error || "老师入库失败")
      }

      toast({
        title: "入库成功",
        description: "已保存老师编号并标记为入库",
      })
      router.push("/dashboard/teacher-candidates")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "入库失败",
        description: error.message || "无法入库该候选人",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="老师入库预览" description="确认入库信息" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="flex flex-col h-full">
        <Header title="老师入库预览" description="确认入库信息" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          未找到候选人
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="老师入库预览" description="确认信息后入库" />
      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="teacher_code">老师编号（手动填写）</Label>
              <Input
                id="teacher_code"
                placeholder="请输入老师编号"
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>老师名字</Label>
                <Input value={candidate.name || ""} readOnly />
              </div>
              <div className="space-y-2">
                <Label>老师级别</Label>
                <Input value={candidate.teacher_level || ""} readOnly />
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>课时费（时薪）</Label>
              <Input value={candidate.approved_hourly_rate?.toString() || ""} readOnly />
            </div>
            <div className="space-y-2">
              <Label>手机号</Label>
              <Input value={candidate.wechat_id || ""} readOnly />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="classin_initial_password">ClassIn 初始密码</Label>
            <Input
              id="classin_initial_password"
              placeholder="请输入初始密码"
              value={initialPassword}
              onChange={(e) => setInitialPassword(e.target.value)}
            />
          </div>

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button variant="outline" onClick={() => router.push("/dashboard/teacher-candidates")} disabled={isSubmitting}>
                取消
              </Button>
              <Button onClick={handleConfirmEntry} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    入库中...
                  </>
                ) : (
                  "确认入库"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
