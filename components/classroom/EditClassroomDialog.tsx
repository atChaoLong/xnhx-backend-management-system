"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { Classroom, EditClassroomParams } from "@/lib/services/classrooms"
import { useToast } from "@/hooks/use-toast"
import { api } from "@/lib/fetch"
import { getClientSafeErrorMessage } from "@/lib/safe-error"

interface EditClassroomDialogProps {
  classroom: Classroom | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EditClassroomDialog({ classroom, isOpen, onClose, onSuccess }: EditClassroomDialogProps) {
  const [formData, setFormData] = useState<Partial<EditClassroomParams>>({})
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (classroom && isOpen) {
      setFormData({
        className: classroom.name,
        beginTime: classroom.start_time,
        endTime: classroom.end_time,
      })
    }
  }, [classroom, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!classroom) return

    try {
      setIsLoading(true)
      
      const params: EditClassroomParams = {
        courseId: classroom.course_id || 0,
        classId: classroom.class_id,
        ...formData,
      }
      
      const response = await api.put('/api/classin/classrooms', params)
      
      if (!response.ok) {
        throw new Error('修改课节失败')
      }
      
      toast({
        title: "修改成功",
        description: `课节 "${formData.className}" 已成功修改`,
      })
      
      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "修改失败",
        description: getClientSafeErrorMessage(error, "修改课节失败", [
          "修改课节失败",
        ]),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof EditClassroomParams, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (!classroom) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>修改课节</DialogTitle>
          <DialogDescription>
            修改课节信息。带 * 的字段为必填项。
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="className" className="text-right">
                课节名称 *
              </Label>
              <Input
                id="className"
                value={formData.className || ''}
                onChange={(e) => handleInputChange('className', e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="beginTime" className="text-right">
                开始时间
              </Label>
              <Input
                id="beginTime"
                type="datetime-local"
                value={formData.beginTime ? new Date(formData.beginTime * 1000).toISOString().slice(0, 16) : ''}
                onChange={(e) => handleInputChange('beginTime', Math.floor(new Date(e.target.value).getTime() / 1000))}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endTime" className="text-right">
                结束时间
              </Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={formData.endTime ? new Date(formData.endTime * 1000).toISOString().slice(0, 16) : ''}
                onChange={(e) => handleInputChange('endTime', Math.floor(new Date(e.target.value).getTime() / 1000))}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="teacherUid" className="text-right">
                教师UID
              </Label>
              <Input
                id="teacherUid"
                type="number"
                value={formData.teacherUid || ''}
                onChange={(e) => handleInputChange('teacherUid', parseInt(e.target.value))}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="teacherName" className="text-right">
                教师姓名
              </Label>
              <Input
                id="teacherName"
                value={formData.teacherName || ''}
                onChange={(e) => handleInputChange('teacherName', e.target.value)}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="record" className="text-right">
                录制
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  id="record"
                  checked={formData.record === 1}
                  onCheckedChange={(checked) => handleInputChange('record', checked ? 1 : 0)}
                />
                <Label htmlFor="record">开启录制</Label>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="live" className="text-right">
                直播
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  id="live"
                  checked={formData.live === 1}
                  onCheckedChange={(checked) => handleInputChange('live', checked ? 1 : 0)}
                />
                <Label htmlFor="live">开启直播</Label>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="replay" className="text-right">
                回放
              </Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Switch
                  id="replay"
                  checked={formData.replay === 1}
                  onCheckedChange={(checked) => handleInputChange('replay', checked ? 1 : 0)}
                />
                <Label htmlFor="replay">开启回放</Label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
