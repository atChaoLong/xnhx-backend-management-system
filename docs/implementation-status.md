# 系统实现状态清单

**生成时间**: 2025-01-01
**文档版本**: v1.0

---

## 2026-06-08 整改增量说明

本文件早期章节仍保留历史盘点口径；以下为黄老师团队 0601 清单整改后的最新增量：

- 试听匹配流程已补基础智能推荐与开课串联：`/dashboard/academic/pending-trials` 会按试听学科、年级、地域、时间、老师状态和负载给出 Top 3 推荐老师，并支持一键应用推荐；`GET /api/teachers/classin` 已合并老师画像字段，供匹配页展示推荐理由和自动预填。待匹配工作台已新增“匹配并开课”，可在资料齐全时一次写回 `matched_teacher` / `confirmed_teacher` 并调用 `POST /api/trial-lessons/open-class` 生成 ClassIn 课堂和 `class_link`；后续仍需用真实 ClassIn 账号做端到端验收。
- 质检报告缺口已补基础闭环、统计、评分标准和 CSV 导出：新增 `quality_reports` 迁移表和 `GET/POST/PUT /api/quality-reports`，支持试听转化与课后服务两类报告的生成、更新和处理完成；`GET /api/quality-reports?include_stats=true` 已返回报告总量、待处理、已处理、分层风险和平均分；`GET /api/quality-reports/export` 支持按类型、状态和生成日期导出报告、问题摘要、改进建议和评分项明细；`/dashboard/quality/trial-conversion` 与 `/dashboard/quality/service` 已接入报告状态、自动评分项、问题摘要、处理动作、质检统计卡片、评分标准展示和导出按钮。后续仍可继续做质检项后台模板化和更细 BI 分析。
- 本轮质检报告功能已部署到 Vercel production：deployment `dpl_7RiLnc3QTTSEUENcQ6mDAEmeaDUD` 已 Ready 并绑定 `https://xiaoniuhaoxue.paitongai.cn`；`GET /api/health` 正常，空登录请求返回参数校验错误，未登录访问 `/api/quality-reports` 返回 401。生产库仍需确认并执行 `supabase/migrations/071_create_quality_reports.sql` 后，登录用户才能写入质检报告。
- `/dashboard/students/[id]` 已作为正式生详情/管理中心投入使用，聚合学生、正式订单、课程、试听、课堂、回访、状态历史、异动记录和剩余课时/金额；学生详情内已补按课程批量排课入口，并支持维护回访日期和下次回访提醒。
- `GET /api/students`、`GET /api/students/detail`、`PUT/DELETE /api/students` 已按当前用户可访问学生范围过滤或校验；普通角色不能通过传入别人的学生 ID 绕过列表范围。
- 学生 ClassIn 初始密码和 UID 已按角色脱敏：仅 admin / academic_affairs 可在 API 响应和学生页面看到；其他角色响应置空，页面不显示对应字段；旧的手动学生 ClassIn 注册接口也已限制为 admin / academic_affairs 且校验单条学生范围；学生入库确认响应也复用同一脱敏策略，避免旧入库接口回显 ClassIn 凭据；学生列表的手动入库入口已改为受控弹窗输入学生编号和 ClassIn 初始密码，不再通过浏览器 `prompt()` 处理敏感输入。
- 正式订单和试听付款凭证已按角色脱敏：仅 admin / finance / academic_affairs 可在对应接口和学生详情聚合数据中看到付款凭证；正式订单列表仅上述角色显示凭证列，试听详情在字段置空后不展示凭证。
- 后台通用 `/api/upload` 已要求登录并按 bucket 校验业务权限，避免任意已登录角色写入不属于自己的业务目录；停用账号会返回 `ACCOUNT_DISABLED` 终态错误码，公开老师二维码上传仍走独立 `/api/teacher-form/upload`。
- 后台通用 `/api/upload` 已补空文件拦截、content-type 推断、纯 UUID Storage 文件名、安全摘要日志和稳定 `UPLOAD_*` 错误 code；线索新建、编辑和反馈聊天截图前端统一 `image/*`、20MB、非空校验，并在文件进入本地队列或触发上传前整组预检，上传请求已补 60 秒超时和临时失败自动重试。
- 公开老师二维码上传已补齐 `image/*` 图片校验、空文件、20MB 限制、明确错误 code 和纯 UUID Storage 文件名；老师表单前端会先本地校验图片并对多张截图整组预检、批量上传、一次性写回，公开上传请求已补 45 秒超时和临时失败自动重试；候选人链接验证、微信验证和最终提交也已补 30 秒超时与 408/429/5xx、网络超时自动重试。
- 后台通用上传和公开老师表单上传已补服务端文件头校验：图片、PDF、Word 和面试视频会校验二进制签名，文本/脚本/可执行文件即使伪造成 `.jpg/.pdf/.mp4` 或伪造 MIME，也会被后端拒绝。
- 付款凭证前端入口已和 `payment-proofs` bucket 对齐：正式订单新建、试听新建、试听编辑均允许图片或 PDF，上传前统一拒绝空文件、超过 20MB 文件和不支持类型。
- 老师招聘和老师库存图片上传入口已和对应 bucket 对齐：新增老师面试简历前端限制 PDF/Word/图片且最大 50MB，初试录像前端限制 MP4/MOV/M4V/AVI/MKV/WebM 且最大 500MB，老师库存新增页形象照/好评截图会先校验空文件、20MB 上限和图片类型，再上传到 `teacher-photos` 保存 Storage URL，选择文件和提交前都会先本地校验。
- 旧每日线索简历附件入口已补真实上传：新建和编辑每日线索可上传 PDF、Word 或图片到 `lead-resumes` bucket，前端先做空文件、50MB 上限和类型校验，上传成功后自动回填附件 URL，同时保留手工粘贴 URL 能力。
- 统一 API wrapper 已在请求前主动刷新临近过期的 token，401 刷新重试会复用一致的 Authorization 与 JSON Content-Type 规则；首页和登录页的 session 探测也已改走 wrapper，公开 auth 错误响应与日志已收敛，不再记录原始账号/邮箱、密码长度或 token 长度。
- 客户端登录态日志与本地缓存已继续收敛：`lib/fetch.ts`、`lib/tokenRefreshManager.ts`、`useTokenRefresh`、首页、登录页、注册页和 `/debug/auth` 不再裸 `console.*` 输出异常对象或 refresh API 错误正文；`/api/auth/signin` 和 `/api/auth/refresh` 只向前端返回最小 session（`access_token`、`refresh_token`、`expires_at`、`user.id`），登录页和刷新器也只写入最小 session；token 刷新事件和 BroadcastChannel 只广播更新信号，不再通过 event detail 携带完整 session/access token/refresh token；登录成功后也不再额外把用户邮箱/姓名写入 `localStorage.user`。
- 旧 `AppProvider/useApp` 模拟登录上下文已移除：根布局不再包裹可本地伪造 admin 用户的 provider，权限调试页改用真实 `usePermission/useCurrentUser` 档案，并把邮箱原文改为存在性展示；Toast 容器改为根布局独立挂载。
- 客户端高敏入口日志已继续收敛：字典服务、线索新增/编辑、公共线索池、正式订单新建、公开老师表单、学生列表/新建/编辑/详情、课堂学生列表、批量排课、异动预填和时区转换失败时只记录 `summarizeError` 安全摘要，不再把原始异常对象、可能包含的响应正文或 stack 直接写入浏览器控制台。
- 公开登录、鉴权中间件和上传错误日志已在 2026-06-11 继续收敛：`/api/auth/refresh`、`/api/auth/session`、`/api/auth/signin`、`/api/auth/signup`、`/api/auth/signout`、`lib/middleware.ts`、`lib/supabase-client.ts`、`/api/upload`、`/api/teacher-form/upload` 不再记录 Supabase/Storage 原始 message 或 stack；权限检查 500 响应不再回显异常正文，上传失败日志也不再记录内部 storage path。
- 账号停用后的认证链路拦截已补齐：`/api/auth/signin`、`/api/auth/refresh`、`/api/auth/session`、`/api/auth/profile`、`lib/middleware.ts` 和路由内共享用户档案解析统一校验 `user_profiles.is_active`，档案缺失或账号停用时不再返回 session/profile 或允许继续调用后台业务 API；前端 API wrapper 和 token 刷新器收到 `ACCOUNT_DISABLED` / `PROFILE_NOT_FOUND` 后会立即清除本地 session/token/user 缓存，401/403 以及 token 刷新后重试响应都会统一识别这两个终态错误码。
- 公开注册入口已默认关闭：`/signup` 与 `POST /api/auth/signup` 只有显式设置 `ENABLE_PUBLIC_SIGNUP=true` 时可用；登录页不再展示注册链接，注册接口即使开启也不再返回 session、access token、refresh token 或注册邮箱。
- 启动专用 `/api/init-admin` 已保留 `INIT_ADMIN_SECRET` fail-closed 保护，并补生产环境显式开关：生产环境默认 404，只有设置 `ENABLE_INIT_ADMIN_API=true` 后才进入密钥校验；请求体解析失败和 Supabase/Admin 异常只返回通用错误，日志只记录账号摘要和是否携带字段，创建成功仅回传 `user.id`，不再回显管理员邮箱或姓名。
- 独立“回访管理”已从占位页补为真实工作台：`/dashboard/feedback` 接入 `GET/POST/PUT/DELETE /api/visit-records`，支持按可访问正式生范围分页查看、新增、编辑和删除回访记录，并按 `students.view/edit/delete` 控制入口与操作；运营/销售无权直访时仍显示无权提示。
- 未抢单销售线索已继续收紧：`GET /api/leads` 与 `GET /api/leads/[id]` 会脱敏家长微信、聊天截图和客户社媒账号 ID；线索反馈、丢弃、学生/试听/订单聚合范围里的销售归属判断统一为 `grab_user_id` 命中或 `grab_wechat` 精确等于当前用户姓名，不再使用姓名包含匹配。
- 线索接口日志和查询字段已在 2026-06-11 继续收敛：`GET/POST/PUT /api/leads`、`GET/DELETE /api/leads/[id]`、`POST /api/leads/feedback/grab/release` 不再全字段查询或记录来源账号、客户社媒账号、家长微信、聊天截图、raw database message/stack；反馈日志只保留截图数量和用户/角色摘要。
- 学生详情聚合接口已继续降敏：`GET /api/students/detail` 的正式订单、试听、课程、回访、状态历史、异动和 ClassIn 课堂查询均改为页面字段白名单；课程调试全量数据日志已移除；异动记录不再返回银行卡字段；ClassIn 课堂改按当前学生课程关联查询，不再依赖不存在风险较高的手机号镜像字段。
- 学生主接口已继续收敛：`GET/POST/PUT/DELETE /api/students` 列表、详情、创建和更新响应统一使用字段白名单，分页 count 不再全字段查询；学生范围校验、ClassIn 注册和 CRUD 异常只写安全摘要并返回友好错误，不再回显 raw message、stack 或 details，同时保留班主任/销售/运营范围校验和 ClassIn 凭据角色脱敏；`POST /api/students/assign-head-teacher` 已补 route-local 用户档案校验，仅 admin / academic_affairs 可变更学生班主任归属，响应改为学生白名单字段且异常不再回显底层错误。
- 正式订单接口已继续收敛：`GET/POST/PUT/DELETE /api/formal-orders` 不再使用全字段查询或向前端/日志透出数据库/运行时原始 `message`、`stack`、`details`；创建正式订单时来源试听和历史订单查询均改为字段白名单，并保留来源试听转正式、续费/扩科和单条范围校验。
- 学生状态历史和回访接口已继续降敏并补齐基础提醒闭环：`GET /api/students/status-history` 与 `GET/POST/PUT/DELETE /api/visit-records` 改为页面字段白名单；回访备注、状态变更原因和底层数据库异常不再进入日志或响应正文，只保留安全错误摘要和是否携带字段；创建或更新回访记录时如果填写 `next_visit_date`，会自动生成/更新 `visit_next_follow_up` 待办并关联到学生，清空下次回访日期或删除回访记录时会取消未完成的自动提醒。
- 异动记录接口已补响应字段白名单：`GET/POST/PUT /api/transactions` 不再 `select('*')` 或返回银行卡姓名、卡号、开户行、支行字段，银行卡信息仅保留为创建/更新时的写入字段；创建和手工更新会校验目标学生与正式订单仍在当前用户可访问范围内；数据库和运行时异常只返回友好错误，不再透出 raw message/stack。
- 退费/异动流程已补基础流转、操作流水和状态看板：新建异动默认进入“待教务核对”，异动列表支持教务金额核对、财务打款、人力业绩核对和拒绝；后端按权限校验 4 个状态的合法推进，记录核对/打款/业绩操作时间和人员，写入 `transaction_workflow_events` 流水，并按同一数据范围返回可见异动统计。
- 已废弃的 `/api/wechat-accounts` 收紧为 admin-only，路由内 fail-closed；列表、创建、更新响应不再返回登录/支付密码，请求日志也不记录完整 body 或密码值，避免普通线索权限读取历史账号敏感字段。
- `/api/user-profiles` 和 `/api/users?role=...` 已从全量用户档案查询收窄为选人目录查询，路由内校验角色筛选白名单；普通角色响应只返回 `id/name/email/role/created_at`，不再暴露手机号、微信、ClassIn UID、团队、启停等账号管理字段。
- 账号管理 `/api/users` 已继续补齐：管理员列表和单条详情从全字段查询收窄为账号页面字段白名单，创建/更新响应不返回 ClassIn UID 等扩展敏感字段；创建账号会正确写入微信号，`GET /api/users?id=...` 返回单条记录并对不存在用户返回 404；创建、更新、删除错误和操作日志只保留安全摘要，不记录原始账号/密码或底层异常正文；新增/编辑账号页已移除不存在的 `notes` 表单并对齐 `name` 字段。
- 角色管理占位页已补为真实只读权限工作台：`/dashboard/roles` 复用现有 `ROLES/RESOURCES/ACTIONS/getPermissions` 展示角色总览、单角色资源动作明细和横向权限矩阵；非 admin 且无 `users.view` 权限的账号直访会显示无权提示。
- 待办与线索催促接口已继续收敛：`GET/POST/PUT/DELETE /api/todos` 和 `POST /api/todos/[id]/complete` 不再全字段查询或回显 raw message/stack；列表、单条、更新和完成按 admin / assigned_to / created_by 做路由内范围校验；删除已收紧为仅 admin；手工创建待办仅允许分配给销售或班主任，且不再接收任意 `metadata`；线索催促不再把家长微信复制进待办描述，改用 `entity_type=lead` / `entity_id` 关联回原线索。
- 线索催促已补双向受限闭环：运营/admin 可在线索页催促已分配销售反馈；销售只能催促自己负责线索的负责运营，后端校验线索归属、`operator_id` 与接收人角色，避免把普通销售扩展成通用派单人。
- 公共线索池入口已和权限范围对齐：侧边栏继续按 `leads.assign` 仅展示给 admin / sales，页面允许 admin 查看公共池，销售才显示和执行抢单按钮，运营无法从菜单进入也不能在页面执行公共池抢单。
- 待办页面已补齐基础闭环：侧边栏任务列表入口按 `todos.view` 过滤，`/dashboard/todos` 支持筛选、分页、创建、完成和删除；创建/完成按钮按 `todos.create/edit` 与当前分配/创建关系显示，删除按钮仅按 `todos.delete` 显示，删除前使用受控确认弹窗替代浏览器原生 `confirm()`；`DELETE /api/todos` 中间件只接受 `todos.delete`，路由内再次要求 admin，避免普通角色通过“自己创建的待办”绕过 P0 删除限制。
- 待办事项已补基础 SLA 与统计口径：`GET/POST/PUT /api/todos` 和 `POST /api/todos/[id]/complete` 统一返回 `sla_status`、`sla_status_name`、`is_overdue`、`days_overdue`；列表接口返回同权限和优先级范围统计 `pending/completed/cancelled/due_today/overdue/urgent_pending/urgent_overdue`，`/dashboard/todos` 改为使用服务端统计并展示今日到期、逾期和紧急待办。
- 批量排课已补提交前预检闭环：`POST /api/schedule/batch/precheck` 复用后端排课校验，页面自动/手动检查待创建课节的必填项、时间段、剩余课时、同批次重叠和数据库全局冲突；`POST /api/schedule/batch/create-classin` 仍在调用 ClassIn 创建课堂前二次阻断冲突，减少跨课程误排和半创建风险。
- 回访管理已补统计与日历增强：`GET /api/visit-records?include_stats=true` 返回可见回访总量、本月回访、待跟进、今日到期、7天内和逾期跟进统计；`/dashboard/feedback` 展示统计卡片，`/dashboard/calendar` 已合并 `next_visit_date` 回访提醒，支持按月在课程日历中查看待跟进学生。
- 当前用户档案与选人目录错误处理已继续收敛：`GET /api/auth/profile` 和 `GET /api/user-profiles` 的服务端日志只记录安全错误摘要，异常响应不再透出 Supabase 或运行时原始 message/stack；对应前端 hook/service 也不再把原始异常对象写入 console。
- 调试诊断接口已继续降敏：`GET /api/debug/current-user` 不再 `select('*')` 或返回完整用户/档案对象，只返回用户 ID、是否有邮箱、角色和权限检查摘要；`GET /api/debug/network-test` 的环境诊断不再回显原始 Supabase URL，日志也只记录脱敏 host、通过数量和失败数量。
- 旧每日线索与字典配置接口已继续降敏：`GET/POST/PUT/DELETE /api/daily-leads` 与 `GET/POST/PUT/DELETE /api/dictionaries` 不再全字段查询或回显底层错误；微信号、简历附件、备注和字典 label/code 只在业务写入/响应字段内出现，日志仅保留字段摘要和安全错误摘要。
- 后台高敏写接口日志已批量改为安全摘要：试听、正式订单、异动、回访、每日线索、学生、学生入库确认、老师、老师候选人、老师入库预览、课程和课节不再记录完整 `body`、`insertData`、`updateData`、`updatePayload`，手机号、微信、付款凭证、银行卡、回访备注、ClassIn 凭据和候选人材料只保留“是否携带/字段名/数量”等排查信息。
- ClassIn 回调入口和消息 handler 已改为结构化摘要日志：不再打印完整请求头、`SafeKey`、`Msg` 原文、回调数据 JSON、异常 message 或 stack；认证失败只记录命令、时间戳和是否携带密钥。
- ClassIn 镜像与课堂运维接口已继续降敏：`/api/classin/classes`、`/api/classin/teachers`、`/api/classin/students`、`/api/classin/classrooms`、`/api/classroom-classin`、`/api/classrooms/scheduled`、`/api/classin/login` 和 `/api/classin/classrooms/test` 不再裸 `console.*` 输出异常对象，不再把数据库/ClassIn SDK 原始 message、stack、`class_id` 明细或 `sdkResult` 透出给前端；列表查询也从 `select('*')` 收窄到页面实际使用字段。
- ClassIn 同步与 SDK 写入口已继续收敛：`/api/sync/classes`、`/api/sync/classrooms`、`/api/sync/students`、`/api/sync/teachers` 和 `/api/classin-sdk/register/teacher`、`/api/classin-sdk/course`、`/api/classin-sdk/unit`、`/api/classin-sdk/classroom`、`/api/classin-sdk/complete` 不再向前端回显数据库、第三方 API 或 SDK 原始错误；SDK 服务层也改为安全摘要日志，SDK core 的 debug 请求日志仅保留 action/path、参数字段数量、字段名和敏感字段数量，不再裸输出完整参数或异常对象。
- 高风险前端操作入口已继续按后端资源权限和数据范围对齐：账号管理按 `users.create/edit/delete` 隐藏新增、编辑、删除；线索列表编辑/删除按钮按当前用户对单条线索的负责关系二次收紧，删除确认弹窗和确认函数也会重新校验当前行范围；试听列表、学生列表和老师库删除入口分别按 `trialLessons.delete`、admin 学生删除权限、`teachers.delete` 隐藏，并在弹窗打开与确认删除时二次拦截；字典、废弃微信号管理和每日线索删除入口分别按 `dictionaries.delete`、`users.delete`、`leads.delete` 隐藏并在确认函数内二次拦截；学生详情按 `trialLessons.create`、`formalOrders.create`、`transactions.create`、`students.edit/delete` 隐藏新试听、续费/扩科、退费、回访增改删；课程详情按 `classSessions.edit/delete` 隐藏课节编辑、勾选、单删和批删；ClassIn SDK、ClassIn API 测试和同步运维页按 `teachers.notes` 隐藏表单；`usePermission` 不再向浏览器控制台输出完整用户对象或权限失败细节。
- `DELETE /api/leads/[id]` 已增加路由内管理员兜底：缺用户档案、非 admin 或线索不存在都会 fail-closed，不只依赖中间件权限映射。
- 老师候选人权限已完成第一轮硬化：普通角色不再具备候选人查看权限，删除仅 admin；招师、教务、HR 与财务在候选人 `POST/PUT` 中只能写入各自流程字段，HR/财务仅能处理复核通过且未入库的待入库候选人。
- 老师候选人接口已继续补缺和降敏：`GET /api/teacher-candidates?name=...` 支持按姓名精确查询历史面试，教师详情页不再误拿候选人第一页；候选人 CRUD 响应改为字段白名单，删除路由内再次校验 admin，错误日志和响应不再透出 raw message/stack。
- 老师候选人复核人已改为真实登录用户：候选人编辑页不再向复核组件传入硬编码“系统用户”，复核表单会自动带出当前登录档案姓名；`PUT /api/teacher-candidates` 在写入复核字段但缺少 `reviewed_by` 时也会用当前登录档案兜底。
- 招聘流程推进缺口已补齐：新增 `PUT /api/teacher-candidates/recruitment-flow`，支持现有 `advanceToNextStep/rejectCandidate` 前端服务按合法状态流转推进约面、视频、复核、谈薪入库和拒绝；新增迁移补 `interview_notes`、`interview_rating`、`review_notes` 以及谈薪入库银行/外显备注字段，约面、初试录像上传、教学复核和谈薪入库分步组件已从 TODO 改为真实保存字段并推进流程。
- 老师约面工作台已补齐：新增 `/dashboard/teacher-candidates/interview`，招师和管理员可从侧边栏进入，页面只拉取 `queue=scheduling` 的未约面且未入库候选人；约面后写回时间、约面人、链接和备注，并推进到初试录像上传。
- 初试录像上传工作台已补齐：新增 `/dashboard/teacher-candidates/upload`，招师和管理员可从侧边栏进入，页面只拉取 `queue=video_upload` 的已约面且未上传录像候选人；上传文件走统一 `/api/upload` 的 `teacher-interview-videos` bucket、视频类型和 500MB 限制，并写回 `video_recording_url` 后推进到教学复核。
- 教学复核工作台已补齐：新增 `/dashboard/teacher-candidates/review`，教务和管理员可从侧边栏进入，页面只拉取 `queue=teaching_review` 的已上传录像且未复核候选人；复核通过进入谈薪/待入库链路，拒绝会写入拒绝原因并归档，旧录像记录缺少招聘步骤时也会兼容推进。
- 待入库老师工作台已补齐：新增 `/dashboard/teacher-candidates/pending`，具备 `teacherCandidates.confirmEntry` 的管理员、教务、HR 和财务可从侧边栏进入，页面只拉取 `queue=pending_entry` 的复核通过且未入库候选人；点击“谈薪入库”会填写课时费、教学科目、银行账户和备注，保存候选人谈薪字段后调用老师入库确认接口创建老师档案，并由确认接口一次写入 `final_entry`、`in_teacher_pool`、薪资确认时间和确认人；候选人银行卡和外显备注按入库确认权限脱敏。
- 老师招聘/谈薪入库前端错误展示已继续降敏：约面、初试录像、教学复核和谈薪入库表单不再把接口、数据库、Storage 或入库确认 raw error 透出到 toast，只展示白名单业务错误或固定友好文案。
- 后台高频操作前端错误展示已继续降敏：老师库加载/删除、待办创建/分配用户加载和课节编辑不再把服务层或第三方接口 raw error 直接透出到 toast，只展示固定友好文案或白名单业务错误。
- 公开老师表单和后台通用上传前端错误展示已继续降敏：候选人链接验证、公开图片上传、最终提交以及通用 upload helper 只展示白名单业务错误或固定友好文案，避免未知网络、Storage、数据库或 SDK 异常正文进入浏览器 toast。
- 账号管理和异动核对前端错误展示已继续降敏：账号列表/新增/编辑、异动列表/新增及历史异动提示入口不再把服务层、数据库或流程动作 raw error 透出到 toast，只展示固定友好文案。
- 登录档案查询稳定性已继续补强并部署：`getActiveUserProfile()` 支持用已验证 access token 兜底读取当前用户档案，登录、refresh、session、profile、权限中间件、用户管理 admin 校验和线索反馈均已传入现成 token；Vercel production deployment `dpl_5jvbrCAwf8gUj4Miu8Vdg9GK33T1` 已 Ready 并绑定 `https://xiaoniuhaoxue.paitongai.cn`。
- 公开老师表单和后台通用上传前端错误展示降敏补丁已部署：Vercel production deployment `dpl_4Zy4kiqK3Z73JdeAENnnLhnp4Ggc` 已 Ready 并绑定 `https://xiaoniuhaoxue.paitongai.cn`；`GET /api/health` 正常，空登录请求返回参数校验错误而不是 `PROFILE_LOOKUP_FAILED`。
- 账号管理和异动核对前端错误展示降敏补丁已部署：Vercel production deployment `dpl_EkpUVFy2irYcVMU4LtKoGVFuCQkh` 已 Ready 并绑定 `https://xiaoniuhaoxue.paitongai.cn`；`GET /api/health` 正常，空登录请求返回参数校验错误。
- API 权限覆盖已补自动审计：新增 `npm run audit:routes`，会扫描所有 `app/api/**/route.ts` 已导出的 GET/POST/PUT/PATCH/DELETE 方法，并和 `lib/route-permissions.ts`、公开路由白名单对齐；当前受保护 API 未发现缺失权限映射，后续新增接口可用该脚本防止再次出现 `ROUTE_PERMISSION_UNREGISTERED`。
- API 基础限流已接入统一中间件：新增 `lib/rate-limit.ts` 和 `npm run audit:rate-limit`，公开登录/注册/刷新、上传、公开老师表单写入、ClassIn/同步写入口、通用 API 读写均已具备分钟级阈值保护并返回 `RATE_LIMITED`；当前为代码层基础限流，跨 Vercel 实例的全局强一致限流/WAF 可作为上线增强项继续补。
- API 基础限流补丁已部署到 Vercel production：deployment `dpl_3QxVEziLRVKvVPScNjqkSE5v1J2u` 已 Ready 并绑定 `https://xiaoniuhaoxue.paitongai.cn`；`GET /api/health` 返回 200 且带 `x-ratelimit-policy: api-read`，空登录请求返回参数校验错误且带 `x-ratelimit-policy: auth-sensitive`，未登录访问 `/api/quality-reports` 返回 401；运营、销售、班主任、教务、管理员五个账号登录、cookie-only `/api/auth/session` 和 `/dashboard` 冒烟均返回 200。
- 线上发布阻断回归已沉淀为可复跑脚本：新增 `npm run test:online-release`（`scripts/online-release-regression.mjs`），账号密码仅通过环境变量传入，报告不落密码、cookie 或 token；脚本已补单请求 timeout、可配置 retry、失败行继续记录和 Attempts 报表，避免单个线上 fetch 抖动拖垮整轮门禁；2026-06-13 最新 production 部署 `dpl_2B9SbHH3Xgxms5Kg25UzBZrmYKqs` 已完成并绑定正式域名 `https://xiaoniuhaoxue.paitongai.cn`，线上回归 65/65 通过，覆盖 `/api/health` 限流头、匿名安全、公开老师表单字典、五角色登录/cookie session/后台深链、旧 P0/P1 API 权限矩阵和管理员核心后台深链；产物见 `.gstack/qa-reports/online-release-regression-2026-06-13.md` / `.json`。
- 统一发布门禁已沉淀为可复跑脚本：新增 `npm run release:gate`（`scripts/release-gate.mjs`），串联脚本语法、发布 DB 执行脚本语法、发布环境预检语法、发布报告敏感信息审计语法、发布解锁看板语法、SQL Editor 后复验脚本语法、TypeScript、API 权限映射、Rate Limiting、发布环境预检、线上发布回归、发布报告敏感信息审计和生产 RLS 审计，并已支持 `--env-file=...` 统一加载生产环境变量；若本机存在 `.env.production.local`，门禁会默认优先使用该生产 env，避免误以本地 Supabase 结果作为正式发布证据。2026-06-13 已用五角色账号完成完整线上回归，线上回归证据为 65/65 PASS；当前最新本机门禁刷新结果为 12 PASS / 1 FAIL / 0 SKIP，`release environment audit`、`online release regression` 和 `release artifacts audit` 均已通过，真实产品侧唯一硬阻断为生产 RLS 审计；五角色线上回归密码未写入 `.env.production.local`，最终门禁仍需按一次性 process env 注入。报告已自动写入 Next Actions，并在 RLS 失败时生成可粘贴到 Supabase SQL Editor 的完整 DB 发布包，artifact 头部已写明自动直连执行、当前生产 URL 下 DB 密码自动派生 pooler URL、SQL Editor 执行和复核命令，且 SQL 包末尾包含缺表、RLS 未启用、anon/PUBLIC SELECT 未撤销三类发布后断言和 `NOTIFY pgrst, 'reload schema'`，用于减少生产库执行后 REST schema cache 未刷新导致的 PGRST205 误阻断；产物见 `.gstack/qa-reports/release-gate-2026-06-13.md` / `.json` 和 `.gstack/qa-reports/release-db-production-bundle-2026-06-13.sql`。
- 发布最后一公里解锁看板已沉淀为可复跑脚本：新增 `npm run release:unblock`（`scripts/release-unblock-status.mjs`），只输出必要 env 是否 ready、直连 DB 发布是否 ready、SQL Editor fallback 是否 ready、RLS 失败拆分、最新 gate 证据和最快路径，不输出任何密钥值；2026-06-13 最新本机结果为 BLOCKED，Release gate 为 12 PASS / 1 FAIL / 0 SKIP，形式门禁和产品侧发布阻断均只剩 `supabase rls audit`，环境/测试阻断为 none；SQL Editor fallback 已 ready，五角色线上回归密码未持久化到 env 文件，但最新 release gate 已用一次性 process env 通过线上回归。
- SQL Editor 执行后的复验路径已收口为一键脚本：新增 `npm run release:after-db`（`scripts/release-after-db-verify.mjs`），用于生产 DB 发布包执行后先审计 SQL bundle、复跑生产 RLS、刷新解锁看板，并且只有在 RLS 通过后才继续跑完整 `release:gate`；新增 `npm run release:after-db:quick`（等价于 `--db-only` / `--quick`）用于 SQL Editor 执行后先做 DB 侧快验，RLS 通过后输出 READY-FOR-GATE，再补齐五角色线上回归密码 env 跑完整 `release:after-db`。脚本语法已接入下一轮 release gate。2026-06-13 当前实跑结果为 BLOCKED（2 PASS / 1 FAIL / 1 SKIP），失败点仍是同一个生产 RLS 审计，证明下一步只剩执行生产 SQL bundle 后复验。
- 发布环境预检已沉淀为可复跑脚本：新增 `npm run audit:release-env`（`scripts/audit-release-env.mjs`），默认优先读取 `.env.production.local`，仅输出线上回归密码变量、Supabase anon 审计变量和生产 DB 执行变量是否存在及来源，不输出任何密钥值；已支持 `--sql-editor-ok`，最终 `release:gate` 会允许 SQL Editor 手工发布路径但仍要求线上回归密码和 Supabase anon 审计 env；最新门禁中该项已随一次性 process env 注入通过，密码仍未写入 `.env.production.local`。
- 发布报告敏感信息审计已沉淀为可复跑脚本：新增 `npm run audit:release-artifacts`（`scripts/audit-release-artifacts.mjs`），扫描 `.gstack/qa-reports` 下 JSON/Markdown/TXT 报告中的未脱敏 `access_token`、`refresh_token`、`xnhx_*_token` cookie、JWT、Bearer、cookie header 和明显 password 值；2026-06-13 最新结果 PASS，扫描 43 个报告文件、0 findings，产物见 `.gstack/qa-reports/release-artifacts-audit-2026-06-13.md` / `.json`。
- 生产 Supabase RLS/匿名直连审计已沉淀为可复跑脚本：新增 `npm run audit:rls`（`scripts/audit-supabase-rls.mjs`），报告不输出密钥或业务行内容，已支持 `npm run audit:rls -- --env-file=.env.production.local`，并会在静态覆盖表中核对 required 表是否同时具备 `ENABLE ROW LEVEL SECURITY`、`anon` revoke 和 `PUBLIC` revoke；2026-06-13 已补 `supabase/migrations/072_lock_down_anon_business_tables.sql`，覆盖 `admin_operation_logs`、`formal_orders`、`trial_lessons` 和业务表 anon/PUBLIC 权限收口；同时 `npm run db:apply-rls-release -- --audit` 已升级为生产 DB 发布包，拿到生产 DB URL，或在当前生产 Supabase URL 下仅提供 `XNHX_SUPABASE_DB_PASSWORD` / `SUPABASE_DB_PASSWORD` 后，可一条命令按顺序执行 `046_add_class_student_participation.sql`、`071_create_quality_reports.sql` 和 `072_lock_down_anon_business_tables.sql` 并复跑审计，脚本会默认加载 `.env.local`，也支持 `--env-file=...`、`--preflight`、`--dry-run`、`--project-ref=...`、`--pooler-host=...`、`--print-sql` 和 `--write-sql-artifact`；新增 `npm run db:write-rls-release-sql` 可不重跑完整 release gate 直接刷新 `.gstack/qa-reports/release-db-production-bundle-2026-06-13.sql`，避免 SQL Editor 发布包陈旧，且 `--audit` 会沿用同一个 env 文件；当前门禁也会自动生成该 SQL bundle。本地类型检查通过，线上应用回归 65/65 通过。当前本地/Vercel env 仅发现 Supabase URL、anon key 和 service role key，未发现生产 Postgres DB URL 或 Supabase DB 密码；`vercel env ls` 也确认 `xiaoniuhaoxue-next` 当前没有 `DATABASE_URL` / `SUPABASE_DB_URL` 变量；Supabase CLI 能看到项目 `xiaoniu`（project ref `kjnqtplzylqxiklsnfoa`），但 `supabase link/db push` 仍需要远程 Postgres 密码或 DB URL。生产库尚未执行该发布包，`npm run audit:rls -- --env-file=.env.production.local` 仍为 FAIL（18 failures）：16 张业务表可被 anon key 直连读到样例行，另有 `class_student_participation`、`quality_reports` 两张 required 表返回 PGRST205 schema cache/table not found；产物见 `.gstack/qa-reports/supabase-rls-audit-2026-06-13.md` / `.json`，该项仍为正式发布硬门禁。
- 储备候选人工作台已补齐：新增 `/dashboard/teacher-candidates/reserve`，招师、教务和管理员可从侧边栏进入，页面只拉取 `queue=reserve` 的流程拒绝或复核不符合候选人，集中查看拒绝原因、复核备注并跳转编辑。
- 老师库存编号已改为后端自动生成 `TH00001` 递增格式；老师创建、候选人确认入库和旧入库预览接口不再依赖前端手填编号。
- 老师 ClassIn 账号创建时机已迁到试听确认老师环节：新建老师和候选人确认入库不再立即注册 ClassIn，确认试听老师时后端自动创建/绑定 UID 并同步 `teacher_classin`。
- 老师库存 API 响应已从全字段收窄为列表/详情白名单：`GET/POST/PUT /api/teachers` 不再返回 `classin_initial_password` 或 `bank_card_info`，银行卡信息仅作为写入输入保留；`DELETE /api/teachers` 路由内再次要求 admin，异常日志和响应不再透出 raw message/stack。
- 老师库教学版/销售版已拆分：新增 `/dashboard/teachers/teaching` 给教务查看授课、排课与 ClassIn 绑定信息，新增 `/dashboard/teachers/sales` 给销售只读查看可外显的老师匹配信息；非 admin / academic_affairs 访问老师库存 API 时会清空 `classin_phone`、`classin_uid` 和 `classin_initial_password`，销售、班主任和财务等非老师资料维护角色同时拿不到老师微信。
- 老师 ClassIn 初始密码已继续收敛：老师库存 API 不再回传该字段；`POST /api/teacher-entries` 和 `POST /api/teacher-entries/confirm` 对非 admin / academic_affairs 响应置空；旧老师入库预览接口同时补路由内 `teacherCandidates.interview` 权限校验。
- 旧老师/学生 ClassIn 入库与注册接口已继续降敏：`POST /api/teacher-entries`、`POST /api/teacher-entries/confirm` 不再 `select('*')` 拉取候选人/老师全字段，旧手动老师/学生 ClassIn 注册接口的日志和 500 响应不再透出手机号、昵称、raw message 或 stack。
- ClassIn 老师/学生自动创建路径已移除固定 `123456` 兜底：显式输入或环境变量优先，缺失时生成随机 8 位数字初始密码；学生手动入库入口也不再预填弱默认值，并已改为受控弹窗收集初始密码。
- ClassIn SDK 测试/运维写入口、ClassIn Cookie 登录、ClassIn 环境诊断、ClassIn 课堂测试端点、旧手动老师/学生注册入口、旧 ClassIn 镜像页面和远端课堂改删入口已收紧为 admin / academic_affairs：相关路由增加 route-local guard，并在权限表中统一映射到 `teachers.notes`；`/api/classroom-classin` 也按当前用户可访问课程/课节过滤镜像数据，不再裸查全量。
- ClassIn 数据同步页已移除浏览器持久保存 Cookie：进入页面会清理旧版 `classin_cookie` 本地缓存，页面只在当前 React 状态中临时保留 Cookie 并随本次同步请求提交，不再提供“保存 Cookie”按钮或提示用户保存到 localStorage。
- `/debug/auth` 认证调试页面已补服务端开关：生产环境默认 404，调试启用时也仅 admin 可查看，并移除旧的页面内 prompt 测试登录入口；页面输出只保留 token/session 是否存在、长度和用户字段存在性，不再展示 token 前缀、本地完整用户对象或原始异常。
- `/dashboard/debug/permissions` 与 `/dashboard/test-dictionary-cache` 已补同样的调试开关和 admin 守卫，隐藏测试页面不再对生产环境或普通角色开放。
- 登录档案查询稳定性已继续补强：`getActiveUserProfile()` 在 service-role 档案查询失败时可用已验证 access token 按同一字段白名单兜底读取当前用户档案，登录、refresh、session、profile 和权限中间件均已接入，仍会拦截停用账号并保持安全摘要日志。
- 老师库存等级与状态入口已接入：`teachers.teacher_level/status` 有迁移和字典初始化，老师列表、详情、新建、编辑页可展示或维护，候选人入库会同步老师等级。
- 新入库老师异常处理已补长期留痕：新增 `teacher_exceptions` 和 `teacher_exception_events` 迁移表，`/dashboard/teachers/exceptions` 在自动识别资料、ClassIn、等级、状态、科目/年级缺口的基础上，可直接记录异常原因、处理状态、本次备注和处理流水；`GET/POST /api/teachers/exceptions` 已纳入权限表并保留路由内 admin / academic_affairs 二次守卫，其中 `POST` 仅上述角色可写入。
- 老师信息采集链接已闭环并完成公开入口收敛：招师可复制 `/teacher-form?candidate_id=...` 专属链接；公开验证接口只接受专属链接里的 `candidate_id`，不再支持按微信号/手机号枚举候选人，且只查询预填所需字段；公开提交接口只返回提交标识，不回显完整老师资料，错误响应和日志均不暴露底层明细或原始表单内容；后台查询 `GET /api/teacher-form` 复用共享用户档案解析，停用账号 fail-closed，并从 `select('*')` 改为字段白名单。
- 高敏异常日志已继续收敛：学生入库确认、废弃微信号管理、admin 清理、老师公开表单验证/提交、旧手动学生 ClassIn 注册等接口不再记录或回显原始 `message/stack`，统一写入 `summarizeError` 摘要并返回业务友好错误；其中 `/api/cleanup-all-admins` 已补路由本地 `users.delete` 二次守卫，查询只读取 admin 用户 ID，响应只返回计数。
- 课堂管理已新增课节 CSV 导出：`GET /api/class-sessions/export` 支持日期范围和状态筛选，按当前用户可访问课程过滤；`/dashboard/classroom` 提供导出按钮，`/api/classrooms/scheduled` 也同步加上课程范围过滤，并改为课程展示字段白名单。
- 课程日历占位页已补为真实月视图：`/dashboard/calendar` 接入 `GET /api/class-sessions?start_date=&end_date=&status=`，按可访问课程范围展示课节日期、时间、学生、老师和状态，并支持状态筛选、刷新、月份切换和跳转课程详情；侧边栏入口按 `classSessions.view` 控制。
- 课节时间修改已同步 ClassIn：`PUT /api/class-sessions` 在修改上课日期/开始/结束时间时调用 ClassIn `updateClassroom`，成功后同步更新 `classroom_classin` 本地镜像，失败时返回明确错误。
- 学生入库确认和课节接口响应已继续收窄：`POST /api/student-entries/confirm`、`GET/POST/PUT /api/class-sessions` 不再使用默认 `.select()` 或星号查询回传整行，改为列表、详情和写入各自的字段白名单后再返回，避免旧入口顺带暴露无关字段。
- 批量/单节排课创建已加固：批量创建按可访问订单校验，单节重建按可访问课程校验；ClassIn ID 统一转为数字，上课时间统一按中国时区处理，学生会先注册/复用并加入课程，本地课程或课节落库失败会返回明确错误和失败明细。
- 从订单创建 ClassIn 班级入口已补真实提交链路：`/dashboard/classin/classes/from-order` 不再模拟成功，现调用 `POST /api/classin/classes` 创建 ClassIn 课程、回填 `class_classin` 和本地 `courses`，并为所选学生注册/复用 ClassIn 账号后加入课程；订单已有 ClassIn 班级时会拒绝重复创建。
- ClassIn 非课堂结束类回调已补事件留痕：新增 `classin_callback_events` 迁移表，举手、奖励、进出教室、授权/静音、答题/抢答、上下台、网络/设备、求助、录课、板书、直播、评价、回放、文件转换和账号类回调会统一去除 `SafeKey` 后落库，并尽量匹配本地课节，避免这些消息只停留在服务端日志。
- 课程课消/同步统计已改为按课堂结束时间计算：`/api/courses/[courseId]/sync-stats` 和 `/api/courses/[courseId]/consumption` 不再把所有已排课堂都视为已完成，已完成课节和实际消耗小时只统计 `classroom_classin.end_time` 已早于当前时间的课堂；同步统计入口也已补当前用户可访问课程校验。
- 课程、课节和排课链路错误响应与查询字段已继续收敛：课程 CRUD、按订单查课程、课程课时/课消/同步统计、ClassIn 关联、课节 CRUD、课节导出/同步/重建、批量创建 ClassIn 不再向前端或日志透出数据库/ClassIn/运行时原始 `message`、`stack` 或 `details`，统一记录安全摘要并返回业务友好错误；`/api/courses`、`/api/courses/by-order/[orderId]`、`/api/courses/link-classin`、`/api/courses/[courseId]/sync-stats`、`/api/classrooms/scheduled`、`/api/class-sessions/sync`、`/api/courses/[courseId]/sessions` 和批量创建 ClassIn 的老师镜像查询均已从 `select('*')`/整行返回改为页面/同步所需字段白名单。
- 新增试听已收紧为精确单来源：只能从可访问线索或可访问正式生二选一创建；从线索进入时线索单号只读展示，渠道优先自动带入 `channel_platform` 并回退到小红书来源或添加方式，年级、地域、首个学科和学生称呼也会自动带入；线索联系方式只有可识别为手机号或邮箱时才自动填入 ClassIn 建号字段，否则只展示来源联系方式并要求手工填写手机号/邮箱。
- 试听链路已补齐来源锁定和老师选择：编辑页只展示来源，后端拒绝 `lead_id/student_id` 改绑；新增、列表快捷匹配/确认和编辑页统一走 ClassIn 老师目录搜索，后端校验 `matched_teacher` 必须命中老师库或 ClassIn 镜像；`GET /api/teachers/classin` 只返回老师选项必要字段。
- 新增 `/dashboard/academic/pending-trials` 待试听匹配页面：教务和管理员可从侧边栏进入，页面聚合待匹配老师的试听记录，支持单条或批量搜索选择 ClassIn 老师并写回 `matched_teacher`。
- 试听 ClassIn 学生绑定已补可见状态和重试：创建试听后自动创建/绑定学生账号，编辑手机号或历史失败记录会重试；列表/详情展示绑定状态，普通角色只拿到 `classin_student_bound`，不回显 ClassIn 学生 UID。
- 试听 API 和 ClassIn 建课/开课接口已继续降敏：`GET/POST/PUT /api/trial-lessons` 不再全字段查询或默认 `.select()`，`manual_converted` 缺列会自动回退；建课/开课接口只查必要试听字段和教师 `uid/name`，错误响应不回显 raw message/stack，开课返回和 `class_link` 不再使用携带手机号的 `invokeUrl`。
- 试听 ClassIn 写入口已补路由内数据范围校验：`POST /api/trial-lessons/create-classin` 与 `POST /api/trial-lessons/open-class` 会按当前用户可访问试听范围校验 `trialLessonId`，避免有试听开课权限的角色传入别人的试听 ID 创建或开启 ClassIn 课程。
- 历史试听正式生关联已补回填迁移：`supabase/migrations/070_backfill_trial_lesson_student_id.sql` 会优先按正式订单 `trial_lesson_id` 权威回填 `trial_lessons.student_id`，再按唯一联系方式加姓名、唯一联系方式做低风险补齐，减少正式生详情继续依赖手机号兼容匹配的范围。
- 线索与试听状态计算器已接入核心接口：`GET /api/leads` 返回添加/转化计算状态；`GET /api/leads` 当前页线索状态计算已从逐线索串行查关联记录改为按页批量查询 `trial_lessons` / `formal_orders` 后内存计算，减少列表页状态字段导致的数据库往返；线索列表总数/分页数据查询、状态计算/运营姓名补全也已改为并行等待，进一步降低线上慢响应风险；`GET/POST/PUT /api/trial-lessons` 在列表、详情、创建和更新响应中返回 `lesson_status`、`lesson_status_name` 和转正式计算值，避免保存后状态需要二次刷新才一致。
- 新增 `/dashboard/academic/students` 学生库（教务版）入口，复用正式生管理视图，按教务口径展示正式生订单汇总、课时、剩余金额和详情/续费/退费入口；当前已补当前页数据看板、学生/手机号/班主任/科目/老师搜索、科目筛选、课时预警、未分配班主任、授课信息缺失和非在读状态筛选。
- 新增质检系统基础工作台：`/dashboard/quality/trial-conversion` 基于试听状态识别待复盘/跟进/已转化记录，`/dashboard/quality/service` 基于正式生剩余课时和订单汇总识别续费/结课服务风险；侧边栏已开放质检入口。
- 试听转正式已改为来源试听权威：新建正式订单页自动带入并锁定来源学生、电话、年级、地域和来源线索；后端按来源试听 `student_id` 复用学生，或按试听姓名/手机号复用、创建学生并回写，前端伪造其他学生 ID 不再生效。
- `/dashboard/formal-orders` 已改为只读核对页，旧编辑入口迁移为提示页；续费、扩科、退费等操作迁移到正式生详情/正式生列表。
- 正式订单编辑接口已继续收口：`PUT /api/formal-orders` 在单条范围校验后仍拒绝改绑来源学生、线索、试听、历史订单、订单编号和订单类型；付款与状态字段仅允许 admin / academic_affairs / finance 角色写入，避免旧入口或伪造请求绕过只读列表。
- `/dashboard/transactions` 已改为异动记录核对页，旧编辑入口迁移为提示页，列表不再提供编辑、删除或状态快切。
- 正式订单余额已统一到 `lib/server-formal-order-balance.ts`：学生详情和退费创建共用同一套完成课时、既往非拒绝退费、净剩余课时/金额计算；退费后端会同时限制金额和 `remaining_duration`。
- 学生/面试/退费状态计算器已补齐并接入核心 API：`GET /api/students` 返回学生状态、新生状态和回访状态；`GET/POST/PUT /api/teacher-candidates` 返回面试流程计算状态；`GET/POST/PUT /api/transactions` 返回退费流程计算状态。
- 全量 TypeScript 验收已恢复通过：修复 Next 16 动态 route handler `params` 签名、旧服务层更新入参过窄、学生编辑页历史 `student_number` 字段、分页组件类型依赖、移动端 hook 引用路径和 toaster Map 渲染问题；`pnpm exec tsc --noEmit --pretty false --incremental false` 当前通过。

---

## 📊 总体进度

| 分类 | 规划数量 | 已实现 | 未实现 | 完成率 |
|------|---------|-------|--------|--------|
| **页面** | 21 | 21 | 0 | 100% |
| **数据表** | 30 | 23+ | 待确认/待拆分 | 77%+ |
| **状态计算器** | 5 | 5 | 0 | 100% |
| **权限系统** | 1 | API/RBAC/限流/线上回归/生产 DB 发布包已完成 | 生产 DB 发布包待执行并复审 | 90% |

---

### 正式发布剩余判断（2026-06-13）
- **功能/API/页面口径**：约剩 3%-5%，核心页面、状态计算器、五角色登录和线上发布阻断回归已通过；最新完整线上发布回归为 65/65 PASS。
- **正式发布门禁口径**：约剩 3%-4%，应用代码已部署到 production；最新 Vercel production 部署为 `dpl_2B9SbHH3Xgxms5Kg25UzBZrmYKqs`，正式域名 `https://xiaoniuhaoxue.paitongai.cn` 已指向该部署并通过无密码线上 smoke（健康检查、登录页、匿名保护、公开字典 4/4 PASS）。带五角色线上回归 env 的完整线上发布回归已通过 65/65 PASS，具备线上应用放行证据。2026-06-13 最新本机 `npm run release:gate -- --env-file=.env.production.local` 刷新结果为 12 PASS / 1 FAIL / 0 SKIP，`release environment audit`、`online release regression`、`release artifacts audit` 均已通过；真实产品侧唯一硬阻断仍为 `npm run audit:rls -- --env-file=.env.production.local` 18 failures，其中 16 个线上 anon-key 直连业务表可读样例行，2 个生产 schema/cache 缺口导致 required 表不可验证。五角色线上回归密码未写入 `.env.production.local`，后续最终 gate 仍需一次性 process env 注入。2026-06-13 已再次执行直连预检，当前 `.env.production.local` 与 Vercel production env 均未发现 `DATABASE_URL` / `SUPABASE_DB_URL` / Supabase DB password，需拿到生产 DB 连接凭据或走 Supabase SQL Editor 发布包路径。新增 `npm run release:after-db -- --env-file=.env.production.local` 已单独实跑，当前 BLOCKED（2 PASS / 1 FAIL / 1 SKIP），仍精确卡在同一个 RLS 点；新增脚本语法已单独通过并接入 release gate。线上回归超时已通过脚本 timeout/retry 加固和完整复跑消除阻塞；`/api/leads` 慢响应代码侧优化已部署，匿名保护在正式域名复测为 401 PASS。
- **最后一公里操作手册**：已生成并刷新 `.gstack/qa-reports/release-db-operator-runbook-2026-06-13.md` 和 `.gstack/qa-reports/release-db-production-bundle-2026-06-13.sql`，发布包按顺序包含 `046_add_class_student_participation.sql`、`071_create_quality_reports.sql`、`072_lock_down_anon_business_tables.sql`，并带 post-run 断言和 `NOTIFY pgrst, 'reload schema'`；`npm run audit:release-db-bundle -- --path=.gstack/qa-reports/release-db-production-bundle-2026-06-13.sql` 已复核通过。拿到生产 DB URL/DB password 后可直接跑 `npm run db:apply-rls-release -- --env-file=.env.production.local --preflight --audit` 和 `npm run db:apply-rls-release -- --env-file=.env.production.local --audit`；若走 Supabase SQL Editor 手工执行，执行完整 SQL bundle 后先跑 `npm run release:after-db:quick -- --env-file=.env.production.local` 做 DB 侧快验，快验 READY-FOR-GATE 后再补齐五角色线上回归密码 env 并跑 `npm run release:after-db -- --env-file=.env.production.local` 完整终验；之后如拿到 DB 连接，可用 `npm run db:apply-rls-release -- --env-file=.env.production.local --verify-only --audit` 只跑断言、schema cache reload 和 RLS 审计，避免重复落迁移。2026-06-13 已加固 `release:unblock` 与 DB runbook：解阻诊断可从标准 Supabase URL 推导 project ref，并继续识别当前自定义生产域名；runbook 的最终 gate 预期改为按实际步骤数自动生成，避免硬编码旧 PASS 数。

## 1. 页面实现状态

### ✅ 已实现页面 (11个)

#### 1.1 运营管理
- ✅ `/dashboard/leads/new` - 线索录入页面

#### 1.2 销售管理
- ✅ `/dashboard/leads` - 线索管理列表
- ✅ `/dashboard/leads/[id]/edit` - 线索编辑
- ✅ `/dashboard/trial-lessons` - 试听课程管理，包含列表、详情、编辑、新建、状态流转、ClassIn 建课/开课和转正式入口
- ✅ `/dashboard/trial-lessons/[id]` - 试听课程详情页

#### 1.3 订单管理
- ✅ `/dashboard/formal-orders` - 正式订单列表
- ✅ `/dashboard/formal-orders/new` - 新建正式订单
- ✅ `/dashboard/formal-orders/[id]/edit` - 历史编辑入口，当前已改为正式生管理迁移提示页

#### 1.4 学生与老师管理
- ✅ `/dashboard/students` - 学生列表
- ✅ `/dashboard/students/new` - 新建学生
- ✅ `/dashboard/students/[id]` - 学生详情/正式生管理中心，包含档案、订单、课程课时、试听、课堂、回访、交易和状态历史
- ✅ `/dashboard/students/[id]/edit` - 编辑学生
- ✅ `/dashboard/schedule/batch` - 批量排课页面，支持从正式订单生成单节/班级课并创建 ClassIn 课程/课堂与本地课节
- ✅ `/dashboard/feedback` - 回访管理工作台，支持回访记录列表、新增、编辑、删除和下次回访提醒待办

#### 1.5 老师管理
- ✅ `/dashboard/teacher-candidates` - 老师候选人列表
- ✅ `/dashboard/teacher-candidates/new` - 新建候选人
- ✅ `/dashboard/teacher-candidates/[id]/edit` - 编辑候选人
- ✅ `/dashboard/teachers` - 老师库列表
- ✅ `/dashboard/teachers/new` - 新建老师
- ✅ `/dashboard/teachers/[id]/edit` - 编辑老师

#### 1.6 系统管理
- ✅ `/dashboard/accounts` - 用户账号管理
- ✅ `/dashboard/dictionaries` - 数据字典管理
- ✅ `/dashboard/transactions` - 异动记录核对页，新增入口按权限展示，列表不再提供编辑、删除和状态快切
- ✅ `/dashboard/transactions/[id]/edit` - 历史编辑入口，当前已改为正式生管理迁移提示页
- ✅ `/dashboard/classin-sdk` - ClassIn SDK配置

#### 1.7 已废弃
- ⚠️ `/dashboard/wechat-accounts` - 微信号管理(已废弃，改用user_profiles)
- ⚠️ `/dashboard/daily-leads` - 每日线索(功能已合并到leads)

---

### ✅ 原未实现页面补齐状态

#### 2.1 销售管理
- ✅ `/dashboard/trial-lessons` - **试听课程管理**
  - 试听课程列表
  - 试听详情页
  - 试听状态流转
  - ClassIn 建课/开课
  - 转正式订单入口

#### 2.2 学生管理
- ✅ `/dashboard/students/[id]` - **学生详情页/正式生管理中心**
  - ✅ 学生档案详情
  - ✅ 课时管理（剩余课时、课程进度、课程课节入口）
  - ✅ 回访管理（回访日期、下次回访日期、自动提醒待办）
  - ✅ 订单、试听、课堂、交易和状态历史聚合
  - ✅ 学生详情内批量排课入口：按课程批量调用 `/api/class-sessions/recreate` 创建 ClassIn 课堂和本地课节
  - 🟡 仍需真实 ClassIn 账号验收批量建课/冲突跳过口径

#### 2.3 老师面试 (4个)
- ✅ `/dashboard/teacher-candidates/interview` - **老师约面页面**
- ✅ `/dashboard/teacher-candidates/upload` - **初试录像上传页面**
- ✅ `/dashboard/teacher-candidates/review` - **教学复核页面**
- ✅ `/dashboard/teacher-candidates/pending` - **待入库页面**
- ✅ `/dashboard/teacher-candidates/reserve` - **储备候选人页面**

#### 2.4 老师库 (3个)
- ✅ `/dashboard/teachers/teaching` - **老师库（教学版）**
- ✅ `/dashboard/teachers/sales` - **老师库（销售版，只读）**
- ✅ `/dashboard/teachers/exceptions` - **新入库异常页面**

#### 2.5 质检系统 (2个)
- ✅ `/dashboard/quality/trial-conversion` - **试听转化质检页面（基础工作台）**
- ✅ `/dashboard/quality/service` - **课后服务质检页面（基础工作台）**

#### 2.6 教务管理 (2个)
- ✅ `/dashboard/academic/students` - **学生库（教务版）**，支持正式生订单汇总、剩余课时/金额、当前页数据分析、预警筛选和续费/扩科/退费入口
- ✅ `/dashboard/academic/pending-trials` - **待试听匹配页面**

---

## 2. 数据表实现状态

### ✅ 已存在的表 (23+张)

来自 `docs/online-tables.md`:

```sql
1. user_profiles          - 用户档案
2. leads                  - 线索
3. daily_leads           - 每日线索(已废弃)
4. teacher_candidates    - 老师候选人
5. teachers              - 老师信息
6. teacher_profiles      - 老师档案
7. teacher_classin       - 老师ClassIn同步
8. students              - 学生信息
9. students_classin      - 学生ClassIn同步
10. trial_lessons        - 试听课程
11. formal_orders        - 正式订单
12. class_classin        - 班级ClassIn
13. classroom_classin    - 教室ClassIn
14. sys_dictionaries     - 数据字典
15. wechat_accounts      - 微信号(已废弃)
16. transaction_records  - 异动记录
17. schedules            - 排课表(待确认)
18. visit_records        - 回访记录
19. courses              - 课程详细排课
20. class_sessions       - 具体课次
21. todos                - 待办事项
22. quality_reports      - 质检报告
23. student_profiles / class_schedules - 当前表清单中已记录，仍需按生产库核对字段完整性
```

---

### 🟡 待确认/待拆分的表

来自 `docs/database-design.md`:

#### 2.1 学生档案增强 (1张)
- 🟡 `student_profiles` - 学生详细档案，当前表清单中已记录，需按生产库字段核对
  ```sql
  CREATE TABLE student_profiles (
    id UUID PRIMARY KEY,
    student_id UUID REFERENCES students(id),
    contact_method VARCHAR(100),
    course_frequency VARCHAR(100),
    class_duration INT,
    class_time VARCHAR(200),
    hourly_rate DECIMAL(10,2),
    first_order_month VARCHAR(20),
    renewal_count INT DEFAULT 0,
    schedule_notes TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id)
  );
  ```

#### 2.2 课程与排课 (3张)
- ✅ `courses` - 课程详细排课，已通过 `supabase/migrations/038_create_courses_tables.sql` 创建并接入课程/排课 API
- ✅ `class_sessions` - 具体课次，已通过 `supabase/migrations/038_create_courses_tables.sql` 创建并接入课节、课消和批量排课链路
- 🟡 `class_schedules` - 课程日历，当前表清单中已记录，需按生产库字段和实际使用情况核对

#### 2.3 回访管理 (1张)
- ✅ `visit_records` - 回访记录，已通过 `supabase/migrations/006_create_visit_records_table.sql` 创建并接入学生详情、独立回访工作台和下次回访待办
  ```sql
  CREATE TABLE visit_records (
    id UUID PRIMARY KEY,
    student_id UUID REFERENCES students(id),
    order_id UUID REFERENCES orders(id),
    course_id UUID REFERENCES courses(id),
    visit_date DATE NOT NULL,
    visit_method VARCHAR(100),
    parent_attitude VARCHAR(100),
    visit_notes TEXT NOT NULL,
    visit_personnel UUID REFERENCES user_profiles(id),
    next_visit_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

#### 2.4 面试流程拆分 (6张)
- 🟡 `interview_arrangements` - 约面安排：独立表未拆，当前由 `teacher_candidates.interview_date/interview_time/interview_link/interview_officer/interview_notes` 承载
- 🟡 `interview_sessions` - 面试记录：独立表未拆，当前由 `teacher_candidates.video_recording_url/trial_video_url/interview_exception/interview_notes` 承载
- 🟡 `interview_scores` - 面试评分：独立表未拆，当前由 `teacher_candidates.interview_score/interview_rating/logical_expression_score/dress_appearance_score/material_preparation_score/exam_score` 承载
- 🟡 `teacher_characteristics` - 老师素质评价：独立表未拆，当前由 `teacher_candidates.teacher_characteristics/mandarin_level/research_ability/service_awareness/affinity` 承载
- 🟡 `review_records` - 复核记录：独立表未拆，当前由 `teacher_candidates.review_status/review_result/review_notes/review_date/reviewed_by_id/video_reviewed_at` 承载
- 🟡 `hire_records` - 入库记录：独立表未拆，当前由 `teacher_candidates.is_hired/salary_confirmed_at/salary_confirmed_by_id/bank_* / notes_external` 与 `teacher-entries` 入库接口承载

**说明**: 这 6 张表不是“功能完全未实现”，而是“数据模型未拆表”。当前约面、初试录像、教学复核、谈薪入库、储备候选人等页面/API 已基于 `teacher_candidates` 大表运行；后续若要支持多轮面试、多次评分、完整操作审计或更强报表能力，再作为架构重构拆分。

#### 2.5 质检系统 (1张)
- ✅ `quality_reports` - 质检报告
  ```sql
  CREATE TABLE quality_reports (
    id UUID PRIMARY KEY,
    report_type VARCHAR(50), -- 'trial_conversion' | 'service_quality'
    target_id UUID, -- trial_lesson.id | visit_record.id
    quality_score INT,
    issues TEXT[],
    improvement_suggestions TEXT,
    reported_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

#### 2.6 待办事项 (1张)
- ✅ `todos` - 待办事项，已通过 `supabase/migrations/053_create_todos_table.sql` 创建并接入 `/dashboard/todos` 与回访提醒
  ```sql
  CREATE TABLE todos (
    id UUID PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES user_profiles(id),
    due_date DATE,
    priority VARCHAR(20), -- 'low' | 'medium' | 'high'
    status VARCHAR(20), -- 'pending' | 'in_progress' | 'completed'
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

---

## 3. 状态计算器实现状态

### 🟢 已实现并接入核心接口

来自 `docs/business-status-rules.md`:

#### 3.1 线索状态计算器
当前已通过 `lib/status-calculator.ts` 接入 `GET /api/leads`，列表响应会返回添加状态与转化状态的计算结果。2026-06-13 已将批量列表计算改为按当前页 lead ids 并行查询 `trial_lessons` 与 `formal_orders`，再在内存中生成添加/转化状态，避免分页列表按每条线索重复串行查询关联表；`app/api/leads/route.ts` 也已将总数/分页查询和状态/运营姓名补全分别并行化，减少接口内部无依赖等待。

```typescript
// 文件: lib/status-calculator.ts
export function calculateLeadAddStatus(lead: Lead): LeadAddStatus {
  // 'unassigned' | 'waiting_feedback' | 'added' | 'not_added'
}

export function calculateLeadConvertStatus(leadId: string): ConvertStatus {
  // 'trial' | 'formal' | 'empty'
}
```

#### 3.2 试听课程状态计算器
当前已通过 `lib/status-calculator.ts` 接入 `GET/POST/PUT /api/trial-lessons`，列表、详情、创建和更新响应会返回试听状态、状态名称和转正式计算值。

```typescript
export function calculateTrialLessonStatus(lesson: TrialLesson): LessonStatus {
  // 'cancelled' | 'waiting_match' | 'waiting_confirm' |
  // 'waiting_time' | 'waiting_link' | 'scheduled' |
  // 'waiting_feedback' | 'completed'
}

export function calculateIsConverted(lesson: TrialLesson): boolean {
  // 是否已转化
}
```

#### 3.3 学生状态计算器
当前已通过 `lib/status-calculator.ts` 接入 `GET /api/students`，列表和详情响应会返回学生状态、新生状态和回访状态。学生状态会结合正式订单汇总课时判断“快没课”，新生状态会优先使用首次报名/最新正式订单时间，回访状态会按当月回访记录计算。

```typescript
export function calculateStudentStatus(student: Student): StudentStatus {
  // 'missing' | 'low_hours' | 'normal'
}

export function calculateNewStudentStatus(student: Student): NewStudentStatus {
  // 'week_1' | 'week_2' | 'week_3' | 'week_4' | 'old'
}

export async function calculateVisitStatus(student: Student): Promise<VisitStatus> {
  // 'visited' | 'not_visited'
}
```

#### 3.4 面试流程状态计算器
当前已通过 `lib/status-calculator.ts` 接入 `GET/POST/PUT /api/teacher-candidates`，列表、详情、创建和更新响应会返回 `interview_status`、`interview_status_name`。老师面试列表优先展示后端计算状态。

```typescript
export function calculateInterviewStatus(candidate: TeacherCandidate): InterviewStatus {
  // 'waiting_contact' | 'contacted' | 'interviewing' |
  // 'waiting_review' | 'reviewed' | 'pending_entry' |
  // 'hired' | 'review_rejected' | 'pause_scheduling' | 'disabled'
}
```

#### 3.5 退费流程状态计算器
当前已通过 `lib/status-calculator.ts` 接入 `GET/POST/PUT /api/transactions`，列表、详情、创建和更新响应会返回 `refund_status`、`refund_status_name`。计算逻辑兼容当前流程时间戳字段和历史布尔字段。

```typescript
export function calculateRefundStatus(transaction: TransactionRecord): RefundStatus {
  // 'waiting_verify' | 'waiting_payment' |
  // 'waiting_performance' | 'completed' | 'rejected'
}
```

---

## 4. 权限系统实现状态

### 🟢 基础 RBAC 与路由权限已落地

#### 已完成:
- ✅ `lib/permissions.ts` - 角色、资源和动作权限定义已落地
- ✅ `docs/role-permissions.md` - 角色权限文档完整
- ✅ 基础角色字段 (`user_profiles.role`)
- ✅ `lib/hooks/usePermission.ts` - 前端权限 Hook 已接入高风险按钮/入口，并避免输出完整用户对象或权限失败细节
- ✅ `middleware.ts` / `lib/middleware.ts` - 后台业务 API 统一经过登录态、账号启停、档案和路由权限检查
- ✅ `lib/route-permissions.ts` - 核心 API 已建立方法级资源动作映射，包含待办删除、ClassIn 运维和老师异常处理等历史缺口
- ✅ `lib/rate-limit.ts` / `middleware.ts` - API 基础限流已接入统一中间件，公开认证、公开老师表单、上传、ClassIn/同步写入口和通用读写 API 均有阈值保护，并已在 Vercel production 冒烟验证响应头
- ✅ `scripts/online-smoke.mjs` - 无密码线上冒烟已接入 `npm run test:online-smoke`，覆盖健康检查、登录页、匿名保护和公开字典；最新正式域名结果 4/4 PASS，直连 Vercel deployment URL 在当前本地网络下 TLS 连接失败并记录为 secondary warning，不影响正式域名放行判断
- ✅ `scripts/online-release-regression.mjs` - 五角色线上发布阻断回归已可复跑，覆盖匿名安全、会话、权限矩阵和核心深链；已支持单请求 timeout、可配置 retry 和 Attempts 报表；最近一次线上结果 65/65 通过
- ✅ `scripts/release-gate.mjs` - 统一发布门禁已可复跑，串联脚本语法、发布 DB 执行脚本语法、发布环境预检语法、发布报告敏感信息审计语法、发布解锁看板语法、SQL Editor 后复验脚本语法、TypeScript、路由权限、限流、发布环境预检、线上回归、发布报告敏感信息审计和 RLS 审计，支持 `--env-file=...`；若 `.env.production.local` 存在会默认作为生产门禁 env，并在报告中输出 Next Actions；最新五角色线上回归 65/65 PASS，当前最新本机门禁刷新结果为 12 PASS / 1 FAIL / 0 SKIP，真实产品侧失败项只剩生产 RLS 审计，且已生成带发布后断言、DB 密码 pooler 直连提示和 PostgREST schema cache reload 的 `.gstack/qa-reports/release-db-production-bundle-2026-06-13.sql`
- ✅ `scripts/release-unblock-status.mjs` - 发布最后一公里解锁看板已可复跑，接入 `npm run release:unblock`，会基于最新 release gate、RLS audit、DB bundle、当前 env presence 和最新 gate 证据输出 BLOCKED/READY 判断、RLS 失败拆分和最快路径；报告不输出密码、token、cookie 或 DB 连接串明文，最新结果为 BLOCKED，并显示产品侧发布阻断只剩 `supabase rls audit`，环境/测试阻断为 none
- ✅ `scripts/release-after-db-verify.mjs` - SQL Editor/生产 DB 发布包执行后的复验脚本已可复跑，接入 `npm run release:after-db` 和 `npm run release:after-db:quick`；快验模式只做 SQL bundle/RLS/release unblock 并在 DB 侧通过后输出 READY-FOR-GATE，完整模式会在 RLS 通过后自动进入完整 release gate；当前结果为 BLOCKED（2 PASS / 1 FAIL / 1 SKIP），失败点仍为生产 RLS 审计
- ✅ `scripts/audit-release-env.mjs` - 发布环境预检已可复跑，默认优先读取 `.env.production.local`，只报告必要发布 env 是否存在及来源，不输出密钥值；覆盖五角色线上回归密码、Supabase URL/anon key 和生产 DB URL/DB 密码直连执行准备度，并支持 `--sql-editor-ok` 用于最终门禁允许 SQL Editor 发布路径
- ✅ `scripts/audit-release-artifacts.mjs` - 发布报告敏感信息审计已可复跑，扫描 `.gstack/qa-reports` 中 JSON/Markdown/TXT 报告的未脱敏 session token、auth cookie、JWT、Bearer、cookie header 和明显 password 值；最新结果 PASS，扫描 43 个文件、0 findings，并已接入 `npm run release:gate`
- ✅ `scripts/audit-supabase-rls.mjs` - 生产 RLS/匿名直连审计已可复跑，支持 `--env-file=...` 并生成 `.gstack/qa-reports/supabase-rls-audit-2026-06-13.*`；静态表已核对 RLS、`anon` revoke、`PUBLIC` revoke 覆盖，报告会按匿名直连暴露和 PGRST205 schema/cache 缺口输出 Remediation；当前结果为 FAIL，作为正式发布硬门禁
- ✅ `scripts/apply-rls-release-migration.mjs` - 生产 DB 发布包执行脚本已接入 `npm run db:apply-rls-release -- --audit`，默认加载 `.env.local`、校验生产 DB host，支持 `--help`、`--env-file=...`、`--preflight`、`--dry-run`、`--project-ref=...`、`--pooler-host=...`、`--print-sql` 和 `--write-sql-artifact`；可直接读取 `XNHX_SUPABASE_DB_URL` / `SUPABASE_DB_URL` / `DATABASE_URL`，也可在识别当前生产 Supabase URL 时仅用 `XNHX_SUPABASE_DB_PASSWORD` / `SUPABASE_DB_PASSWORD` 派生 Supabase pooler URL，非生产 URL 才需要额外提供 `XNHX_SUPABASE_PROJECT_REF` / `SUPABASE_PROJECT_REF`；`--print-sql` 和 `--write-sql-artifact` 头部均已写明直连预检、执行审计和 SQL Editor 复核路径，`npm run db:write-rls-release-sql` 可直接刷新 `.gstack/qa-reports/release-db-production-bundle-2026-06-13.sql`；脚本会按顺序执行 `046_add_class_student_participation.sql`、`071_create_quality_reports.sql`、`072_lock_down_anon_business_tables.sql`，执行后会断言 required 表存在、RLS 已启用且 anon/PUBLIC SELECT 已撤销，并触发 PostgREST schema cache reload，且 `--audit` 会沿用同一个 env 文件，避免误推到非生产项目
- ✅ `supabase/migrations/072_lock_down_anon_business_tables.sql` - 已补业务表 RLS/anon/PUBLIC 权限收口迁移，覆盖新增审计缺口和可被 anon 直连的核心业务表
- ✅ `lib/supabase.ts` - 服务端数据库访问已优先使用 service role，认证/会话校验保留 anon auth client，避免 RLS 收口后后台 API 读写被误伤
- ✅ 高风险前端按钮已按资源权限和单条数据负责关系显隐

#### 仍需持续推进:
- 🔴 Supabase RLS 当前仍为正式发布硬阻断：仓库迁移和执行脚本已补齐，但生产库尚未执行；最新五角色线上回归 65/65 PASS，当前最新本机门禁复跑为 12 PASS / 1 FAIL / 0 SKIP，真实产品侧失败项只剩 `npm run audit:rls -- --env-file=.env.production.local`，30 张表检查中 18 个失败、13 个警告；其中 16 个失败为线上 anon key 仍可直连读取业务表样例行，2 个失败为 `class_student_participation`、`quality_reports` 在生产 schema cache 中不可见或未执行迁移，无法验证 anon 访问是否被阻断。2026-06-13 已刷新完整 SQL 发布包并复核通过，直连预检确认当前本机/Vercel production env 仍缺生产 DB URL 或 Supabase DB password；若暂时拿不到生产 DB URL，可用 `npm run db:write-rls-release-sql -- --env-file=.env.production.local` 刷新完整 SQL 后在 Supabase SQL Editor 执行并确认断言块通过；若拿到生产 DB URL 或生产 Supabase DB 密码，可先跑 `npm run audit:release-env -- --env-file=.env.production.local` 和 `npm run db:apply-rls-release -- --env-file=.env.production.local --preflight --audit`，再跑 `npm run db:apply-rls-release -- --env-file=.env.production.local --audit`
- ⚠️ 如需跨 Vercel 实例全局强一致限流，后续可接 Redis、Vercel WAF 或边缘限流服务
- ⚠️ 新增 API/页面需要持续保持权限表、route-local 守卫和前端入口三处同步

---

## 5. 核心业务功能实现状态

### 5.1 试听匹配流程
**状态**: 🟡 基础匹配、推荐与开课串联已实现，待真实账号端到端验收

**已实现功能**:
- 待试听匹配页面 `/dashboard/academic/pending-trials`
- ClassIn 老师搜索选择并写回 `matched_teacher`
- 批量匹配已选试听记录
- 基于学科、年级、地域、时间、老师状态和负载的 Top 3 老师推荐
- 一键应用推荐老师，并自动预填待匹配试听的首选老师
- ClassIn 老师接口合并 `teachers` 画像字段用于推荐理由展示
- 资料齐全时可从待匹配工作台直接“匹配并开课”，一次写回匹配老师、确认老师并调用 `open-class` 生成 ClassIn 课堂与 `class_link`

**待完善功能**:
- 需使用真实 ClassIn 账号验收“匹配并开课”返回链接、学生入课和课堂状态

**涉及表**: `trial_lessons`, `teacher_profiles`

---

### 5.2 退费流程
**状态**: 🟢 基础流程、操作流水和状态看板已实现

**已有**:
- ✅ `transaction_records` 表
- ✅ `/dashboard/transactions` 核对页
- ✅ `/dashboard/transactions/[id]/edit` 历史入口已改为迁移提示
- ✅ 退费入口从正式生详情/列表发起，并在后端按订单净剩余金额和净可退课时校验
- ✅ 异动记录 API 响应字段白名单；银行卡字段只写入不回传，手工改挂学生/订单会重新校验范围，错误响应不回显底层异常
- ✅ 4 个状态流转：待教务核对(`pending`) -> 待财务打款(`processing`) -> 已完成打款(`completed`)；待核对/待打款可拒绝(`rejected`)
- ✅ 教务核对金额、财务打款、人力业绩核对均按 `transactions.verifyHours/payment/verifyPerformance` 权限开放
- ✅ 流程动作记录 `academic_verified_at/by`、`paid_at/by`、`performance_verified_at/by`
- ✅ `transaction_workflow_events` 操作流水表，记录提交、教务核对、财务打款、人力业绩核对、拒绝和兼容状态更新
- ✅ 异动列表展示最近操作流水，包含动作、操作人、时间和状态变化
- ✅ `/api/transactions?stats=true` 按当前用户可见范围返回退费状态统计，列表页展示总笔数、总金额和各状态金额/数量

---

### 5.3 面试流程
**状态**: ✅ 主体已实现，拆表重构未做

**已有**:
- ✅ `teacher_candidates` 表(但字段太全，应拆分)
- ✅ `/dashboard/teacher-candidates` 列表页
- ✅ `/dashboard/teacher-candidates/interview` 约面队列
- ✅ `/dashboard/teacher-candidates/upload` 初试录像上传队列
- ✅ `/dashboard/teacher-candidates/review` 教学复核队列
- ✅ `/dashboard/teacher-candidates/pending` 待入库队列
- ✅ `/dashboard/teacher-candidates/reserve` 储备候选人队列

**缺失**:
- 🟡 面试流程拆分为6个子表：当前功能由 `teacher_candidates` 大表承载，属于后续架构重构，不是当前功能阻塞
- ✅ 谈薪入库已拆为 `teacherCandidates.confirmEntry`，并开放给 HR/财务处理待入库候选人
- ⚠️ 状态流转、谈薪保存和老师档案创建链路已补，仍需用真实 HR/财务账号验收待入库队列、银行卡脱敏和确认入库链路

---

### 5.4 批量排课
**状态**: ✅ 主体已实现，提交前预检已补，待业务验收/精修

**缺失**:
- ✅ `courses` 表
- ✅ `class_sessions` 表
- 🟡 `class_schedules` 表需按生产库字段和实际使用情况核对
- ✅ 批量排课 UI：`/dashboard/schedule/batch`
- 🟡 排课规则引擎：已有单节/班级课、剩余课时校验、提交前预检和后端二次校验，复杂业务规则仍需口径确认
- ✅ 冲突检测：页面已通过 `/api/schedule/batch/precheck` 自动/手动预检同批次与数据库全局冲突；同一老师或同一学生存在跨课程时间重叠时会在提交前提示，并在创建 ClassIn 课堂前再次阻断

---

### 5.5 回访管理
**状态**: ✅ 主体已实现，统计/日历已补强

**缺失**:
- ✅ `visit_records` 表
- ✅ 回访记录列表：学生详情与 `/dashboard/feedback`
- ✅ 新增/编辑/删除回访表单
- ✅ 回访统计与日历：`/dashboard/feedback` 展示总量、本月、待跟进、今日到期、7天内和逾期统计；`/dashboard/calendar` 合并 `next_visit_date` 回访提醒
- ✅ 回访提醒：`next_visit_date` 自动生成/更新/取消下次回访待办

---

### 5.6 质检系统
**状态**: ✅ 基础闭环、统计看板、基础评分标准与导出已实现

**缺失**:
- ✅ `quality_reports` 表
- ✅ 试听转化质检页面（基于现有试听数据）
- ✅ 课后服务质检页面（基于现有正式生汇总）
- ✅ 质检评分标准（已按试听转化、课后服务分别配置评分项、权重和扣分依据）
- ✅ 质检报告生成（支持生成和标记处理完成）
- ✅ 质检报告统计（报告总量、待处理、已处理、风险分层、平均分）
- ✅ 质检报告导出（CSV 导出报告状态、问题摘要、改进建议和评分项明细）

---

### 5.7 待办事项
**状态**: ✅ 基础闭环、SLA 统计和基础提醒升级已实现

**已有**:
- ✅ `todos` 表
- ✅ 待办列表页面 `/dashboard/todos`
- ✅ 创建待办表单
- ✅ 完成待办
- ✅ 删除待办
- ✅ 侧边栏入口和操作按钮已按权限/分配关系收敛
- ✅ 批量排课页已支持从正式订单生成单节/班级课预览、保留已有课节、按剩余课节补排，并通过 `/api/schedule/batch/create-classin` 真实创建 ClassIn 课程/课堂与本地课节；页面已接入 `/api/schedule/batch/precheck`，可在提交前检查剩余课时、必填项、时间段、同批次重叠和数据库全局冲突，后端创建接口仍做二次阻断。
- ✅ 回访记录 `next_visit_date` 自动生成/更新/取消下次回访待办
- ✅ 待办 SLA 口径：接口统一返回正常、今日到期、已逾期、已完成、已取消、无截止时间，以及逾期天数
- ✅ 待办统计口径：列表接口返回同权限和优先级范围下的待完成、已完成、已取消、今日到期、已逾期、紧急待办和紧急逾期统计，页面已改为服务端统计
- ✅ 基础提醒升级：待办接口统一返回需关注、需升级、严重升级及升级原因；列表页展示升级标签，统计卡展示升级总量和严重升级数量
- ✅ 升级口径：高/紧急优先级今日到期进入需关注；普通逾期进入需升级；逾期 3 天或高/紧急优先级逾期进入严重升级

**缺失**:
- ⚠️ 自定义提醒规则、跨角色 SLA 责任归属和升级通知方式仍需业务确认后配置化

---

## 6. 技术债务

### 6.1 架构问题
1. **试听订单 vs 正式订单**: 已确认分开存储 ✅
2. **teacher_candidates表**: 当前承载面试全流程，功能可用；若后续需要多轮面试、多次评分、独立审计和复杂报表，再拆分为6个子表
3. **状态计算**: 所有状态都是硬编码，未使用状态机

### 6.2 代码问题
1. **服务层不统一**: 缺少统一的BaseService接口
2. **状态管理**: 使用useState，未引入React Query/Zustand
3. **类型定义**: 类型定义重复，缺少统一生成
4. **错误处理**: 缺少统一的错误处理机制

### 6.3 性能问题
1. **数据库索引**: 缺少关键字段索引
2. **查询优化**: N+1查询问题
3. **前端优化**: 未使用代码分割和懒加载

### 6.4 安全问题
1. **RLS策略**: `npm run audit:rls` 已接入并在 2026-06-13 发现正式发布阻断，且已支持 `--env-file=...`；仓库已补 `072_lock_down_anon_business_tables.sql`、`npm run db:apply-rls-release -- --audit` 执行路径、`npm run audit:release-env` 环境预检、`npm run release:gate` 发布门禁、`npm run release:after-db` 完整执行后复验和 `npm run release:after-db:quick` DB 侧快验路径，并已将生产 schema 补齐迁移 `046`、`071` 合入同一个 DB 发布包；发布包已补 `--preflight`、执行后 DB 断言、PostgREST schema cache reload，并支持用 DB URL，或在当前生产 Supabase URL 下仅用 DB 密码派生 pooler 连接；新增 `npm run db:write-rls-release-sql` 可刷新 SQL Editor 发布包；但生产库尚未执行，当前仍有 16 张业务表 anon-key 直连可读样例行，且 `class_student_participation`、`quality_reports` 两张 required 表在生产 schema cache 中不可验证，需执行生产 DB 发布包后先用 `npm run release:after-db:quick -- --env-file=.env.production.local` 确认 DB 侧 READY-FOR-GATE，再用 `npm run release:after-db -- --env-file=.env.production.local` 完整复跑通过
2. **API安全**: API 路由权限覆盖、基础 Rate Limiting、线上回归均已可自动审计；生产仍需先让 RLS 审计通过，分布式限流/WAF 可作为上线增强项
3. **输入验证**: 缺少统一的数据验证

---

## 7. 优先级建议

### 🔴 P0 - 核心业务功能 (必须)
1. ✅ **试听课程状态计算器** - 已接入核心接口，后续关注真实数据验收
2. ✅ **试听课程管理页面** - 列表、详情、状态流转、ClassIn 建课/开课和转正式入口已实现
3. ✅ **待试听匹配页面** - 教务核心工作已补入口、单条匹配和批量匹配
4. ✅ **线索状态计算器** - 已接入 `GET /api/leads`
5. 🔴 **生产 RLS 收口** - API 中间件、路由权限表、公开路由白名单、路由/限流/线上回归审计已完成；RLS 收口迁移和一键执行脚本已补，当前等待生产 Supabase 执行并复跑 `npm run audit:rls -- --env-file=.env.production.local`，通过后该项可降为上线前复核项

### 🟡 P1 - 重要功能 (应该)
6. ✅ **回访管理系统** - 学生详情与独立回访工作台已实现，支持回访日期、下次回访日期、自动提醒待办、统计卡片和课程日历回访提醒，后续仅做筛选/体验细节精修
7. ✅ **批量排课功能** - 已具备正式订单批量生成、学生详情按课程直达批量排课、ClassIn 创建和基础预检，后续聚焦真实账号验收与业务口径精修
8. 🟡 **面试流程拆分** - 老师招聘架构优化，当前功能已由 `teacher_candidates` 承载
9. ✅ **学生详情页** - 已补详情内批量排课入口、课时统计与回访日期/提醒维护，后续仅做真实账号验收与细节精修
10. ✅ **状态计算器(学生/面试/退费)** - 已补业务逻辑并接入学生、老师面试、异动退费核心 API

### 🟢 P2 - 增强功能 (可以)
11. **质检系统** - 质量保障
12. **待办事项系统** - 任务管理
13. **老师库细分页面** - 用户体验优化
14. ✅ **学生库(教务版)** - 已补基础数据分析、搜索筛选和教务预警，后续可继续做跨页/全量 BI 统计
15. **性能优化** - 提升用户体验

---

## 8. 下一步行动建议

### 第一阶段: 补齐核心页面 (2周)
1. ✅ `/dashboard/trial-lessons` 页面已创建，下一步做真实账号验收和细节精修
2. ✅ 创建 `/dashboard/academic/pending-trials` 页面
3. ✅ 状态计算器 `lib/status-calculator.ts` 已创建并接入线索、试听、学生、面试、退费核心接口
4. 持续补齐新增路由/页面的权限映射、route-local 守卫和验收清单

### 第二阶段: 补齐核心数据表 (2周)
1. 🟡 核对 `student_profiles` 表生产字段与页面实际使用口径
2. ✅ `visit_records` 表已创建并接入回访链路
3. ✅ `courses`, `class_sessions` 表已创建并接入排课链路；`class_schedules` 需按生产库和实际使用情况核对
4. 数据迁移和验证

### 第三阶段: 实现核心流程 (2周)
1. ✅ 试听匹配流程已实现，后续验收待匹配队列、老师选择和 ClassIn 开课
2. ✅ 回访管理流程已实现，已补统计和日历增强，后续仅做筛选/体验细节精修
3. ✅ 批量排课流程已实现，后续补更完整冲突检测和真实账号验收
4. 退费流程完善

### 第四阶段: 优化和测试 (1周)
1. 性能优化
2. 安全加固
3. 单元测试
4. 用户验收测试

---

**文档版本**: v1.0
**创建日期**: 2025-01-01
**预计总工期**: 7周 (如果全职开发)
**建议优先**: P0功能 → P1功能 → P2功能
