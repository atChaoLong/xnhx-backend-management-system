# 分页功能完整实施指南

## 已完成 ✅

1. ✅ Pagination 组件（包含页大小选择）
2. ✅ usePagination Hook（支持动态页大小）
3. ✅ ClassIn 学生页面（完整示例）
4. ✅ ClassIn API 分页支持（students, teachers, classes, classrooms）

## 快速实施步骤

### 方式一：直接复制学生页面模板

对于任何需要分页的页面，可以参考 `app/dashboard/classin/students/page.tsx` 的实现：

**关键修改点**：
1. 导入分页组件
2. 添加 `pageSize` 状态
3. 更新 API 调用，传递 `from` 和 `to` 参数
4. 添加分页控制UI（三个部分：统计、页大小、分页按钮）

### 方式二：使用代码片段

#### 1. 导入语句
```typescript
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationPageSize,
  PaginationInfo,
} from "@/components/ui/pagination"
import { usePagination } from "@/lib/hooks/usePagination"

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
```

#### 2. Hook 使用
```typescript
const [items, setItems] = useState([])
const [totalCount, setTotalCount] = useState(0)

const {
  currentPage,
  pageSize,
  totalPages,
  canGoNext,
  canGoPrevious,
  goToPage,
  goToNextPage,
  goToPreviousPage,
  handlePageSizeChange,
  getPageRange,
} = usePagination({
  totalCount,
  pageSize: 20,
  onPageChange: (page, size) => fetchItems(page, size),
})
```

#### 3. 数据获取
```typescript
const fetchItems = async (page: number = 1, size: number = pageSize) => {
  const from = (page - 1) * size
  const to = from + size - 1

  const response = await fetch(`/api/resource?from=${from}&to=${to}`)
  const result = await response.json()

  setItems(result.data || [])
  setTotalCount(result.count || 0)
}
```

#### 4. 分页UI
```typescript
{totalPages > 1 && (
  <div className="mt-6 flex items-center justify-between">
    {/* 左侧：统计 */}
    <PaginationInfo {...props} />

    {/* 中间：控制 */}
    <div className="flex items-center gap-4">
      <PaginationPageSize {...props} />
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={goToPreviousPage} />
          </PaginationItem>
          {getPageRange().map((page, index) => {
            if (page === -1) return <PaginationEllipsis key={`ellipsis-${index}`} />
            return (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => goToPage(page)}
                  isActive={page === currentPage}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          })}
          <PaginationItem>
            <PaginationNext onClick={goToNextPage} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>

    {/* 右侧：占位 */}
    <div className="w-auto"></div>
  </div>
)}
```

#### 5. API 更新模板
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = parseInt(searchParams.get('from') || '0')
  const to = parseInt(searchParams.get('to') || '19')

  // 获取总数
  const { count } = await supabaseServer
    .from('table_name')
    .select('*', { count: 'exact', head: true })

  // 分页查询
  const { data, error } = await supabaseServer
    .from('table_name')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to)

  return NextResponse.json({
    success: true,
    data: data || [],
    count: count || 0,
    from,
    to,
  })
}
```

## 待实施页面清单

### ClassIn 模块
- [ ] ClassIn 老师页面（API已完成，需更新前端）
- [ ] ClassIn 班级页面（API已完成，需更新前端）
- [ ] ClassIn 课堂页面（API已完成，需更新前端）

### 核心业务
- [ ] 线索管理 (`/dashboard/leads`)
- [ ] 试听课管理 (`/dashboard/trial-lessons`)
- [ ] 正式订单管理 (`/dashboard/formal-orders`)
- [ ] 学生管理 (`/dashboard/students`)

### 其他页面
- [ ] 每日线索 (`/dashboard/daily-leads`)
- [ ] 老师面试 (`/dashboard/teacher-candidates`)
- [ ] 老师库存 (`/dashboard/teachers`)
- [ ] 异动记录 (`/dashboard/transactions`)

## 优先级建议

### 高优先级（数据量大）
1. 线索管理 - 可能有数百条
2. 试听课管理 - 频繁增长
3. 学生管理 - 长期积累
4. 正式订单管理 - 业务核心

### 中优先级（数据量中等）
5. 每日线索
6. 老师面试
7. 老师库存
8. ClassIn 老师页面

### 低优先级（数据量小）
9. ClassIn 班级页面
10. ClassIn 课堂页面
11. 异动记录

## 实施建议

由于页面较多，建议采用以下策略：

1. **批量更新 API**：先统一更新所有后端 API（已完成ClassIn模块）
2. **前端分批实施**：每批更新3-4个页面
3. **复用代码**：直接复制 ClassIn 学生页面模板
4. **测试验证**：每批更新后测试功能

## 下一步行动

可以按以下顺序继续实施：

**第一批**：ClassIn 模块完成
- 更新 ClassIn 老师、班级、课堂的前端页面

**第二批**：核心业务模块
- 线索管理、试听课管理、正式订单管理

**第三批**：其他页面
- 学生管理、每日线索、老师面试等

每个页面的实施时间约 10-15 分钟，主要是复制模板和调整字段名。
