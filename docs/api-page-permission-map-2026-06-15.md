# API / 页面 / 权限关系梳理

日期：2026-06-15；2026-06-16 复核更新

复核范围：
- 页面：`app/dashboard/**/page.tsx`
- 接口：`app/api/**/route.ts`
- 权限定义：`lib/permissions.ts`
- API 路由权限：`lib/route-permissions.ts`
- 前端服务与直接请求：`lib/services/**`、`api.*`、`fetch('/api/...')`
- 菜单可见性：`components/dashboard/sidebar.tsx`

说明：本文件是静态扫描 + 针对性代码复核结果。页面 import 了某个 service 时，实际是否触发接口仍取决于按钮、分支和用户操作。

## 当前结论

上一版清单里有一批“阻塞项”已经不是当前代码真实问题，主要是旧接口迁移后文档没有同步。本次已按当前代码重新校准。

| 类型 | 结论 | 当前状态 |
| --- | --- | --- |
| 路由权限登记 | `pnpm audit:routes` 通过，当前没有未登记的受保护 API route | ✅ 已通过 |
| TypeScript | `pnpm exec tsc --noEmit` 通过 | ✅ 已通过 |
| 交易编辑/删除 | `admin` 已拥有 `transactions.edit/delete`；`PUT /api/transactions` 也允许 edit/payment/verify 类动作 | ✅ 已修复 |
| 课程/排课权限 | `/api/courses/**` 已改用 `courses.*`，不再错误依赖 `formalOrders.*` | ✅ 已修复 |
| 批量排课旧接口 | 当前页面使用 `/api/schedule/batch/precheck` 和 `/api/schedule/batch/create-classin`，没有调用 `/api/class-sessions/batch` | ✅ 文档旧误报 |
| 自动待办旧接口 | 当前代码没有调用 `/api/todos/auto` | ✅ 文档旧误报 |
| ClassIn 注册旧接口 | 测试页使用 `/api/classin-sdk/register/student`、`/api/classin-sdk/register/teacher`；本地镜像 `/api/classin/students|teachers` 只做 GET 列表 | ✅ 文档旧误报 |
| 招师候选创建 | `POST /api/teacher-candidates` 已改为 `teacherCandidates.create`，前端 `teacherCandidates.create()` 同步对齐 | ✅ 本次修复 |
| 试听建班权限 | `admin` 已补 `trialLessons.addLink`；试听详情页无权限时不再显示“创建 ClassIn 课程”按钮 | ✅ 本次修复 |
| 页面/请求矩阵 | 当前扫到 69 个 dashboard 页面，其中 54 个页面直接或通过 service 调用 API | ✅ 本次复核 |
| 公共线索池 | 页面、菜单、接口统一收口到 `leads.assign`，避免只有页面拦截、接口仍可查看 | ✅ 本次修复 |
| 新建试听页 | 页面角色口径改为 sales，和 `trialLessons.create` 实际权限一致 | ✅ 本次修复 |

## 本次实际修复

| 文件 | 修复点 |
| --- | --- |
| `lib/permissions.ts` | `admin.trialLessons` 增加 `addLink`，允许管理员执行试听开班/建班；`admin.teacherCandidates` 增加 `create` |
| `lib/route-permissions.ts` | `POST /api/teacher-candidates` 从 `teacherCandidates.interview` 改为 `teacherCandidates.create` |
| `lib/route-permissions.ts` | `GET /api/public-leads` 从 `leads.view` 改为 `leads.assign`，和公共线索池页面/菜单保持一致 |
| `lib/dashboard-route-access.ts` | `/dashboard/trial-lessons/new` 角色从 sales/head_teacher 收敛为 sales，和 `trialLessons.create` 保持一致 |
| `lib/hooks/usePermission.ts` | `teacherCandidates.create()` 改为检查 `ACTIONS.create`，不再借用 `interview` |
| `app/dashboard/trial-lessons/[id]/page.tsx` | 试听详情页创建 ClassIn 课程按钮按 `trialLessons.addLink` 显示；无权限时 handler 返回明确“权限不足” |

## 鉴权模型

API 鉴权入口在 `lib/route-permissions.ts`：

1. `/api/auth/**`、`/api/teacher-form/**`、`/api/health`、`/api/init-admin`、`/api/classin/callback` 是公开或特殊校验接口。
2. 其他 `/api/**` 必须在 `ROUTE_PERMISSIONS` 中登记。
3. 未登记会返回 `ROUTE_PERMISSION_UNREGISTERED`。
4. 已登记接口会先认证用户，再用 `hasPermission(role, resource, action)` 判断。
5. 如果一个接口配置多个 action，是 OR 关系，满足任意一个即可。

页面权限：

- `middleware.ts` 只处理登录态和基础跳转，不按角色硬拦截 `/dashboard/**`。
- 菜单可见性由 `components/dashboard/sidebar.tsx` 控制。
- `/dashboard/**` 直接访问由 `app/dashboard/layout.tsx` 调用 `lib/dashboard-route-access.ts` 做页面级拦截。
- 最终安全边界仍在 API 层。

## 角色权限摘要

| 角色 | 当前定位 | 关键限制 |
| --- | --- | --- |
| `admin` | 系统管理员 | 不是日常业务超级账号；不直接创建试听、不直接反馈线索、不转化试听 |
| `operator` | 运营 | 能创建/编辑线索，能查看试听/订单/课节/交易；不能反馈线索、不能创建试听 |
| `sales` | 销售 | 能创建线索、反馈线索、转化试听、创建正式订单、创建/完成相关待办 |
| `head_teacher` | 班主任 | 能看线索、学生、课程、课节，能排课和回访；不能创建试听 |
| `teacher` | 老师 | 以查看和资料维护为主；仍拥有 `teachers.create/edit`，业务上建议再确认 |
| `academic_affairs` | 教务 | 能处理试听匹配、确认、开班/建班、课程和课节；拥有正式订单只读用于排课/核对 |
| `finance` | 财务 | 能查看交易并做付款相关动作；不做业务资料编辑 |
| `teacher_recruiter` | 招师 | 菜单仅显示教务管理 > 面试管理；接口保留候选创建、约面、评价、上传视频能力；2026-06-17 线上专项 UI 24/24、API 270/270 通过 |
| `hr` | HR | 能入库确认、绩效核验、查看部分候选数据 |

## 权限资源限制

| 资源动作 | 当前可用角色 |
| --- | --- |
| `leads.view` | admin、operator、sales、head_teacher、teacher、finance |
| `leads.create` | admin、operator、sales、head_teacher |
| `leads.edit` | admin、operator |
| `leads.feedback` | sales |
| `leads.assign` | sales |
| `trialLessons.view` | admin、operator、sales、head_teacher、teacher、academic_affairs、finance |
| `trialLessons.create` | sales |
| `trialLessons.edit` | admin、sales、head_teacher、teacher、academic_affairs |
| `trialLessons.addLink` | admin、academic_affairs |
| `trialLessons.convert` | sales |
| `students.create` | admin、sales、head_teacher |
| `students.edit` | admin、sales、head_teacher、teacher、academic_affairs |
| `formalOrders.view` | admin、operator、sales、head_teacher、teacher、academic_affairs、finance |
| `formalOrders.create` | admin、sales、head_teacher |
| `formalOrders.edit/delete` | admin |
| `classSessions.create/edit` | admin、head_teacher、academic_affairs |
| `courses.view/edit` | admin、operator、sales、head_teacher、teacher、academic_affairs、finance 等按矩阵 |
| `transactions.create` | admin、head_teacher、academic_affairs |
| `transactions.payment` | admin、academic_affairs、finance |
| `transactions.verifyHours` | admin、academic_affairs |
| `transactions.verifyPerformance` | admin、academic_affairs、hr |
| `transactions.edit/delete` | admin；教务可 edit |
| `teacherCandidates.create` | admin、teacher_recruiter |
| `teacherCandidates.interview/evaluate` | admin、teacher_recruiter；教务可 evaluate |
| `teacherCandidates.confirmEntry` | admin、academic_affairs、finance、hr |
| `teacherCandidates.uploadVideo` | admin、teacher_recruiter |
| `teacherCandidates.reviewVideo` | admin、academic_affairs |
| `teachers.notes` | admin、academic_affairs |
| `todos.create` | admin、operator、sales、academic_affairs |
| `uploads.create` | 除 hr 外的大多数业务角色 |

## 页面和接口关系

| 页面 | 主要调用接口 |
| --- | --- |
| `/dashboard/leads` | `/api/leads`、`/api/leads/[id]`、`/api/leads/feedback`、`/api/leads/release`、`/api/dictionaries`、`/api/todos`、`/api/todos/[id]/complete`、`/api/upload` |
| `/dashboard/leads/new` | `/api/leads`、`/api/dictionaries`、`/api/upload` |
| `/dashboard/leads/[id]/edit` | `/api/leads`、`/api/leads/[id]`、`/api/dictionaries`、`/api/upload` |
| `/dashboard/public-leads` | `/api/public-leads`、`/api/leads`、`/api/leads/[id]`、`/api/leads/grab`、`/api/dictionaries` |
| `/dashboard/trial-lessons` | `/api/trial-lessons`、`/api/trial-lessons/open-class`、`/api/dictionaries`、`/api/teachers`、`/api/teachers/classin` |
| `/dashboard/trial-lessons/new` | `/api/trial-lessons`、`/api/leads`、`/api/students`、`/api/teachers`、`/api/teachers/classin`、`/api/upload` |
| `/dashboard/trial-lessons/[id]` | `/api/trial-lessons`、`/api/trial-lessons/create-classin`、`/api/dictionaries` |
| `/dashboard/trial-lessons/[id]/edit` | `/api/trial-lessons`、`/api/dictionaries`、`/api/teachers`、`/api/teachers/classin`、`/api/upload` |
| `/dashboard/academic/pending-trials` | `/api/trial-lessons`、`/api/trial-lessons/open-class`、`/api/dictionaries`、`/api/teachers`、`/api/teachers/classin` |
| `/dashboard/formal-orders` | `/api/formal-orders` |
| `/dashboard/formal-orders/new` | `/api/formal-orders`、`/api/leads`、`/api/students`、`/api/teachers`、`/api/teachers/classin`、`/api/trial-lessons`、`/api/dictionaries`、`/api/upload` |
| `/dashboard/students` | `/api/students`、`/api/students/assign-head-teacher`、`/api/students/update-status`、`/api/student-entries/confirm`、`/api/users` |
| `/dashboard/students/[id]` | `/api/students/detail`、`/api/courses/[courseId]/sessions`、`/api/class-sessions/recreate`、`/api/transactions`、`/api/visit-records`、`/api/dictionaries` |
| `/dashboard/schedule/batch` | `/api/formal-orders`、`/api/courses/by-order/[orderId]`、`/api/schedule/batch/precheck`、`/api/schedule/batch/create-classin`、`/api/students`、`/api/teachers`、`/api/teachers/classin` |
| `/dashboard/classroom` | `/api/class-sessions/export`、`/api/classrooms/scheduled`、`/api/students` |
| `/dashboard/calendar` | `/api/class-sessions`、`/api/visit-records` |
| `/dashboard/courses/[id]` | `/api/courses`、`/api/courses/[courseId]/sessions`、`/api/class-sessions`、`/api/class-sessions/recreate`、`/api/class-sessions/sync` |
| `/dashboard/transactions` | `/api/transactions` |
| `/dashboard/transactions/new` | `/api/transactions`、`/api/formal-orders`、`/api/students`、`/api/students/detail` |
| `/dashboard/transactions/[id]/edit` | `/api/transactions` |
| `/dashboard/todos` | `/api/todos`、`/api/todos/[id]/complete` |
| `/dashboard/teacher-candidates` | `/api/teacher-candidates` |
| `/dashboard/teacher-candidates/new` | `/api/teacher-candidates`、`/api/dictionaries`、`/api/upload` |
| `/dashboard/teacher-candidates/[id]/edit` | `/api/teacher-candidates` |
| `/dashboard/teacher-candidates/[id]/entry` | `/api/teacher-candidates`、`/api/teacher-entries/confirm` |
| `/dashboard/teacher-candidates/interview` | `/api/teacher-candidates` |
| `/dashboard/teacher-candidates/upload` | `/api/teacher-candidates` |
| `/dashboard/teacher-candidates/review` | `/api/teacher-candidates` |
| `/dashboard/teachers/new` | `/api/teachers`、`/api/teachers/classin`、`/api/upload` |
| `/dashboard/teachers/[id]` | `/api/teachers`、`/api/teachers/classin`、`/api/teacher-candidates` |
| `/dashboard/teachers/exceptions` | `/api/teachers/exceptions` |
| `/dashboard/classin` | `/api/classin/classrooms` |
| `/dashboard/classin/classes` | `/api/classin/classes` |
| `/dashboard/classin/classes/from-order` | `/api/classin/classes`、`/api/formal-orders`、`/api/students`、`/api/teachers`、`/api/teachers/classin` |
| `/dashboard/classin/students` | `GET /api/classin/students` |
| `/dashboard/classin/teachers` | `GET /api/classin/teachers` |
| `/dashboard/classin/test` | `/api/classin/login`、`GET /api/classin/students`、`GET /api/classin/teachers`、`POST /api/classin-sdk/register/student`、`POST /api/classin-sdk/register/teacher` |
| `/dashboard/classin-sdk` | `/api/classin-sdk/course`、`/api/classin-sdk/classroom`、`/api/classin-sdk/unit`、`/api/classin-sdk/register/student`、`/api/classin-sdk/register/teacher`、`/api/classin-sdk/complete` |
| `/dashboard/sync` | `/api/sync/classes`、`/api/sync/classrooms`、`/api/sync/students`、`/api/sync/teachers` |
| `/dashboard/quality/trial-conversion` | `/api/quality-reports`、`/api/quality-reports/export`、`/api/trial-lessons` |
| `/dashboard/quality/service` | `/api/quality-reports`、`/api/quality-reports/export`、`/api/students` |
| `/dashboard/dictionaries` | `/api/dictionaries` |
| `/dashboard/accounts` | `/api/users` |
| `/dashboard/daily-leads` | `/api/daily-leads`、`/api/upload` |
| `/dashboard/wechat-accounts` | `/api/wechat-accounts` |
| `/dashboard/feedback` | `/api/visit-records`、`/api/students`、`/api/dictionaries` |

## 全量静态索引

本节是直接从当前代码扫描出的完整调用面，用来和上面的业务页面关系互相校验。

| 项目 | 数量 | 结论 |
| --- | ---: | --- |
| API route 文件 | 85 | 已全部清点 |
| 页面直接调用 API 的页面 | 27 | 已列出直接 `fetch('/api/...')` 调用 |
| 涉及 API 调用的文件 | 56 | 包含页面、组件、hooks、service、token refresh 等 |
| 受保护 API 权限登记 | 72/85 | `pnpm audit:routes` 通过，无漏登记 |
| 特殊/公开接口 | 13/85 | auth、teacher-form、health、init-admin、ClassIn callback 等 |

### 所有 API 路由

| 接口 | 方法 |
| --- | --- |
| `/api/auth/profile` | GET |
| `/api/auth/refresh` | POST |
| `/api/auth/session` | GET |
| `/api/auth/signin` | POST |
| `/api/auth/signout` | POST |
| `/api/auth/signup` | POST |
| `/api/class-sessions` | DELETE、GET、POST、PUT |
| `/api/class-sessions/export` | GET |
| `/api/class-sessions/recreate` | POST |
| `/api/class-sessions/sync` | POST |
| `/api/classin-sdk/classroom` | POST |
| `/api/classin-sdk/complete` | POST |
| `/api/classin-sdk/course` | POST |
| `/api/classin-sdk/diagnostics` | GET |
| `/api/classin-sdk/register/student` | POST |
| `/api/classin-sdk/register/teacher` | POST |
| `/api/classin-sdk/unit` | POST |
| `/api/classin/callback` | DELETE、GET、POST、PUT |
| `/api/classin/classes` | GET、POST |
| `/api/classin/classrooms` | DELETE、GET、PUT |
| `/api/classin/classrooms/test` | GET、POST |
| `/api/classin/login` | POST |
| `/api/classin/students` | GET |
| `/api/classin/teachers` | GET |
| `/api/classroom-classin` | GET |
| `/api/classrooms/scheduled` | GET |
| `/api/cleanup-all-admins` | POST |
| `/api/courses` | DELETE、GET、POST、PUT |
| `/api/courses/[courseId]/consumption` | GET |
| `/api/courses/[courseId]/sessions` | GET |
| `/api/courses/[courseId]/sync-stats` | POST |
| `/api/courses/by-order/[orderId]` | GET |
| `/api/courses/link-classin` | POST |
| `/api/daily-leads` | DELETE、GET、POST、PUT |
| `/api/debug/current-user` | GET |
| `/api/debug/network-test` | GET |
| `/api/dictionaries` | DELETE、GET、POST、PUT |
| `/api/formal-orders` | DELETE、GET、POST、PUT |
| `/api/health` | GET |
| `/api/init-admin` | GET、POST |
| `/api/leads` | GET、POST、PUT |
| `/api/leads/[id]` | DELETE、GET |
| `/api/leads/feedback` | POST |
| `/api/leads/grab` | POST |
| `/api/leads/release` | POST |
| `/api/public-leads` | GET |
| `/api/quality-reports` | GET、POST、PUT |
| `/api/quality-reports/export` | GET |
| `/api/schedule/batch/create-classin` | POST |
| `/api/schedule/batch/precheck` | POST |
| `/api/student-entries/confirm` | POST |
| `/api/students` | DELETE、GET、POST、PUT |
| `/api/students/assign-head-teacher` | POST |
| `/api/students/detail` | GET |
| `/api/students/register-classin` | POST |
| `/api/students/status-history` | GET |
| `/api/students/update-status` | PUT |
| `/api/sync/classes` | POST |
| `/api/sync/classrooms` | POST |
| `/api/sync/students` | POST |
| `/api/sync/teachers` | POST |
| `/api/teacher-candidates` | DELETE、GET、POST、PUT |
| `/api/teacher-candidates/recruitment-flow` | GET、PUT |
| `/api/teacher-entries` | POST |
| `/api/teacher-entries/confirm` | POST |
| `/api/teacher-entries/register-classin` | POST |
| `/api/teacher-form` | GET、POST |
| `/api/teacher-form/dictionaries` | GET |
| `/api/teacher-form/upload` | POST |
| `/api/teacher-form/verify` | POST |
| `/api/teachers` | DELETE、GET、POST、PUT |
| `/api/teachers/classin` | GET |
| `/api/teachers/exceptions` | GET、POST |
| `/api/teachers/register-classin` | POST |
| `/api/todos` | DELETE、GET、POST、PUT |
| `/api/todos/[id]/complete` | POST |
| `/api/transactions` | DELETE、GET、POST、PUT |
| `/api/trial-lessons` | DELETE、GET、POST、PUT |
| `/api/trial-lessons/create-classin` | POST |
| `/api/trial-lessons/open-class` | POST |
| `/api/upload` | POST |
| `/api/user-profiles` | GET |
| `/api/users` | DELETE、GET、POST、PUT |
| `/api/visit-records` | DELETE、GET、POST、PUT |
| `/api/wechat-accounts` | DELETE、GET、POST、PUT |

### 页面直接 API 调用

这些是页面文件里直接出现的 `/api/...` 调用；没有包含通过 `lib/services/**` 间接调用的部分。

| 页面 | 直接调用 |
| --- | --- |
| `app/dashboard/academic/pending-trials/page.tsx` | `/api/trial-lessons/open-class` |
| `app/dashboard/calendar/page.tsx` | `/api/class-sessions`、`/api/visit-records` |
| `app/dashboard/classin/classes/from-order/page.tsx` | `/api/classin/classes` |
| `app/dashboard/classin/classes/page.tsx` | `/api/classin/classes` |
| `app/dashboard/classin/page.tsx` | `/api/classin/classrooms` |
| `app/dashboard/classin/students/page.tsx` | `/api/classin/students` |
| `app/dashboard/classin/teachers/page.tsx` | `/api/classin/teachers` |
| `app/dashboard/classin/test/page.tsx` | `/api/classin-sdk/register/student`、`/api/classin-sdk/register/teacher`、`/api/classin/login` |
| `app/dashboard/classin-sdk/page.tsx` | `/api/classin-sdk/classroom`、`/api/classin-sdk/complete`、`/api/classin-sdk/course`、`/api/classin-sdk/register/student`、`/api/classin-sdk/register/teacher`、`/api/classin-sdk/unit` |
| `app/dashboard/classroom/page.tsx` | `/api/class-sessions/export`、`/api/classrooms/scheduled`、`/api/students` |
| `app/dashboard/courses/[id]/page.tsx` | `/api/class-sessions`、`/api/class-sessions/recreate`、`/api/class-sessions/sync`、`/api/courses`、`/api/courses/[id]/sessions` |
| `app/dashboard/feedback/page.tsx` | `/api/students`、`/api/visit-records` |
| `app/dashboard/leads/page.tsx` | `/api/leads/feedback`、`/api/leads/release` |
| `app/dashboard/public-leads/page.tsx` | `/api/leads/grab` |
| `app/dashboard/schedule/batch/page.tsx` | `/api/class-sessions`、`/api/courses/by-order/[id]`、`/api/schedule/batch/create-classin`、`/api/schedule/batch/precheck` |
| `app/dashboard/students/[id]/page.tsx` | `/api/class-sessions/recreate`、`/api/courses/[id]/sessions`、`/api/students/detail`、`/api/visit-records` |
| `app/dashboard/students/page.tsx` | `/api/student-entries/confirm`、`/api/students`、`/api/students/assign-head-teacher`、`/api/students/update-status`、`/api/users` |
| `app/dashboard/sync/page.tsx` | `/api/sync/classes`、`/api/sync/classrooms`、`/api/sync/students`、`/api/sync/teachers` |
| `app/dashboard/teacher-candidates/[id]/entry/page.tsx` | `/api/teacher-entries/confirm` |
| `app/dashboard/teachers/[id]/page.tsx` | `/api/teacher-candidates` |
| `app/dashboard/teachers/exceptions/page.tsx` | `/api/teachers/exceptions` |
| `app/dashboard/transactions/new/page.tsx` | `/api/students/detail` |
| `app/dashboard/trial-lessons/[id]/page.tsx` | `/api/trial-lessons/create-classin` |
| `app/dashboard/trial-lessons/page.tsx` | `/api/trial-lessons/open-class` |
| `app/login/page.tsx` | `/api/auth/session`、`/api/auth/signin` |
| `app/page.tsx` | `/api/auth/session` |
| `app/teacher-form/page.tsx` | `/api/teacher-form`、`/api/teacher-form/upload`、`/api/teacher-form/verify` |

### 服务层 API 调用

| 文件 | 调用接口 |
| --- | --- |
| `lib/services/classrooms.ts` | `/api/classin/classrooms`、`/api/classroom-classin` |
| `lib/services/courses.ts` | `/api/class-sessions`、`/api/courses`、`/api/courses/[courseId]/consumption`、`/api/courses/[courseId]/sessions`、`/api/courses/[courseId]/sync-stats`、`/api/courses/by-order/[orderId]`、`/api/courses/link-classin` |
| `lib/services/dailyLeads.ts` | `/api/daily-leads` |
| `lib/services/dictionary.ts` | `/api/dictionaries`、`/api/teacher-form/dictionaries` |
| `lib/services/formalOrders.ts` | `/api/formal-orders` |
| `lib/services/leads.ts` | `/api/leads`、`/api/leads/[id]` |
| `lib/services/qualityReports.ts` | `/api/quality-reports`、`/api/quality-reports/export` |
| `lib/services/recruitmentFlow.ts` | `/api/teacher-candidates/recruitment-flow` |
| `lib/services/students.ts` | `/api/students` |
| `lib/services/teacherCandidates.ts` | `/api/teacher-candidates` |
| `lib/services/teachers.ts` | `/api/teachers`、`/api/teachers/classin` |
| `lib/services/todos.ts` | `/api/todos`、`/api/todos/[id]/complete` |
| `lib/services/transactions.ts` | `/api/transactions` |
| `lib/services/trialLessons.ts` | `/api/trial-lessons` |
| `lib/services/upload.ts` | `/api/upload` |
| `lib/services/userProfiles.ts` | `/api/user-profiles` |
| `lib/services/users.ts` | `/api/users` |
| `lib/services/wechatAccounts.ts` | `/api/wechat-accounts` |

### 其他 API 调用入口

| 文件 | 调用接口 |
| --- | --- |
| `app/signup/signup-client.tsx` | `/api/auth/signup` |
| `app/debug/auth/auth-debug-client.tsx` | `/api/auth/session` |
| `components/classroom/EditClassroomDialog.tsx` | `/api/classin/classrooms` |
| `components/teacher/recruitment/SalaryNegotiationForm.tsx` | `/api/teacher-entries/confirm` |
| `lib/fetch.ts` | `/api/auth/signout` |
| `lib/hooks/useCurrentUser.ts` | `/api/auth/profile` |
| `lib/middleware.ts` | `/api/auth/profile` |
| `lib/supabase-client.ts` | `/api/upload` |
| `lib/tokenRefreshManager.ts` | `/api/auth/refresh` |

## 仍需业务确认

这些不是代码阻塞，但会影响手工测试时如何判断“正确”：

| 项目 | 当前实现 | 需要确认 |
| --- | --- | --- |
| admin 是否是超级业务账号 | 当前不是：不创建试听、不反馈线索、不转化试听 | 是否继续保持“管理账号不做业务动作” |
| operator 是否能反馈线索 | 当前不能，只能创建/编辑线索 | 运营是否只负责线索录入和资料修正 |
| public leads 是否给 admin | 已决策为销售专属；页面、菜单、接口均只允许 `sales + leads.assign` | 管理员不进入公共线索池，后续如需管理视角应另做只读/分配看板 |
| teacher 的老师资料创建/编辑 | 当前 teacher 有 `teachers.create/edit` | 是否符合老师自助维护资料的业务设计 |
| 教务是否需要正式订单只读 | 当前教务已有 `formalOrders.view`，用于批量排课、学生/订单核对等链路 | 是否需要在菜单上单独给教务暴露正式订单列表 |

## 手工测试建议

| 账号 | 优先测试路径 | 预期 |
| --- | --- | --- |
| `yy001` 运营 | 新建线索、编辑线索、查看试听/订单/课节、创建待办 | 能录入和修正线索；不能反馈线索、不能创建试听 |
| `xs001` 销售 | 新建线索、反馈线索、创建试听、试听转正式、创建正式订单、待办完成 | 销售主链路可走通；无权限的管理动作不展示或返回权限不足 |
| `bzr001` 班主任 | 学生详情、排课、回访、课节查看 | 能处理学生服务链路；不能创建试听 |
| `jw001` 教务 | 试听列表、待开班、创建 ClassIn、批量排课、课程课节 | 能完成试听开班和排课主链路 |
| `admin` | 账号、字典、交易编辑删除、试听开班、招师候选创建 | 管理能力可用；业务反馈/转化类动作按限制不应出现 |

## 验证记录

```text
pnpm audit:routes
API route permission audit: 72/85 protected route files checked
Permission table entries: 73
No missing protected API route permission mappings.

pnpm exec tsc --noEmit
通过，无 TypeScript 错误。

git diff --check
通过，无空白格式问题。
```
