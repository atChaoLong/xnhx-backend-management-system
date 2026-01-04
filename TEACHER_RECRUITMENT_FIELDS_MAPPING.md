# 教师招聘系统 - 完整字段映射表

## 1. 招聘流程字段（teacher_candidates 表）

### 1.1 基本信息
| 字段名 | 数据库字段 | 是否必填 | 类型 | 说明 |
|--------|-----------|---------|------|------|
| 候选人称呼 | name | ✅ | TEXT | 候选老师的姓名 |
| 微信号（必填） | wechat_id | ✅ | TEXT | 用于联系的微信号，UNIQUE |
| 简历 | resume_url | ✅ | TEXT | 简历文件URL |
| 形象照 | profile_photo_url | ❌ | TEXT | 候选人照片 |
| 父记录 | daily_lead_id | ❌ | UUID | 关联的每日线索ID |

### 1.2 岗位需求信息
| 字段名 | 数据库字段 | 是否必填 | 类型 | 说明 |
|--------|-----------|---------|------|------|
| 年级段 | grade_level | ❌ | TEXT | 拟招聘年级，单选 |
| 教授学科 | subjects_taught | ❌ | TEXT[] | 拟招聘科目，可多选 |
| 老师类型 | teacher_type | ❌ | TEXT | 全职/兼职/实习等 |
| 试讲科目 | trial_subject | ❌ | TEXT | 试讲指定科目 |

### 1.3 约面信息
| 字段名 | 数据库字段 | 是否必填 | 类型 | 说明 |
|--------|-----------|---------|------|------|
| 约面日期 | interview_date | ❌ | DATE | 约定面试日期 |
| 约面时间 | interview_time | ❌ | TIME | 约定面试时间 |
| 约面人（总） | interview_officer | ❌ | TEXT | 负责约面的人员 |
| 面试链接 | interview_link | ❌ | TEXT | 线上面试链接 |
| 面试官（总） | interviewer_name | ❌ | TEXT | 面试官名字 |
| 面试异常 | interview_exception | ❌ | TEXT | 面试中出现的异常情况 |

### 1.4 面试过程
| 字段名 | 数据库字段 | 是否必填 | 类型 | 说明 |
|--------|-----------|---------|------|------|
| 面试录像 | video_recording_url | ❌ | TEXT | 面试录像URL |
| 面试录像（链接版） | video_recording_url | ❌ | TEXT | 同上（备用字段名） |
| 试讲视频 | trial_video_url | ❌ | TEXT | 试讲视频URL |
| 二维码 | qr_code_url | ❌ | TEXT | 二维码信息 |

### 1.5 面试评分
| 字段名 | 数据库字段 | 是否必填 | 类型 | 说明 |
|--------|-----------|---------|------|------|
| 面试评分表 | interview_score | ❌ | DECIMAL(5,2) | 总体面试分数 |
| 面试评分表总分 | interview_score | ❌ | DECIMAL(5,2) | 总分（同上） |
| 逻辑表达能力 | logical_expression_score | ❌ | DECIMAL(5,2) | 逻辑表达评分 |
| 礼仪着装/精神面貌 | dress_appearance_score | ❌ | DECIMAL(5,2) | 仪表礼仪评分 |
| 课件准备充分度 | material_preparation_score | ❌ | DECIMAL(5,2) | 课件准备评分 |
| 中高考分数（得分/满分） | exam_score | ❌ | TEXT | 考试成绩记录 |

### 1.6 素质评价
| 字段名 | 数据库字段 | 是否必填 | 类型 | 说明 |
|--------|-----------|---------|------|------|
| 初试评价 | initial_evaluation | ❌ | TEXT | 初步评价意见 |
| 老师特点 | teacher_characteristics | ❌ | TEXT | 候选人特点描述 |
| 普通话水平 | mandarin_level | ❌ | TEXT | 普通话水平等级 |
| 教研能力 | research_ability | ❌ | TEXT | 教研能力评估 |
| 服务意识 | service_awareness | ❌ | TEXT | 服务意识评估 |
| 亲和力 | affinity | ❌ | TEXT | 亲和力评分 |

### 1.7 复核流程
| 字段名 | 数据库字段 | 是否必填 | 类型 | 说明 |
|--------|-----------|---------|------|------|
| 复核状态（勿填） | review_status | ❌ | TEXT | 待复核/已复核/不符合（自动） |
| 复核结果 | review_result | ❌ | TEXT | 复核意见 |
| 复核评价（定薪） | review_evaluation_comment | ❌ | TEXT | 复核详细评价 |
| 复核日期 | review_date | ❌ | DATE | 复核日期 |
| 复核人 | reviewed_by | ❌ | UUID | 复核人员ID |

### 1.8 薪资信息
| 字段名 | 数据库字段 | 是否必填 | 类型 | 说明 |
|--------|-----------|---------|------|------|
| 目前课时费 | current_rate | ❌ | DECIMAL(10,2) | 候选人目前课时费 |
| 时薪（谈定） | approved_hourly_rate | ❌ | DECIMAL(10,2) | 谈定的每小时费率 |

### 1.9 招聘决定
| 字段名 | 数据库字段 | 是否必填 | 类型 | 说明 |
|--------|-----------|---------|------|------|
| 是否入库 | is_hired | ❌ | BOOLEAN | 是否被录用 |
| 老师感觉（松弛自信、不浮躁、落落大方） | teacher_feeling | ❌ | TEXT | 候选人气质描述 |
| 适合学生 | suitable_for_students | ❌ | TEXT | 适合的学生类型 |
| 排课偏好 | scheduling_preference | ❌ | TEXT | 排课时间偏好 |
| 入库备注 | hired_notes | ❌ | TEXT | 录用备注 |
| 老师级别 | teacher_level | ❌ | TEXT | 初级/中级/高级 |
| 能否排毕业班 | can_teach_graduation_class | ❌ | BOOLEAN | 是否可以教毕业班 |

### 1.10 时间戳
| 字段名 | 数据库字段 | 是否必填 | 类型 | 说明 |
|--------|-----------|---------|------|------|
| 登记日期 | registration_date | ❌ | DATE | 登记日期 |
| 面试月份 | interview_month | ❌ | TEXT | 面试月份 |
| 面试所属周 | interview_week | ❌ | INTEGER | 面试周数 |
| 约面所属周 | - | ❌ | - | 不存在，需要新增？ |

---

## 2. 已入库老师档案字段（teacher_profiles 表）

| 字段名 | 数据库字段 | 说明 |
|--------|-----------|------|
| 入表老师（选择） | teacher_name | 已入库老师姓名，从candidates迁移 |
| 性别 | gender | 性别 |
| 微信号 | wechat | 微信号 |
| 所在地 | location | 所在地 |
| 学科（可多选） | subjects | 教授科目 |
| 年级（可多选） | grade_levels | 教授年级 |
| 教学年限 | teaching_years | 教龄 |
| 学历 | education | 最高学历 |
| 毕业院校 | university | 毕业大学 |
| 是否有教资证 | has_certificate | 教资证书 |
| 是否用过ClassIn | used_classin | ClassIn使用经验 |
| 教材版本 | textbook_versions | 熟悉的教材版本 |
| 带过学生地域 | student_regions | 教学地域 |
| 擅长学生水平 | student_levels | 擅长的学生层次 |
| 可排课时间 | available_times | 可排课时间 |
| 教学特点 | teaching_style | 教学方法特色 |
| 成功案例 | success_cases | 优秀学生案例 |
| 形象照 | photo_url | 老师头像 |
| 提分/好评截图 | review_screenshots | 学生反馈截图 |
| 银行卡号等 | bank_card_info | JSON结构的银行信息 |
| 备注 | notes | 其他备注 |

---

## 3. 字段缺失分析

### 3.1 teacher_candidates 中存在但未在UI中实现
```
✅ 已实现：
- name, wechat_id, resume_url, profile_photo_url
- grade_level, subjects_taught, teacher_type, trial_subject, teaching_style
- interview_date, interviewer_name, interview_time, interview_link, interview_officer
- review_status, review_result, review_evaluation_comment
- is_hired, teacher_level, can_teach_graduation_class

❌ 未实现：
- initial_evaluation（初试评价）
- teacher_characteristics（老师特点）
- mandarin_level（普通话水平）
- research_ability（教研能力）
- service_awareness（服务意识）
- affinity（亲和力）
- interview_exception（面试异常）
- interview_month, interview_week, registration_date（时间戳）
- interview_score, logical_expression_score, dress_appearance_score, material_preparation_score（评分）
- exam_score（中高考分数）
- current_rate, approved_hourly_rate（薪资）
- teacher_feeling, suitable_for_students, scheduling_preference, hired_notes（招聘决定详情）
- review_date, reviewed_by（复核时间和复核人）
- video_recording_url, trial_video_url, qr_code_url（视频和二维码）
```

### 3.2 teacher_profiles 中存在但未有关联
该表的所有字段都是针对**已入库老师**，需要在流程第4步（谈薪入库）时迁移候选人信息。

---

## 4. 实现优先级

### Phase 1（必须）- 基础招聘流程
- [x] 候选人称呼、微信号、简历、年级段、教授学科
- [x] 约面信息（日期、时间、约面人、面试官、面试链接）
- [x] 复核流程（复核状态、复核结果、复核评价）
- [x] 招聘决定（是否入库、老师级别、毕业班）

### Phase 2（重要）- 详细评价
- [ ] 面试评分（总分、逻辑表达、礼仪着装、课件准备）
- [ ] 素质评价（普通话、教研能力、服务意识、亲和力）
- [ ] 初试评价和老师特点
- [ ] 面试异常记录

### Phase 3（关键）- 视频和费用
- [ ] 面试录像URL
- [ ] 试讲视频URL
- [ ] 目前课时费和谈定时薪

### Phase 4（完善）- 其他信息
- [ ] 形象照上传
- [ ] 二维码生成
- [ ] 时间戳自动填充
- [ ] 中高考分数记录

---

## 5. 数据流向

```
新建候选人
  ↓
(phase 1) 填写基础约面信息 → 状态：待联系
  ↓
(phase 2) 上传面试视频 → 状态：待复核
  ↓
(phase 2) 复核人评价 → 状态：已复核/不符合
  ↓
(phase 3) HR填写薪资 → 状态：待入库
  ↓
(phase 3) 点击"入库"按钮
  ↓
创建 teacher_profiles 记录 + 调用ClassIn API
  ↓
(自动) teacher_profiles 同步到 teachers（ClassIn数据）
  ↓
完成
```
