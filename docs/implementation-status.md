# 系统实现状态清单

**生成时间**: 2025-01-01
**文档版本**: v1.0

---

## 📊 总体进度

| 分类 | 规划数量 | 已实现 | 未实现 | 完成率 |
|------|---------|-------|--------|--------|
| **页面** | 21 | 11 | 10 | 52% |
| **数据表** | 30 | 17 | 13 | 57% |
| **状态计算器** | 5 | 0 | 5 | 0% |
| **权限系统** | 1 | 部分 | - | 30% |

---

## 1. 页面实现状态

### ✅ 已实现页面 (11个)

#### 1.1 运营管理
- ✅ `/dashboard/leads/new` - 线索录入页面

#### 1.2 销售管理
- ✅ `/dashboard/leads` - 线索管理列表
- ✅ `/dashboard/leads/[id]/edit` - 线索编辑

#### 1.3 订单管理
- ✅ `/dashboard/formal-orders` - 正式订单列表
- ✅ `/dashboard/formal-orders/new` - 新建正式订单
- ✅ `/dashboard/formal-orders/[id]/edit` - 编辑正式订单

#### 1.4 学生与老师管理
- ✅ `/dashboard/students` - 学生列表
- ✅ `/dashboard/students/new` - 新建学生
- ✅ `/dashboard/students/[id]/edit` - 编辑学生

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
- ✅ `/dashboard/transactions` - 异动记录
- ✅ `/dashboard/classin-sdk` - ClassIn SDK配置

#### 1.7 已废弃
- ⚠️ `/dashboard/wechat-accounts` - 微信号管理(已废弃，改用user_profiles)
- ⚠️ `/dashboard/daily-leads` - 每日线索(功能已合并到leads)

---

### ❌ 未实现页面 (10个)

#### 2.1 销售管理 (1个)
- ❌ `/dashboard/trial-lessons` - **试听课程管理**
  - 试听课程列表
  - 试听详情页
  - 试听状态流转

#### 2.2 学生管理 (1个)
- ❌ `/dashboard/students/[id]` - **学生详情页**
  - 学生档案详情
  - 批量排课功能
  - 课时管理
  - 回访管理

#### 2.3 老师面试 (4个)
- ❌ `/dashboard/teacher-candidates/interview` - **老师约面页面**
- ❌ `/dashboard/teacher-candidates/upload` - **初试录像上传页面**
- ❌ `/dashboard/teacher-candidates/review` - **教学复核页面**
- ❌ `/dashboard/teacher-candidates/pending` - **待入库页面**
- ❌ `/dashboard/teacher-candidates/reserve` - **储备候选人页面**

#### 2.4 老师库 (4个)
- ❌ `/dashboard/teachers/teaching` - **老师库（教学版）**
- ❌ `/dashboard/teachers/sales` - **老师库（销售版，只读）**
- ❌ `/dashboard/teachers/exceptions` - **新入库异常页面**

#### 2.5 质检系统 (2个)
- ❌ `/dashboard/quality/trial-conversion` - **试听转化质检页面**
- ❌ `/dashboard/quality/service` - **课后服务质检页面**

#### 2.6 教务管理 (2个)
- ❌ `/dashboard/academic/students` - **学生库（教务版）**
- ❌ `/dashboard/academic/pending-trials` - **待试听匹配页面**

---

## 2. 数据表实现状态

### ✅ 已存在的表 (17张)

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
```

---

### ❌ 缺失的表 (13张)

来自 `docs/database-design.md`:

#### 2.1 学生档案增强 (1张)
- ❌ `student_profiles` - 学生详细档案
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
- ❌ `courses` - 课程详细排课
- ❌ `class_sessions` - 具体课次
- ❌ `class_schedules` - 课程日历

#### 2.3 回访管理 (1张)
- ❌ `visit_records` - 回访记录
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
- ❌ `interview_arrangements` - 约面安排
- ❌ `interview_sessions` - 面试记录
- ❌ `interview_scores` - 面试评分
- ❌ `teacher_characteristics` - 老师素质评价
- ❌ `review_records` - 复核记录
- ❌ `hire_records` - 入库记录

**说明**: 当前`teacher_candidates`表包含了面试全流程，应该拆分为多个子表。

#### 2.5 质检系统 (1张)
- ❌ `quality_reports` - 质检报告
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
- ❌ `todos` - 待办事项
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

### ❌ 未实现 (5个)

来自 `docs/business-status-rules.md`:

#### 3.1 线索状态计算器
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
```typescript
export function calculateStudentStatus(student: Student): StudentStatus {
  // 'missing' | 'running_out' | 'visited' | 其他
}

export function calculateNewStudentStatus(student: Student): NewStudentStatus {
  // 'week_1' | 'week_2' | 'week_3' | 'week_4' | 'old_student'
}
```

#### 3.4 面试流程状态计算器
```typescript
export function calculateInterviewStatus(candidate: TeacherCandidate): InterviewStatus {
  // 'pending_interview' | 'interview_scheduled' | 'waiting_review' |
  // 'approved' | 'rejected' | 'reserved'
}
```

#### 3.5 退费流程状态计算器
```typescript
export function calculateRefundStatus(transaction: TransactionRecord): RefundStatus {
  // 'pending_verification' | 'pending_payment' |
  // 'pending_performance_verification' | 'completed'
}
```

---

## 4. 权限系统实现状态

### ⚠️ 部分实现 (30%)

#### 已完成:
- ✅ `lib/permissions.ts` - 权限定义文档已创建
- ✅ `docs/role-permissions.md` - 角色权限文档完整
- ✅ 基础角色字段 (user_profiles.role)

#### 未完成:
- ❌ `lib/hooks/usePermission.ts` - 权限Hook
  ```typescript
  export function usePermission() {
    const { user } = useCurrentUser();
    return {
      can: (resource, action) => hasPermission(user.role, resource, action),
      canCreate: (resource) => hasPermission(user.role, resource, 'create'),
      canRead: (resource) => hasPermission(user.role, resource, 'read'),
      canUpdate: (resource) => hasPermission(user.role, resource, 'update'),
      canDelete: (resource) => hasPermission(user.role, resource, 'delete'),
    };
  }
  ```

- ❌ API层权限中间件
- ❌ 前端页面权限控制(按钮级别)
- ❌ Supabase RLS策略配置

---

## 5. 核心业务功能实现状态

### 5.1 试听匹配流程
**状态**: ❌ 未实现

**缺失功能**:
- 待试听匹配页面 `/dashboard/academic/pending-trials`
- 老师推荐算法(基于学科、年级、时间)
- 批量匹配功能
- 生成上课链接

**涉及表**: `trial_lessons`, `teacher_profiles`

---

### 5.2 退费流程
**状态**: ⚠️ 部分实现

**已有**:
- ✅ `transaction_records` 表
- ✅ `/dashboard/transactions` 页面

**缺失**:
- ❌ 退费状态流转(4个状态)
- ❌ 教务核对金额功能
- ❌ 财务打款功能
- ❌ 人力业绩核对功能
- ❌ 状态计算器

---

### 5.3 面试流程
**状态**: ⚠️ 部分实现

**已有**:
- ✅ `teacher_candidates` 表(但字段太全，应拆分)
- ✅ `/dashboard/teacher-candidates` 列表页

**缺失**:
- ❌ 面试流程拆分为6个子表
- ❌ 约面功能
- ❌ 录像上传
- ❌ 教学复核
- ❌ 入库流程
- ❌ 状态流转

---

### 5.4 批量排课
**状态**: ❌ 未实现

**缺失**:
- ❌ `courses` 表
- ❌ `class_sessions` 表
- ❌ `class_schedules` 表
- ❌ 批量排课UI
- ❌ 排课规则引擎
- ❌ 冲突检测

---

### 5.5 回访管理
**状态**: ❌ 未实现

**缺失**:
- ❌ `visit_records` 表
- ❌ 回访记录列表
- ❌ 新增回访表单
- ❌ 回访日历视图
- ❌ 回访提醒

---

### 5.6 质检系统
**状态**: ❌ 未实现

**缺失**:
- ❌ `quality_reports` 表
- ❌ 试听转化质检页面
- ❌ 课后服务质检页面
- ❌ 质检评分标准
- ❌ 质检报告生成

---

### 5.7 待办事项
**状态**: ❌ 未实现

**缺失**:
- ❌ `todos` 表
- ❌ 待办列表页面
- ❌ 创建待办表单
- ❌ 完成待办
- ❌ 提醒设置

---

## 6. 技术债务

### 6.1 架构问题
1. **试听订单 vs 正式订单**: 已确认分开存储 ✅
2. **teacher_candidates表**: 包含面试全流程，应拆分为6个子表
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
1. **RLS策略**: Supabase Row Level Security未完善配置
2. **API安全**: 缺少Rate Limiting
3. **输入验证**: 缺少统一的数据验证

---

## 7. 优先级建议

### 🔴 P0 - 核心业务功能 (必须)
1. **试听课程状态计算器** - 核心流程
2. **试听课程管理页面** - 销售和教务高频使用
3. **待试听匹配页面** - 教务核心工作
4. **线索状态计算器** - 运营和销售核心指标
5. **权限系统完善** - 基础安全

### 🟡 P1 - 重要功能 (应该)
6. **回访管理系统** - 学生服务关键
7. **批量排课功能** - 教务效率工具
8. **面试流程拆分** - 老师招聘优化
9. **学生详情页** - 班主任日常工作
10. **状态计算器(学生/面试/退费)** - 完善业务逻辑

### 🟢 P2 - 增强功能 (可以)
11. **质检系统** - 质量保障
12. **待办事项系统** - 任务管理
13. **老师库细分页面** - 用户体验优化
14. **学生库(教务版)** - 数据分析
15. **性能优化** - 提升用户体验

---

## 8. 下一步行动建议

### 第一阶段: 补齐核心页面 (2周)
1. 创建 `/dashboard/trial-lessons` 页面
2. 创建 `/dashboard/academic/pending-trials` 页面
3. 创建状态计算器 `lib/status-calculator.ts`
4. 完善权限系统 `lib/hooks/usePermission.ts`

### 第二阶段: 补齐核心数据表 (2周)
1. 创建 `student_profiles` 表
2. 创建 `visit_records` 表
3. 创建 `courses`, `class_sessions`, `class_schedules` 表
4. 数据迁移和验证

### 第三阶段: 实现核心流程 (2周)
1. 试听匹配流程
2. 回访管理流程
3. 批量排课流程
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
