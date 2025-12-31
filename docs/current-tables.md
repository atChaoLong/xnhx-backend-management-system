# 当前数据库表清单

## 📊 现有表列表 (共16张表)

### 1. 用户与权限管理 (1张)
- **user_profiles** - 用户档案表 (系统表,未在迁移文件中)

### 2. 线索管理 (2张)
- **leads** - 线索表 (从小红书等渠道获取的销售线索)
- **daily_leads** - 每日线索表 (每日老师候选人线索)

### 3. 老师管理 (4张)
- **teacher_candidates** - 老师候选人表 (面试管理)
- **teacher_profiles** - 老师档案表 (内部老师详细信息)
- **teachers** - 老师表 (基础信息)
- **teacher_classin** - ClassIn老师同步表

### 4. 学生管理 (2张)
- **students** - 学生表 (学生基础信息)
- **students_classin** - ClassIn学生同步表

### 5. 课程与订单 (2张)
- **trial_lessons** - 试听课程表
- **formal_orders** - 正式订单表

### 6. ClassIn集成 (2张)
- **class_classin** - ClassIn班级同步表
- **classroom_classin** - ClassIn课堂同步表

### 7. 系统配置 (2张)
- **sys_dictionaries** - 系统字典表 (数据字典)
- **wechat_accounts** - 微信号管理表

### 8. 异动记录 (1张)
- **transaction_records** - 异动记录表 (学生课程异动)

---

## 📋 表详细说明

### user_profiles (系统表)
**用途**: 存储用户账号信息和角色
```sql
主要字段:
- id: UUID (主键)
- email: 邮箱
- name: 姓名
- role: 角色 (admin/operator/sales/head_teacher/teacher/academic_affairs/finance/hr)
- avatar_url: 头像
- created_at: 创建时间
```

---

### leads (线索表)
**用途**: 存储从小红书等渠道获取的销售线索
```sql
主要字段:
- id: UUID
- report_number: 报单序号
- entry_date: 录单日期
- xhs_source: 小红书账号来源
- add_method_code: 添加方式
- operator_id: 运营人员ID
- grade_code: 年级代码
- subject_codes: 咨询学科(数组)
- region_ip: 地域IP
- parent_wechat: 家长微信号
- grab_wechat: 抢单微信
- add_status: 添加状态 (unassigned/added/not_added/waiting_feedback)
- convert_status: 转化状态 (trial/formal/empty)
- chat_screenshots: 聊天截图(数组)
- created_at, updated_at
```

**业务流程**:
- 运营录入线索 → 销售反馈添加状态 → 转化为试听或正式学生

---

### daily_leads (每日线索表)
**用途**: 每日老师候选人线索
```sql
主要字段:
- id: UUID
- name: 姓名
- wechat_number: 微信号
- assigned_person: 分配人员
- received_date: 接收日期
- is_added: 是否已添加
- resume_attachment: 简历附件
- notes: 备注
- created_at, updated_at
```

**业务流程**:
- 每日导入候选人线索 → 分配给HR → 转为teacher_candidates

---

### teacher_candidates (老师候选人表)
**用途**: 老师面试候选人全流程管理
```sql
主要字段:
- id: UUID
- daily_lead_id: 每日线索ID (外键)
- name: 姓名
- wechat_id: 微信号
- resume_url: 简历URL
- profile_photo_url: 形象照URL
- grade_level: 年级段
- subjects_taught: 教授学科(数组)
- teacher_type: 老师类型
- trial_subject: 试讲科目
- teaching_style: 授课风格
- interview_date: 面试日期
- interview_time: 面试时间
- interviewer_name: 面试官
- interview_link: 面试链接
- interview_score: 面试评分
- logical_expression_score: 逻辑表达评分
- dress_appearance_score: 礼仪着装评分
- material_preparation_score: 课件准备评分
- exam_score: 考试成绩
- initial_evaluation: 初试评价
- teacher_characteristics: 老师特点
- mandarin_level: 普通话水平
- research_ability: 教研能力
- service_awareness: 服务意识
- affinity: 亲和力
- review_status: 复核状态 (pending/reviewed/not-suitable)
- review_result: 复核结果
- review_evaluation_comment: 复核评价
- reviewed_by: 复核人
- review_date: 复核日期
- is_hired: 是否入库
- teacher_feeling: 老师感觉
- suitable_for_students: 适合学生
- scheduling_preference: 排课偏好
- teacher_level: 老师级别
- can_teach_graduation_class: 能否排毕业班
- current_rate: 当前时薪
- approved_hourly_rate: 批准时薪
- created_at, updated_at
```

**业务流程**:
1. 从daily_leads导入
2. HR约面 (interview_date, interview_time, interview_link)
3. HR初试评价 (interview_score, initial_evaluation)
4. 教务复核 (review_status, review_result, approved_hourly_rate)
5. 入库 (is_hired=true) → 创建teacher_profiles

---

### teacher_profiles (老师档案表)
**用途**: 内部老师详细档案管理
```sql
主要字段:
- id: UUID
- classin_uid: ClassIn UID
- teacher_name: 老师姓名
- gender: 性别
- wechat: 微信号
- classin_phone: ClassIn注册手机号
- mobile: 常用联系电话
- location: 所在地
- subjects: 教授学科(数组)
- grade_levels: 教授年级段(数组)
- used_classin: 是否用过ClassIn
- has_certificate: 是否有教资证
- education: 学历
- university: 毕业院校
- available_times: 可排课时间(数组)
- textbook_versions: 熟悉教材版本(数组)
- student_regions: 带过学生地域(数组)
- student_levels: 擅长学生水平(数组)
- teaching_years: 教学年限
- teaching_style: 教学特点
- success_cases: 优秀学员提分案例
- photo_url: 老师形象照URL
- review_screenshots: 提分/好评截图URLs(数组)
- bank_card_info: 银行卡信息(JSONB)
- notes: 备注
- created_at, updated_at
```

**业务流程**:
- 从teacher_candidates入库后创建
- 教务维护详细档案
- 用于排课时匹配合适老师

---

### teachers (老师表)
**用途**: 老师基础信息表
```sql
主要字段:
- id: UUID
- classin_uid: ClassIn UID
- name: 姓名
- mobile: 手机号
- email: 邮箱
- gender: 性别
- location: 所在地
- subject: 教授科目
- grade: 教授年级
- teach_type: 教学类型
- education: 学历
- university: 毕业院校
- school_uid: 学校编号
- join_type: 加入类型
- serve_state: 服务状态
- tea_id: 老师ID
- is_del: 是否删除
- status: 本地状态
- sync_time: 同步时间
- notes: 备注
- created_at, updated_at
```

---

### teacher_classin (ClassIn老师同步表)
**用途**: 同步ClassIn系统的老师数据
```sql
主要字段:
- uid: BIGINT (ClassIn UID, 主键)
- name: 姓名
- logo: 头像URL
- emp_no: 工号
- position: 职位
- is_del: 是否删除
- join_type: 加入类型
- departments_info: 部门信息(数组)
- mobile: 手机号
- email: 邮箱
- account_status: 账号状态
- sync_time: 同步时间
- notes: 备注
- created_at, updated_at
```

---

### students (学生表)
**用途**: 学生基础信息管理
```sql
主要字段:
- id: UUID
- classin_uid: BIGINT (ClassIn UID)
- student_number: 学号
- name: 姓名
- grade: 年级
- region: 地域
- parent_phone: 家长电话
- parent_wechat: 家长微信
- mobile: 学生本人电话
- school: 学校
- head_teacher_id: 班主任ID
- status: 状态
- school_uid: ClassIn学校UID
- serve_state: 服务状态
- join_type: 加入类型
- stud_id: ClassIn学生ID
- classin_extra: ClassIn额外信息(JSONB)
- notes: 备注
- created_at, updated_at
```

---

### students_classin (ClassIn学生同步表)
**用途**: 同步ClassIn系统的学生数据
```sql
主要字段:
- uid: BIGINT (ClassIn UID, 主键)
- stud_id: 学生ID
- name: 学生姓名
- join_type: 加入类型
- mobile: 手机号
- email: 邮箱
- account_status: 账号状态
- cat_info: 分类信息(数组)
- lable_info: 标签信息(数组)
- stuno: 学号
- is_del: 是否删除
- addtime: 添加时间
- serve_state: 服务状态
- sync_time: 同步时间
- notes: 备注
- created_at, updated_at
```

---

### trial_lessons (试听课程表)
**用途**: 试听课程管理
```sql
主要字段:
- id: UUID
- child_name: 孩子姓名
- status: 状态 (scheduled/completed/cancelled/no-show)
- lead_id: 线索ID (外键到leads)
- region: 地域
- grade: 年级
- trial_subject: 试讲科目
- trial_time: 试讲时间
- trial_duration: 试讲时长
- phone: 联系电话
- channel: 渠道
- trial_amount: 试听费用
- payment_proof: 付款凭证
- urgency_level: 紧急程度 (low/medium/high)
- notes: 备注
- assigned_consultant: 分配顾问
- course_status: 课程状态
- student_type: 学生类型
- matched_teacher: 匹配老师
- confirmed_teacher: 确认老师
- confirmed_time: 确认时间
- class_link: 上课链接
- manual_converted: 手动转化
- classin_uid: ClassIn UID
- classin_course_id: ClassIn班级ID
- created_at, updated_at
```

**业务流程**:
- 从leads创建试听
- 教务匹配老师 (matched_teacher)
- 确认老师和上课时间
- 上课完成后转化为正式订单

---

### formal_orders (正式订单表)
**用途**: 正式课程订单管理
```sql
主要字段:
- id: UUID
- student_id: 学生ID (外键到students)
- order_number: 订单号
- teacher_names: 老师姓名(数组)
- subjects: 学科(数组)
- order_type: 订单类型
- total_hours: 总课时
- payment_channel: 付款渠道
- payment_amount: 付款金额
- hourly_rate: 时薪
- payment_proof: 付款凭证
- payment_time: 付款时间
- consultant_teacher: 顾问老师
- order_notes: 订单备注
- total_sessions: 总课次
- session_duration: 单课时长
- fixed_mode: 固定模式
- frequency: 频次
- official_start_time: 正式开始时间
- first_class_time: 第一次上课时间
- status: 状态 (active/completed/cancelled/suspended)
- created_at, updated_at
```

**业务流程**:
- 从试听转化或直接创建
- 录入付款信息
- 创建课程和排课

---

### class_classin (ClassIn班级同步表)
**用途**: 同步ClassIn系统的班级数据
```sql
主要字段:
- course_id: BIGINT (ClassIn班级ID, 主键)
- course_name: 班级名称
- school_uid: 学校编号
- web_cast: webcast链接
- live_host: 直播主机
- course_type: 课程类型
- cover_img: 封面图片
- creater_name: 创建者名称
- add_time: 添加时间
- creator_uid: 创建者UID
- end_uid: 结束UID
- end_name: 结束名称
- end_time: 结束时间
- subject_id: 科目ID
- course_state: 课程状态
- first_class_begin_time: 第一次上课时间
- teacher_num: 老师数量
- student_num: 学生数量
- audit_num: 听课人数
- expiry_time: 过期时间
- cloud_folder: 云文件夹
- skin_id: 皮肤ID
- complete_class_num: 完成的课节数
- total_class_num: 总课节数
- record_num: 录播数量
- live_num: 直播数量
- open_num: 公开课数量
- homework_num: 作业数量
- exam_num: 考试数量
- head_img: 头图信息(JSONB)
- course_img: 课程图片(JSONB)
- setting: 设置信息(JSONB)
- main_user_info: 主用户信息(JSONB)
- teachers: 老师列表(数组)
- labels: 标签(数组)
- cat_info: 分类信息(JSONB)
- cloud_folder_info: 云文件夹信息(JSONB)
- skin_info: 皮肤信息(JSONB)
- sync_time: 同步时间
- notes: 备注
- created_at, updated_at
```

---

### classroom_classin (ClassIn课堂同步表)
**用途**: 同步ClassIn系统的课堂数据
```sql
主要字段:
- class_id: BIGINT (ClassIn课堂ID, 主键)
- name: 课堂名称
- class_status: 课堂状态
- class_type: 课堂类型
- start_time: 开始时间
- end_time: 结束时间
- seat_num: 座位数量
- teach_mode: 教学模式
- screen_mode: 屏幕模式
- camera_hide: 是否隐藏摄像头
- is_auto_onstage: 是否自动上台
- is_dc: 是否DC
- is_hd: 是否HD
- lesson_key: 课程key
- live_host: 直播主机
- class_introduce: 课堂介绍
- transfer_stu_num: 转出学生数
- out_stu_num: 离开学生数
- stu_num: 学生数
- audit_num: 听课人数
- goods_num: 商品数量
- course_id: 班级ID (外键到class_classin)
- school_uid: 学校UID
- activity_id: 活动ID
- co_type: coType
- co_main_id: coMainId
- created_at_timestamp: 创建时间戳
- biz_type: bizType
- publish_flag: publishFlag
- process_flag: processFlag
- biz_id: bizId
- mute_all: muteAll
- forbid_assistant_operation: forbidAssistantOperation
- course_name: 班级名称(冗余)
- video_array: 视频数组信息(JSONB)
- teacher: 老师信息(JSONB)
- class_label: 班级标签(数组)
- assistant: 助教列表(数组)
- creator: 创建者信息(JSONB)
- cloud_folder: 云文件夹信息(JSONB)
- unit: 单元信息(JSONB)
- category: 分类信息(JSONB)
- sync_time: 同步时间
- notes: 备注
- created_at, updated_at
```

---

### sys_dictionaries (系统字典表)
**用途**: 数据字典配置
```sql
主要字段:
- id: UUID
- category: 分类 (grade/subject/add_method/province/xhs_source等)
- code: 代码
- label: 标签
- sort_order: 排序
- is_active: 是否激活
- created_at, updated_at
```

**字典分类**:
- `grade`: 年级 (小学1-6, 初中1-3, 高中1-3)
- `subject`: 学科 (语文/数学/英语/物理/化学等)
- `add_method`: 添加方式 (微信/电话/其他)
- `province`: 省份地域
- `xhs_source`: 小红书账号来源

---

### wechat_accounts (微信号管理表)
**用途**: 微信号账号管理
```sql
主要字段:
- id: UUID
- account_name: 账号名称
- wechat_id: 微信号
- purpose: 用途
- status: 状态 (active/inactive/banned)
- notes: 备注
- created_at, updated_at
```

**注意**: 该表已不再使用,改为使用user_profiles表获取销售人员信息

---

### transaction_records (异动记录表)
**用途**: 学生课程异动记录
```sql
主要字段:
- id: UUID
- student_id: 学生ID (外键到students)
- student_name: 学生姓名
- transaction_type: 异动类型
- description: 描述
- transaction_date: 异动日期
- handled_by: 处理人
- notes: 备注
- created_at
```

---

## 🔄 表与业务模块对应关系

### 客户管理模块
- `leads` - 线索跟进
- `daily_leads` - 客户回访

### 订单管理模块
- `trial_lessons` - 试听课
- `formal_orders` - 正式课

### 教务管理模块
- `teacher_candidates` - 面试管理
- `teacher_profiles` - 老师库存管理
- `students` - 学生管理
- (缺) 排课管理
- (缺) 课程日历

### 待办事项
- (缺) 待办任务
- `transaction_records` - 异动记录

### 系统管理
- `sys_dictionaries` - 字典管理
- (缺) 用户管理 (使用user_profiles系统表)
- (缺) 角色管理 (使用user_profiles.role字段)

---

## ⚠️ 缺失的重要表

根据数据库设计文档,以下表尚未创建:

### 1. 学生管理增强
- `student_profiles` - 学生详细档案

### 2. 订单与课程增强
- `orders` - 订单主表 (统一试听和正式订单)
- `courses` - 课程详细排课
- `class_sessions` - 具体课次
- `class_schedules` - 课程日历

### 3. 面试管理增强
- `interview_arrangements` - 约面安排
- `interview_sessions` - 面试记录
- `interview_scores` - 面试评分
- `teacher_characteristics` - 老师素质评价
- `review_records` - 复核记录
- `hire_records` - 入库记录

### 4. 回访管理
- `visit_records` - 回访记录
- `visit_templates` - 回访模板

### 5. 异动管理增强
- `course_changes` - 课程异动 (扩展transaction_records)

### 6. 待办事项
- `todos` - 待办事项

### 7. 排课模板
- `schedule_templates` - 排课模板

---

## 📊 数据统计

- **现有表**: 16张
- **ClassIn同步表**: 4张 (teacher_classin, students_classin, class_classin, classroom_classin)
- **核心业务表**: 12张
- **缺失表**: 约13张 (根据设计文档)

---

**文档版本**: v1.0
**最后更新**: 2025-01-01
**维护人员**: 开发团队
