import { useState, useCallback } from 'react'

interface UsePaginationProps {
  totalPages: number
  initialPage?: number
  onPageChange?: (page: number) => void
}

export function usePagination({
  totalPages,
  initialPage = 1,
  onPageChange,
}: UsePaginationProps) {
  const [currentPage, setCurrentPage] = useState(initialPage)

  const goToPage = useCallback(
    (page: number) => {
      const newPage = Math.max(1, Math.min(page, totalPages))
      setCurrentPage(newPage)
      onPageChange?.(newPage)
    },
    [totalPages, onPageChange]
  )

  const goToNextPage = useCallback(() => {
    goToPage(currentPage + 1)
  }, [currentPage, goToPage])

  const goToPreviousPage = useCallback(() => {
    goToPage(currentPage - 1)
  }, [currentPage, goToPage])

  const canGoNext = currentPage < totalPages
  const canGoPrevious = currentPage > 1

  // 计算显示的页码范围
  const getPageRange = () => {
    const range: number[] = []
    const delta = 2 // 当前页前后显示的页数

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i)
    }

    // 始终显示第一页
    if (range[0] > 2) {
      range.unshift(1)
      if (range[1] > 2) {
        range.splice(1, 0, -1) // 添加省略号占位
      }
    }

    // 始终显示最后一页
    if (range[range.length - 1] < totalPages - 1) {
      if (range[range.length - 2] < totalPages - 1) {
        range.push(-1) // 添加省略号占位
      }
      range.push(totalPages)
    }

    return range
  }

  return {
    currentPage,
    totalPages,
    canGoNext,
    canGoPrevious,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    getPageRange,
  }
}
