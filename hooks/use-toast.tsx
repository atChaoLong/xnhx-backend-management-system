import { useState, useEffect } from "react"

export interface Toast {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

let toastCount = 0

export function useToast() {
  const [toasts, setToasts] = useState<Map<number, Toast>>(new Map())

  const toast = (props: Toast) => {
    const id = toastCount++
    setToasts((prev) => new Map(prev).set(id, props))

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }, 3000)

    return id
  }

  return {
    toast,
    toasts,
    dismiss: (id: number) => {
      setToasts((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    },
  }
}

// Simple toast container component
export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {Array.from(toasts.entries()).map(([id, toast]) => (
        <div
          key={id}
          className={`p-4 rounded-lg shadow-lg min-w-[300px] max-w-md ${
            toast.variant === "destructive"
              ? "bg-destructive text-destructive-foreground"
              : "bg-background border"
          }`}
        >
          <div className="font-semibold">{toast.title}</div>
          {toast.description && (
            <div className="text-sm opacity-90 mt-1">{toast.description}</div>
          )}
        </div>
      ))}
    </div>
  )
}
