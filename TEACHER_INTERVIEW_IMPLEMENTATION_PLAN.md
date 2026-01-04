# 教师面试流程 - 完整实现计划

## 现状 vs 完整流程对比

### 当前实现（不完整）
```
新建候选人 ──→ 约面信息 ──→ 编辑候选人 ──→ 复核状态 ──→ 招聘决定
           (基础)        (缺评价)      (缺评分)     (缺薪资)
```

### 目标完整流程
```
Step 1: 约面
├─ 基本信息：候选人称呼、微信号、简历、形象照
├─ 岗位需求：年级段、教授学科、老师类型、试讲科目
└─ 约面时间：约面日期、约面人、面试官、面试链接

Step 2: 面试进行
├─ 面试评分（5个子项）
│  ├─ 总体面试评分
│  ├─ 逻辑表达能力
│  ├─ 礼仪着装/精神面貌
│  ├─ 课件准备充分度
│  └─ 中高考分数（得分/满分）
├─ 面试录像：视频链接
├─ 面试异常：异常情况记录
└─ 初试评价：第一印象记录

Step 3: 素质评价
├─ 普通话水平
├─ 教研能力
├─ 服务意识
├─ 亲和力
├─ 老师特点描述
└─ 老师感觉（松弛自信、不浮躁、落落大方）

Step 4: 教学复核（复核官进行）
├─ 复核状态：待复核/已复核/不符合
├─ 复核结果：复核意见
├─ 复核评价：定薪评价
├─ 复核日期：自动填充
├─ 复核人：自动填充当前用户
└─ 试讲视频：上传链接（可选）

Step 5: 谈薪入库
├─ 目前课时费：候选人当前要价
├─ 谈定时薪：公司批准的课时费
├─ 老师级别：初级/中级/高级
├─ 能否排毕业班：是否具备资质
├─ 入库备注：入库前备注
└─ 是否入库：标记为已录用

Step 6: 入库（可选）
└─ 调用ClassIn API入库 → 获得ClassIn UID
```

---

## 详细实现任务

### Task 1: 完善新建页面（/teacher-candidates/new）

**当前情况**：弹窗，展示基础信息+约面信息
**目标**：添加形象照上传+验证逻辑

```typescript
新建页面改造：
┌─────────────────────────────────────────┐
│ 新增老师面试                              │
├─────────────────────────────────────────┤
│ 📋 基本信息                               │
│  ├─ 候选人称呼（必填）                    │
│  ├─ 微信号（必填）                        │
│  ├─ 简历上传（必填）                      │
│  └─ 形象照上传（可选）                    │
│                                           │
│ 👥 岗位信息                               │
│  ├─ 年级段                                │
│  ├─ 教授学科（多选）                      │
│  ├─ 老师类型                              │
│  └─ 试讲科目                              │
│                                           │
│ 📅 约面信息                               │
│  ├─ 面试时间                              │
│  ├─ 约面人                                │
│  ├─ 面试链接                              │
│  └─ 面试官                                │
│                                           │
│         [取消]  [保存]                    │
└─────────────────────────────────────────┘
```

**改动**：
- 添加形象照上传字段（profile_photo_url）
- 完善验证：名字+微信号+简历必填

---

### Task 2: 编辑页面拆分为多个Tab（重要！）

**当前情况**：单页面form，滚动很长
**目标**：Tab式设计，逻辑清晰

```typescript
编辑候选人：张三 [面试进行中]
├─ Tab 1: 基本信息 ✅ (已完成)
│  ├─ 候选人称呼
│  ├─ 微信号
│  ├─ 简历/形象照
│  ├─ 年级/学科
│  └─ 老师类型
│
├─ Tab 2: 面试评分 ⚠️ (待实现)
│  ├─ 面试总分 [     ]
│  ├─ 逻辑表达能力 [     ]
│  ├─ 礼仪着装/精神面貌 [     ]
│  ├─ 课件准备充分度 [     ]
│  ├─ 中高考分数 [    /    ]
│  ├─ 面试异常 [        ]
│  ├─ 面试录像 [   文件上传   ]
│  └─ 初试评价 [   文本框    ]
│
├─ Tab 3: 素质评价 ⚠️ (待实现)
│  ├─ 普通话水平 [    ]
│  ├─ 教研能力 [    ]
│  ├─ 服务意识 [    ]
│  ├─ 亲和力 [    ]
│  ├─ 老师特点 [   文本框   ]
│  └─ 老师感觉 [   文本框   ]
│
├─ Tab 4: 复核流程 ⚠️ (需改进)
│  ├─ 复核状态 [待复核 ▼]
│  ├─ 复核结果 [    ]
│  ├─ 复核评价 [    ]
│  ├─ 试讲视频 [  文件  ]
│  └─ [复核人：系统自动  复核日期：系统自动]
│
└─ Tab 5: 谈薪入库 ⚠️ (需改进)
   ├─ 目前课时费 [    元/小时]
   ├─ 谈定时薪 [    元/小时]
   ├─ 老师级别 [初级 ▼]
   ├─ 能否排毕业班 ☐
   ├─ 入库备注 [    ]
   └─ 是否入库 ☐ [标记已录用]
```

---

### Task 3: 添加字段到数据库schema（如需要）

检查缺失字段：

```sql
-- 已有字段，无需添加：
✅ interview_score, logical_expression_score, dress_appearance_score, material_preparation_score
✅ exam_score, interview_exception, initial_evaluation
✅ teacher_characteristics, mandarin_level, research_ability, service_awareness, affinity
✅ video_recording_url, trial_video_url, qr_code_url
✅ current_rate, approved_hourly_rate
✅ review_date, reviewed_by
✅ teacher_feeling, suitable_for_students, scheduling_preference

无需新增字段！所有字段都已在数据库中
```

---

### Task 4: 编辑面试编辑页面的service层

**文件**：`lib/services/teacherCandidates.ts`

```typescript
// 需要扩展的类型定义
export interface TeacherCandidate {
  // ... 现有字段
  
  // Phase 2：面试评分
  interview_score?: number
  logical_expression_score?: number
  dress_appearance_score?: number
  material_preparation_score?: number
  exam_score?: string
  interview_exception?: string
  initial_evaluation?: string
  video_recording_url?: string
  
  // Phase 3：素质评价
  teacher_characteristics?: string
  mandarin_level?: string
  research_ability?: string
  service_awareness?: string
  affinity?: string
  teacher_feeling?: string
  suitable_for_students?: string
  scheduling_preference?: string
  
  // Phase 4：面试过程
  trial_video_url?: string
  
  // Phase 5：薪资
  current_rate?: number
  approved_hourly_rate?: number
  
  // Phase 5：复核
  review_date?: string
  reviewed_by?: string
}
```

---

### Task 5: UI组件实现（React组件）

#### 子组件结构
```
EditTeacherCandidate
├─ Tabs (shadcn/ui)
│  ├─ BasicInfoTab         ✅ (已有)
│  ├─ InterviewScoreTab    ⚠️  (新建)
│  ├─ QualityEvaluationTab ⚠️  (新建)
│  ├─ ReviewTab            ⚠️  (改进)
│  └─ SalaryHiringTab      ⚠️  (改进)
│
├─ FormContextProvider     ⚠️  (新建，共享formData)
└─ VideoUploadModal        ⚠️  (新建，用于上传视频)
```

#### Task 5.1：InterviewScoreTab 组件
```typescript
function InterviewScoreTab({ formData, onInputChange }) {
  return (
    <div className="space-y-4">
      <h3>面试评分</h3>
      
      {/* 5个评分项，1-10分 */}
      <ScoreInput
        label="总体面试评分"
        value={formData.interview_score}
        onChange={(v) => onInputChange('interview_score', v)}
        min={0} max={10}
      />
      
      <ScoreInput
        label="逻辑表达能力"
        value={formData.logical_expression_score}
        onChange={(v) => onInputChange('logical_expression_score', v)}
      />
      
      {/* 类似... */}
      
      {/* 中高考分数 */}
      <div className="flex gap-4">
        <Input 
          placeholder="得分" 
          value={formData.exam_score?.split('/')[0]}
        />
        <span>/</span>
        <Input 
          placeholder="满分" 
          value={formData.exam_score?.split('/')[1]}
        />
      </div>
      
      {/* 面试异常 */}
      <Textarea
        label="面试异常"
        placeholder="如有异常情况请记录"
        value={formData.interview_exception}
      />
      
      {/* 初试评价 */}
      <Textarea
        label="初试评价"
        placeholder="第一印象和初步评价"
        value={formData.initial_evaluation}
      />
      
      {/* 面试录像上传 */}
      <FileUpload
        label="面试录像"
        accept="video/*"
        onUpload={async (file) => {
          const url = await uploadFile(file, 'interview-videos')
          onInputChange('video_recording_url', url)
        }}
        value={formData.video_recording_url}
      />
    </div>
  )
}
```

#### Task 5.2：QualityEvaluationTab 组件
```typescript
function QualityEvaluationTab({ formData, onInputChange }) {
  return (
    <div className="space-y-4">
      <h3>素质评价</h3>
      
      {/* 4个下拉选项 */}
      <SelectField
        label="普通话水平"
        options={['一级甲等', '一级乙等', '二级甲等', '二级乙等', '三级']}
        value={formData.mandarin_level}
        onChange={(v) => onInputChange('mandarin_level', v)}
      />
      
      <SelectField
        label="教研能力"
        options={['强', '较强', '一般', '较弱']}
        value={formData.research_ability}
      />
      
      <SelectField
        label="服务意识"
        options={['强', '较强', '一般', '较弱']}
        value={formData.service_awareness}
      />
      
      <SelectField
        label="亲和力"
        options={['强', '较强', '一般', '较弱']}
        value={formData.affinity}
      />
      
      {/* 两个大文本框 */}
      <Textarea
        label="老师特点"
        placeholder="描述候选人的特点"
        value={formData.teacher_characteristics}
      />
      
      <Textarea
        label="老师感觉"
        placeholder="松弛自信、不浮躁、落落大方等"
        value={formData.teacher_feeling}
      />
      
      {/* 两个补充字段 */}
      <Textarea
        label="适合学生"
        placeholder="适合什么类型的学生"
        value={formData.suitable_for_students}
      />
      
      <Textarea
        label="排课偏好"
        placeholder="排课时间偏好、其他要求等"
        value={formData.scheduling_preference}
      />
    </div>
  )
}
```

#### Task 5.3：ReviewTab 组件（改进）
```typescript
function ReviewTab({ formData, onInputChange, currentUser }) {
  return (
    <div className="space-y-4">
      <h3>教学复核</h3>
      
      {/* 复核人和日期自动填充 */}
      <Alert>
        <AlertDescription>
          复核人：{currentUser.name} | 复核日期：{new Date().toLocaleDateString()}
        </AlertDescription>
      </Alert>
      
      <SelectField
        label="复核状态"
        options={['待复核', '已复核', '不符合']}
        value={formData.review_status}
        onChange={(v) => {
          onInputChange('review_status', v)
          onInputChange('review_date', new Date().toISOString().split('T')[0])
          onInputChange('reviewed_by', currentUser.id)
        }}
      />
      
      <Textarea
        label="复核结果"
        placeholder="复核意见"
        value={formData.review_result}
      />
      
      <Textarea
        label="复核评价（定薪参考）"
        placeholder="定薪时的评价建议"
        value={formData.review_evaluation_comment}
      />
      
      {/* 试讲视频上传 */}
      <FileUpload
        label="试讲视频（可选）"
        accept="video/*"
        onUpload={async (file) => {
          const url = await uploadFile(file, 'trial-videos')
          onInputChange('trial_video_url', url)
        }}
        value={formData.trial_video_url}
      />
    </div>
  )
}
```

#### Task 5.4：SalaryHiringTab 组件（改进）
```typescript
function SalaryHiringTab({ formData, onInputChange }) {
  return (
    <div className="space-y-4">
      <h3>谈薪入库</h3>
      
      <NumberInput
        label="目前课时费"
        suffix="元/小时"
        value={formData.current_rate}
        onChange={(v) => onInputChange('current_rate', v)}
      />
      
      <NumberInput
        label="谈定时薪"
        suffix="元/小时"
        value={formData.approved_hourly_rate}
        onChange={(v) => onInputChange('approved_hourly_rate', v)}
      />
      
      <SelectField
        label="老师级别"
        options={['初级', '中级', '高级']}
        value={formData.teacher_level}
      />
      
      <CheckboxField
        label="能否排毕业班"
        checked={formData.can_teach_graduation_class}
        onChange={(v) => onInputChange('can_teach_graduation_class', v)}
      />
      
      <Textarea
        label="入库备注"
        placeholder="入库前的备注说明"
        value={formData.hired_notes}
      />
      
      <CheckboxField
        label="是否入库（标记为已录用）"
        checked={formData.is_hired}
        onChange={(v) => onInputChange('is_hired', v)}
      />
      
      {/* 如果是已复核 && 已录用，显示入库按钮 */}
      {formData.review_status === '已复核' && formData.is_hired && (
        <Button 
          className="w-full bg-green-600"
          onClick={() => handleRegisterToClassIn(formData)}
        >
          <Upload className="mr-2 h-4 w-4" />
          入库到ClassIn
        </Button>
      )}
    </div>
  )
}
```

---

## 实现时间表

| Phase | 任务 | 工作量 | 优先级 |
|-------|------|--------|--------|
| 1 | Task 1: 新建页面改造（+形象照） | 1天 | 🔴 高 |
| 2 | Task 2: 编辑页面改为Tab式 | 2天 | 🔴 高 |
| 2 | Task 5.1: InterviewScoreTab | 1.5天 | 🔴 高 |
| 2 | Task 5.2: QualityEvaluationTab | 1天 | 🔴 高 |
| 3 | Task 5.3: ReviewTab改进 | 0.5天 | 🟠 中 |
| 3 | Task 5.4: SalaryHiringTab改进 | 0.5天 | 🟠 中 |
| - | Task 4: Service层扩展 | 1天 | 🔴 高 |

**总计**：约7-8天

---

## 分阶段发布计划

### v1.0（第一周）
- Tab 1: 基本信息 ✅
- Tab 2: 面试评分（新）
- Tab 3: 素质评价（新）
- Tab 4: 复核流程（改进）
- Tab 5: 谈薪入库（改进）

### v1.1（第二周可选）
- 自动计算总分
- 评分模板预设
- 批量上传视频
- 评价建议AI生成

---

## 代码组织

```
components/
├─ dashboard/
│  ├─ teacher-candidates/
│  │  ├─ BasicInfoTab.tsx         (新)
│  │  ├─ InterviewScoreTab.tsx     (新)
│  │  ├─ QualityEvaluationTab.tsx  (新)
│  │  ├─ ReviewTab.tsx            (新)
│  │  ├─ SalaryHiringTab.tsx       (新)
│  │  ├─ VideoUploadModal.tsx      (新)
│  │  └─ FormContext.tsx           (新)
│  └─ ...
│
lib/
├─ services/
│  └─ teacherCandidates.ts        (扩展)
│
app/
├─ dashboard/
│  └─ teacher-candidates/
│     ├─ [id]/edit/page.tsx        (改进，使用Tab)
│     └─ new/page.tsx              (改进，+形象照)
```

开始吧？建议从 **Task 1** 和 **Task 2** 开始。
