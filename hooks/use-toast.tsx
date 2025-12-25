import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export interface Toast {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

let toastCount = 0

// 全局单例 state
let globalToasts: Map<number, Toast> = new Map()
let listeners: Set<(toasts: Map<number, Toast>) => void> = new Set()

// 通知所有监听器
function notifyListeners() {
  listeners.forEach(listener => listener(globalToasts))
}

export function useToast() {
  const [toasts, setToasts] = useState<Map<number, Toast>>(globalToasts)

  // 注册监听器
  useEffect(() => {
    listeners.add(setToasts)

    return () => {
      listeners.delete(setToasts)
    }
  }, [])

  const toast = (props: Toast) => {
    const id = toastCount++
    globalToasts = new Map(globalToasts).set(id, props)
    notifyListeners()

    // 不自动关闭，需要用户手动关闭
    return id
  }

  return {
    toast,
    toasts,
    dismiss: (id: number) => {
      globalToasts = new Map(globalToasts)
      globalToasts.delete(id)
      notifyListeners()
    },
  }
}

// 使用 Dialog 显示提示信息
export function Toaster() {
  const { toasts, dismiss } = useToast()
  const latestToast = Array.from(toasts.entries()).pop()

  if (!latestToast) {
    return null
  }

  const [id, toast] = latestToast
  const isError = toast.variant === "destructive"

  return (
    <Dialog open={true} onOpenChange={(open) => !open && dismiss(id)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isError && <AlertCircle className="h-5 w-5 text-destructive" />}
            <DialogTitle>{toast.title}</DialogTitle>
          </div>
          {toast.description && (
            <DialogDescription className="mt-2">
              {toast.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => dismiss(id)}>确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
