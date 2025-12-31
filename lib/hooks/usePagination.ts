import { useState, useCallback } from 'react'

interface UsePaginationProps {
  totalCount: number
  pageSize?: number
  initialPage?: number
  onPageChange?: (page: number, pageSize: number) => void
}

export function usePagination({
  totalCount,
  pageSize: initialPageSize = 20,
  initialPage = 1,
  onPageChange,
}: UsePaginationProps) {
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)

  // 计算总页数
  const totalPages = Math.ceil(totalCount / pageSize)

  // 页大小改变时，重置到第一页
  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      setPageSize(newPageSize)
      setCurrentPage(1)
      onPageChange?.(1, newPageSize)
    },
    [onPageChange]
  )

  // 跳转到指定页
  const goToPage = useCallback(
    (page: number) => {
      const newPage = Math.max(1, Math.min(page, totalPages))
      setCurrentPage(newPage)
      onPageChange?.(newPage, pageSize)
    },
    [totalPages, pageSize, onPageChange]
  )

  // 下一页
  const goToNextPage = useCallback(() => {
    goToPage(currentPage + 1)
  }, [currentPage, goToPage])

  // 上一页
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
    pageSize,
    totalPages,
    totalCount,
    canGoNext,
    canGoPrevious,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    handlePageSizeChange,
    getPageRange,
  }
}
