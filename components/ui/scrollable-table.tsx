"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ScrollableTableProps {
  children: React.ReactNode
  className?: string
  flex?: boolean
  maxHeight?: string | number
  showScrollbar?: boolean
}

/**
 * 可滚动的表格容器 - 使用原生滚动条
 *
 * 特点：
 * - 支持水平和垂直滚动
 * - 支持固定列（通过 sticky 定位）
 * - 使用原生滚动条，简单可靠
 */
export function ScrollableTable({
  children,
  className,
  flex = true,
  maxHeight,
  showScrollbar = true,
}: ScrollableTableProps) {
  return (
    <div
      className={cn(
        "rounded-md border overflow-auto",
        flex && "flex-1",
        showScrollbar && [
          // 自定义滚动条样式
          "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30",
          "[&::-webkit-scrollbar-thumb]:rounded-sm",
          "[&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50",
        ],
        className
      )}
      style={
        !flex
          ? { maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight }
          : undefined
      }
    >
      <div className="min-w-max">
        {children}
      </div>
    </div>
  )
}
