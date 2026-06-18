# 已实现功能符合性严格分析

**分析时间**: 2025-01-01
**分析对象**: 所有已实现的功能代码 vs 文档要求

---

## 2026-06-08 合规整改补充

围绕黄老师团队 0601 清单，本轮已补上几项原先最高风险的合规缺口：

- 学生、正式订单、试听、课程、课节、回访、状态历史、异动等核心接口已经从“资源权限”进一步收敛到“当前用户负责范围”。
- 学生 ClassIn 初始密码/UID 已做角色级脱敏：只有 admin / academic_affairs 可见，普通角色 API 响应置空且页面不展示；手动学生 ClassIn 注册接口也已限制为 admin / academic_affairs 并校验单条学生范围；学生入库确认响应也不再向普通角色回显 ClassIn 凭据；学生列表手动入库 ClassIn 已改为受控弹窗输入学生编号和初始密码，不再使用浏览器 `prompt()` 处理敏感输入。
- 正式订单和试听付款凭证已做角色级脱敏：只有 admin / finance / academic_affairs 可见，普通角色 API 响应置空；正式订单列表不展示凭证列，试听详情在字段为空时不展示凭证。
- 后台通用上传接口已从“任意登录用户可选 bucket 上传”收紧为“登录 + bucket 对应业务权限”；外部老师二维码表单继续使用独立公开上传接口。
- 后台通用上传接口已补空文件拦截、content-type 推断、纯 UUID Storage 文件名、安全摘要日志和稳定 `UPLOAD_*` 错误 code；线索新建、编辑和反馈聊天截图前端统一 `image/*`、20MB、非空校验，并在文件进入本地队列或触发上传前整组预检，对通用上传请求增加 60 秒超时和临时失败重试，避免把明显失败留到 Storage 层才暴露。
- 外部老师二维码上传已补公开入口专用校验：允许 `image/*` 图片并覆盖常见安全图片扩展，拒绝空文件和超过 20MB 文件，Storage 路径使用纯 UUID 文件名，前端多图上传先整组校验再批量写回，并对公开上传请求增加 45 秒超时和临时失败重试；公开老师表单的候选人链接验证、微信验证和最终提交也已补 30 秒超时和临时失败重试。
- 付款凭证上传入口已和后端 bucket 策略对齐：正式订单与试听付款凭证前端允许图片或 PDF，先本地校验空文件、20MB 上限和类型，再交给统一上传接口。
- 老师招聘和老师库存图片上传入口已和后端 bucket 策略对齐：新增老师面试简历前端限制 PDF/Word/图片且最大 50MB，初试录像前端限制 MP4/MOV/M4V/AVI/MKV/WebM 且最大 500MB，老师库存新增页形象照/好评截图会先校验空文件、20MB 上限和图片类型，再上传到 `teacher-photos` 保存 Storage URL，选择文件和提交前都会先本地拦截明显失败文件。
- 旧每日线索简历附件上传入口已和 `lead-resumes` bucket 策略对齐：新建和编辑页可上传 PDF、Word 或图片，先本地校验空文件、50MB 上限和类型，成功后自动回填附件 URL，也继续允许粘贴已有 URL。
- 统一 API wrapper 已补请求前 token 临期刷新，并保证 401 刷新重试保留 JSON Content-Type；首页和登录页的 session 探测也改走 wrapper，公开 auth 错误响应与日志已收敛，减少长时间停留页面后的误登出、重试请求格式偏差和登录调试信息泄露。
- 前端登录态链路已补客户端侧隐私收敛：刷新失败、session 解析失败、首页 session 探测失败、登录/注册失败只记录错误摘要，不再把原始异常对象或 refresh API 错误正文写入 console；`/api/auth/signin` 和 `/api/auth/refresh` 只返回最小 session（`access_token`、`refresh_token`、`expires_at`、`user.id`），登录页和刷新器也只写入最小 session；`token:refreshed`、`token:updated` 和 BroadcastChannel 通知不再携带完整 session 或 token；登录成功后不再额外缓存用户邮箱/姓名到 `localStorage.user`。
- 旧 `AppProvider/useApp` 模拟登录上下文已移除，根布局不再生成本地伪造 admin 用户；权限调试页改为读取真实权限 Hook 的当前用户档案，并只展示邮箱是否配置，避免调试页继续依赖假登录或暴露邮箱原文。
- 线索、正式订单、公共线索池、公开老师表单、学生、课堂、排课、异动预填和字典服务等客户端高敏入口已继续收敛错误日志：加载失败只输出 `summarizeError` 摘要，不再把原始异常对象、可能包含的响应正文或 stack 直接写入浏览器控制台。
- 公开 auth、鉴权中间件和上传链路已继续按安全摘要日志收敛：`/api/auth/refresh`、`/api/auth/session`、`/api/auth/signin`、`/api/auth/signup`、`/api/auth/signout`、`lib/middleware.ts`、`lib/supabase-client.ts`、`/api/upload`、`/api/teacher-form/upload` 不再记录原始错误 message/stack；权限检查异常统一返回通用 500，上传桶创建和上传失败不再输出底层 Storage 错误正文或内部对象路径。
- 账号停用拦截已落到认证主链路：登录、token 刷新、session 探测、当前用户档案和通用 API 权限检查都会读取 `user_profiles.is_active`，停用账号返回 `ACCOUNT_DISABLED` 且不再继续发放业务响应；客户端请求封装和刷新器收到 `ACCOUNT_DISABLED` / `PROFILE_NOT_FOUND` 后会清除本地登录态，避免继续携带无效凭据重试。
- 公开注册入口已默认关闭：`/signup` 和 `POST /api/auth/signup` 未显式设置 `ENABLE_PUBLIC_SIGNUP=true` 时返回 404；登录页不再展示注册入口，注册接口开启时也不回传 session、access token、refresh token 或注册邮箱。
- 启动专用 `/api/init-admin` 已按公开 bootstrap 接口标准收敛：生产环境默认 404，只有显式设置 `ENABLE_INIT_ADMIN_API=true` 后才进入密钥校验；开启后仍必须配置并提供 `INIT_ADMIN_SECRET`，创建失败不向前端透出 Supabase/Admin 原始错误，服务端日志不记录管理员邮箱、姓名或密码，成功响应仅返回新用户 ID。
- 独立“回访管理”已从占位页补为真实工作台：`/dashboard/feedback` 直访限制为具备学生查看权限的角色，页面接入 `visit-records` 分页列表和新增、编辑、删除；所有记录仍按当前用户可访问学生范围过滤，写入和删除按 `students.edit/delete` 控制，运营和销售无权访问时显示无权提示；填写 `next_visit_date` 时会自动生成/更新下次回访待办，清空日期或删除记录会取消未完成提醒。
- 未抢单销售线索的敏感字段已继续收紧：家长微信、聊天截图和客户社媒账号 ID 在列表/详情 API 中置空；反馈、丢弃以及学生/试听/订单聚合范围里的线索归属判断改为 `grab_user_id` 或 `grab_wechat` 精确匹配，避免姓名片段包含导致误授权。
- 线索 API 查询和日志已继续降敏：列表/详情/创建/更新/反馈/抢单/释放不再全字段查询，不再把来源账号、客户社媒账号、家长微信、聊天截图或数据库 raw message/stack 写入日志或异常响应；反馈日志只记录截图数量、用户 ID 和角色摘要。
- 学生详情聚合查询已收窄到页面字段白名单：订单、试听、课程、回访、状态历史、异动和 ClassIn 课堂不再 `select('*')`；异动记录不返回银行卡字段；课程查询不再输出整批课程数据，ClassIn 课堂按当前学生课程关联查询。
- `/api/students` 主接口已继续收敛：列表、详情、创建和更新响应统一使用学生页面字段白名单，分页 count 不再全字段查询；范围校验、ClassIn 注册和 CRUD 异常只写安全摘要并返回友好错误，不再向前端或日志透出 raw `message`、`stack`、`details`；`POST /api/students/assign-head-teacher` 已补归属变更专用守卫，仅 admin / academic_affairs 可分配班主任，避免具备 `students.edit` 的普通角色改挂学生访问范围。
- 学生状态历史和回访 CRUD 已继续收窄：状态历史与回访记录接口只返回页面字段；回访备注、状态变更原因、数据库 raw message 和 stack 不再写入日志或响应正文；回访下次计划日期已接入自动待办基础闭环，待办关联到学生且只分配给班主任或当前销售/班主任。
- `/api/transactions` 已补接口级响应字段白名单：列表、详情、创建和更新响应不再返回银行卡姓名、卡号、开户行、支行字段，银行卡信息仅作为写入输入保留；创建和手工更新会校验目标学生与正式订单仍在当前用户可访问范围内；异常日志和响应已改为安全摘要/友好错误。
- `/api/formal-orders` 已继续收敛正式订单主链路：列表、详情、创建、更新和删除不再全字段查询或向前端/日志透出数据库/运行时原始 `message`、`stack`、`details`；来源试听和历史订单校验均改为字段白名单，保留来源试听转正式、续费/扩科和单条范围校验。
- 试听 API 与试听 ClassIn 建课/开课链路已继续收敛：试听 CRUD 改为字段白名单并兼容 `manual_converted` 缺列，建课/开课只查询必要字段，ClassIn 学生失败只落安全错误状态，开课不再返回或保存含手机号的 `invokeUrl`。
- 线索与试听状态计算器已接入核心接口：`GET /api/leads` 返回添加/转化计算状态；`GET/POST/PUT /api/trial-lessons` 在列表、详情、创建和更新响应中返回试听状态、状态名称和转正式计算值。
- 教务学生库页面已补齐：`/dashboard/academic/students` 接入正式生视图和侧边栏入口，可按教务角色查看正式生订单汇总、课时、剩余金额及详情/续费/退费入口。
- 质检系统基础工作台已补齐：试听转化质检和课后服务质检页面已接入现有试听/正式生汇总数据，先提供风险筛选、统计和详情跳转；独立质检报告表、评分标准和报告生成仍待细化。
- 退费/异动已补基础状态流转、操作流水和状态看板：新建默认待教务核对，列表页可按权限推进教务金额核对、财务打款、人力业绩核对或拒绝；后端校验 4 个状态的合法流转，记录核对/打款/业绩操作痕迹，写入 `transaction_workflow_events` 供列表展示最近流水，并按当前可见范围汇总各状态数量和金额。
- 已废弃的 `/api/wechat-accounts` 已改为 admin-only，路由内再次校验 admin；列表、创建、更新响应不再返回登录/支付密码，请求日志也不记录完整 body 或密码值，降低历史账号模块的敏感字段泄露面。
- `/api/user-profiles` 和 `/api/users?role=...` 已从全量用户档案导出改为选人目录：角色筛选做白名单校验，普通角色响应只返回 `id/name/email/role/created_at`，避免普通业务角色读取手机号、微信、ClassIn UID、团队、启停等账号管理字段。
- `/api/users` 账号管理接口已补白名单和功能缺口：管理员列表/单条详情不再全字段查询，创建/更新响应只返回账号页面需要的字段；创建用户会持久化微信号，`id` 查询返回单条并处理 404；创建、更新、删除日志和异常响应只保留安全摘要；账号新增/编辑页移除不存在的 `notes` 字段并改用后端实际的 `name` 字段。
- 角色管理页面已从占位页升级为只读权限矩阵：管理员或具备 `users.view` 的账号可查看所有角色、资源和动作授权覆盖，普通无权账号直访返回无权提示，先解决“角色权限不可核对”的功能缺口。
- 待办系统与线索催促已补隐私和范围控制：待办 CRUD 与完成接口改为字段白名单、安全错误摘要和路由内范围校验；非管理员只能读取或修改自己被分配/创建的待办，完成操作仅允许被分配人执行，删除操作仅允许 admin；手工待办不再写入任意 `metadata`，线索催促也不再把家长微信复制到待办描述。
- 线索催促方向已从单向补为双向受限：运营/admin 可催促已分配销售反馈线索；销售只能催促自己负责线索的负责运营，API 会校验线索归属、`operator_id` 和接收人角色，避免通过直接请求创建越权待办。
- 公共线索池页面已补齐 admin 只读查看与销售抢单的前端分层：菜单、后端 `scope=public` 和页面访问逻辑保持一致，admin 不再点入口后被页面误判无权，销售以外角色不会看到或执行抢单操作。
- 待办页面基础闭环已对齐：`/dashboard/todos` 支持筛选、分页、创建、完成和删除，侧边栏任务列表按 `todos.view` 过滤，创建/完成按钮按权限与当前分配/创建关系显示，删除按钮仅按 `todos.delete` 显示，删除前使用受控确认弹窗替代浏览器原生 `confirm()`；`DELETE /api/todos` 中间件和路由内校验均已收紧为 admin-only，避免普通创建者删除自己的待办。
- `/api/auth/profile`、`/api/user-profiles` 及其前端调用方已补错误收敛：服务端日志只保留 `name/code/status/has_message/has_stack` 等摘要，前端 hook/service 不再裸 `console.*` 输出异常对象，接口异常响应不再回显底层 message 或 stack。
- 调试诊断接口继续降敏：`/api/debug/current-user` 只返回最小用户/权限摘要，不再全字段查询或回显完整档案；`/api/debug/network-test` 不再在诊断响应或日志中暴露原始 Supabase URL，只保留是否配置、脱敏 host、区域和测试摘要。
- 旧每日线索和字典配置接口继续收敛：不再 `select('*')`，数据库错误响应统一为友好文案，日志只保留字段摘要和 `summarizeError`，不记录微信号、简历附件、备注、字典 label/code 或 raw message/stack。
- 后台高敏写接口日志已从原始请求体改为安全摘要：试听、正式订单、异动、回访、每日线索、学生、学生入库确认、老师、老师候选人、老师入库预览、课程和课节不再记录完整 `body`、`insertData`、`updateData`、`updatePayload`，手机号、微信、付款凭证、银行卡、回访备注、ClassIn 凭据和候选人材料只保留字段名、是否携带和数量类排查信息。
- ClassIn 回调日志已完成密钥级收敛：入口和 handler 不再输出完整请求头、`SafeKey`、`Msg` 原文、回调 JSON、异常 message 或 stack，公开回调路径仅保留必要摘要和失败原因。
- ClassIn 镜像/课堂相关接口已补查询与错误降敏：镜像列表和课堂查询不再 `select('*')` 返回同步表原始字段，ClassIn 课堂改删、测试、Cookie 登录、日常 `classroom-classin` 查询和 scheduled 课程聚合不再在日志或响应里暴露 raw error message、stack、外部课堂 ID 明细或 SDK 返回体。
- ClassIn 同步和 SDK 写入口已继续降敏：四个同步接口的单条失败明细只保留对象名称和固定业务错误，整体失败只返回固定业务文案；ClassIn SDK 老师注册、课程、单元、课堂和一键创建入口统一记录 `summarizeError` 摘要，SDK core 的 debug 请求日志只保留 action/path 和参数摘要，前端不再收到 SDK/数据库/第三方原始错误正文。
- 高敏接口异常日志继续降敏：学生入库确认、废弃微信号管理、admin 清理、老师公开表单验证/提交、旧手动学生 ClassIn 注册均已改为安全错误摘要，500 响应不再回显第三方/数据库/运行时原文；`/api/cleanup-all-admins` 额外增加 route-local `users.delete` 权限二次守卫，清理前只查询 admin 用户 ID，响应不再回传邮箱或姓名。
- 前端高风险操作入口已与后端资源权限和数据范围继续对齐：账号、线索、试听列表、学生列表、老师库、每日线索、字典、废弃微信号管理、学生详情、课程详情、ClassIn SDK、ClassIn API 测试和同步运维页中的新增、编辑、删除、续费/扩科、退费、回访、课节勾选/批删、运维表单等按 `usePermission` 的对应资源动作及单条数据负责关系显隐；其中线索、试听、学生列表、老师库、字典、废弃微信号管理和每日线索删除确认链路也增加前端二次权限拦截，弹窗打开状态会随权限关闭。权限 Hook 不再向浏览器控制台输出完整用户对象或权限失败细节，降低普通角色误触越权操作和前端日志泄露的概率。
- `DELETE /api/leads/[id]` 已补路由内管理员校验和记录存在性校验，普通角色或缺档案账号会直接 403，手工请求不存在的线索返回 404。
- `PUT/DELETE /api/students` 已补单条学生范围校验，避免用户通过手工提交别人的学生 ID 操作越权；`POST /api/students/assign-head-teacher` 已限制为 admin / academic_affairs，并改为最小字段响应和安全错误摘要，避免普通 `students.edit` 角色改挂学生归属。
- 正式订单列表已从可编辑操作页改为核对页；异动记录列表已改为流程工作台，不再提供任意编辑/删除/状态快切，只允许按权限推进后端状态机。
- 老师候选人权限已收紧：普通角色不再查看候选人，删除仅 admin；招师、教务、HR 和财务在候选人写入接口中只能更新各自流程字段，HR/财务仅能处理复核通过且未入库的待入库候选人，避免越权改复核、入库和等级信息。
- 老师候选人接口已补姓名查询和字段白名单：教师详情页按 `name` 获取历史面试时不再回退到候选人第一页；候选人 CRUD 不再全字段返回，删除接口路由内再次要求 admin，异常日志只记录安全摘要。
- 老师候选人复核记录已改用真实登录档案：编辑页复核组件自动带出当前用户姓名，`PUT /api/teacher-candidates` 在保存复核字段但缺少复核人时由后端用当前用户档案兜底，不再留下“系统用户”或空复核人的记录。
- 招聘流程后端缺口已补齐：`PUT /api/teacher-candidates/recruitment-flow` 负责状态推进和拒绝记录，路由内校验合法流转与角色边界；候选人表新增 `interview_notes`、`interview_rating`、`review_notes` 以及谈薪入库银行/外显备注字段；约面、初试录像上传、教学复核和谈薪入库分步组件已从 TODO 改为真实保存字段并推进流程。
- 老师约面页面已补齐：`GET /api/teacher-candidates?queue=scheduling` 只返回未约面且未入库候选人，`/dashboard/teacher-candidates/interview` 为招师/管理员提供独立约面队列，保存后推进到初试录像上传。
- 初试录像上传页面已补齐：`GET /api/teacher-candidates?queue=video_upload` 只返回已约面且未上传录像候选人，`/dashboard/teacher-candidates/upload` 为招师/管理员提供独立上传队列，上传走统一 `/api/upload` 的视频 bucket 权限、类型和大小校验。
- 教学复核页面已补齐：`GET /api/teacher-candidates?queue=teaching_review` 只返回已上传录像且未复核候选人，`/dashboard/teacher-candidates/review` 为教务/管理员提供独立复核队列；复核通过/拒绝使用同一招聘流程接口，历史已有录像但步骤未推进的记录可兼容复核。
- 待入库候选人页面已补齐：`GET /api/teacher-candidates?queue=pending_entry` 只返回复核通过且未入库候选人，`/dashboard/teacher-candidates/pending` 为具备 `teacherCandidates.confirmEntry` 的管理员、教务、HR 和财务提供独立入库队列；页面已接入谈薪入库表单，保存课时费、教学科目、银行账户和备注后创建老师档案，并由入库确认接口一次写入 `final_entry`、`in_teacher_pool`、薪资确认时间和确认人；候选人银行卡和外显备注仅对入库确认角色可见，其余候选人响应置空。
- 储备候选人页面已补齐：`GET /api/teacher-candidates?queue=reserve` 只返回流程拒绝或复核不符合候选人，`/dashboard/teacher-candidates/reserve` 为招师、教务和管理员提供独立储备队列，集中查看储备/拒绝原因并可跳转编辑。
- 老师库存编号改为数据库序列/RPC 自动生成 `TH00001` 格式，老师创建与候选人入库不再依赖前端传入或手填编号。
- 老师 ClassIn 账号创建时机已改为试听确认老师时自动创建/绑定；老师库存新建、候选人确认入库不再立即注册，老师列表也不再提供手动入库按钮。
- 老师库存 API 响应已改为字段白名单：老师列表/详情/新建/更新不再全字段返回，不回传 `classin_initial_password` 或 `bank_card_info`，银行卡信息仅作为写入输入保留；删除路由内再次要求 admin，异常日志和响应不再透出 raw message/stack。
- 老师库已拆出教学版和销售版：教务侧可看授课、库存状态与 ClassIn 绑定状态，销售侧只读展示学历、学校、教龄、教学风格和成功案例等外显信息；老师库存 API 对非 admin / academic_affairs 清空 `classin_phone`、`classin_uid` 和 `classin_initial_password`，对销售、班主任和财务等非老师资料维护角色清空老师微信。
- 老师 ClassIn 初始密码已继续收敛：老师库存 API 不再回传该字段；旧入库预览和候选人确认入库响应对非 admin / academic_affairs 置空；旧入库预览接口也增加路由内 `teacherCandidates.interview` 权限校验。
- 旧老师/学生 ClassIn 入库与注册接口已继续收敛：老师入库预览/确认不再全字段读取候选人或老师记录，手动注册 ClassIn 的异常日志和公开响应只保留安全摘要，不再暴露手机号、昵称、底层错误正文或 stack。
- ClassIn 老师/学生自动创建路径已移除固定 `123456` 兜底：显式输入或环境变量优先，缺失时生成随机 8 位数字初始密码；学生手动入库入口也不再预填弱默认值，并已改为受控弹窗收集初始密码。
- ClassIn SDK 测试/运维写入口、ClassIn Cookie 登录、ClassIn 环境诊断、ClassIn 课堂测试端点、旧手动老师/学生注册入口、旧 ClassIn 镜像页面和远端课堂改删入口已限制为 admin / academic_affairs，接口本地 guard 与中间件权限表双层收紧；`/api/classroom-classin` 按可访问课程/课节过滤镜像数据，避免普通角色通过镜像接口读取全量外部课堂记录。
- ClassIn 数据同步页不再把手工复制的 Cookie 写入浏览器 localStorage：进入页面会删除旧版 `classin_cookie` 残留，Cookie 仅在当前页面内存中临时使用，降低外部系统会话凭据在浏览器侧长期残留的风险。
- `/debug/auth` 认证调试页已生产默认关闭，调试启用时仍要求 admin，并移除旧的页面内 prompt 测试登录入口；页面输出只保留 token/session 是否存在、长度、用户字段存在性和错误摘要，避免公开页面成为登录态和 token 诊断泄露面。
- `/dashboard/debug/permissions` 与 `/dashboard/test-dictionary-cache` 隐藏调试/测试页面已生产默认关闭，调试启用时也仅限 admin，避免普通角色直访获取权限矩阵、用户信息或缓存诊断。
- 老师库存等级/状态管理入口已补齐：老师列表展示等级和状态，老师详情、新建、编辑页可维护，候选人入库同步老师等级到库存。
- 新入库老师异常处理已从只读识别升级为可留痕流程：新增 `teacher_exceptions` / `teacher_exception_events`，教务或管理员可在异常队列中保存异常原因、处理状态和备注，接口会记录操作人、状态变化和事件流水；`GET/POST /api/teachers/exceptions` 已纳入方法级权限映射，并保留路由内 admin / academic_affairs 守卫。
- 老师信息采集链接已支持候选人专属入口，且公开 API 已收敛隐私面：验证接口只取预填所需字段，提交成功只返回 `id/candidate_id/created_at`，失败响应不再透出数据库或存储错误明细，服务端日志仅记录字段名、数量和是否携带类摘要。
- 课堂管理课节导出已补齐：课节 CSV 导出要求日期范围、按当前用户可访问课程过滤，并对 CSV 单元格做公式注入防护；课堂课程列表接口也同步加上课程范围过滤。
- 课程日历已从占位页补为真实月视图：`/dashboard/calendar` 使用课节接口的日期/状态筛选展示当月课表，后端仍按当前用户可访问课程范围过滤，侧边栏入口按 `classSessions.view` 控制。
- 课节时间修改已补 ClassIn 同步：修改本地课节日期或时间会先按课程范围校验，再调用 ClassIn `updateClassroom` 并更新本地课堂镜像；同步失败不会静默吞掉。
- 批量/单节排课创建已补稳定性和权限控制：批量接口按订单范围校验，单节重建按课程范围校验；ClassIn 课程/老师/学生 ID 统一数字化，学生先注册或复用后加入课程，本地课程和课节写入失败会返回失败明细，不再出现“显示成功但缺老师/缺课节”的半同步结果。
- 从订单创建 ClassIn 班级入口已从模拟成功改为真实提交：后端按 ClassIn 运维权限和订单范围校验，创建/绑定 ClassIn 课程、本地课程和学生入课；订单已有 ClassIn 班级时拒绝重复创建。
- ClassIn 实时回调已补通用事件流水：除既有课堂结束/课消处理外，举手、奖励、进出教室、授权/静音、答题/抢答、网络/设备、求助、录课、评价、回放、文件转换和账号类消息会写入 `classin_callback_events`，保存前剔除 `SafeKey` 并尽量关联本地课节，后续可用于质检、异常复盘和课堂互动统计。
- 课程课消/同步统计已补真实完成口径：`sync-stats` 和 `consumption` 按 `classroom_classin.end_time < 当前时间` 统计已完成课节，实际消耗小时只累加已结束课堂，避免未来已排课提前消耗余额。
- 课程、课节和排课链路的异常出口与查询字段已继续收敛：相关 API 统一使用安全错误摘要写日志，HTTP 响应只返回业务友好文案，不再暴露数据库、ClassIn SDK 或运行时原始 `message`、`stack`、`details`；课节同步、课程课节列表和批量创建 ClassIn 老师镜像查询已改为字段白名单，`app/api` 与 `lib` 当前已无 `select('*')` 命中。
- 新增试听来源已补排他约束：后台接口拒绝同时携带 `lead_id` 和 `student_id`，避免把一条试听同时挂到线索和正式生；从线索创建时页面会展示锁定的线索单号并自动填充渠道、地域、年级、首个学科和学生称呼，线索联系方式只有可识别为手机号或邮箱时才写入 ClassIn 建号字段。
- 待试听匹配页面已补齐：`/dashboard/academic/pending-trials` 聚合待匹配老师的试听记录，教务和管理员可从侧边栏进入并单条或批量选择 ClassIn 老师写回 `matched_teacher`。
- 试听转正式链路已补来源权威约束：页面锁定来源试听带出的学生和线索，后端只允许绑定来源试听学生；历史试听缺少 `student_id` 时由后端按试听姓名/手机号复用或创建学生并回写，避免转正式时手工改绑其他学生。
- 正式订单余额和退费上限已统一到服务端 helper：学生详情展示的剩余课时/金额会扣减已完成课时和既往非拒绝退费，退费创建/更新会拒绝超过净可退金额或净可退课时的请求。
- 全量 TypeScript 检查已恢复通过，后续功能整改可以用 `pnpm exec tsc --noEmit --pretty false --incremental false` 作为基础验收门槛。

---

## 🔍 分析方法

对每个已实现的功能，严格对照以下文档进行检查:
1. `docs/system-menu.md` - 菜单和功能要求
2. `docs/business-status-rules.md` - 状态计算规则
3. `docs/role-permissions.md` - 权限要求
4. `docs/database-design.md` - 数据库设计

---

## 1. 线索管理 (`/dashboard/leads`)

### ✅ 符合项

#### 1.1 页面和路由
- ✅ 路由正确: `/dashboard/leads`
- ✅ 页面存在且可访问
- ✅ 权限Hook已集成: `usePermission()`

#### 1.2 数据展示
**要求字段** (system-menu.md:116-153):
- ✅ 录单日期 → `entry_date`
- ✅ 报单序号 → `report_number`
- ✅ 小红书账号来源 → `xhs_source`
- ✅ 年级 → `grade_code`
- ✅ 咨询学科 → `subject_codes`
- ✅ 地域 → `region_ip`
- ✅ 添加方式 → `add_method_code`
- ✅ 家长微信 → `parent_wechat`
- ✅ 抢单微信 → `grab_wechat`
- ✅ 添加状态 → `add_status` (计算得出)
- ✅ 转化状态 → `convert_status` (计算得出)
- ✅ 运营人员 → `operator_id`
- ✅ 创建人 → `created_by`

#### 1.3 状态计算
**文档要求** (business-status-rules.md:30-95):
- ✅ **线索添加状态** 已实现 (`lib/status-calculator.ts:58-83`)
  ```typescript
  // 实现的4种状态:
  - unassigned     // 运营未派单
  - added          // 已添加
  - not_added      // 未添加
  - waiting_feedback // 销售未反馈
  ```

  **符合性检查**:
  - ✅ 检查 `grab_wechat` 是否为空
  - ✅ 检查 `add_status` 字段
  - ✅ 检查是否产生试听
  - ✅ 反馈接口已限制 `add_status` 只能为 `added` 或 `not_added`
    ```typescript
    if (!lead.grab_wechat || lead.grab_wechat.trim() === '') {
      return LeadAddStatus.UNASSIGNED
    }

    if (lead.add_status === 'added' || hasTrialLesson) {
      return LeadAddStatus.ADDED
    }
    ```

- ✅ **线索转化状态** 已实现 (`lib/status-calculator.ts:88-101`)
  ```typescript
  // 实现的3种状态:
  - trial   // 试听
  - formal  // 正式
  - empty   // 空
  ```
  ✅ 完全符合文档要求

#### 1.4 权限控制
**文档要求** (role-permissions.md:138-153):
- ✅ 销售: `read: true, update: 'partial', delete: false, feedback: true`
- ✅ 班主任: `read: true, update: false, delete: false, feedback: false`

**实际代码** (leads/page.tsx:307-330):
```typescript
{leadsPerm.feedback() && (
  <Button onClick={() => handleMarkAsFeedback(lead)}>反馈</Button>
)}
{leadsPerm.convert() && (
  <Button onClick={() => handleCreateTrialLesson(lead)}>创建试听</Button>
)}
{leadsPerm.edit() && (
  <Link href={`/dashboard/leads/${lead.id}/edit`}>编辑</Link>
)}
{leadsPerm.delete() && (
  <Button onClick={() => handleDeleteClick(lead.id)}>删除</Button>
)}
```
✅ 权限控制正确

#### 1.5 操作功能
- ✅ **销售反馈**: 已实现 `handleMarkAsFeedback` (line 134-159)
- ✅ **创建试听**: 已实现 `handleCreateTrialLesson` (line 162-165)
- ✅ **编辑线索**: 已实现，链接到编辑页面
- ✅ **删除线索**: 已实现，带确认对话框

---

### ❌ 不符合项

#### 1.1 缺少筛选功能

**文档要求** (system-menu.md:122-133):
> 查看所有线索列表

**实际实现**: 无任何筛选或搜索功能

**建议添加**:
- 按添加状态筛选
- 按转化状态筛选
- 按运营人员筛选
- 按时间范围筛选

---

## 2. 线索录入 (`/dashboard/leads/new`)

### ✅ 符合项

#### 2.1 页面和路由
- ✅ 路由正确: `/dashboard/leads/new`
- ✅ 权限控制: 运营角色专属

#### 2.2 表单字段
**要求字段** (system-menu.md:99-99):
- ✅ 报单序号 → `report_number`
- ✅ 录单日期 → `entry_date`
- ✅ 小红书账号来源 → `xhs_source`
- ✅ 添加方式 → `add_method_code`
- ✅ 运营人员 → `operator_id` (默认当前用户)
- ✅ 年级 → `grade_code`
- ✅ 咨询学科 → `subject_codes`
- ✅ 地域 → `region_ip`
- ✅ 家长微信 → `parent_wechat`
- ✅ 聊天截图 → `chat_screenshots`

#### 2.3 默认值
- ✅ 运营人员默认为当前登录用户
- ✅ 录单日期默认为今天

#### 2.4 提交流程
- ✅ 提交后自动设置状态为"运营未派单"
- ✅ 记录创建人和更新人

---

### ❌ 不符合项

#### 2.1 缺少重复标记功能

**文档要求** (system-menu.md:96-97):
> 填写基础信息: 报单序号、录单日期、小红书账号来源、添加方式

**实际表单** (需要检查): 缺少重复标记和冲突运营人员字段

**数据库字段**:
- `duplicate_mark` - 重复标记 (boolean)
- `collision_operator` - 冲突运营人员

---

## 3. 试听课程管理

### ❌ 完全未实现

**状态**: 页面不存在 `/dashboard/trial-lessons`

**影响**:
- ❌ 销售无法创建试听课程
- ❌ 教务无法匹配老师
- ❌ 无法查看试听状态流转
- ❌ 整个试听转化流程断裂

**文档要求** (system-menu.md:157-207):
- 试听列表 (8种状态)
- 新增试听 (销售/班主任)
- 匹配老师 (教务)
- 确认老师 (教务)
- 确定时间 (教务)
- 生成链接 (教务)
- 填写反馈 (老师)

**状态计算器**: ✅ 已实现 (status-calculator.ts:160-224)
```typescript
export enum TrialLessonStatus {
  CANCELLED = 'cancelled',           // 取消试听
  WAITING_MATCH = 'waiting_match',   // 待匹配老师
  WAITING_CONFIRM = 'waiting_confirm', // 待确认老师
  WAITING_TIME = 'waiting_time',     // 待确认时间
  WAITING_LINK = 'waiting_link',     // 待开链接
  SCHEDULED = 'scheduled',           // 已排待上课
  WAITING_FEEDBACK = 'waiting_feedback', // 上完待反馈
  COMPLETED = 'completed'            // 已完成
}
```
✅ 状态定义完全符合文档要求 (business-status-rules.md:156-231)

---

## 4. 正式订单管理 (`/dashboard/formal-orders`)

### ✅ 符合项

#### 4.1 页面和路由
- ✅ 路由正确: `/dashboard/formal-orders`
- ✅ 新增页面: `/dashboard/formal-orders/new`
- ✅ 历史编辑入口: `/dashboard/formal-orders/[id]/edit`，当前已改为正式生管理迁移提示页

#### 4.2 基本功能
- ✅ 订单列表展示
- ✅ 新建订单
- ✅ 订单列表只读核对；后续编辑类动作迁移到正式生详情
- ✅ 退费/异动列表已提供按权限推进的教务核对、财务打款、人力业绩核对和拒绝动作；新增按权限展示，旧编辑入口迁移到正式生详情提示
- ✅ 正式订单净剩余课时/金额和退费金额上限已按完成课时、既往非拒绝退费统一计算
- ✅ 异动记录 API 已隐藏银行卡字段，补目标学生/订单范围校验，并收敛 raw error message/stack
- ✅ 权限控制

---

### ❌ 不符合项

#### 4.1 缺少续费订单限制

**文档要求** (system-menu.md:214-255):
```typescript
// 销售
{
  create: {
    new: true,     // 可以录入新签订单
    renewal: false // 不能录入续费订单
  }
}

// 班主任
{
  create: {
    new: false,    // 不能录入新签订单
    renewal: true  // 可以录入续费订单
  }
}
```

**实际实现**: 需要检查是否有角色限制逻辑

#### 4.2 订单状态计算已补

**文档要求**: 订单状态流转
- draft (草稿)
- pending_payment (待付款)
- active (进行中)
- suspended (已暂停)
- completed (已完成)
- refunded (已退费)
- cancelled (已取消)

**实际实现**:
- ✅ `lib/server-formal-order-balance.ts` 已在课时余额汇总中统一计算 `computed_status` 和 `computed_status_label`。
- ✅ `GET /api/formal-orders` 列表/详情返回计算状态；`GET /api/students/detail` 也会把正式订单和订单汇总对齐到同一状态口径。
- ✅ 正式订单列表和正式生详情页优先展示计算状态，原始 `formal_orders.status` 保留为人工/历史状态。
- ⚠️ 草稿、待付款、暂停、取消等仍依赖原始 `status` 人工状态；自动计算目前覆盖课时耗尽完成、退费耗尽、进行中等运行时状态。

---

## 5. 学生管理 (`/dashboard/students`)

### ✅ 符合项

#### 5.1 基本功能
- ✅ 学生列表
- ✅ 新建学生
- ✅ 编辑学生
- ✅ 学生详情页 (需要检查)

---

### ❌ 不符合项

#### 5.1 缺少学生状态计算

**文档要求** (business-status-rules.md:265-340):
- 缺状态: `status` 字段为空
- 快没课: 距离课表截至 < 7天
- 已回访: 本月回访次数 > 0
- 新生状态: 一周/两周/三周/四周/老生

**实际实现**:
- ✅ 状态计算器已实现 (status-calculator.ts:294-375)
- ✅ 回访状态已统一查询 `visit_records`，迁移 `supabase/migrations/006_create_visit_records_table.sql` 已存在
- ⚠️ 列表页面的学生状态展示仍需按最终业务口径确认

#### 5.2 缺少学生详情页功能

**文档要求** (system-menu.md:260-309):
- 批量排课
- 课时管理
- 回访管理

**实际实现**: `/dashboard/students/[id]` 已作为正式生详情/管理中心使用，聚合订单、课程、回访、状态历史、异动和剩余课时/金额；批量排课入口仍在排课模块。

---

## 6. 老师候选人管理 (`/dashboard/teacher-candidates`)

### ✅ 符合项

#### 6.1 基本功能
- ✅ 候选人列表
- ✅ 新建候选人
- ✅ 编辑候选人

---

### ❌ 不符合项

#### 6.1 面试流程未拆分

**文档要求** (system-menu.md:374-523):
- 老师约面 (`/dashboard/teacher-candidates/interview`)
- 录像上传 (`/dashboard/teacher-candidates/upload`)
- 教学复核 (`/dashboard/teacher-candidates/review`)
- 待入库 (`/dashboard/teacher-candidates/pending`)
- 储备 (`/dashboard/teacher-candidates/reserve`)

**实际实现**: 已有统一列表页、编辑页分阶段表单、招聘流程推进接口、独立约面页面、独立初试录像上传页面、独立教学复核页面、独立待入库页面和独立储备候选人页面；数据表仍未按 6 个子表拆分。

**影响**:
- ✅ 约面队列已独立，约面后可推进到初试录像上传。
- ✅ 初试录像上传队列已独立，上传后可推进到教学复核。
- ✅ 教学复核队列已独立，复核后可推进到待入库或拒绝归档。
- ✅ 复核通过后的入库队列已独立，可直接进入确认入库。
- ✅ 拒绝/不符合候选人已进入独立储备队列。

---

## 7. 权限系统

### ✅ 符合项

#### 7.1 权限定义
- ✅ `lib/permissions.ts` - 权限定义完整
- ✅ `docs/role-permissions.md` - 文档完整

#### 7.2 权限Hook
- ✅ `lib/hooks/usePermission.ts` 已实现

#### 7.3 集成使用
- ✅ 线索管理页面已使用权限Hook

---

### ❌ 不符合项

#### 7.1 API层权限验证（已补第一轮）

**文档要求** (system-menu.md:992-1053):
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const user = await verifyAuthToken(token)
  const hasAccess = checkPathPermission(path, user.role)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}
```

**实际实现**: `middleware.ts` 已接入 `lib/route-permissions.ts`，非公开 API 未配置权限时默认返回 `ROUTE_PERMISSION_UNREGISTERED`，不再静默放行。

#### 7.2 缺少RLS策略

**文档要求**: Supabase Row Level Security策略

**实际实现**: 需要检查Supabase项目

---

## 8. 数据库表

### ✅ 已存在的表 (17张)
见 `docs/online-tables.md`

### ❌ 缺失的表 (历史盘点口径)

本节保留早期盘点结构；以下表项中，`visit_records`、`courses`、`class_sessions`、`todos` 已在当前迁移中存在，不能再按缺失表处理。

#### 8.1 严重影响功能的缺失

1. **`student_profiles`** - 学生详细档案
   - 影响: 学生管理功能不完整
   - 优先级: P0

2. **`visit_records`** - 回访记录（已修正）
   - 当前状态: 迁移已存在，状态计算器已查询 `visit_records`
   - 优先级: 已从 P0 闭环项移除

3. **`courses`** - 课程详细排课
   - 影响: 批量排课功能无法实现
   - 优先级: P1

4. **`class_sessions`** - 具体课次
   - 影响: 课时管理无法实现
   - 优先级: P1

5. **`class_schedules`** - 课程日历
   - 影响: 排课日历无法实现
   - 优先级: P1

6. **`todos`** - 待办事项
   - 影响: 任务管理功能缺失
   - 优先级: P2

---

## 9. 总体符合性评分

| 功能模块 | 符合性 | 评分 | 说明 |
|---------|--------|------|------|
| 线索录入 | ⚠️ 部分 | 70% | 基本功能正常，缺少重复标记 |
| 线索管理 | ⚠️ 部分 | 60% | **严重bug**: 状态计算逻辑错误 |
| 试听课程 | ❌ 缺失 | 0% | 页面不存在，流程断裂 |
| 正式订单 | ⚠️ 部分 | 70% | 基本功能正常，缺少续费限制 |
| 学生管理 | ⚠️ 部分 | 50% | 基本CRUD正常，缺少状态展示 |
| 老师候选人 | ⚠️ 部分 | 40% | 未按面试流程拆分 |
| 权限系统 | ⚠️ 部分 | 60% | 前端权限正常，缺少API验证 |
| 状态计算器 | ✅ 已实现 | 90% | 逻辑完整，但有字段不匹配bug |
| 数据库表 | ❌ 缺失 | 57% | 缺13张关键表 |

**总体评分**: **55% - 不合格**

---

## 10. 关键问题总结

### 🔴 P0 - 严重bug (必须立即修复)

#### Bug 1: 线索添加状态计算错误（已修复）
**位置**: `lib/status-calculator.ts:58-83`

**当前状态**: 已按 `grab_wechat` 判断运营未派单，并使用 `add_status` 的 `added/not_added` 值。
**补充**: `POST /api/leads/feedback` 已拒绝非法 `add_status`，避免手工请求写坏状态。

#### Bug 2: 字段名不匹配（已修复）
**位置**: `lib/status-calculator.ts:68-75`

**当前状态**: 状态计算器使用 `add_status`，未再使用历史 `feedback_added` 字段。

#### Bug 3: 回访记录表名不一致（已修复）
**位置**: `lib/status-calculator.ts:282-287`

**当前状态**: 代码已查询 `visit_records`，并有 `supabase/migrations/006_create_visit_records_table.sql` 创建回访记录表。

---

### 🟡 P1 - 重要缺失 (应该尽快修复)

1. **试听课程管理页面** - 已补来源锁定、ClassIn 学生绑定状态/重试和 ClassIn 老师目录选择；剩余继续按实际验收补筛选与质检流转
2. **学生状态展示口径** - 学生管理关键
3. **学生详细档案表** - 批量排课需要
4. **课程排课表** - 教务核心功能

---

### 🟢 P2 - 增强功能 (可以后续优化)

1. 筛选和搜索功能
2. 面试流程页面拆分
3. 待办事项系统
4. API权限中间件

---

## 11. 修复优先级建议

### 第1周 - 修复P0 bug
1. 修复线索状态计算逻辑
2. 统一字段名称
3. 校验学生状态展示口径
4. 回归回访状态计算

### 第2周 - 补齐核心功能
5. 创建试听课程管理页面
6. 集成试听状态计算器
7. 待试听匹配页面已创建，继续补老师推荐和后续上课链接流程

### 第3周 - 完善数据模型
8. 创建 `student_profiles` 表
9. 创建 `courses` 等排课表
10. 实现批量排课功能

### 第4周+ - 优化和增强
11. 添加筛选搜索
12. 拆分面试流程页面
13. 完善权限系统

---

**文档版本**: v1.0
**创建日期**: 2025-01-01
**分析师**: Claude AI
**结论**: 已实现功能存在严重bug，需要立即修复后再继续开发新功能
