# 黄老师团队问题清单 0601 分析与开发拆解

来源文档：`/Users/t77yq/Downloads/给黄老师团队看的问题清单0601.md`

分析日期：2026-06-08

## 1. 总体结论

这份清单不是单纯的页面 bug 汇总，而是一次围绕 CRM、教务、招师和 ClassIn 集成的系统性整改。核心问题集中在三件事：

1. 权限模型缺少统一的数据范围控制，普通角色可以看到或操作过多敏感数据。
2. 线索、试听、正式订单、正式生之间的业务链路没有形成强约束，用户可以绕开线索直接创建试听或正式订单。
3. 文件上传、登录态、ClassIn 调用这些基础能力不稳定，导致业务功能测试结果反复波动。

当前代码已经有 Next.js API、Supabase、RBAC 权限矩阵、路由权限中间件、ClassIn SDK、老师信息采集表单等基础，但与清单要求仍有明显差距。尤其是“有权限访问某个资源”和“只能看到自己负责的数据”是两层不同问题，目前代码主要解决前者，后者覆盖不足。

## 2. 技术栈与当前结构

项目是 Next.js 16 + React 19 + TypeScript + Supabase。

关键目录：

| 范围 | 代码位置 | 说明 |
|---|---|---|
| 页面 | `app/dashboard/**/page.tsx` | 后台各模块页面 |
| API | `app/api/**/route.ts` | Next.js Route Handlers |
| 服务封装 | `lib/services/*.ts` | 前端调用 API 的服务层 |
| 权限矩阵 | `lib/permissions.ts` | 角色、资源、动作定义 |
| API 权限映射 | `lib/route-permissions.ts` | API 路由到资源动作的映射 |
| API 中间件 | `middleware.ts`, `lib/middleware.ts` | 认证与权限拦截 |
| Supabase 迁移 | `supabase/migrations/*.sql` | 表结构与字段演进 |
| ClassIn | `lib/services/classin*`, `app/api/classin*` | ClassIn 接口与 SDK 封装 |
| 上传 | `app/api/upload/route.ts`, `lib/services/upload.ts` | Supabase Storage 上传 |

## 3. 优先级任务拆解

### P0：权限、隐私、登录和上传稳定性

这些问题优先级最高，因为它们直接影响敏感数据泄露和后续测试稳定性。

| 任务 | 对应原问题 | 当前代码状态 | 主要改动位置 | 验收标准 |
|---|---:|---|---|---|
| 统一角色数据范围过滤 | 1, 9, 21, 补充多条 | 核心线索、试听、正式订单、学生、正式生详情、课程、课节、回访和异动接口已补服务端数据范围；正式订单创建强制合法来源，更新/删除校验单条范围，且编辑接口不再允许改绑来源、编号、订单类型或让非财务级角色改写付款/状态字段 | `app/api/leads/route.ts`, `app/api/trial-lessons/route.ts`, `app/api/formal-orders/route.ts`, `app/api/students/route.ts`, `app/api/class-sessions/route.ts` | 运营只看自己录入线索；销售只看自己创建/负责线索、试听、订单；班主任只看自己负责学生及相关订单/课节；伪造 ID 或来源字段的写请求返回 400/403 |
| 普通角色禁用删除 | 30 | 权限矩阵和路由权限已收紧；账号、线索、待办、学生详情回访、课程课节等高风险页面已按资源权限和行级范围隐藏新增/编辑/删除入口；待办已移除“创建者可删除自己待办”的例外，待办删除前使用受控确认弹窗替代浏览器原生 `confirm()` | `lib/permissions.ts`, `lib/route-permissions.ts`, `lib/hooks/usePermission.ts`, 各列表页/详情页 | 只有 admin 或具备对应删除权限且命中后端范围校验的角色可看到前端按钮；普通角色后端 DELETE 返回 403；`DELETE /api/todos` 仅 admin 可执行 |
| 运营回访管理入口关闭 | 5 | 独立回访管理已从占位页补为真实工作台，页面按学生查看/编辑/删除权限和可访问学生范围控制；无权角色直访显示无权 | `app/dashboard/feedback/page.tsx`, `app/api/visit-records/route.ts`, `components/dashboard/sidebar.tsx` | 具备权限的角色可分页查看、新增、编辑、删除可访问正式生回访记录；运营/销售等无权角色看不到入口且手工访问 `/dashboard/feedback` 显示无权 |
| 抢单前隐藏敏感信息 | 补充 1 | 已对销售未抢单线索脱敏，公共线索池不展示家长微信、聊天截图和客户社媒账号 ID；归属判断已从姓名包含改为 `grab_user_id` 或 `grab_wechat` 精确匹配；线索列表/详情/反馈/抢单/释放接口已改字段白名单和安全摘要日志 | `app/api/leads/route.ts`, `app/api/leads/[id]/route.ts`, `app/api/leads/feedback/route.ts`, `app/api/leads/grab/route.ts`, `app/api/leads/release/route.ts`, `lib/server-lead-access.ts`, `app/dashboard/leads/page.tsx`, `app/dashboard/public-leads/page.tsx` | 未抢单销售看不到家长微信、聊天截图、客户社媒账号 ID；抢单后才显示并允许反馈/丢弃/创建试听；服务端日志不记录截图、微信号或社媒账号原文 |
| 学生、老师、账号与订单敏感字段脱敏 | 1, 9, 21, 补充多条 | 学生、老师、账号、订单、公开老师表单、老师候选人和学生详情聚合已做角色脱敏或字段白名单；学生详情不再全字段返回订单/试听/课程/异动/ClassIn 课堂，异动不返回银行卡字段，老师库存 API 不返回 ClassIn 初始密码或银行卡信息，老师候选人 API 对无入库确认权限角色隐藏银行卡和外显备注，账号管理 API 不返回 ClassIn UID 等扩展敏感字段，课程调试全量日志已移除 | `app/api/students/route.ts`, `app/api/students/detail/route.ts`, `app/api/student-entries/confirm/route.ts`, `app/api/users/route.ts`, `app/api/teachers/route.ts`, `app/api/teacher-candidates/route.ts`, `app/api/teacher-entries/route.ts`, `app/api/teacher-entries/confirm/route.ts`, `app/api/teacher-form/verify/route.ts`, `app/api/teacher-form/route.ts`, `app/api/formal-orders/route.ts`, 学生/老师/订单/账号列表页 | 非管理员/教务看不到学生 ClassIn 初始密码/UID；老师库存 API 不回传 ClassIn 初始密码或银行卡信息；无 `teacherCandidates.confirmEntry` 的角色看不到候选人银行卡和外显备注；账号管理响应只返回页面必要字段；公开老师表单只返回业务必要字段；非管理员/财务/教务看不到订单付款凭证；学生详情不回传无页面必要的银行或 ClassIn 原始字段 |
| 文件上传成功率排查和修复 | 2, 31, 补充付款凭证 | 后台通用上传已按 bucket 校验权限、类型、大小和真实文件头，补空文件拦截、稳定 `UPLOAD_*` 错误 code、content-type 推断、纯 UUID 路径、安全摘要日志、60 秒超时和临时失败自动重试；公开老师表单上传已补空文件、`image/*` 类型、20MB、真实图片文件头、纯 UUID 路径、多图状态处理、45 秒超时和临时失败自动重试，候选人链接验证、微信验证和最终提交也已补 30 秒超时与临时失败自动重试；付款凭证、聊天截图、老师简历、每日线索简历附件、老师库存形象照/好评截图和面试视频前端入口已对齐格式/大小校验，线索新建/编辑/反馈聊天截图会在进入本地队列和发起上传前整组预检；2026-06-12 已补通用上传和公开老师表单上传的二进制签名校验，伪装扩展名或伪造 MIME 的文件会被拒绝，`.docx` 还必须包含 Word 文档结构标记，普通 ZIP 改名不会被当成简历/附件；公开老师表单上传同时要求已验证候选人 ID，服务端会在写入 Storage 前复核候选人、面试状态和是否已提交，文件按候选人目录隔离；后台 `/api/upload` 已移出公开路径并受中间件与 bucket 双层权限保护 | `app/api/upload/route.ts`, `app/api/teacher-form/upload/route.ts`, `app/teacher-form/page.tsx`, `app/dashboard/teacher-candidates/new/page.tsx`, `app/dashboard/daily-leads/new/page.tsx`, `app/dashboard/daily-leads/[id]/edit/page.tsx`, `app/dashboard/teachers/new/page.tsx`, `components/teacher/recruitment/InterviewVideoForm.tsx`, `lib/services/upload.ts`, 相关上传页面、部署代理配置 | png/jpeg/webp/avif/heic/bmp/tiff/pdf/中文文件名/至少 20MB 图片文件可上传；线索聊天截图、老师简历、每日线索简历附件、老师库存形象照/好评截图和面试视频在前端先拦截空文件、超限和不支持格式，失败文件不进入本地上传队列；把文本/脚本/可执行文件改名为 `.jpg/.pdf/.mp4`、普通 ZIP 改名为 `.docx` 或伪造 MIME 时，后端返回类型不匹配错误；老师库存新增页保存的是上传后的 Storage URL，不再保存本地预览 blob/data URL；公开老师表单验证、提交和上传遇到 408/429/5xx 或网络超时时会自动重试，通用上传遇到 408/429/5xx、网络失败或超时时会自动重试；通用和公开老师表单上传 URL/path 不带原始文件名且按候选人目录隔离；线上代理和 Supabase bucket 配置仍需按真实账号/真实 bucket 抽样复测 |
| 登录态频繁失效排查 | 29, 补充 ClassIn 未登录 | 统一 API wrapper 已补 token refresh；后台页面、首页和登录页的系统 API 请求已收敛到 wrapper；公开 auth 错误响应和日志已收敛；客户端刷新失败/登录失败只记录错误摘要，首页 session 探测失败不再打印原始异常，`/api/auth/signin` 与 `/api/auth/refresh` 只返回最小 session（`access_token`、`refresh_token`、`expires_at`、`user.id`），登录页和刷新器也只写入最小 session，token 刷新事件不再携带完整 session，登录页不再额外缓存用户邮箱/姓名到 `localStorage.user`；字典服务、线索新增/编辑、公共线索池、正式订单新建和公开老师表单加载失败时也只输出 `summarizeError` 摘要，不再裸打印原始异常对象；`/debug/auth` 仅输出 token/session 是否存在、长度、用户字段存在性和错误摘要，不再展示 token 前缀、本地完整用户对象或原始异常；2026-06-11 已补 `/api/auth/refresh/session/signin/signup/signout`、`lib/middleware.ts`、`lib/supabase-client.ts` 的 raw message/stack 收敛和权限检查通用错误响应；登录、刷新、session、profile、通用 API 权限检查和路由内共享用户档案解析已统一拦截 `is_active=false` 停用账号，`/api/upload` 也会返回 `ACCOUNT_DISABLED` 终态错误码；前端请求封装和刷新器收到 `ACCOUNT_DISABLED` / `PROFILE_NOT_FOUND` / `PROFILE_LOOKUP_FAILED` 后会清除本地 session/token/user 缓存，401/403/5xx 以及 token 刷新后重试响应都会统一识别这些终态错误码；2026-06-12 已补 active profile 查询的 Supabase service role 配置显式校验，生产缺 `SUPABASE_SERVICE_ROLE_KEY` 时不再静默降级为 anon key 撞 RLS，而是记录 `SUPABASE_SERVICE_ROLE_KEY_MISSING` 并返回可定位的档案服务配置错误；剩余裸 fetch 为刷新器自身、公开老师表单和外部 ClassIn/网络诊断请求 | `lib/fetch.ts`, `lib/tokenRefreshManager.ts`, `lib/hooks/useTokenRefresh.ts`, `app/api/auth/*`, `lib/middleware.ts`, `lib/supabase.ts`, `lib/server-active-profile.ts`, 首页/登录页、`/debug/auth`、直接 fetch 的页面/API | 1 分钟不操作不应自动退出；401 能刷新或给出明确重新登录提示；公开 auth 日志不记录原始账号/邮箱、密码长度、token 长度、token 前缀、原始异常 message/stack 或完整 session；本地 `supabase.auth.session` 不应缓存完整 Supabase user；生产必须配置 `SUPABASE_SERVICE_ROLE_KEY`，登录后用户档案查询不能用 anon key 静默兜底；停用账号或档案校验失败账号不应拿到 session/profile 或继续访问后台 API，前端也不应继续保留本地登录态；客户端高敏入口加载失败不应在浏览器控制台暴露原始异常对象 |
| 公开注册入口默认关闭 | 登录/权限补充 | `/signup` 与 `POST /api/auth/signup` 已默认 404；登录页不再保留注册链接；注册接口即使显式开启也只提交注册申请，不返回 session/token/注册邮箱，若 Supabase 自动签发 session 会由服务端尝试撤销 | `app/signup/page.tsx`, `app/signup/signup-client.tsx`, `app/api/auth/signup/route.ts`, `app/login/page.tsx`, `lib/server-auth-session-cleanup.ts` | 生产默认 404；仅显式 `ENABLE_PUBLIC_SIGNUP=true` 可开启；开启时也不返回 `session`、`access_token`、`refresh_token` 或注册邮箱；注册申请不能直接形成可用后台登录态 |

### P1：线索与公共线索池

| 任务 | 对应原问题 | 当前代码状态 | 主要改动位置 | 验收标准 |
|---|---:|---|---|---|
| 线索编号自动生成 | 3 | 已实现后端生成；新增页不再手填，编辑页只读，更新接口忽略客户端编号 | `app/api/leads/route.ts`, `app/dashboard/leads/new/page.tsx`, `app/dashboard/leads/[id]/edit/page.tsx`, `supabase/migrations/057_add_lead_report_number_generator.sql` | 优先按 `channel_platform` 前缀生成“渠道_000000001”，并发创建使用数据库序列避免重复 |
| 新增渠道平台和客户社媒账号 ID | 4 | 已新增字段、前端表单和后端重复提示；重复不阻断提交 | `supabase/migrations/058_add_lead_channel_social_fields.sql`, `lib/services/leads.ts`, `app/api/leads/route.ts`, 线索新增/编辑/列表页 | 提交时按渠道平台 + 社媒账号 ID 查重，重复线索淡蓝色标识 |
| 销售、班主任可录入线索 | 7, 补充销售新增线索 | 已补 `leads.create`；后端会把销售/班主任新增线索绑定给本人 | `lib/permissions.ts`, `app/dashboard/leads/new/page.tsx`, `app/api/leads/route.ts` | 销售/班主任可以新增线索，但分配销售只能为自己 |
| 原线索页去掉销售抢单，新建公共线索页 | 6 | 已新增公共线索池；销售线索跟进页改为只看自己负责线索并移除抢单按钮 | `app/dashboard/public-leads/page.tsx`, `app/dashboard/leads/page.tsx`, `app/api/leads/route.ts`, `components/dashboard/sidebar.tsx` | 线索跟进页无抢单；销售丢弃进入公共池，公共池可抢单 |
| 销售催促运营或运营催促销售规则统一 | 10 | 已补为双向但受限：运营/admin 可催促已分配销售反馈线索；销售只能催促自己负责线索的负责运营，后端校验线索归属、`operator_id` 和接收人角色；催促待办不复制家长微信等敏感字段 | `app/dashboard/leads/page.tsx`, `app/api/todos/route.ts` | 点击“催促销售”后销售收到线索待办；点击“催促运营”后该线索负责运营收到待办；销售不能通过接口给非本人线索或非负责运营创建催促待办 |
| 抢单状态修正 | 补充 2, 3 | 抢单/丢弃时已清空旧反馈状态，状态计算器会把新抢到的线索显示为“销售未反馈” | `app/api/leads/grab/route.ts`, `app/api/leads/release/route.ts`, `lib/status-calculator.ts` | 抢单后添加状态为“销售未反馈”，转化状态为空；未添加仍可改为已添加 |

### P1：试听课链路

| 任务 | 对应原问题 | 当前代码状态 | 主要改动位置 | 验收标准 |
|---|---:|---|---|---|
| 试听必须关联线索 | 11, 13, 16, 17, 补充 5 | 已收紧为从可访问线索或正式生二选一创建；列表显示线索编号；编辑页只展示来源，后端拒绝 `lead_id/student_id` 改绑 | `app/dashboard/trial-lessons/new/page.tsx`, `app/dashboard/trial-lessons/[id]/edit/page.tsx`, `app/api/trial-lessons/route.ts`, 试听列表页 | 销售不能从试听页独立新增；新建试听必须带线索；列表显示线索编号，编辑页不可改 |
| 试听自动填充线索字段 | 11, 13 | 已补齐：从 URL 线索加载后锁定线索单号，自动填渠道、地域、年级、首个学科和学生称呼；`parent_wechat` 只有可识别为手机号/邮箱时才进入 ClassIn 联系方式字段，否则只作为来源联系方式提示 | `app/dashboard/trial-lessons/new/page.tsx` | 自动填充线索单号、渠道、年级、地域、学科；联系方式字段不再误塞微信号，ClassIn 建号字段含义正确 |
| 创建试听后创建 ClassIn 学生账号 | 12 | 创建试听后会自动创建/绑定 ClassIn 学生并落库 UID/时间/安全错误状态；编辑手机号或历史失败记录会重试绑定；普通角色只看到绑定状态，不回显 UID | `app/api/trial-lessons/route.ts`, `app/api/classin-sdk/register/student/route.ts`, `lib/server-formal-order-redaction.ts` | 提交试听后手机号在 ClassIn 创建学生账号，并保存 UID/初始密码 |
| 匹配老师改为老师库模糊选择 | 15, 补充“试听只能选 ClassIn 已有老师” | 新增、列表快捷匹配/确认和编辑页统一使用 ClassIn 老师目录搜索；后端校验 `matched_teacher` 必须命中老师库或 ClassIn 镜像；`/api/teachers/classin` 只返回选人字段 | `app/dashboard/trial-lessons/new/page.tsx`, `app/dashboard/trial-lessons/page.tsx`, `app/dashboard/trial-lessons/[id]/edit/page.tsx`, `app/api/trial-lessons/route.ts`, `app/api/teachers/classin/route.ts` | 只能选择老师库/ClassIn 已有老师，支持搜索 |
| 试听提交偶发失败排查 | 14 | 后端验证、来源约束、字段白名单和 ClassIn 学生重试已收紧；创建/开课 ClassIn 的旧写入口已补 route-local 当前用户可访问试听范围校验；数据库/ClassIn 原始错误不再透出到响应或日志正文 | `app/api/trial-lessons/route.ts`, `app/api/trial-lessons/open-class/route.ts`, `app/api/trial-lessons/create-classin/route.ts`, `lib/server-business-scope.ts`, `lib/logger.ts` | 每种业务失败有明确错误；正常必填数据稳定创建；无权用户即使知道试听 ID 也不能创建/开启该试听的 ClassIn 课程；日志不记录手机号、付款凭证或 raw stack |
| 聊天截图/付款凭证点击放大 | 8 | 已补线索聊天截图弹窗预览、反馈缩略图点击放大、正式订单付款凭证预览 | `app/dashboard/leads/page.tsx`, `app/dashboard/formal-orders/page.tsx` | 点击图片打开预览，不需要下载 |

### P1：正式订单与正式生管理

| 任务 | 对应原问题 | 当前代码状态 | 主要改动位置 | 验收标准 |
|---|---:|---|---|---|
| 正式订单列表只读化 | 19, 22, 补充 5 | 已移除列表页新增、编辑、删除、退费和状态切换；直接编辑 URL 只显示迁移提示 | `app/dashboard/formal-orders/page.tsx`, `app/dashboard/formal-orders/[id]/edit/page.tsx`, `app/api/formal-orders/route.ts` | 列表不允许直接编辑订单业务字段；新增正式订单迁移到试听/正式生详情来源 |
| 试听转正式自动带学生 | 18 | 已收紧为来源试听权威：页面自动带入并锁定学生信息，后端按来源试听 `student_id` / 姓名手机号复用或创建学生，忽略伪造改绑 | `app/dashboard/formal-orders/new/page.tsx`, `app/api/formal-orders/route.ts` | 由试听转正式时学生信息自动同步，无需手选且不能改绑其他学生 |
| 扩科关联历史订单而非线索 | 补充 6 | `formal-orders/new` 对新签/扩科要求 `lead_id`，续费用 `previous_order_id` | `app/dashboard/formal-orders/new/page.tsx`, `edit/page.tsx`, API 验证 | 扩科选择之前订单，和续费一致 |
| 新增正式生管理页 | 20, 22, 班主任跟进记录 | 已新增 `/dashboard/formal-students`，复用学生详情作为正式生详情承载；列表带正式订单汇总 | `app/dashboard/formal-students/page.tsx`, `app/dashboard/students/page.tsx`, `app/dashboard/students/[id]/page.tsx`, `app/api/students/detail/route.ts` | 正式生详情集中展示订单、剩余课时、剩余金额、科目、老师、开课日期、跟进记录 |
| 质检基础工作台 | 质检系统 | 已新增试听转化质检和课后服务质检入口，先基于现有试听状态、正式生剩余课时和订单汇总识别风险 | `app/dashboard/quality/trial-conversion/page.tsx`, `app/dashboard/quality/service/page.tsx`, `components/dashboard/sidebar.tsx` | 质检可从侧边栏进入，查看风险统计、筛选异常记录并跳转到试听/学生详情处理 |
| 退费金额约束 | 20, 22 | 已给异动记录补 `student_id/order_id`，退费入口从正式生列表/详情进入；后端按正式订单课消、既往非拒绝退费和“剩余课时 × 单价”共同限制金额与课时 | `lib/server-formal-order-balance.ts`, `app/api/transactions/route.ts`, `app/dashboard/transactions/page.tsx`, `app/dashboard/transactions/new/page.tsx`, `app/dashboard/transactions/[id]/edit/page.tsx`, `supabase/migrations/059_add_transaction_record_relations.sql` | 可退金额 <= 当前订单净剩余金额，剩余课时 <= 当前净可退课时；异动列表只用于查询核对 |
| 退费流程流转 | 20, 22 | 已补 4 状态流转、三方核对动作、操作流水和状态看板：新建默认为待教务核对，教务核对后进入待财务打款，财务确认后进入已完成打款，人力可做业绩核对；待核对/待打款可拒绝 | `app/api/transactions/route.ts`, `app/dashboard/transactions/page.tsx`, `app/dashboard/transactions/new/page.tsx`, `lib/services/transactions.ts`, `supabase/migrations/066_add_transaction_workflow_audit_fields.sql`, `supabase/migrations/067_create_transaction_workflow_events.sql` | 后端按 `transactions.verifyHours/payment/verifyPerformance` 权限校验流程动作，记录教务/财务/人力操作时间和人员；每次流程动作同步写入操作流水，列表显示最近流水和可见范围内各状态统计 |
| 学生/订单敏感数据隔离 | 补充多条 | 学生列表、学生详情、回访、状态历史、异动接口已按当前用户可访问学生范围过滤；学生详情聚合查询已从全字段收窄为页面字段白名单 | 学生、订单、试听、课堂 API | 销售/班主任只能看到自己负责范围内的学生手机号和订单；学生详情不返回银行卡、ClassIn 原始镜像大字段或课程调试数据 |

### P2：招师、面试、老师库存

| 任务 | 对应原问题 | 当前代码状态 | 主要改动位置 | 验收标准 |
|---|---:|---|---|---|
| 招师角色与菜单 | 23 | `teacher_recruiter` 已存在，sidebar 有“招师管理”；普通角色已移除候选人查看权限 | `lib/permissions.ts`, `components/dashboard/sidebar.tsx`, 用户角色管理 | 招师仅可见面试管理及必要字典/待办 |
| 面试后录像和初评开放给招师 | 24 | 候选人页面按钮和 API 写入字段已按招师/教务分层；仍可继续拆分独立流程页 | `app/dashboard/teacher-candidates/[id]/edit/page.tsx`, `components/dashboard/teacher-candidates/*` | 招师可上传录像、写初评；教务可复核 |
| 老师信息二维码 | 25, 教务补充 | 已有候选人专属采集链接入口；公开表单只支持按 `candidate_id` 预填和提交，不再允许按微信号/手机号公开查候选人；后台读取已补活跃账号校验和字段白名单 | `app/dashboard/teacher-candidates/[id]/edit/page.tsx`, `app/teacher-form/page.tsx`, `app/api/teacher-form/*`, `app/api/teacher-entries/confirm/route.ts` | 招师可生成/复制二维码；老师使用专属链接提交信息回填候选人并入库成为标准字段；公开接口不能枚举候选人联系方式 |
| 老师编号自动生成 TH00001 | 26 | 已新增数据库序列和 `generate_teacher_code()`，老师创建与候选人入库确认均由后端自动生成编号 | 老师表迁移、`app/api/teachers/route.ts`, `app/api/teacher-entries/confirm/route.ts` | 入库按顺序生成 `TH00001`、`TH00002`，并发不重复 |
| 老师等级和状态入口 | 27 | 已新增老师库存 `teacher_level/status` 字段，老师列表、详情、新建、编辑页均可展示或维护；候选人入库会同步老师等级 | `supabase/migrations/062_add_teacher_level_status_fields.sql`, `app/api/teachers/route.ts`, 老师列表/详情/新建/编辑页 | 可调整升级、降级、满课、停用等状态 |
| 老师库教学版/销售版 | 教务补充、销售补充 | 已新增 `/dashboard/teachers/teaching` 和 `/dashboard/teachers/sales`，复用老师库数据但按角色场景拆展示字段；销售版只读且不展示微信、ClassIn 手机号或 UID，后端也会对非老师资料维护角色清空老师微信 | `components/teacher/TeacherLibraryView.tsx`, `app/dashboard/teachers/teaching/page.tsx`, `app/dashboard/teachers/sales/page.tsx`, `components/dashboard/sidebar.tsx`, `app/api/teachers/route.ts`, `lib/server-teacher-redaction.ts` | 教务可看教学排课必要字段；销售只看外显匹配信息 |
| 试听确认老师时创建 ClassIn 老师账号 | 28 | 已停止老师创建时立即注册 ClassIn；试听更新确认老师时会按老师库存手机号自动创建/绑定 ClassIn，并同步 `teacher_classin` | `lib/server-classin-teachers.ts`, `app/api/trial-lessons/route.ts`, `app/api/teachers/route.ts`, `app/dashboard/teachers/page.tsx` | 确认老师时使用老师库存手机号创建/绑定 ClassIn |

### P2：排课、课堂、ClassIn 同步

| 任务 | 对应原问题 | 当前代码状态 | 主要改动位置 | 验收标准 |
|---|---:|---|---|---|
| 创建 ClassIn 课程未登录 | 补充试听详情 | ClassIn 回调外的 ClassIn 路由已纳入权限映射，`PUBLIC_PATHS` 仅保留回调；试听创建/开课 ClassIn 写入口已补当前用户可访问试听范围校验；实际 ClassIn token/cookie 仍需线上联调排查 | `app/api/classin*`, `app/api/trial-lessons/open-class/route.ts`, `app/api/trial-lessons/create-classin/route.ts`, `lib/services/classin-sdk/*`, `lib/server-business-scope.ts` | 点击创建课程不报登录过期，错误可定位；无权用户不能通过传入别人的试听 ID 创建或开启 ClassIn 课程 |
| 批量/单节排课重新生成失败和慢 | 补充排课 | 已加固批量创建与单节重建接口：按当前用户可访问订单/课程校验，统一 ClassIn 数字 ID 和中国时区时间，返回单条失败明细；批量创建已补单次数量上限、必填字段、日期时间、结束时间和同批次重复时间预检，避免明显错误进入 ClassIn 创建流程；课程、课节和排课相关 API 的数据库/ClassIn/运行时异常已统一改为安全摘要日志和业务友好错误，不再透出 raw message/stack/details；课程 CRUD、按订单查课程、课程统计同步、ClassIn 课程关联、课堂管理课程列表、课节同步、课程课节列表和批量创建 ClassIn 老师镜像查询已改字段白名单，避免继续全字段读取课程、课节或镜像记录；按订单查课程、删除课程和课程统计同步已补当前用户可访问范围校验 | `app/api/schedule/batch/create-classin/route.ts`, `app/api/class-sessions/recreate/route.ts`, `app/api/class-sessions/sync/route.ts`, `app/api/courses/route.ts`, `app/api/courses/by-order/[orderId]/route.ts`, `app/api/courses/[courseId]/sessions/route.ts`, `app/api/courses/[courseId]/sync-stats/route.ts`, `app/api/classrooms/scheduled/route.ts`, `lib/server-course-selects.ts`, `app/dashboard/schedule/batch/page.tsx`, `lib/safe-error.ts` | 重新生成不要求不合理班级名称；重复课节提交前拦截或创建时跳过；失败条目可定位原因；接口异常不泄露底层错误正文；课程/课堂链路不再整行读取并按当前用户范围返回 |
| 第一次创建班级缺老师/课节 | 补充排课 | 已要求 ClassIn 课程、本地课程、学生绑定、老师 UID、ClassIn 课堂和本地课节均成功后才计入成功；本地课程或课节落库失败不再静默放过 | `app/api/schedule/batch/create-classin/route.ts`, `app/api/class-sessions/recreate/route.ts` | 首次创建成功即包含学生、老师、课节；失败时返回明确错误 |
| 修改课节时间同步 ClassIn | 班主任补充 | 已在 `PUT /api/class-sessions` 接入 ClassIn `updateClassroom`；修改日期/开始/结束时间时先校验课节范围和 ClassIn 绑定，远端同步成功后更新本地课节和 `classroom_classin` 镜像 | `app/api/class-sessions/route.ts`, `app/dashboard/courses/[id]/page.tsx`, `lib/services/classin-sdk/service.ts` | 本地课节时间修改后 ClassIn 同步变化；失败时给出明确错误，不静默只改本地 |
| 课堂管理导出 | 教务补充 | 已新增课节 CSV 导出 API 和页面日期范围导出控件，并补齐课堂课程列表数据范围过滤和字段白名单 | `app/api/class-sessions/export/route.ts`, `app/dashboard/classroom/page.tsx`, `app/api/classrooms/scheduled/route.ts`, `lib/server-course-selects.ts` | 可按时间范围导出课节字段用于核算课时，导出和页面列表均只能返回当前用户可访问课程 |
| 课程日历占位页 | 教务补充 | 已将 `/dashboard/calendar` 从占位页补为真实月视图，并给 `GET /api/class-sessions` 增加日期范围和状态筛选；侧边栏入口按课节查看权限显示 | `app/dashboard/calendar/page.tsx`, `app/api/class-sessions/route.ts`, `components/dashboard/sidebar.tsx` | 教务/班主任等有课节查看权限的角色可按月查看可访问课程课节，支持状态筛选并跳转课程详情；无权限角色看不到入口 |
| 角色管理占位页 | 管理补充 | 已将 `/dashboard/roles` 从占位页补为只读权限矩阵，展示角色总览、单角色资源动作和横向授权覆盖 | `app/dashboard/roles/page.tsx`, `lib/permissions.ts` | 管理员或具备用户查看权限的账号可核对各角色权限；无权账号直访显示无权 |

## 4. 已实施进展（2026-06-08）

本节记录已经落地的 P0 代码改动，便于后续继续拆分验收。

### 4.1 权限矩阵与删除权限

- `lib/permissions.ts` 已移除普通角色的删除权限：运营不再删除线索，班主任/教务不再删除课节，普通角色不再删除待办。
- `sales` 和 `head_teacher` 已补上线索创建权限，用于满足“销售/班主任可录入自己的线索”。
- `operator`、`sales` 中重复声明的 `todos` 权限已清理，避免对象后声明覆盖前声明。
- `app/dashboard/leads/page.tsx` 已在资源权限之外叠加单条线索写入范围判断：编辑/删除按钮只有当前用户确实负责或创建该线索时才显示；误触删除也会在前端再次拦截。
- `DELETE /api/leads/[id]` 已增加路由内 fail-closed 校验：缺用户档案返回 403，非 admin 返回 403，线索不存在返回 404，避免只依赖中间件权限映射。

### 4.2 核心业务 API 数据范围过滤

新增 `lib/server-data-scope.ts` 与 `lib/server-business-scope.ts`，用于按当前登录用户档案计算可访问数据范围。

已增加服务端范围过滤的接口：

| API | 已加控制 |
|---|---|
| `GET /api/leads` | admin 全量；运营只看自己录入/负责；销售看未分配公共线索和自己负责线索；班主任看自己相关线索 |
| `GET /api/leads/[id]` | 单条线索详情按同样规则校验，未授权返回 403 |
| `GET /api/trial-lessons` | 按当前用户可访问线索和 `assigned_consultant` 过滤试听 |
| `GET /api/formal-orders` | 销售/运营按关联线索和签约顾问过滤；班主任按关联线索、签约顾问、负责学生过滤 |
| `GET /api/students` | 班主任只看自己负责学生；销售/运营只看自己线索转出的学生 |
| `GET /api/courses` | 按当前用户可访问正式订单过滤课程 |
| `GET /api/courses/by-order/[orderId]` | 按当前用户可访问正式订单过滤课程 |
| `DELETE /api/courses` | 删除前校验课程所属正式订单是否在当前用户范围内 |
| `POST /api/courses/[courseId]/sync-stats` | 同步前校验课程是否在当前用户范围内 |
| `GET /api/class-sessions` | 按当前用户可访问课程过滤课节 |
| `GET /api/classrooms/scheduled` | 按当前用户可访问课程过滤课堂管理课程列表 |
| `GET /api/class-sessions/export` | 按当前用户可访问课程过滤导出课节，并要求时间范围 |
| `GET /api/todos`、`GET /api/todos?id=...` | admin 可看全部；普通角色只能看自己被分配的待办，单条查询也按 assigned_to 范围校验 |

课程和课节写入侧也已增加归属校验：

- `POST /api/courses` 只能为自己范围内的订单创建课程。
- `PUT /api/courses` 只能修改自己范围内的课程。
- `POST /api/class-sessions` 批量/单条创建均校验 `course_id`。
- `PUT /api/class-sessions`、`DELETE /api/class-sessions` 先校验课节所属课程是否可访问。

### 4.3 敏感字段与未抢单遮罩

- `GET /api/leads` 和 `GET /api/leads/[id]` 已对销售角色做未抢单遮罩。
- 未抢单销售可见公共线索，但 `parent_wechat`、`chat_screenshots`、`customer_social_id` 返回 `null`，公共线索池页面也不展示这些列。
- 抢单后、创建人本人、或已绑定销售本人时才返回完整字段；其中绑定销售本人已统一到 `lib/server-lead-access.ts`，只接受 `grab_user_id` 命中或 `grab_wechat` 与当前用户姓名精确相等，不再使用姓名包含匹配。
- `app/api/leads/feedback`、`app/api/leads/release` 以及正式订单、试听、学生聚合范围里的线索归属过滤也已同步使用精确匹配，避免同名片段误判导致越权反馈或读取关联数据；线索反馈接口已复用 active profile 校验，停用账号或缺档案账号不能继续反馈线索。
- `GET/POST/PUT /api/leads`、`GET/DELETE /api/leads/[id]`、`POST /api/leads/feedback`、`POST /api/leads/grab`、`POST /api/leads/release` 已从 `select('*')`/默认 `.select()` 收敛为线索页面字段白名单；错误响应不再回显数据库原始 message，日志不再记录来源账号、客户社媒账号、家长微信、聊天截图或异常 stack。
- 新增 `lib/server-student-redaction.ts`：`GET/POST/PUT /api/students` 与 `GET /api/students/detail` 对非 admin / academic_affairs 角色返回的 `classin_initial_password`、`classin_uid` 统一置空；学生列表和学生详情页也按角色隐藏 ClassIn 初始密码/UID 展示。
- `PUT /api/students` 已补单条学生范围校验，并且非 admin / academic_affairs 即使提交 `classin_uid` 或 `classin_initial_password` 也不会写入数据库。
- `/api/students` 已继续收敛 `GET/POST/PUT/DELETE`：学生列表/详情/创建/更新响应使用字段白名单，分页 count 不再全字段查询，范围校验、ClassIn 注册和 CRUD 异常只写安全摘要并返回友好错误，不再回显 raw `message`、`stack` 或 `details`。
- `POST /api/students/assign-head-teacher` 已补 route-local 用户档案和角色守卫，仅 admin / academic_affairs 可变更学生班主任归属；接口响应只返回学生白名单字段，日志和错误响应不再透出 raw message/stack。
- `POST /api/student-entries/confirm` 已复用学生 ClassIn 凭据脱敏并改为学生字段白名单响应，避免有学生创建权限的普通角色通过旧入库确认响应拿到 `classin_initial_password`、`classin_uid` 或其他无关学生字段。
- `POST /api/students/register-classin` 已补 route-local 角色和范围校验：缺用户档案返回 403，非 admin / academic_affairs 返回 403，手工传不可访问学生 ID 返回 403。
- `GET/POST/PUT /api/teachers` 已从全字段响应改为列表/详情字段白名单，不再返回 `classin_initial_password` 或 `bank_card_info`；银行卡信息仅作为创建/更新输入保留，`DELETE /api/teachers` 路由内再次校验 admin，错误日志和响应不再透出 raw message/stack。
- 新增 `lib/server-teacher-redaction.ts`：`POST /api/teacher-entries` 和 `POST /api/teacher-entries/confirm` 对非 admin / academic_affairs 角色返回的 `classin_initial_password` 统一置空，避免旧入库响应回显 ClassIn 初始密码；老师库存 API 对非老师资料维护角色额外清空老师微信，避免绕过销售版页面读取联系方式。
- 新增 `lib/server-formal-order-redaction.ts`：`GET/POST/PUT /api/formal-orders`、`GET/POST/PUT /api/trial-lessons` 和学生详情聚合订单/试听时，对非 admin / finance / academic_affairs 角色返回的 `payment_proof` 统一置空；正式订单列表仅上述角色显示付款凭证列，试听详情在字段置空后不展示凭证。
- `/api/formal-orders` 已继续收敛 `GET/POST/PUT/DELETE` 查询和异常出口：正式订单、来源试听和历史订单均使用字段白名单，数据库/运行时异常只写安全摘要并返回友好错误，不再回显 raw `message`、`stack` 或 `details`。
- `GET /api/students/detail` 查询班主任信息时已收窄为 `id/name`，不再把班主任邮箱、手机号随学生详情返回。
- `GET /api/students/detail` 聚合的正式订单、试听、课程、回访、状态历史、异动和 ClassIn 课堂已全部改为页面字段白名单；异动记录不返回银行卡字段；课程查询移除“无 JOIN 测试”和整批课程数据日志；ClassIn 课堂改按当前学生课程关联查询，并对 `manual_converted` 字段提供缺列兼容重试。
- `GET/POST/PUT /api/transactions` 已补接口级字段白名单：银行卡姓名、卡号、开户行、支行只允许作为创建/更新输入，不随列表、详情、创建或更新响应返回；创建和手工更新会校验目标学生与正式订单仍在当前用户可访问范围内；查询、写入、删除和退费校验异常只返回友好错误，日志保留安全摘要。
- 废弃的微信号管理接口已改为 admin-only：`/api/wechat-accounts` 的中间件权限映射到 `users.delete`，路由内部也要求 admin；列表、单条查询、创建、更新响应不再返回 `login_password` / `payment_password`，编辑页不再回显或要求旧密码，相关请求日志也不记录完整 body 或密码值；如确需变更密码，仅通过显式非空写入更新。
- `GET /api/user-profiles` 与 `GET /api/users?role=...` 已从用户档案全量导出收窄为选人目录：角色筛选做白名单校验，普通角色响应只返回 `id/name/email/role/created_at`，不再暴露手机号、微信、ClassIn UID、团队、启停等账号管理字段。
- `GET/POST/PUT/DELETE /api/users` 已补账号管理字段白名单和缺失功能：管理员列表/单条详情不再 `select('*')`，创建/更新响应不回传 ClassIn UID 等扩展敏感字段；创建用户会写入微信号，`GET /api/users?id=...` 返回单条并对不存在用户返回 404；创建、更新、删除日志和异常响应不再透出原始账号/密码或底层错误正文；管理员判断已复用 active profile 校验，停用账号或缺档案账号不能继续执行用户管理操作；账号新增/编辑页移除不存在的 `notes` 字段并对齐后端实际 `name` 字段；账号管理前端 toast 已改为固定友好文案，避免服务层或数据库 raw error 直出。
- `GET/POST/PUT/DELETE /api/todos` 与 `POST /api/todos/[id]/complete` 已从全字段响应改为待办页面字段白名单，错误响应和日志只保留安全摘要；创建时校验接收人只能是销售或班主任，手工创建不再接收任意 `metadata`；更新只允许标题、描述、优先级、状态和截止日期等安全字段；线索催促创建待办时不再把家长微信复制进描述。
- `/dashboard/todos` 已补待办基础页面闭环，支持筛选、分页、创建、完成和删除；侧边栏“任务列表”入口按 `todos.view` 过滤，页面创建/完成按钮按 `todos.create/edit` 与当前分配/创建关系显隐，删除按钮仅按 `todos.delete` 显示，删除前使用受控确认弹窗替代浏览器原生 `confirm()`；`DELETE /api/todos` 中间件仅允许 `todos.delete` 进入路由，路由内再次要求 admin，普通创建者不能删除自己的待办。
- `GET/POST/PUT/DELETE /api/visit-records` 已补下次回访基础提醒闭环：新增或更新回访记录时，若填写 `next_visit_date`，后端会自动生成或更新 `visit_next_follow_up` 待办，优先分配给学生班主任，缺班主任时仅回退给当前销售/班主任；清空下次回访日期或删除回访记录时会取消未完成的自动提醒。
- `GET /api/auth/profile` 与 `GET /api/user-profiles` 的错误日志和响应已补安全摘要：服务端不再记录 Supabase 原始 message/stack，异常响应不再把底层 message 透出给前端；`useCurrentUser` 与 `UserProfilesService` 也不再裸 `console.*` 输出异常对象。
- `GET /api/debug/current-user` 已从完整调试对象改为最小诊断摘要：不再 `select('*')`，也不再返回完整用户邮箱或用户档案，只保留用户 ID、是否存在邮箱、角色、权限检查结果和档案角色/创建时间；调试接口也复用 active profile 校验，停用账号或缺档案时返回终态错误码。
- `GET /api/debug/network-test` 已隐藏原始 Supabase URL：环境诊断只返回是否配置、脱敏 host 和区域；网络测试日志只记录脱敏 host、通过数量和失败数量，顶层异常响应不再回显 raw message。
- `GET/POST/PUT/DELETE /api/daily-leads` 与 `GET/POST/PUT/DELETE /api/dictionaries` 已继续字段白名单和错误降敏：旧每日线索不再全字段查询或在日志/错误中暴露微信号、简历附件、备注；字典接口不再记录 label/code 原文或 raw message/stack。
- ClassIn 镜像/课堂接口已补第二轮降敏：`/api/classin/classes`、`/api/classin/teachers`、`/api/classin/students`、`/api/classin/classrooms`、`/api/classroom-classin`、`/api/classrooms/scheduled`、`/api/classin/login`、`/api/classin/classrooms/test` 和 ClassIn API client 不再输出裸 `console.*`、raw error message/stack、外部课堂 ID 明细或 SDK 返回体；镜像列表与课堂查询从 `select('*')` 收窄到页面实际字段。
- 后台高敏写接口日志已从完整 `body` / `insertData` / `updateData` / `updatePayload` 改为安全摘要：`POST/PUT /api/trial-lessons`、`/api/formal-orders`、`/api/transactions`、`/api/visit-records`、`/api/daily-leads`、`/api/students`、`/api/student-entries/confirm`、`/api/teachers`、`/api/teacher-candidates`、`/api/teacher-entries`、`/api/courses`、`/api/class-sessions` 只保留字段名、是否携带关键字段和批量数量，不再写入手机号、微信、付款凭证、银行卡、回访备注、ClassIn 凭据或候选人材料原文。

### 4.4 高风险公共接口补充鉴权

这些接口此前处于 public prefix 或未映射放行风险下，已补充 route-local 鉴权或中间件权限映射：

| API | 新增限制 |
|---|---|
| `POST /api/students/assign-head-teacher` | 归属变更仅限 admin / academic_affairs；缺用户档案或普通 `students.edit` 角色均 fail-closed，响应只返回学生白名单字段 |
| `POST /api/students/register-classin` | 需要用户档案；仅 admin / academic_affairs 可手动注册，并按当前可访问学生范围校验 `studentId` |
| `POST /api/teachers/register-classin`、`POST /api/teacher-entries/register-classin` | ClassIn 运维权限；route-local 限制 admin / academic_affairs，中间件映射到 `teachers.notes` |
| `POST /api/classin-sdk/register/student`、`POST /api/classin-sdk/register/teacher` | ClassIn 运维权限；route-local 限制 admin / academic_affairs，中间件映射到 `teachers.notes` |
| `POST /api/classin-sdk/course`、`POST /api/classin-sdk/unit`、`POST /api/classin-sdk/classroom`、`POST /api/classin-sdk/complete` | ClassIn 运维权限；route-local 限制 admin / academic_affairs，中间件映射到 `teachers.notes` |
| `GET/POST /api/classin/classes`、`GET /api/classin/students`、`GET /api/classin/teachers`、`GET/PUT/DELETE /api/classin/classrooms` | ClassIn 镜像、从订单创建班级和远端课堂改删统一收紧为 ClassIn 运维权限；route-local 限制 admin / academic_affairs，中间件映射到 `teachers.notes`；响应和日志不再暴露同步表全字段、raw error message/stack、外部课堂 ID 明细或 SDK 返回体 |
| `POST /api/classin/login` | Cookie 登录会影响服务端 ClassIn 会话，已收紧为 ClassIn 运维权限并增加 route-local guard |
| `GET/POST /api/classin/classrooms/test` | ClassIn 课堂测试端点可修改/删除远端课堂，已收紧为 ClassIn 运维权限并增加 route-local guard |
| `GET /api/classin-sdk/diagnostics` | ClassIn 环境诊断会暴露配置状态，已收紧为 ClassIn 运维权限并增加 route-local guard |
| `POST /api/courses/link-classin` | 本地订单/课程关联 ClassIn 课程属于运维变更，已收紧为 ClassIn 运维权限并增加 route-local guard |
| `GET /api/classroom-classin` | 课堂镜像查询不再裸查全表；缺用户档案返回 403，普通角色按当前可访问课程/课节关联过滤，分页 count 同步按范围计算 |
| `POST /api/classin/students`、`POST /api/classin/teachers` | 当前无实际 POST handler；权限表已预收为 ClassIn 运维权限，避免后续兼容 handler 被普通创建权限放行 |
| `POST /api/classin/callback` | 保留 ClassIn 公开回调入口；入口和 handler 不再打印完整 headers、`SafeKey`、`Msg` 原文或回调 JSON，仅记录结构化摘要和认证失败原因 |
| `POST /api/student-entries/confirm` | 需要 `students.create` 权限 |
| `POST /api/teacher-entries` | 需要 `teacherCandidates.interview` 权限；路由内补 `checkPermission`，响应不向普通角色回显老师 ClassIn 初始密码 |
| `POST /api/teacher-entries/confirm` | 需要 `teacherCandidates.confirmEntry` 权限 |
| `POST /api/sync/students` | 仅 admin / academic_affairs |
| `POST /api/sync/teachers` | 仅 admin / academic_affairs |
| `POST /api/sync/classes` | 仅 admin / academic_affairs |
| `POST /api/sync/classrooms` | 仅 admin / academic_affairs |
| `GET /api/teachers/classin` | 需要 `teachers.view` 权限 |
| `GET/POST /api/init-admin` | 启动专用接口，生产环境默认 404，需显式 `ENABLE_INIT_ADMIN_API=true`，且必须配置并提供 `INIT_ADMIN_SECRET`；公开响应不回显管理员邮箱/姓名或底层错误 |
| `POST /api/cleanup-all-admins` | 需要管理员删除权限；路由内二次校验 `users.delete`；生产环境默认 404，需 `ENABLE_ADMIN_RESET_API=true` |
| `GET /api/debug/current-user` | 生产环境默认 404；仅非生产或 `ENABLE_DEBUG_API=true` 可用；响应只返回最小用户/权限摘要，不回显完整档案；停用账号或缺档案 fail-closed |
| `GET /api/debug/network-test` | 生产环境默认 404；仅非生产或 `ENABLE_DEBUG_API=true` 可用；响应不回显原始 Supabase URL |
| `POST /api/auth/signup` | 公开注册默认关闭，未设置 `ENABLE_PUBLIC_SIGNUP=true` 时返回 404；显式开启时也只返回注册申请结果，不返回 session/access_token/refresh_token/注册邮箱 |
| `GET/POST/PUT/DELETE /api/wechat-accounts` | 历史废弃模块且包含登录/支付密码，已收紧为 admin-only；路由内再校验 admin；列表、单条查询和写入响应不返回 `login_password` / `payment_password`，编辑页不再回显旧密码，日志不记录密码值 |
| `GET /api/user-profiles` | 保留选人目录能力，但路由内要求用户档案存在，`role` 仅允许白名单角色，响应只返回 `id/name/email/role/created_at` |
| `GET/POST/PUT/DELETE /api/users` | 完整账号管理继续 admin-only；角色选人目录只返回最小字段；管理员判断复用 active profile 校验；管理员列表/单条/创建/更新响应使用账号页面字段白名单，错误和操作日志只保留安全摘要，新增账号会写入微信号，`id` 查询返回单条并处理 404 |
| `GET/POST/PUT/DELETE /api/todos`、`POST /api/todos/[id]/complete` | 中间件按 `todos.*` 权限拦截，路由内再次按 admin / assigned_to / created_by 校验读取、更新和完成范围；删除仅允许 admin；完成操作仅允许被分配人执行；响应字段白名单，异常不回显 raw message/stack |
| `/debug/auth` 页面 | 生产环境默认 404；仅非生产或 `ENABLE_DEBUG_API=true` 可打开，页面内仅 admin 可查看认证诊断，并移除旧的 prompt 测试登录入口 |
| `/dashboard/debug/permissions`、`/dashboard/test-dictionary-cache` 页面 | 生产环境默认 404；仅非生产或 `ENABLE_DEBUG_API=true` 可打开，页面内仅 admin 可查看 |

### 4.5 路由权限中间件收紧

- `middleware.ts` 已从“未配置权限则记录警告并放行”改为默认拒绝，未映射 API 返回 `ROUTE_PERMISSION_UNREGISTERED`。
- `middleware.ts` 已支持单路由多个可接受 action；`PUT /api/teacher-candidates` 与 `PUT /api/teacher-candidates/recruitment-flow` 可由评审权限或入库确认权限进入，再由路由内字段白名单和流程规则继续收口。
- `lib/route-permissions.ts` 已修复动态路由匹配：`/api/leads/[id]`、`/api/courses/by-order/[orderId]`、`/api/todos/[id]/complete` 等现在能按段匹配真实请求路径。
- 原先过宽的公开前缀已收窄，不再把 `/api/classin`、`/api/classin-sdk`、`/api/sync`、`/api/teachers/classin` 整组绕过权限中间件。
- 当前保留的公开路径/前缀为：`/api/auth/*`、`/api/teacher-form/*`、`/api/health`、`/api/init-admin`、`/api/classin/callback`。后台 `/api/upload` 已移出公开路径，由中间件按 `uploads.create` 做统一入口授权，路由内部继续要求登录并按 bucket 做业务权限校验。
- `/api/init-admin` 保留在公开路径是为了支持全新环境 bootstrap，但路由内已改为 fail-closed：生产环境未显式设置 `ENABLE_INIT_ADMIN_API=true` 时 `GET` 与 `POST` 都返回 404；开启后仍必须配置 `INIT_ADMIN_SECRET`，且请求需提供 `x-init-admin-secret` / `init_admin_secret` / `initAdminSecret`，否则返回 403。
- `/api/init-admin` 的日志与响应已进一步收窄：账号只记录类型/长度/是否含 `@`，创建失败不返回 Supabase/Admin 原始错误，创建成功仅回传 `user.id`，不再回显管理员邮箱或姓名。
- `/api/cleanup-all-admins` 不再是公开路径，仍需管理员删除权限；路由内也通过 `checkPermission(..., users.delete)` 做二次守卫；同时生产环境默认 404，只有显式设置 `ENABLE_ADMIN_RESET_API=true` 才执行清理。执行时只读取 admin 用户 ID，日志和响应不再回传邮箱或姓名。
- `/api/debug/current-user` 与 `/api/debug/network-test` 仍需中间件管理员权限；同时生产环境默认返回 404，只有非生产环境或显式设置 `ENABLE_DEBUG_API=true` 才执行诊断逻辑。当前用户调试接口只返回最小用户/权限摘要，网络诊断接口只返回脱敏 Supabase 配置状态和测试摘要。
- `/debug/auth` 认证调试页已补服务端开关，生产环境默认 `notFound()`；调试环境中也必须是 admin 才能查看诊断信息，且页面不再提供输入账号密码的测试登录入口。
- `/dashboard/debug/permissions` 与 `/dashboard/test-dictionary-cache` 已同步补服务端调试开关和 admin 页面内守卫，避免隐藏测试页在生产或普通角色直访时暴露权限矩阵、用户信息或字典缓存诊断。
- `/signup` 页面和 `POST /api/auth/signup` 已增加 `ENABLE_PUBLIC_SIGNUP` 开关，默认返回 404；登录页不再保留注册链接，注册接口开启时也不再返回 session、access token 或 refresh token；若 Supabase 因项目配置自动返回 signup session，后端会尝试立即撤销，避免未分配档案/角色的注册申请形成可用后台登录态。
- `GET /api/auth/profile` 已移除“用户档案缺失时默认返回 sales 角色”的兜底，改为 403，避免未配置档案的账号获得默认业务角色；当前用户档案响应已收窄到 `id/email/name/avatar_url/role/created_at`。
- `/api/auth/signin`、`/api/auth/signup`、`/api/auth/session`、`/api/auth/refresh`、`/api/auth/profile` 和 `/api/auth/signout` 的公开错误响应与日志已收敛：不再记录原始账号/邮箱、密码长度、token 长度或 Supabase/运行时原始 message/stack，也不再把 Supabase 或异常明细透出给前端；`lib/middleware.ts` 的认证和权限检查异常也改为安全摘要日志，权限检查 500 响应统一为通用错误；客户端当前用户 hook 与 `lib/supabase-client.ts` 也只记录安全错误摘要。
- `GET /api/auth/profile`、`GET /api/auth/session`、`POST /api/auth/signin`、`POST /api/auth/refresh`、`lib/middleware.ts`、`POST /api/leads/feedback`、`GET /api/debug/current-user`、`GET/POST/PUT/DELETE /api/users` 和路由内共享用户档案解析已统一通过 `user_profiles.is_active` 拦截停用账号；档案缺失或账号停用时返回 403 或 fail-closed，不再返回 session/profile 或允许继续调用后台业务 API；`/api/upload` 会把停用账号返回为 `ACCOUNT_DISABLED`，`lib/fetch.ts` 与 `lib/tokenRefreshManager.ts` 收到 `ACCOUNT_DISABLED` / `PROFILE_NOT_FOUND` 后会清除本地 session/token/user 缓存。
- 重新扫描 `app/api/**/route.ts` 后，当前 78 个 API route 文件、131 个导出方法中，非公开路由均已命中权限表。

### 4.6 上传与登录态稳定性

- `app/api/upload/route.ts` 已支持 `teacher-interview-videos` bucket，修复面试录像上传被 “Invalid bucket name” 拦截的问题。
- 通用上传 API 已增加按 bucket 的文件类型/大小校验：聊天截图和付款凭证最大 20MB，简历/附件最大 50MB，面试录像最大 500MB。
- 通用上传 API 已增加按 bucket 的业务权限校验：例如线索附件/聊天截图要求线索创建或编辑/反馈权限，付款凭证要求试听、正式订单或异动付款相关权限，老师面试视频要求候选人上传录像权限。未授权 bucket 返回 `UPLOAD_BUCKET_PERMISSION_DENIED`。
- `/api/upload` 已移出公开路径，统一中间件会先验证登录态、停用状态、档案状态和 `uploads.create` 入口权限；进入路由后仍按 bucket 的业务权限二次校验，避免后台通用上传入口绕过全局 API 门禁。
- 2026-06-12 线上验证：`pnpm exec tsc --noEmit`、`git diff --check`、`vercel build --prod` 通过；已部署 `dpl_4qyqN6AWTAUg3fNk3YZeiY5z5r8p` 到生产别名 `https://xiaoniuhaoxue.paitongai.cn`。生产 smoke：`POST /api/auth/signin {}` 返回“账号/邮箱和密码必填”，`POST /api/upload` 未登录返回“未登录或登录已过期”，`POST /api/teacher-form/upload` multipart 非图片返回 `TEACHER_FORM_UPLOAD_INVALID_TYPE`。
- 通用上传 API 已补空文件拦截、`UPLOAD_*` 稳定错误 code，并在浏览器未提供 MIME 时按安全扩展名推断 content-type，避免上传后预览/下载类型异常；Storage 对象名改为纯 UUID 加扩展名，日志不再记录原始文件名。
- 2026-06-12 继续收紧通用上传二进制校验：`.docx` 必须包含 `[Content_Types].xml` 和 `word/document.xml`，普通 ZIP 改名为 `.docx` 会返回 `UPLOAD_CONTENT_TYPE_MISMATCH`；已通过 `pnpm exec tsc --noEmit`、`git diff --check`、`vercel build --prod`，并用归档上传模式部署 `dpl_B3nnMMum2yWU8Xn7tFLW6hUPzVBk` 到生产别名 `https://xiaoniuhaoxue.paitongai.cn`。生产 smoke：`POST /api/auth/signin {}` 返回“账号/邮箱和密码必填”，`POST /api/upload` 未登录返回“未登录或登录已过期”。
- 2026-06-12 针对线上 `POST /api/auth/signin` 返回 `PROFILE_LOOKUP_FAILED` 追加登录档案查询诊断：`supabaseAdmin` 不再在缺少 `SUPABASE_SERVICE_ROLE_KEY` 时静默降级为 anon key，active profile 查询会显式记录 `SUPABASE_SERVICE_ROLE_KEY_MISSING` 并返回“用户档案服务配置异常，请联系管理员”；登录或刷新已拿到 Supabase session 但后续档案校验失败时，后端会尽量撤销当前 session，避免停用/缺档案/档案服务异常账号留下半截登录态；已通过 `pnpm exec tsc --noEmit`、`git diff --check`、`vercel build --prod`，并用归档上传模式部署 `dpl_Ff1tczVvq27XUkk1SLQV6QddXQpP` 到生产别名 `https://xiaoniuhaoxue.paitongai.cn`。生产 smoke：`GET /api/health` 返回 `ok`，`POST /api/auth/signin {}` 返回“账号/邮箱和密码必填”。完整账号登录仍需用真实账号验证；若仍失败，优先检查生产环境变量 `SUPABASE_SERVICE_ROLE_KEY` 和生产库 `user_profiles(id,email,name,role,created_at,is_active)` 字段。
- 2026-06-12 继续补公开注册入口的隐性 session 处理：`POST /api/auth/signup` 在 `ENABLE_PUBLIC_SIGNUP=true` 的环境下若收到 Supabase 自动签发的 signup session，会调用服务端撤销逻辑；已通过 `pnpm exec tsc --noEmit`、`git diff --check`、`vercel build --prod`，并用归档上传模式部署 `dpl_HV2C54Efnm82tpDhSqAZpoH2xyRk` 到生产别名 `https://xiaoniuhaoxue.paitongai.cn`。生产 smoke：`GET /api/health` 返回 `ok`，`GET /signup` 和 `POST /api/auth/signup` 默认均返回 404，`POST /api/auth/signin {}` 返回“账号/邮箱和密码必填”。
- 2026-06-12 继续补 `PROFILE_LOOKUP_FAILED` 的前端终态处理：统一 API wrapper 和 token refresh manager 收到 `ACCOUNT_DISABLED` / `PROFILE_NOT_FOUND` / `PROFILE_LOOKUP_FAILED` 后会清理本地 `supabase.auth.session`、`supabase.auth.token`、`user`、`currentUser` 并停止刷新重试；`PROFILE_LOOKUP_FAILED` 即使以 5xx 返回也会被识别为终态登录失败，避免前端保留半截登录态或反复刷新。已通过 `pnpm exec tsc --noEmit --pretty false --incremental false`、`git diff --check`、`vercel build --prod`，并用归档上传模式部署 `dpl_9Vs3WesHnTw8nw3b4tnL2G9BovHt` 到生产别名 `https://xiaoniuhaoxue.paitongai.cn`。生产 smoke：Vercel inspect 显示 deployment `Ready` 且别名已绑定；`POST /api/auth/signin {}` 返回“账号/邮箱和密码必填”，`POST /api/auth/refresh {}` 返回“缺少 refresh_token”。本机 curl 对自定义域偶发 DNS 解析失败，完整真实账号登录仍需用业务账号在浏览器端复测。
- `/api/teacher-form/upload` 仍作为老师二维码采集表单的独立公开上传入口，和后台 `/api/upload` 分离，避免外部表单被后台登录态影响；该入口已补 node runtime、空文件拦截、`image/*` 上传类型校验、常见安全图片扩展白名单、20MB 限制、明确错误 code 和安全摘要日志。
- `app/api/upload/route.ts` 与 `app/api/teacher-form/upload/route.ts` 已在 2026-06-11 继续收敛异常处理：bucket 创建失败、Storage 上传失败和顶层异常只记录 `name/code/status/has_message/has_stack` 摘要，不再记录底层 `message`、`stack` 或内部 storage path；响应仍保持稳定错误码和业务提示。
- 上传文件名已改为纯 UUID 加安全扩展名，减少中文、空格和特殊字符在 Supabase Storage 路径中导致失败的概率；老师表单上传会按 `photo/`、`screenshots/` 分目录写入纯 UUID 文件名，通用上传和老师表单上传的 URL/path 都不再携带原始文件名。
- `app/teacher-form/page.tsx` 已把图片选择放宽到 `image/*`，上传前先做本地类型/20MB/空文件校验，多张好评截图会整组预检后批量上传并一次性写回表单，避免并发上传时 loading 状态提前结束；公开上传请求已增加 45 秒超时和 3 次以内的临时失败重试，400 类校验错误不重试。
- `lib/services/upload.ts` 已补付款凭证和聊天截图前端共用校验：付款凭证入口允许图片或 PDF，聊天截图入口统一限制图片；上传前先拒绝空文件、超过 20MB 文件和不支持类型，通用上传请求增加 60 秒超时和 3 次以内临时失败重试，线索新建、编辑、反馈入口共用 `CHAT_SCREENSHOT_ACCEPT`，并在文件进入本地队列前先整组调用 `validateChatScreenshotFile`。
- `lib/services/upload.ts` 已补老师招聘和老师库存图片上传前端共用校验：老师简历限制 PDF/Word/图片且最大 50MB，面试视频限制 MP4/MOV/M4V/AVI/MKV/WebM 且最大 500MB，老师库存形象照/好评截图限制图片且最大 20MB；新增老师面试、初试录像上传表单和老师库存新增页会在选择文件和提交前拦截明显失败文件。
- `/dashboard/teachers/new` 已把老师形象照和好评截图从本地预览值改为真实上传：形象照保持必传，提交时先上传到 `teacher-photos` bucket，再把 Storage URL 写入 `photo_url` 和 `review_screenshots`。
- `/dashboard/daily-leads/new` 和 `/dashboard/daily-leads/[id]/edit` 已从“只能填写 URL”补为真实简历附件上传：上传走 `lead-resumes` bucket，支持 PDF、Word 和图片，最大 50MB，选择文件时先本地校验并在成功后自动回填 `resume_attachment` URL，同时保留粘贴已有附件 URL 的入口。
- `app/dashboard/formal-orders/new/page.tsx` 新建正式订单时已真正上传付款凭证到 `payment-proofs`，不再只保存本地文件名。
- `lib/supabase-client.ts` 的上传调用已改走统一 `api` wrapper，token 过期时可以触发刷新和重试。
- 后台非公开 API 的直接 `fetch('/api/...')` 调用已收敛到 `api.get/post/put`，覆盖学生列表/详情/分配/状态/入库、线索反馈/抢单/释放、试听开课、老师入库、同步页、ClassIn SDK 页、ClassIn 学生/老师/班级列表、课程课节、回访记录、ClassIn 测试页等。
- `/dashboard/sync` 已移除 ClassIn Cookie 的浏览器持久保存：页面加载时清理旧版 `localStorage.classin_cookie` 残留，Cookie 只在当前页面内存中临时保留并随本次同步请求提交，不再提示或允许保存到本地存储。
- `app/page.tsx` 与 `app/login/page.tsx` 的 session 探测已从手写旧 token + `fetch('/api/auth/session')` 改为 `api.get('/api/auth/session')`，完整 session 存在但 access token 临期或过期时也能先走刷新链路再判断登录状态。
- `app/page.tsx` 的 session 探测异常已改为安全摘要日志；`/debug/auth` 调试页面不再展示 token 前缀、本地完整用户对象或原始异常，只保留存在性、长度和错误摘要。
- `/api/auth/signin` 与 `/api/auth/refresh` 不再向前端返回完整 Supabase `session/user`，只返回前端刷新和鉴权所需的最小 session；`app/login/page.tsx` 和 `lib/tokenRefreshManager.ts` 写入 `localStorage` 时也只保留 token、过期时间和 `user.id`，用户资料继续通过 `/api/auth/profile` 按需读取。
- 旧 `AppProvider/useApp` 模拟登录上下文已移除，根布局不再本地生成任意邮箱对应的 admin 用户；`/dashboard/debug/permissions` 改用真实权限 Hook 的当前用户档案，并将邮箱原文改为存在性展示。
- `lib/fetch.ts` 已在每次 API 请求前检查 token 是否临近过期并主动刷新；401 后重试也复用同一套请求头构造逻辑，避免 JSON 请求刷新后丢失 `Content-Type`。
- 重新扫描后，源码里剩余的直接 fetch 仅为 `lib/fetch.ts`、`tokenRefreshManager` 自身刷新请求、公开老师二维码表单、外部 ClassIn SDK/同步请求和网络诊断请求；其中公开老师二维码上传已补超时和临时失败重试，仍不依赖后台登录态。

### 4.7 页面入口与业务链路收紧

- `app/api/leads/route.ts` 已通过数据库 RPC 自动生成线索编号，默认优先使用 `channel_platform` 清洗后的前缀，缺失时回退当前 `xhs_source`，格式为 `PREFIX_000000001`。
- 新增迁移 `supabase/migrations/057_add_lead_report_number_generator.sql`，提供 `leads_report_number_seq` 序列、`generate_lead_report_number()` 函数，并在历史数据无重复时创建唯一索引。
- 新增迁移 `supabase/migrations/058_add_lead_channel_social_fields.sql`，给线索增加 `channel_platform` 与 `customer_social_id`，并建立普通组合索引用于重复查询。
- `app/dashboard/leads/new/page.tsx` 已移除手填报单序号，创建成功后 toast 展示后端返回编号。
- `app/dashboard/leads/new/page.tsx` 已新增必填的“渠道平台”和“客户社媒账号 ID”；`app/dashboard/leads/[id]/edit/page.tsx` 可维护这两个字段。
- `POST/PUT /api/leads` 已按渠道平台 + 客户社媒账号 ID 自动查重，写入 `duplicate_mark/collision_operator`；重复只提示和标色，不阻断提交。
- `app/dashboard/leads/page.tsx` 已展示渠道平台、客户社媒账号 ID 和重复标记，疑似重复行使用淡蓝色标识。
- `app/dashboard/leads/page.tsx` 已新增聊天截图列，支持从列表或反馈弹窗点击放大并切换多张截图。
- `app/dashboard/formal-orders/page.tsx` 已新增付款凭证列，支持图片凭证弹窗预览，非图片 URL 提供打开链接。
- `app/dashboard/leads/[id]/edit/page.tsx` 已将报单序号改为只读；`PUT /api/leads` 会先校验当前用户数据范围，并忽略客户端传入的 `report_number`、`created_at`、`created_by`、`duplicate_mark`、`collision_operator`。
- `GET /api/leads` 已支持 `scope=owned` 和 `scope=public`：销售的线索跟进页只拉自己负责线索，公共线索池只拉未分配线索。
- 新增 `app/dashboard/public-leads/page.tsx`，作为销售公共线索池；页面不展示家长微信和聊天截图，仅提供抢单入口。
- `components/dashboard/sidebar.tsx` 已在客户管理下新增“公共线索池”，通过 `leads.assign` 权限控制，默认只对销售显示。
- `app/dashboard/leads/page.tsx` 已移除销售抢单按钮，保留自己线索的丢弃入口；丢弃后线索回到公共池。
- `app/dashboard/leads/page.tsx` 的编辑/删除按钮已按当前用户与单条线索的负责关系二次收紧，避免有资源权限但不在该线索范围内的用户看到高风险操作。
- `app/dashboard/dictionaries/page.tsx`、`app/dashboard/wechat-accounts/page.tsx` 和 `app/dashboard/daily-leads/page.tsx` 的删除入口已分别按 `dictionaries.delete`、`users.delete`、`leads.delete` 隐藏，并在删除弹窗确认函数内做二次权限拦截。
- `app/dashboard/classin-sdk/page.tsx`、`app/dashboard/sync/page.tsx`、`app/dashboard/classin/test/page.tsx`、`app/dashboard/classin/page.tsx`、`app/dashboard/classin/students/page.tsx`、`app/dashboard/classin/teachers/page.tsx`、`app/dashboard/classin/classes/page.tsx` 与 `app/dashboard/classin/classes/from-order/page.tsx` 已按 `teachers.notes` 隐藏 ClassIn 运维/镜像页面，非 admin / academic_affairs 直接访问 URL 也只显示无权访问。
- `app/api/leads/grab/route.ts` 与 `app/api/leads/release/route.ts` 已在抢单/丢弃时清空 `add_status/add_feedback/feedback_time/conversion_status`，避免旧反馈状态污染下一位销售。
- `POST /api/leads/feedback` 已把 `add_status` 限定为 `added` 或 `not_added`，防止手工请求写入历史中文值或其他非法状态。
- `app/dashboard/trial-lessons/page.tsx` 已移除独立“新增试听课程”入口，空列表文案改为从线索页面创建试听。
- `app/dashboard/trial-lessons/page.tsx` 已新增“线索编号”列；`GET /api/trial-lessons` 仅联表返回 `leads.report_number`，不额外扩大微信、截图等敏感字段暴露面。
- `app/dashboard/trial-lessons/new/page.tsx` 已要求 URL 必须携带 `lead_id` 或正式生 `student_id`；缺少来源时只显示返回入口，不再展示可提交表单；从线索进入时会只读展示线索单号，渠道优先自动带入 `channel_platform`，再回退到小红书来源或添加方式。
- 新建试听前端已锁定来源线索，不再允许手动切换；自动填充会带入地域、年级、首个学科和学生称呼，`parent_wechat` 只有可识别为手机号/邮箱时才写入手机号/邮箱字段，否则在来源信息中提示用户手工填写可用于 ClassIn 建号的联系方式。
- `app/api/trial-lessons/route.ts` 已强制试听必须且只能关联线索或正式生其中一种来源，普通试听必须关联可访问线索，正式生补试听必须关联可访问 `student_id`；`GET/PUT/DELETE` 也已把 `student_id` 纳入单条和列表范围校验；编辑时来源 `lead_id/student_id` 后端拒绝改绑。
- `app/api/trial-lessons/route.ts` 创建试听后会自动创建/绑定 ClassIn 学生账号，并写回 `classin_student_uid/classin_student_registered_at/classin_student_error`；失败不阻塞试听业务记录，但落库为安全错误状态，服务端只记录错误摘要；编辑手机号或历史失败记录会重试绑定，普通角色响应只保留 `classin_student_bound` 状态，不回显 UID。
- `GET/POST/PUT /api/trial-lessons` 已从全字段查询和默认 `.select()` 收敛为试听页面字段白名单；列表/详情/创建/更新响应都会返回 `lesson_status`、`lesson_status_name` 和转正式计算值，状态计算时优先读取 `manual_converted`，旧库缺列时自动回退基础字段集；数据库异常响应不再回显 raw message/stack。
- `app/api/trial-lessons/open-class` 和旧的 `app/api/trial-lessons/create-classin` 已优先复用试听记录上的 `classin_student_uid`，没有 UID 时才补注册，并在创建课程后把学生加入 ClassIn 课程；两个接口查询字段、教师字段、count 查询和错误日志已收窄，开课返回和 `class_link` 不再使用携带手机号的 `invokeUrl`。
- 试听列表快捷“匹配老师/确认老师”、新增试听页和编辑试听页已从自由输入改为 ClassIn 老师搜索选择；`GET /api/teachers/classin` 的选项 id 已改为稳定的 `uid` 字符串，响应只返回 `uid/name/position` 映射后的选人字段；后端会拒绝不在老师库或 ClassIn 镜像中的 `matched_teacher`。
- 新增 `app/dashboard/academic/pending-trials/page.tsx`，作为教务“待试听匹配”工作台；侧边栏已对 admin / academic_affairs 展示入口，页面可筛出待匹配试听并单条或批量选择 ClassIn 老师写回匹配老师。
- `app/dashboard/leads/page.tsx` 的“试听”按钮已收紧为：只有已添加且归当前用户负责的线索才显示/允许跳转。
- `app/dashboard/formal-orders/page.tsx` 已改为只读核对页：移除列表页直接新增入口，订单状态改为只读标签，退费、编辑、删除等高风险操作不再从正式订单列表发起，只保留付款凭证预览和进入正式生详情。
- `lib/server-formal-order-balance.ts` 已统一计算正式订单 `computed_status/computed_status_label`，基于原始订单状态、已消耗课时和退费记录自动区分进行中、已完成、已退费等状态；`GET /api/formal-orders` 与 `GET /api/students/detail` 已返回该计算状态，正式订单列表和正式生详情优先展示同一口径。
- `app/dashboard/formal-orders/[id]/edit/page.tsx` 已替换为迁移提示页；手动访问旧编辑 URL 不再展示可提交表单，只引导回正式订单列表或进入正式生详情。
- `lib/permissions.ts` 已移除 sales/head_teacher 在正式订单上的 `edit/addLink` 能力，保留 `create` 用于试听转正式。
- `app/dashboard/teachers/page.tsx` 已按 `teachers.create/edit/delete` 隐藏新增、编辑、删除入口，并移除手动“入库到 ClassIn”按钮，避免绕过试听确认老师流程。
- `app/dashboard/formal-orders/new/page.tsx` 已要求必须从试听课程携带 `trialLessonId` 进入；缺少来源试听时不展示表单。
- 试听转正式时，正式订单新增页会自动带入并锁定学生称呼、电话、年级、地域、来源线索、老师和学科；页面不再在转正式前自行创建或改绑学生，只提交 `trial_lesson_id` 与订单字段。
- `app/api/formal-orders/route.ts` 创建正式订单时已校验来源试听可访问、未重复转化、处于可转正状态，并确保订单关联线索与来源试听一致；来源试听已有 `student_id` 时订单必须使用该学生，来源试听没有 `student_id` 时后端按试听姓名和手机号复用或创建学生并回写 `trial_lessons.student_id`，前端伪造的其他 `student_id` 不再生效；`PUT/DELETE` 也已补单条订单范围校验。
- 新增 `supabase/migrations/055_add_trial_lesson_id_to_formal_orders.sql`，给 `formal_orders` 增加 `trial_lesson_id` 和非空唯一索引，支撑“一个试听只能转一个正式订单”和状态计算器的已转化判断。
- 新增 `supabase/migrations/056_add_classin_student_fields_to_trial_lessons.sql`，给 `trial_lessons` 增加试听学生 ClassIn UID、绑定时间和错误原因字段。
- 新增 `app/dashboard/formal-students/page.tsx` 和 `app/dashboard/academic/students/page.tsx`，作为正式生管理/学生库（教务版）入口；侧边栏“教务管理”下已新增对应入口。
- 新增 `app/dashboard/quality/trial-conversion/page.tsx` 和 `app/dashboard/quality/service/page.tsx`，作为质检系统基础工作台；侧边栏新增“质检系统”分组，支持查看试听转化风险和课后服务风险并跳转处理。
- `app/dashboard/feedback/page.tsx` 已从占位页补为真实回访管理工作台，具备学生查看权限的角色可分页查看可访问正式生回访记录，具备编辑/删除权限时可新增、编辑和删除；运营/销售等无权角色手工访问只显示无权提示。
- `GET /api/students?formal=true&include_summary=true` 已返回仅有正式订单的学生，并附带订单数、总课时、已消耗课时、剩余课时、剩余金额、科目、老师和最近订单。
- `app/dashboard/students/page.tsx` 会根据路径切换为正式生列表，隐藏新增学生、入库、普通编辑和删除入口，保留详情、续费和退费入口。
- `app/api/students/detail/route.ts` 已按当前用户可访问学生范围校验，并一次性聚合正式订单、课程、回访、状态历史、异动记录和剩余课时/金额，避免详情页再走未过滤散接口；正式订单余额统一走 `lib/server-formal-order-balance.ts`，按已完成课时和既往非拒绝退费扣减净剩余课时/金额。
- `app/api/students/route.ts` 的 `PUT/DELETE` 已补单条学生范围校验，防止普通可编辑角色通过传入别人的学生 ID 绕过列表过滤。
- `app/api/visit-records/route.ts`、`app/api/students/status-history/route.ts`、`app/api/students/update-status/route.ts` 已补学生范围校验；班主任只能操作自己负责学生，销售/运营只能看自己转化来源内学生。
- `app/api/visit-records/route.ts` 与 `app/api/students/status-history/route.ts` 已继续字段白名单和错误降敏：回访备注、状态变更原因和底层 raw message/stack 不再写入日志或响应正文。
- `app/dashboard/students/[id]/page.tsx` 的回访记录已支持新增、编辑、删除，并复用 `visit-records` 后端学生范围校验。
- 新增 `supabase/migrations/059_add_transaction_record_relations.sql`，给 `transaction_records` 增加 `student_id` 与 `order_id`；`app/api/transactions/route.ts` 已按学生范围过滤，并复用正式订单余额 helper 校验退费金额不超过订单净剩余可退金额，`remaining_duration` 不超过净可退课时；接口响应已隐藏银行卡字段，手工改挂学生/订单会重新校验范围，并收敛底层错误回显。
- `app/dashboard/transactions/page.tsx` 已改为异动流程工作台：新增入口按 `transactions.create` 权限展示，列表提供教务核对、财务打款、人力业绩核对和拒绝按钮；旧 `/dashboard/transactions/[id]/edit` 仅显示迁移提示和记录摘要。
- 新增 `supabase/migrations/060_add_student_id_to_trial_lessons.sql`，给 `trial_lessons` 增加 `student_id`，用于正式生详情中新试听、试听列表范围过滤和正式生试听转正式订单。
- `app/dashboard/students/[id]/page.tsx` 已在正式生详情顶部和各业务标签中提供新试听、试听转正式、续费、扩科、退费入口；订单行也提供续费、扩科、退费快捷操作。
- `app/dashboard/formal-orders/new/page.tsx` 已支持三类合法来源：新签携带 `trialLessonId` 从试听转化进入，续费/扩科携带 `previousOrderId` 从正式生/历史订单进入，正式生新试听可通过 `student_id` 转正式订单；后端会校验来源试听或历史订单可访问且属于同一学生。
- 全量 TypeScript 检查已恢复通过：修复 Next 16 动态路由类型、历史编辑页更新入参、学生学号字段、分页/toaster/sidebar UI 类型问题；当前 `pnpm exec tsc --noEmit --pretty false --incremental false` 可作为后续整改验收门槛。

### 4.8 招师与面试权限硬化

- `lib/permissions.ts` 已收紧老师候选人权限：普通运营、销售、班主任、老师不再具备 `teacherCandidates.view`；`teacher_recruiter` 保留面试创建、编辑、上传录像和初评能力；`academic_affairs` 保留复核、教学评价和入库确认能力；`finance` 与 `hr` 仅具备查看待入库候选人和 `confirmEntry` 入库确认能力；候选人删除仅保留给 `admin`。
- `app/dashboard/teacher-candidates/page.tsx`、`app/dashboard/teacher-candidates/[id]/edit/page.tsx`、`app/dashboard/teacher-candidates/[id]/entry/page.tsx` 已按权限隐藏新增、编辑、删除、入库确认等按钮，前端误点会给出明确提示。
- `app/api/teacher-candidates/route.ts` 已在 `POST/PUT` 中按当前用户角色过滤可写字段：招师只能维护候选人基础资料、约面、录像、初评、薪资沟通等招师侧字段；教务只能维护复核结果、复核评价、试课录像、老师等级、排课偏好和入库备注等教务侧字段；HR/财务只能维护复核通过且未入库候选人的谈薪入库所需课时费、教学信息、银行卡和入库备注字段；非授权字段会被忽略，不再允许通过手工请求越权改 `review_result`、`teacher_level`、`is_hired` 等字段。
- `app/api/teacher-candidates/route.ts` 已对候选人列表/详情/写入响应补入库敏感字段脱敏：没有 `teacherCandidates.confirmEntry` 的角色会拿到置空后的 `bank_account`、`bank_account_name`、`bank_name`、`bank_branch` 和 `notes_external`。
- `app/api/teacher-candidates/route.ts` 已补 `name` 精确筛选，教师详情页按姓名查看历史面试时不再误取候选人第一页；候选人 GET/POST/PUT 返回改为字段白名单，计数查询不再 `select('*')`，DELETE 路由内再次要求 admin，异常日志和响应不再暴露 raw message/stack。
- `app/dashboard/teacher-candidates/[id]/edit/page.tsx` 和 `components/dashboard/teacher-candidates/ReviewTab.tsx` 已移除复核流程里的硬编码“系统用户”，改为当前登录用户档案自动带出复核人；`PUT /api/teacher-candidates` 在写入复核字段但缺少 `reviewed_by` 时也会以后端当前档案兜底。
- `app/api/teacher-candidates/route.ts` 已补 `queue=scheduling` 过滤，返回未约面且未入库候选人；新增 `app/dashboard/teacher-candidates/interview/page.tsx` 作为招师/管理员约面队列，保存约面时间、约面人、链接和备注后推进到初试录像上传。
- `app/api/teacher-candidates/route.ts` 已补 `queue=video_upload` 过滤，返回已约面且未上传录像候选人；新增 `app/dashboard/teacher-candidates/upload/page.tsx` 作为招师/管理员初试录像上传队列，上传走统一 `/api/upload` 的 `teacher-interview-videos` bucket 校验，保存后推进到教学复核。
- `app/api/teacher-candidates/route.ts` 已补 `queue=teaching_review` 过滤，返回已上传录像且未复核候选人；新增 `app/dashboard/teacher-candidates/review/page.tsx` 作为教务/管理员教学复核队列，复核通过进入谈薪/待入库链路，拒绝写入原因并归档。
- `app/api/teacher-candidates/route.ts` 已补 `queue=pending_entry` 过滤，返回复核通过且未入库候选人；HR/财务访问列表、详情和更新时也被后端限制在该队列内；新增 `app/dashboard/teacher-candidates/pending/page.tsx` 作为具备 `teacherCandidates.confirmEntry` 权限角色的待入库老师队列，可从侧边栏进入并通过谈薪入库表单保存课时费、教学科目、银行账户和备注，随后调用确认接口创建老师档案，并一次写入 `final_entry`、`in_teacher_pool`、薪资确认时间和确认人。
- `app/api/teacher-candidates/route.ts` 已补 `queue=reserve` 过滤，返回流程拒绝或复核不符合候选人；新增 `app/dashboard/teacher-candidates/reserve/page.tsx` 作为招师/教务/管理员储备候选人队列，集中查看拒绝原因和复核备注。
- 新增 `PUT /api/teacher-candidates/recruitment-flow`，补上前端招聘流程服务实际调用的后端接口：路由内校验目标步骤、状态匹配、合法流转和角色边界，拒绝候选人时要求填写原因并写入 `review_notes`。
- 新增迁移 `supabase/migrations/064_add_teacher_candidate_recruitment_notes.sql`，补齐招聘流程组件使用的 `interview_notes`、`interview_rating`、`review_notes` 字段，并同步更新候选人服务类型和 API 字段白名单。
- 新增迁移 `supabase/migrations/065_add_teacher_candidate_salary_entry_fields.sql`，补齐谈薪入库使用的 `bank_account`、`bank_account_name`、`bank_name`、`bank_branch`、`notes_external` 字段；候选人 API 字段白名单和教务可写字段已同步放行，日志仅记录是否携带银行字段，不输出原文。
- `components/teacher/recruitment/SchedulingForm.tsx`、`InterviewVideoForm.tsx`、`TeachingReviewForm.tsx` 已从占位 TODO 改为真实调用候选人更新接口和招聘流程推进接口，约面、录像上传、复核通过/拒绝不再只停留在前端提示。
- `POST /api/teacher-entries` 已补路由内 `teacherCandidates.interview` 权限校验；`POST /api/teacher-entries` 和 `POST /api/teacher-entries/confirm` 的老师记录响应会按角色清空 `classin_initial_password`，避免旧入库路径回显初始密码；两个接口也已改为字段白名单查询，异常响应和日志不再透出 raw message/stack。
- 旧手动老师/学生 ClassIn 注册接口已继续降敏：日志只记录是否携带手机号/昵称和错误摘要，500 响应返回通用错误，不再暴露 ClassIn/Supabase 底层错误正文、手机号、昵称或 stack。

### 4.9 老师库存编号

- 新增迁移 `supabase/migrations/061_add_teacher_code_generator.sql`，提供 `teacher_code_seq` 序列和 `generate_teacher_code()` RPC，生成 `TH00001`、`TH00002` 这类 5 位递增编号；迁移会按已有 `TH` 编号校准序列，并给历史空编号老师补号。
- 新增 `lib/server-teacher-code.ts`，统一封装老师编号生成，以及候选人重复入库时复用已有关联老师编号的逻辑。
- `POST /api/teachers` 已从 `TEA + 日期 + 随机数` 改为调用 `generate_teacher_code()`；老师列表和老师详情会展示 `teacher_code`。
- `POST /api/teacher-entries/confirm` 和旧的 `POST /api/teacher-entries` 不再要求前端传 `teacher_code`；候选人入库页已去掉手填编号输入，确认入库后在成功提示中显示后端生成的编号。

### 4.10 老师 ClassIn 账号创建时机

- 新增 `lib/server-classin-teachers.ts`，按老师姓名从 `teachers` 库查找 ClassIn 手机号，优先复用本地 `classin_uid`，其次复用 `teacher_classin.mobile` 已同步 UID，最后才调用 ClassIn SDK 注册老师。
- `POST/PUT /api/trial-lessons` 在创建或更新 `confirmed_teacher` 时会先自动确保该老师已创建/绑定 ClassIn 账号；绑定失败会返回明确错误，不再让后续开课环节才暴露“老师未入库/无 UID”。
- `POST /api/teachers` 已停止创建老师时立即注册 ClassIn，只保留老师库存本地创建和 `TH00001` 编号生成。
- `POST /api/teacher-entries/confirm` 已停止入库确认时注册 ClassIn，只保存本地老师库存、ClassIn 手机号和初始密码，后续仍由试听确认老师时懒创建/绑定 UID。
- `app/dashboard/teachers/page.tsx` 已移除手动“入库到 ClassIn”按钮；老师列表仍展示 `classin_uid` 供核对绑定结果。
- 现有 `POST /api/teachers/register-classin` 与 `POST /api/teacher-entries/register-classin` 暂保留为兼容/运维接口，但日常页面入口已移除，route-local 已限制为 admin / academic_affairs，主业务路径改为试听确认老师时懒创建。
- `lib/server-classin-password.ts` 已统一 ClassIn 初始密码兜底策略：优先使用显式输入或 `CLASSIN_*_DEFAULT_PASSWORD`，缺失时生成随机 8 位数字密码，不再回退固定 `123456`；学生手动入库入口已改为受控弹窗输入学生编号和初始密码，不再通过浏览器 `prompt()` 处理 ClassIn 初始密码，也不再预填弱默认值。

### 4.11 老师库存等级与状态入口

- 新增迁移 `supabase/migrations/062_add_teacher_level_status_fields.sql`，给 `teachers` 补齐 `teacher_level` 与 `status` 字段，默认状态为 `active`，并初始化 `teacher_level`、`teacher_status` 字典项。
- `GET/POST/PUT /api/teachers` 已接入老师等级和库存状态；新建老师默认“未定级/正常”，编辑老师可维护等级和状态。
- `POST /api/teacher-entries/confirm` 与旧 `POST /api/teacher-entries` 已把候选人老师等级同步到老师库存，避免入库后等级信息丢失。
- `app/dashboard/teachers/page.tsx` 已在老师列表展示老师编号、等级和状态标签；老师详情、新建和编辑页也已提供等级/状态展示或维护入口。
- 新增 `components/teacher/TeacherLibraryView.tsx` 作为老师库通用视图，`/dashboard/teachers/teaching` 面向教务展示教学和 ClassIn 绑定字段，`/dashboard/teachers/sales` 面向销售只读展示外显匹配字段。

### 4.12 老师信息采集链接与候选人回填

- `app/dashboard/teacher-candidates/[id]/edit/page.tsx` 已为招师提供候选人专属老师信息采集链接，可复制或打开 `/teacher-form?candidate_id=...`，复制时会把链接保存到 `teacher_candidates.qr_code_url`。
- `app/teacher-form/page.tsx` 已支持从专属链接进入后自动验证候选人、预填姓名、微信、ClassIn 手机号、学科和年级；无专属链接时不再允许用微信号或手机号公开验证/提交。
- `POST /api/teacher-form` 已要求绑定候选人，提交后写入 `teacher_details`，并把老师姓名、微信、ClassIn 手机号、形象照、教授学科、年级段、教学特点、教学经历、学生水平和排课偏好回填到 `teacher_candidates`。
- 公开老师表单 API 已收窄响应与日志：`POST /api/teacher-form/verify` 只接受专属链接里的 `candidate_id` 并只查询预填所需字段；`POST /api/teacher-form` 成功后只返回 `id/candidate_id/created_at`，不回显完整老师资料；`GET /api/teacher-form` 复用共享用户档案解析并按字段白名单读取；公开错误响应不再透出数据库或存储错误明细，日志只记录字段名、数量和是否携带类摘要。
- 新增迁移 `supabase/migrations/063_add_teacher_form_candidate_once_index.sql`，限制同一个候选人只能有一条有效公开表单提交，避免重复提交污染入库数据。
- `app/dashboard/teacher-candidates/[id]/entry/page.tsx` 与 `POST /api/teacher-entries/confirm` 已优先使用公开表单回填的 `teacher_candidates.phone` 作为 ClassIn 注册手机号，入库确认不再把手机号写回 `wechat_id`。

### 4.13 课堂管理课节导出

- 新增 `GET /api/class-sessions/export`，要求 `start_date` / `end_date` 为 `YYYY-MM-DD`，可选按课节状态筛选，路由权限映射到 `classSessions.view`。
- 导出数据按 `getAccessibleCourseIds()` 过滤课程范围，普通角色只能导出自己可访问课程下的课节；CSV 字段包含上课日期、时间、时长、课程、订单、学生、学科、年级、老师、状态、ClassIn 课堂 ID 和备注。
- CSV 输出已加 UTF-8 BOM、`Content-Disposition`、`Cache-Control: private, no-store`、`X-Export-Row-Count` 和 `X-Export-Limited` 响应头，并对 `= + - @ tab CR` 开头的单元格做表格公式注入防护。
- `app/dashboard/classroom/page.tsx` 已新增导出开始/结束日期、课节状态筛选和“导出课节”按钮，下载走统一 `api` wrapper，保留 token refresh 行为。
- `GET /api/classrooms/scheduled` 已同步加上课程范围过滤，避免课堂管理课程列表比课节导出暴露更多数据。

### 4.14 课节时间修改同步 ClassIn

- `PUT /api/class-sessions` 已在修改 `scheduled_date`、`scheduled_time_start` 或 `scheduled_time_end` 时调用 ClassIn SDK `updateClassroom`，使用课程 `classin_course_id`、课节 `classroom_id` 和 `classroom_classin.activity_id` 同步远端课堂时间。
- `POST /api/class-sessions` 和 `PUT /api/class-sessions` 已将创建/更新后的默认整行回包改为课节字段白名单，批量创建、单节创建和更新时间同步返回结构一致，不再依赖 Supabase 默认 `.select()`。
- 同步前会按当前用户可访问课程范围校验课节归属；已绑定 ClassIn 课堂但缺少课程 ClassIn ID 或本地课堂镜像时返回明确业务错误，避免静默只修改本地时间。
- 上课日期和时间按中国时区 `+08:00` 组装为远端 begin/end 时间；时间格式错误或结束时间不晚于开始时间会返回 400。
- ClassIn 同步成功后会更新 `classroom_classin.start_time/end_time/sync_time` 本地镜像，并在课程详情页提示“已同步到 ClassIn”；未绑定 ClassIn 课堂的本地课节会允许本地修改并提示跳过原因。
- 排课日期变化时会触发课程统计刷新，避免 `course_consumption_info.lastSessionDate` 仍停留在旧日期。

### 4.15 批量与单节排课创建加固

- `POST /api/schedule/batch/create-classin` 已按当前用户可访问正式订单范围校验 `orderId`，无权订单返回 403；`POST /api/class-sessions/recreate` 已按当前用户可访问课程范围校验 `courseId`。
- 批量创建还会校验每条排课的学生必须与订单学生一致，老师必须在订单老师名单内，避免有订单权限的账号通过提交别的学生或老师姓名创建越界 ClassIn 课程/课节。
- 批量创建和单节重建均把 ClassIn course ID、teacher UID、student UID 规范为正整数，避免 SDK 调用时因为字符串/空值导致创建失败。
- 上课日期和时间统一按中国时区 `+08:00` 组装，支持 `HH:mm` 与 `HH:mm:ss` 输入，并校验结束时间必须晚于开始时间。
- 批量创建会通过 `ensureClassInStudentAccount()` 注册或复用学生 ClassIn 账号，再加入课程；缺手机号或绑定失败会返回明确错误。
- 批量创建日志和单条失败响应已改为行号、日期时间、是否携带姓名和安全错误摘要，不再记录手机号、学生姓名、老师姓名或整条排课数据。
- ClassIn 课程创建后如果本地 `courses.classin_course_id` 或本地 `courses` 记录回写失败，接口会直接失败，不再继续创建半同步课节。
- ClassIn 课堂创建成功后必须同步写入 `classroom_classin` 和本地 `class_sessions`，本地课节落库失败会计入失败条目，不再显示“成功但没有课节”。
- 课节序号改为基于现有最大 `session_number + 1`，并用标准化后的日期/开始/结束时间跳过重复课节，避免重新生成后序号重复或重复创建。
- 批量排课页重新生成班级课时会按已有课节数计算剩余课节数，避免已经有课节时仍按总课节数重复生成；提交结果会显示成功、失败和第一条失败原因。

### 4.16 验证结果

- `git diff --check` 通过。
- API 覆盖扫描通过：当前 78 个 API route 文件、131 个导出方法中，非公开路由漏配数为 0。
- `npx tsc --noEmit --pretty false --incremental false` 仍失败，但剩余错误位于仓库既有类型问题中；本轮新增/修改的权限、scope、中间件、路由权限、上传、上传 bucket 权限、登录态 session 探测收敛、课程、课节、课堂导出、课节时间同步 ClassIn、批量/单节排课 ClassIn 创建加固、同步、ClassIn 注册、手动学生 ClassIn 注册权限收紧、ClassIn SDK/旧手动注册/课堂测试/Cookie 登录运维权限收紧、试听创建、试听来源排他、正式订单转正、试听转正式学生锁定、公共线索池、线索行级编辑/删除入口、线索删除路由内管理员兜底、渠道社媒去重、截图/付款凭证预览、正式生管理、正式订单余额/退费上限、回访范围、状态历史范围、异动/退费范围、学生 ClassIn 凭据脱敏、正式订单和试听付款凭证脱敏、老师候选人权限硬化、老师编号生成、老师 ClassIn 确认绑定、老师库存等级/状态入口、老师信息采集链接/候选人回填相关文件没有新增 TypeScript 报错。
- 2026-06-11 针对待办接口和线索催促隐私收敛追加验证：敏感日志/全字段查询扫描未命中，相关文件的 TypeScript 定向过滤未出现新增报错；全量 `tsc` 仍受既有仓库类型问题影响。
- 2026-06-12 针对待办删除 admin-only 和登录最小 session 收敛追加验证：`pnpm exec tsc --noEmit --pretty false --incremental false` 通过；`git diff --check` 通过。
- 2026-06-12 针对非超管删除入口追加前端扫描：字典、废弃微信号管理、每日线索删除按钮已接入资源权限显隐，确认删除函数补权限兜底；`git diff --check` 与 `pnpm exec tsc --noEmit --pretty false --incremental false` 通过。
- 2026-06-12 针对剩余非超管删除确认链路追加前端补漏：试听列表、线索列表、学生列表和老师库删除确认弹窗已接入权限/单条范围 open 限制，确认函数补权限兜底；定向扫描、`git diff --check` 与 `pnpm exec tsc --noEmit --pretty false --incremental false` 通过。
- 2026-06-12 针对待办删除确认链路追加前端补漏：`/dashboard/todos` 删除待办已从浏览器原生 `confirm()` 改为受控确认弹窗；定向扫描、`git diff --check` 与 `pnpm exec tsc --noEmit --pretty false --incremental false` 通过。
- 2026-06-12 针对 `/api/cleanup-all-admins` 追加破坏性接口二次守卫：生产环境默认 404 保持不变，非生产或显式开启时仍需 `users.delete` 权限；接口只读取 admin 用户 ID，响应只返回清理计数。
- 2026-06-12 针对 `/api/init-admin` 追加生产环境显式开关：生产环境默认 404，只有 `ENABLE_INIT_ADMIN_API=true` 且 `INIT_ADMIN_SECRET` 校验通过才允许查询初始化状态或创建首个 admin。
- 2026-06-12 已部署 `/api/init-admin` 生产显式开关补丁到 Vercel：deployment `dpl_9yzcRSViTW8cUWL1zKuLgPEGVTwT` 已 Ready 并绑定生产别名 `https://xiaoniuhaoxue.paitongai.cn`。生产 smoke：`GET /api/init-admin` 与 `POST /api/init-admin {}` 均返回 `{"error":"Not found"}`；`POST /api/auth/signin {}` 仍返回“账号/邮箱和密码必填”。
- 2026-06-12 针对学生入库确认、微信号管理、admin 清理、老师公开表单和旧手动学生 ClassIn 注册追加日志降敏验证：敏感 `message/stack` 日志扫描未命中，`pnpm exec tsc --noEmit --pretty false --incremental false` 通过。
- 2026-06-12 针对 ClassIn 同步和 SDK 写入口追加错误出口降敏：`/api/sync/classes`、`/api/sync/classrooms`、`/api/sync/students`、`/api/sync/teachers`、`/api/classin-sdk/register/teacher`、`/api/classin-sdk/course`、`/api/classin-sdk/unit`、`/api/classin-sdk/classroom`、`/api/classin-sdk/complete` 和 `lib/services/classin-sdk/service.ts` 不再命中 `error.message` 直出、`stack` 直出或裸 SDK 异常输出扫描。
- 2026-06-12 针对 ClassIn SDK core debug 请求日志继续降敏：`api-v1.js` / `api-v2.js` 不再输出完整请求参数或请求数据，只保留 action/path、参数字段数量、字段名和敏感字段数量摘要。
- 2026-06-12 针对剩余前端高敏入口追加日志降敏：学生列表/新建/编辑/详情、课堂学生列表、批量排课、异动预填和时区转换工具均改为 `summarizeError` 摘要日志；`console.error/warn(..., error)` 扫描在 `app/lib/components` 范围内已无命中。
- 2026-06-12 针对学生手动入库 ClassIn 入口追加交互整改：学生列表页“入库”改为受控弹窗填写学生编号和 ClassIn 初始密码，提交期间锁定关闭与重复提交；学生页 `prompt()` 扫描已无命中。
- 2026-06-12 针对课节查询接口追加字段白名单：`GET /api/class-sessions` 列表和详情不再使用嵌套星号查询，改为课节字段白名单加必要课程/学生摘要字段；写入接口已保持白名单回包。
- 2026-06-12 针对历史试听缺正式生关联追加数据回填：新增 `070_backfill_trial_lesson_student_id.sql`，优先按正式订单来源试听回填，再按唯一联系方式和姓名/唯一联系方式补齐，避免可确定的历史试听继续依赖手机号兜底。
- 2026-06-12 针对公开老师表单上传追加候选人服务端复核：上传前必须携带已验证候选人 ID，后端复核候选人存在、面试状态和是否已提交，Storage 路径改为候选人目录隔离；路由覆盖脚本确认当前 80 个 API route 文件、135 个导出方法中非公开路由漏配数为 0，`pnpm exec tsc --noEmit` 通过。
- 2026-06-12 针对 ClassIn 创建班级与老师编号生成追加错误出口降敏：`POST /api/classin/classes` 捕获异常时固定返回业务错误码/文案，老师编号 RPC 和候选人老师编号查询日志改为 `summarizeError` 摘要；定向裸 `error.message` 扫描、`pnpm exec tsc --noEmit` 与 `git diff --check` 通过。
- 2026-06-12 针对课程详情按 ID 查询追加业务范围校验：`GET /api/courses/[courseId]/sessions` 与 `GET /api/courses/[courseId]/consumption` 已复用 `getAccessibleCourseIds()` / `hasScopedIdAccess()`，有角色权限但无该课程范围的用户会收到 403，避免猜测课程 ID 读取他人课时和课消数据；`pnpm exec tsc --noEmit` 通过。
- 2026-06-12 针对课节同步写入口追加业务范围校验：`POST /api/class-sessions/sync` 在按 `courseId` 同步整课或按 `sessionId` 同步单节前，都会复用 `getAccessibleCourseIds()` / `hasScopedIdAccess()` 校验当前用户是否可访问对应课程；有 `classSessions.edit` 权限但不在课程范围内的用户会收到 403，避免越权触发他人课程课节状态和实际上课时间同步。
- 2026-06-12 针对老师招聘/谈薪入库前端错误展示追加脱敏：`lib/safe-error.ts` 新增客户端白名单错误展示工具，`lib/services/recruitmentFlow.ts` 不再透传招聘流程接口 raw error，约面、初试录像、教学复核和谈薪入库表单只展示白名单业务错误或固定友好文案，避免数据库、Storage、上传和入库确认底层异常进入浏览器 toast；`pnpm exec tsc --noEmit --pretty false --incremental false` 与 `git diff --check` 通过。
- 2026-06-12 已部署老师招聘/谈薪入库错误展示降敏补丁到 Vercel：deployment `dpl_3vXQhFSTZLnMqGPrwEJFBB1RThG2` 已 Ready 并绑定生产别名 `https://xiaoniuhaoxue.paitongai.cn`。生产 smoke：`GET /api/health` 返回 `ok`，`GET /api/init-admin` 返回 `{"error":"Not found"}`，`POST /api/auth/signin {}` 返回“账号/邮箱和密码必填”。
- 2026-06-12 针对后台高频操作前端错误展示追加脱敏：老师库加载/删除、待办创建/分配用户加载和课节编辑 toast 已接入 `getClientSafeErrorMessage()`，不再展示服务层、数据库或 ClassIn 原始错误正文；局部扫描确认对应组件无旧式 `error.message` toast 暴露点。
- 2026-06-12 针对登录 `PROFILE_LOOKUP_FAILED` 追加档案查询兜底：`getActiveUserProfile()` 支持传入已验证的 access token，service-role 查询缺失或失败时会用用户 token 按同一字段白名单兜底读取当前用户档案，登录、refresh、session、profile、权限中间件、用户管理 admin 校验和线索反馈均已传入现成 token；兜底路径仍会拦截 `is_active=false` 账号，日志只记录安全摘要和是否启用兜底。定向扫描确认无旧式不传 token 的档案查询调用，`pnpm exec tsc --noEmit --pretty false --incremental false` 与 `git diff --check` 通过。
- 2026-06-12 已部署登录 `PROFILE_LOOKUP_FAILED` 档案查询兜底补丁到 Vercel：deployment `dpl_5jvbrCAwf8gUj4Miu8Vdg9GK33T1` 已 Ready 并绑定生产别名 `https://xiaoniuhaoxue.paitongai.cn`。生产 smoke：`GET /api/health` 返回 `ok`，`GET /api/init-admin` 返回 `{"error":"Not found"}`，`POST /api/auth/signin {}` 返回“账号/邮箱和密码必填”。
- 2026-06-12 针对公开老师表单和后台通用上传前端错误展示继续降敏：候选人验证、表单提交、公开图片上传和后台通用上传 helper 只展示白名单业务错误或固定友好文案，未知网络、Storage、数据库或 SDK 错误不再通过 toast 直出；定向扫描确认 `app/teacher-form/page.tsx` 与 `lib/services/upload.ts` 已无旧式 `error.message` 直出，`pnpm exec tsc --noEmit --pretty false --incremental false` 与 `git diff --check` 通过。
- 2026-06-12 已部署公开老师表单和后台通用上传前端错误展示降敏补丁到 Vercel：首次 prebuilt 上传触发免费额度 `api-upload-free`，按 Vercel CLI 建议改用 `--archive=tgz` 后部署成功；deployment `dpl_4Zy4kiqK3Z73JdeAENnnLhnp4Ggc` 已 Ready 并绑定生产别名 `https://xiaoniuhaoxue.paitongai.cn`。生产 smoke：`GET /api/health` 返回 `ok`，`POST /api/auth/signin {}` 返回“账号/邮箱和密码必填”。
- 2026-06-12 针对账号管理与异动核对前端错误展示继续降敏：账号列表/新增/编辑、异动列表/新增及历史异动提示入口 toast 已接入 `getClientSafeErrorMessage()`，未知服务层、数据库或流程动作异常只展示固定友好文案，不再把 raw `error.message` 透出给浏览器用户。
- 2026-06-12 已部署账号管理与异动核对前端错误展示降敏补丁到 Vercel：deployment `dpl_EkpUVFy2irYcVMU4LtKoGVFuCQkh` 已 Ready 并绑定生产别名 `https://xiaoniuhaoxue.paitongai.cn`。生产 smoke：`GET /api/health` 返回 `ok`，`POST /api/auth/signin {}` 返回“账号/邮箱和密码必填”。

---

## 5. 当前代码与需求的主要冲突

### 5.1 权限矩阵冲突

`lib/permissions.ts` 中最直接的普通角色删除权限冲突已在 P0 第一轮处理：

| 角色 | 已处理项 | 剩余关注 |
|---|---|---|
| operator | 已移除 `leads.delete`，线索列表入口和行级编辑/删除已按自己录入/负责范围收敛，公共线索池入口不对运营开放 | 需继续结合业务验收运营是否还需要额外的派单看板 |
| sales | 已补 `leads.create`，未抢公共线索遮罩敏感字段，学生 ClassIn 凭据和订单付款凭证已脱敏，正式订单普通编辑/开课权限已移除；续费、退费、正式生详情入口已迁移到正式生管理 | 需继续结合业务确认学生手机号是否还要在已归属范围内进一步分级展示 |
| head_teacher | 已移除 `classSessions.delete`，已补 `leads.create`，学生 ClassIn 凭据和订单付款凭证已脱敏，正式订单普通编辑权限已移除；续费、退费、正式生详情入口已迁移到正式生管理 | 需继续结合业务确认学生手机号是否还要在已负责正式生范围内进一步分级展示 |
| academic_affairs | 已移除 `classSessions.delete` 与 `todos.delete`，老师候选人权限已收窄为复核/教学评价/入库确认相关能力，老师库存等级/状态入口已接入列表、详情、新建和编辑页，老师信息采集链接已支持候选人回填与入库手机号带入 | 需继续结合实际表单验收二维码图片生成/外部分发形式是否必须从链接升级为图片二维码 |
| admin | 保留 delete | 符合“超级管理员除外” |

另一个已处理代码问题：`operator` 和 `sales` 的 `todos` 字段重复声明已清理，避免对象后声明覆盖前声明。

前端入口已补一轮权限对齐：`/dashboard/accounts` 按 `users.create/edit/delete` 控制新增、编辑、删除；`/dashboard/leads` 的编辑/删除按钮按资源权限和当前用户对单条线索的负责关系双重控制，删除确认弹窗和确认函数也会重查当前行范围；`/dashboard/public-leads` 已和菜单/后端规则对齐，仅销售可进入并执行抢单，admin、运营和班主任不展示入口；`/dashboard/trial-lessons`、`/dashboard/students` 和老师库通用视图的删除弹窗已分别按试听删除、admin 学生删除和 `teachers.delete` 权限限制打开，确认删除时再次拦截无权账号；`/dashboard/dictionaries`、`/dashboard/wechat-accounts`、`/dashboard/daily-leads` 的删除入口分别按 `dictionaries.delete`、`users.delete`、`leads.delete` 控制，并在确认删除时二次拦截无权账号；`/dashboard/students/[id]` 按 `trialLessons.create`、`formalOrders.create`、`transactions.create`、`students.edit/delete` 控制新试听、续费、扩科、退费、回访增改删；`/dashboard/courses/[id]` 按 `classSessions.edit/delete` 控制课节编辑、勾选、单删和批删。后端仍作为最终权限边界，前端隐藏用于减少误触和越权操作入口。

### 5.2 数据范围薄弱

核心 GET API 的第一批服务端数据范围已补齐，但仍需要继续覆盖页面入口和非核心查询：

| API | 当前情况 | 剩余风险 |
|---|---|---|
| `GET /api/leads` / `DELETE /api/leads/[id]` / 线索催促待办 | 已按角色和负责人范围过滤，并对未抢公共线索遮罩敏感字段；线索页编辑/删除按钮已按行级负责范围隐藏；删除接口路由内仅允许 admin 并校验档案和记录存在性；催促待办不再复制家长微信，改通过 lead entity 关联回原线索；线索页已补“运营/admin 催促销售”和“销售催促负责运营”的双向入口，销售侧 API 仅允许自己负责线索催促该线索 `operator_id` | 如后续业务只保留单向催促，再收敛入口文案和 API 白名单 |
| `GET/POST/PUT/DELETE /api/trial-lessons` | 已按可访问线索、顾问和正式生范围过滤；普通创建强制关联可访问线索，正式生补试听强制关联可访问 `student_id`；非 admin/finance/academic_affairs 脱敏 `payment_proof`；列表已展示来源线索编号；查询和写入响应已改字段白名单并兼容 `manual_converted` 缺列；创建后自动绑定 ClassIn 学生 UID 且普通角色只看绑定状态；匹配老师入口已改为老师库/ClassIn 老师搜索选择；确认老师时自动创建/绑定 ClassIn 老师 UID；历史试听 `student_id` 已补低风险回填迁移，优先使用正式订单来源试听关系，其次使用唯一联系方式/姓名匹配 | 少数手机号重复、姓名不一致或无联系方式的历史试听仍需人工核对后补齐 |
| `GET/POST/PUT/DELETE /api/formal-orders` | 已按关联线索、顾问和班主任负责学生过滤；新签强制来源试听；续费/扩科强制关联可访问历史订单；正式生试听可转正式订单；更新/删除校验单条范围；正式订单、来源试听和历史订单查询已改字段白名单；`PUT` 拒绝改绑 `student_id/lead_id/trial_lesson_id/previous_order_id`、订单编号和订单类型，非 admin/academic_affairs/finance 不能改付款或状态字段；异常出口只返回友好错误并记录安全摘要；非 admin/finance/academic_affairs 脱敏 `payment_proof`；课程课消/同步统计已按 `classroom_classin.end_time < 当前时间` 计算已完成课节和实际消耗，不再把全部已排课堂算作已完成 | 扩科/续费关系已约束；赠课、请假、缺课、已排未上等课消口径仍需业务确认后精修 |
| `GET/POST/PUT/DELETE /api/students`、`POST /api/students/assign-head-teacher` | 已按班主任负责学生或线索转化来源过滤；正式生列表支持 `formal=true&include_summary=true`；单条更新/删除已校验可访问学生；学生列表/详情/创建/更新响应已改字段白名单，分页 count 不再全字段查询，异常出口只返回友好错误并记录安全摘要；非 admin/academic_affairs 脱敏并禁止写入 ClassIn 初始密码/UID；班主任归属变更仅允许 admin / academic_affairs 执行，避免普通学生编辑角色改挂访问范围 | 普通学生管理是否仍允许手工新增学生需业务确认 |
| `GET /api/students/detail`、`GET/POST/PUT /api/class-sessions` | 已按可访问学生/课程范围过滤；学生详情聚合订单、课程、回访、状态历史、异动、剩余课时/金额；课节列表、详情和写入响应均改为字段白名单；详情页已提供新试听、试听转正式、续费、扩科、退费入口且按对应创建权限显示；正式订单余额按完成课时和既往非拒绝退费扣减；回访记录支持新增/编辑/删除且前端按学生编辑/删除权限显示；学生 ClassIn 凭据、订单付款凭证和试听付款凭证按角色脱敏 | 剩余缺口主要是赠课、请假、缺课、已排未上等业务口径 |
| `GET/POST/PUT/DELETE /api/visit-records` | 已按可访问学生范围过滤和校验；接口返回学生姓名/学号与回访人员显示名；学生详情页和独立 `/dashboard/feedback` 回访管理页均支持回访新增、编辑、删除，前端入口按 `students.view/edit/delete` 隐藏；填写 `next_visit_date` 时会自动生成/更新下次回访待办，清空日期或删除记录会取消未完成提醒 | 更细的逾期 SLA、提醒配置和统计口径仍需业务确认 |
| `GET/POST/PUT/DELETE /api/transactions` | 已按可访问学生范围过滤，退费记录支持 `student_id/order_id` 并校验净可退金额和净可退课时；CRUD 响应改为字段白名单，银行卡字段只写入不回传，创建/手工更新会校验目标学生与订单范围，错误响应不再透出 raw message/stack；新建强制进入待教务核对，PUT 支持后端状态机流程动作并记录教务/财务/人力核对痕迹 | 历史异动记录只有学生姓名，已做兼容但建议后续数据回填 |
| `GET/POST/PUT/DELETE /api/teacher-candidates`, `PUT /api/teacher-candidates/recruitment-flow` | 普通角色已移除候选人查看权限；新增、编辑、入库、删除按钮已按权限隐藏；`POST/PUT` 已按招师/教务/HR/财务角色过滤可写字段；删除仅 admin 且路由内兜底；列表/详情/写入响应已改字段白名单，并对无入库确认权限角色隐藏银行卡和外显备注；支持 `name` 精确筛选、`queue=scheduling` 约面过滤、`queue=video_upload` 录像上传过滤、`queue=teaching_review` 教学复核过滤、`queue=pending_entry` 待入库过滤和 `queue=reserve` 储备过滤；教师详情页可正确读取历史面试；招聘流程推进接口已补后端实现并校验合法流转；约面、初试录像上传、教学复核、谈薪入库、待入库和储备候选人独立队列已补；谈薪入库会保存银行/课时费并通过确认接口原子写入最终入库状态 | 需用真实 HR/财务账号验收待入库队列、银行卡脱敏和入库确认链路 |
| `GET/POST/PUT/DELETE /api/teachers`, `POST /api/teacher-entries`, `POST /api/teacher-entries/confirm`, `GET/POST /api/teachers/exceptions`, `POST/PUT /api/trial-lessons` | 老师编号已改为后端 `TH00001` 顺序生成，候选人入库不再要求手填编号；新建老师不再立即注册 ClassIn，试听确认老师时会自动创建/绑定老师 ClassIn UID；老师库存 API 响应已改字段白名单，不返回 ClassIn 初始密码或银行卡信息，删除路由内仅 admin；旧入库响应已按角色清空 ClassIn 初始密码；老师库教学版/销售版已拆分，非 admin / academic_affairs 读取老师库存时会清空 ClassIn 手机号和 UID，非老师资料维护角色会清空老师微信；新入库异常页已按老师资料自动识别编号、联系方式、ClassIn 绑定、等级、状态、科目/年级等缺口，`GET/POST /api/teachers/exceptions` 已纳入权限表并保留路由内 admin / academic_affairs 守卫；异常原因、处理状态、本次备注和处理流水已通过 `teacher_exceptions` / `teacher_exception_events` 持久化 | 仍需结合线下流程确认异常 SLA 和谁负责关闭 |
| `GET/POST/PUT/DELETE /api/users` | 账号管理列表/单条/创建/更新/删除均要求 admin；角色选人目录保留最小字段；账号创建会写入微信号，单条查询返回对象供编辑页使用；新增/编辑页字段已与 `user_profiles.name/wechat/team_name/is_active` 对齐；账号停用后登录、刷新、session、profile 和通用 API 权限检查均已 fail-closed | 历史账号审计策略仍需结合业务确认 |

### 5.3 业务链路未强制

当前已把前两段链路从“可选关联”收紧为“强制来源”：

```text
线索 -> 试听课 -> 正式订单 -> 正式生 -> 扩科/续费/退费/跟进
```

已完成的链路约束：

- 普通试听必须从当前用户可访问的线索创建；正式生详情中的新试听必须从当前用户可访问的正式生创建。
- 正式订单新签必须从当前用户可访问、可转正、未重复转化的试听创建；续费/扩科必须从当前用户可访问的历史订单创建。
- `formal_orders.trial_lesson_id` 已补迁移和唯一索引。

正式订单列表已只读化，正式生管理页已接入续费、退费、回访、新试听、试听转正式、扩科；基础课消、净剩余课时/金额和退费上限已建立统一口径，剩余主要缺口是赠课、请假、缺课、已排未上等细分课消规则。

## 6. 建议实施顺序

### 第一阶段：先稳住安全和测试环境

1. 调整 `lib/permissions.ts`，移除普通角色删除权限，修正 sales/head_teacher 录入线索权限。
2. 在所有核心 GET API 增加当前用户数据范围过滤。
3. 隐藏未授权敏感字段，包括微信、手机号、聊天截图、付款凭证。
4. 修复上传链路，明确 20MB 图片、中文文件名、png/jpeg/webp/avif/heic 等常见图片格式的行为。已落地：通用上传和公开老师表单上传均改纯 UUID 路径，公开老师表单上传补超时和临时失败重试，通用上传补 60 秒超时和临时失败重试。
5. 排查登录态刷新和直接 fetch 未走 `lib/fetch.ts` 的地方。已落地：后台业务 API 基本收敛到 wrapper，剩余为刷新器自身、公开表单、外部 ClassIn/网络诊断类请求。

### 第二阶段：线索和试听闭环

1. 线索编号自动生成。已落地：优先使用 `channel_platform` 作为编号前缀，缺失时回退 `xhs_source`。
2. 渠道平台和客户社媒账号 ID 字段迁移与查重。已落地提示型查重，暂不阻断重复提交。
3. 新建公共线索页面，迁移抢单功能。
4. 试听创建强制关联线索，并自动填充线索编号、渠道等字段。
5. 试听提交时创建/绑定 ClassIn 学生。
6. 匹配老师改为老师库/ClassIn 老师搜索选择。

### 第三阶段：正式生管理

1. 将正式订单列表改为只读或弱操作入口。
2. 正式生列表和正式生详情已初步落地，继续完善详情页动作。
3. 已迁移续费、退费、回访、新试听、试听转正式、扩科入口；基础课消、剩余金额和退费上限已复用同一套 helper。
4. 剩余课时/剩余金额/可退金额已按已完成课时和既往退费扣减，后续需根据“缺课、请假、赠课、已排未上”规则精修。

### 第四阶段：招师和 ClassIn 深水区

1. 招师角色页面与面试字段权限已完成第一轮硬化；约面、初试录像上传、教学复核、谈薪入库、待入库和储备候选人队列已拆出，谈薪入库已拆为 `teacherCandidates.confirmEntry` 独立权限并开放给 HR/财务。
2. 完成二维码入口和候选人回填。
3. 老师编号已改为 `TH00001` 顺序生成。
4. 老师状态/等级管理。
5. 试听确认老师创建/绑定 ClassIn 老师账号已接入；从订单创建 ClassIn 班级入口已从模拟成功改为真实创建/绑定 ClassIn 课程、本地课程和学生入课，课节/课堂创建继续由批量排课链路负责。
6. ClassIn 回调已补通用事件留痕：非课堂结束类消息不再只打日志，举手、奖励、进出教室、授权/静音、答题/抢答、网络/设备、求助、录课、评价、回放、文件转换和账号类回调会写入 `classin_callback_events`，并去除 `SafeKey` 后尽量关联本地课节。
7. 新入库老师异常处理已补持久化：自动识别出的资料/ClassIn/等级/状态/科目年级问题可以在异常队列记录处理状态、原因和备注，每次创建或状态变化写入事件流水；异常接口已接入方法级权限映射，并由路由内 admin / academic_affairs 守卫兜底。

## 7. 需要进一步澄清的问题

1. “销售催促运营”还是“运营催促销售”：当前已先补双向受限方案，运营/admin 可催促销售反馈，销售只能催促自己负责线索的负责运营；如后续只保留单向，再收敛入口和 API 白名单。
2. 同一客户重复线索的处理：当前实现为允许提交、自动标记淡蓝色并记录冲突来源；仍需确认后续是否要阻止提交或合并线索。
3. 正式生的定义：是 `students.status` 某个值、存在 active formal order，还是新建独立正式生表。
4. 扩科和续费的订单关系：都关联 previous_order_id，还是扩科需要独立 parent_order_id/type。
5. ClassIn 老师账号默认密码策略：当前已改为优先显式输入或 `CLASSIN_TEACHER_DEFAULT_PASSWORD`，缺失时自动生成随机 8 位数字密码；仍建议部署时明确配置默认策略，便于线下交付。
6. 文件上传是否要完全放开格式，还是图片/视频/凭证分别限制 MIME 和大小。

## 8. 验收文档准备

清单最后要求修复完成后提供 8 类材料。建议开发过程中同步维护以下文档，避免最后补不齐：

| 交付物 | 建议文件 |
|---|---|
| 总体修改清单 | `docs/fix-summary-0601.md` |
| ER 图/关系说明 | `docs/core-er-0601.md` |
| API 示例/Swagger | `docs/api-examples-0601.md` 或 OpenAPI JSON |
| 权限配置清单 | `docs/role-permissions-0601.md` |
| 仓库、分支、部署信息 | `docs/deployment-info-0601.md` |
| 环境变量清单 | `docs/env-vars-0601.md` |
| 遗留问题清单 | `docs/known-issues-0601.md` |
| 本地快速启动指南 | `docs/local-start-0601.md` |

## 9. 代码映射索引

| 模块 | 页面 | API | 服务 | 数据表/迁移线索 |
|---|---|---|---|---|
| 线索 | `app/dashboard/leads/**`, `app/dashboard/public-leads/page.tsx` | `app/api/leads/**` | `lib/services/leads.ts` | `supabase/migrations/001_create_leads_table.sql`, `005_add_audit_fields_to_leads.sql`, `030_add_creator_to_leads.sql`, `057_add_lead_report_number_generator.sql`, `058_add_lead_channel_social_fields.sql` |
| 试听 | `app/dashboard/trial-lessons/**` | `app/api/trial-lessons/**` | `lib/services/trialLessons.ts` | `supabase/migrations/008_create_trial_lessons_table.sql`, `023_add_classin_fields_to_trial_lessons.sql`, `056_add_classin_student_fields_to_trial_lessons.sql` |
| 学生 | `app/dashboard/students/**` | `app/api/students/**` | `lib/services/students.ts` | `supabase/migrations/003_create_students_table.sql`, `026_add_classin_uid_to_students.sql` |
| 正式订单 | `app/dashboard/formal-orders/**` | `app/api/formal-orders/route.ts` | `lib/services/formalOrders.ts` | `supabase/migrations/009_create_formal_orders_table.sql`, `027_add_relations_to_formal_orders.sql`, `055_add_trial_lesson_id_to_formal_orders.sql` |
| 课程/课节 | `app/dashboard/courses/**`, `app/dashboard/schedule/**`, `app/dashboard/classroom/**` | `app/api/courses/**`, `app/api/class-sessions/**`, `app/api/schedule/**` | `lib/services/courses.ts`, `lib/services/classrooms.ts` | `supabase/migrations/038_create_courses_tables.sql`, `045_add_class_session_statistics.sql` |
| 招师/面试 | `app/dashboard/teacher-candidates/**` | `app/api/teacher-candidates/route.ts` | `lib/services/teacherCandidates.ts` | `supabase/migrations/005_create_teacher_candidates_table.sql`, `054_add_teacher_recruiter_role.sql` |
| 老师库存 | `app/dashboard/teachers/**` | `app/api/teachers/**` | `lib/services/teachers.ts` | `supabase/migrations/015_create_teachers_table.sql`, `050_create_teacher_details.sql` |
| 老师二维码 | `app/teacher-form/**` | `app/api/teacher-form/**` | 无独立服务 | `supabase/migrations/051_add_teacher_form_fields.sql` |
| 上传 | 各上传页面 | `app/api/upload/route.ts`, `app/api/teacher-form/upload/route.ts` | `lib/services/upload.ts` | Supabase Storage buckets |
| 权限 | `components/dashboard/sidebar.tsx` | `middleware.ts` | `lib/permissions.ts`, `lib/route-permissions.ts` | `user_profiles.role` |
