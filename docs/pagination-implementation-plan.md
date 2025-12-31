# 列表页面分页功能统一规划

## 概述

为系统中所有列表页面添加统一的分页功能，提升大数据量场景下的用户体验。

## 核心组件

### 1. Pagination 组件
**位置**: `components/ui/pagination.tsx`

**组件**:
- `Pagination` - 导航容器
- `PaginationContent` - 内容容器
- `PaginationItem` - 分页项
- `PaginationLink` - 页码链接
- `PaginationPrevious` - 上一页按钮
- `PaginationNext` - 下一页按钮
- `PaginationEllipsis` - 省略号

**特点**:
- 基于 shadcn/ui 设计风格
- 支持页码高亮
- 自动省略号处理
- 响应式设计

### 2. usePagination Hook
**位置**: `lib/hooks/usePagination.ts`

**功能**:
```typescript
const {
  currentPage,      // 当前页码
  totalPages,       // 总页数
  canGoNext,        // 是否可下一页
  canGoPrevious,    // 是否可上一页
  goToPage,         // 跳转到指定页
  goToNextPage,     // 下一页
  goToPreviousPage, // 上一页
  getPageRange,     // 获取显示的页码范围
} = usePagination({
  totalPages,
  initialPage,
  onPageChange,
})
```

**特点**:
- 自动计算页码范围
- 支持省略号显示（当页数过多时）
- 边界检查（不能超出范围）
- 页码变化回调

## 标准实现模式

### 前端页面标准模板

```typescript
"use client"

import { useState, useEffect } from "react"
import { usePagination } from "@/lib/hooks/usePagination"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

const PAGE_SIZE = 20 // 每页显示条数

export default function ListPage() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  // 分页 hook
  const {
    currentPage,
    canGoNext,
    canGoPrevious,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    getPageRange,
  } = usePagination({
    totalPages: 1,
    onPageChange: (page) => fetchItems(page),
  })

  // 加载数据
  const fetchItems = async (page: number = 1) => {
    try {
      setIsLoading(true)
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const response = await fetch(`/api/resource?from=${from}&to=${to}`)
      const result = await response.json()

      setItems(result.data || [])
      setTotalCount(result.count || 0)
    } catch (error) {
      // 错误处理
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItems(1)
  }, [])

  return (
    <div>
      {/* 统计信息 */}
      <p>
        共 {totalCount} 条记录，第 {currentPage} / {Math.ceil(totalCount / PAGE_SIZE)} 页
      </p>

      {/* 数据表格 */}
      <Table>
        {/* 表格内容 */}
      </Table>

      {/* 分页组件 */}
      {Math.ceil(totalCount / PAGE_SIZE) > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={goToPreviousPage}
                className={!canGoPrevious ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>

            {getPageRange().map((page, index) => {
              if (page === -1) {
                return (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                )
              }

              return (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => goToPage(page)}
                    isActive={page === currentPage}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              )
            })}

            <PaginationItem>
              <PaginationNext
                onClick={goToNextPage}
                className={!canGoNext ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
```

### 后端 API 标准模板

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = parseInt(searchParams.get('from') || '0')
    const to = parseInt(searchParams.get('to') || '19')

    // 1. 先获取总数
    const { count: totalCount } = await supabaseServer
      .from('table_name')
      .select('*', { count: 'exact', head: true })

    // 2. 分页查询数据
    const { data, error } = await supabaseServer
      .from('table_name')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      return NextResponse.json(
        { error: '查询失败', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: totalCount || 0,
      from,
      to,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: '服务器错误', details: error.message },
      { status: 500 }
    )
  }
}
```

## 需要实现分页的页面列表

### 1. 线索管理
- **页面**: `/dashboard/leads`
- **API**: `/api/leads`
- **表**: `leads`
- **字段**: created_at

### 2. 试听课管理
- **页面**: `/dashboard/trial-lessons`
- **API**: `/api/trial-lessons`
- **表**: `trial_lessons`
- **字段**: created_at

### 3. 正式订单管理
- **页面**: `/dashboard/formal-orders`
- **API**: `/api/formal-orders`
- **表**: `formal_orders`
- **字段**: created_at

### 4. 每日线索
- **页面**: `/dashboard/daily-leads`
- **API**: `/api/daily-leads`
- **表**: `daily_leads`
- **字段**: received_date

### 5. 老师面试
- **页面**: `/dashboard/teacher-candidates`
- **API**: `/api/teacher-candidates`
- **表**: `teacher_candidates`
- **字段**: created_at

### 6. 老师库存管理
- **页面**: `/dashboard/teachers`
- **API**: `/api/teachers`
- **表**: `teacher_profiles`
- **字段**: created_at

### 7. 学生管理
- **页面**: `/dashboard/students`
- **API**: `/api/students`
- **表**: `students`
- **字段**: created_at

### 8. 异动记录
- **页面**: `/dashboard/transactions`
- **API**: `/api/transactions`
- **表**: `transactions`
- **字段**: created_at

### 9. ClassIn 学生
- **页面**: `/dashboard/classin/students`
- **API**: `/api/classin/students`
- **表**: `students_classin`
- **字段**: created_at ✅ 已完成

### 10. ClassIn 老师
- **页面**: `/dashboard/classin/teachers`
- **API**: `/api/classin/teachers`
- **表**: `teacher_classin`
- **字段**: created_at

### 11. ClassIn 班级
- **页面**: `/dashboard/classin/classes`
- **API**: `/api/classin/classes`
- **表**: `class_classin`
- **字段**: add_time

### 12. ClassIn 课堂
- **页面**: `/dashboard/classin`
- **API**: `/api/classin/classrooms`
- **表**: `classroom_classin`
- **字段**: start_time

## 分页配置

### 每页条数
- **标准值**: 20 条/页
- **可选项**: 10, 20, 50, 100
- **默认**: 20

### 分页按钮显示规则
```typescript
// 当前页周围显示的页数
const delta = 2

// 例如：当前第5页，共20页
// 显示：1 ... 3 4 5 6 7 ... 20
```

### 省略号显示条件
- 当前页与第一页距离 > 2
- 当前页与最后一页距离 > 2

## 最佳实践

### 1. 性能优化
- ✅ 使用数据库索引优化查询
- ✅ 先查询 count，再查询数据
- ✅ 使用 range() 而非 limit() offset()
- ✅ 避免过大的 PAGE_SIZE

### 2. 用户体验
- ✅ 显示总记录数和当前页码
- ✅ 加载状态显示
- ✅ 禁用不可用的分页按钮
- ✅ 支持键盘导航（可选）

### 3. 错误处理
- ✅ API 请求失败时的提示
- ✅ 空数据时的友好提示
- ✅ 页码超出范围时的自动修正

### 4. 数据一致性
- ✅ 分页时保持排序规则一致
- ✅ 翻页时保持筛选条件一致
- ✅ 定期刷新数据避免过期

## 实施步骤

### 第一阶段：核心组件 ✅
1. ✅ 创建 Pagination 组件
2. ✅ 创建 usePagination hook
3. ✅ ClassIn 学生页面实现示例

### 第二阶段：ClassIn 模块
4. ⏳ ClassIn 老师页面
5. ⏳ ClassIn 班级页面
6. ⏳ ClassIn 课堂页面

### 第三阶段：核心业务
7. ⏳ 线索管理
8. ⏳ 试听课管理
9. ⏳ 正式订单管理
10. ⏳ 学生管理

### 第四阶段：其他页面
11. ⏳ 每日线索
12. ⏳ 老师面试
13. ⏳ 老师库存
14. ⏳ 异动记录

## 技术要点

### Supabase 分页查询
```typescript
// 推荐方式：使用 range()
const { data } = await supabaseServer
  .from('table')
  .select('*')
  .range(from, to)  // 从0开始，包含两端

// 避免使用：limit() offset()
const { data } = await supabaseServer
  .from('table')
  .select('*')
  .limit(PAGE_SIZE)
  .offset((page - 1) * PAGE_SIZE)  // 性能较差
```

### 总数查询优化
```typescript
// 使用 head: true 只查询 count，不返回数据
const { count } = await supabaseServer
  .from('table')
  .select('*', { count: 'exact', head: true })
```

## 相关文档
- [Supabase Pagination](https://supabase.com/docs/reference/javascript/pagination)
- [shadcn/ui Pagination](https://ui.shadcn.com/docs/components/pagination)

## 更新日志

### 2025-12-31
- ✅ 创建 Pagination 组件
- ✅ 创建 usePagination hook
- ✅ 更新 ClassIn 学生 API 支持分页
- ✅ 更新 ClassIn 学生页面支持分页
