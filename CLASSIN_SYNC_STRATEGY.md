# ClassIn 数据同步策略

## 概述

本文档说明如何将本系统中的学生、老师库与 ClassIn 平台进行双向打通。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                      本系统（Xiaoniuhaoxue）                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  students (学生表)          teachers (老师表)                     │
│  ├─ id (UUID)              ├─ id (UUID)                          │
│  ├─ student_name           ├─ name                               │
│  ├─ parent_phone           ├─ mobile                             │
│  ├─ grade_code             ├─ subject                            │
│  ├─ classin_uid ◄──────────┼─ classin_uid                        │
│  │  (关键：ClassIn映射)     │  (关键：ClassIn映射)                 │
│  └─ ...                    └─ ...                                │
│                                                                 │
│         ⬆️ 同步 ⬇️              ⬆️ 同步 ⬇️                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ ClassIn API
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     ClassIn 平台（线上）                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ClassIn Teachers           ClassIn Students                     │
│  (teacher_classin 镜像)      (students_classin 镜像)              │
│  ├─ uid                     ├─ uid                               │
│  ├─ name                    ├─ name                              │
│  ├─ mobile                  ├─ mobile                            │
│  └─ ...                     └─ ...                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 数据表关系

### 学生端数据流
```
students (本地库)
  ├─ 主键：id (UUID)
  ├─ 核心字段：student_name, parent_phone, grade_code
  ├─ 关键关联字段：classin_uid BIGINT (ClassIn 学生唯一ID)
  └─ 关联到：students_classin 表（ClassIn原始数据镜像）

students_classin (ClassIn原始数据)
  ├─ 主键：uid (BIGINT) - ClassIn返回的原始uid
  ├─ 核心字段：name, mobile, email
  ├─ 分类信息：cat_info (JSON)
  └─ 额外字段：classin_extra (JSON)
```

### 老师端数据流
```
teachers (本地库)
  ├─ 主键：id (UUID)
  ├─ 核心字段：name, mobile, subject, grade
  ├─ 关键关联字段：classin_uid BIGINT (ClassIn 老师唯一ID)
  └─ 关联到：teacher_classin 表（ClassIn原始数据镜像）

teacher_classin (ClassIn原始数据)
  ├─ 主键：uid (BIGINT) - ClassIn返回的原始uid
  ├─ 核心字段：name, mobile, email, position
  ├─ 部门信息：departments_info (JSON)
  └─ 额外字段：classin_extra (JSON)
```

## 当前现状

### 已实现
- ✅ ClassIn API 集成（`lib/services/classin.ts`）
- ✅ 原始数据镜像表（`teacher_classin`, `students_classin`）
- ✅ 本地库表（`teachers`, `students`）
- ✅ ClassIn UID 字段映射

### 需要实现
- ⬜️ 同步管理后台（手动/自动同步）
- ⬜️ 数据映射规则引擎
- ⬜️ 冲突检测和解决机制
- ⬜️ 双向同步队列
- ⬜️ 更新通知机制
- ⬜️ 数据清理和去重逻辑

## 同步策略

### 1. 单向同步（从 ClassIn → 本地）

**适用场景**：初始化、主要信息来自 ClassIn

**流程**：
```
1. 获取 ClassIn 老师/学生列表（/api/classin/teachers, /api/classin/students）
2. 存储到镜像表（teacher_classin, students_classin）
3. 检查本地库中是否存在（通过 classin_uid）
   - 如存在：更新本地记录
   - 如不存在：创建新记录
4. 更新 sync_time 和状态
```

**实现示例**：
```typescript
// 从 ClassIn 同步老师到本地
async syncTeachersFromClassIn(cookie: string) {
  // 1. 登录 ClassIn
  await classInService.login(cookie)
  
  // 2. 获取老师列表
  const { list: classInTeachers } = await classInService.getTeachers({
    page: 1,
    pageSize: 1000
  })
  
  // 3. 保存到镜像表
  for (const teacher of classInTeachers) {
    await supabaseServer
      .from('teacher_classin')
      .upsert({
        uid: teacher.uid,
        name: teacher.name,
        mobile: teacher.mobile,
        email: teacher.email,
        // ... 其他字段
        sync_time: new Date()
      }, { onConflict: 'uid' })
  }
  
  // 4. 同步到本地库
  for (const teacher of classInTeachers) {
    const exists = await supabaseServer
      .from('teachers')
      .select('id')
      .eq('classin_uid', teacher.uid)
      .single()
    
    if (exists.data) {
      // 更新
      await supabaseServer
        .from('teachers')
        .update({
          name: teacher.name,
          mobile: teacher.mobile,
          email: teacher.email,
          sync_time: new Date()
        })
        .eq('classin_uid', teacher.uid)
    } else {
      // 创建
      await supabaseServer
        .from('teachers')
        .insert({
          name: teacher.name,
          mobile: teacher.mobile,
          classin_uid: teacher.uid,
          sync_time: new Date()
        })
    }
  }
}
```

### 2. 双向同步（本地 ⬌ ClassIn）

**适用场景**：本地库也需要维护，需要实时同步

**关键点**：
- 需要 ClassIn API 的写权限（注册、更新等）
- 需要冲突检测（最后修改时间）
- 需要事务性保证

**流程**：
```
A. 本地→ClassIn（本地优先）
   1. 检测到本地数据变化（通过 updated_at）
   2. 调用 ClassIn 注册/更新 API
   3. 获取返回的 uid
   4. 保存 classin_uid 到本地库
   5. 记录同步时间

B. ClassIn→本地（远程优先）
   1. 定期拉取 ClassIn 数据
   2. 比对 updated_at，检测远程更新
   3. 更新本地库
   4. 生成审计日志
```

### 3. 智能映射

**姓名匹配规则**：
```sql
-- 找到可能的重复记录
SELECT 
  l.id, l.student_name, l.parent_phone,
  c.uid, c.name, c.mobile,
  similarity(l.student_name, c.name) as name_match
FROM students l
CROSS JOIN students_classin c
WHERE 
  similarity(l.student_name, c.name) > 0.7  -- 相似度70%以上
  AND l.classin_uid IS NULL
ORDER BY name_match DESC
```

**手机号匹配**（最精确）：
```sql
SELECT 
  l.id, l.student_name, l.parent_phone,
  c.uid, c.name, c.mobile
FROM students l
JOIN students_classin c ON l.parent_phone = c.mobile
WHERE l.classin_uid IS NULL
```

## 实现计划

### 阶段 1：基础同步服务（第1周）
```
├─ 创建同步服务：lib/services/sync-service.ts
│  ├─ syncTeachersFromClassIn()
│  ├─ syncStudentsFromClassIn()
│  └─ detectDuplicates()
├─ 创建 API 路由：/api/sync
│  ├─ POST /api/sync/teachers - 同步老师
│  ├─ POST /api/sync/students - 同步学生
│  └─ GET /api/sync/status - 同步状态
└─ 创建前端页面：/dashboard/sync
   ├─ 手动同步按钮
   ├─ 同步历史记录
   └─ 冲突解决界面
```

### 阶段 2：智能匹配（第2周）
```
├─ 实现匹配算法
│  ├─ 姓名相似度匹配
│  ├─ 手机号精确匹配
│  └─ 多字段组合匹配
├─ 冲突检测和解决
├─ 人工审核流程
└─ 数据去重合并
```

### 阶段 3：自动同步（第3周）
```
├─ 实现同步队列（pg_queue）
├─ 定时任务（Cron）
├─ Webhook 监听
├─ 错误重试机制
└─ 同步日志和审计
```

## 代码示例

### 创建同步服务

```typescript
// lib/services/sync-service.ts
import { supabaseServer } from '@/lib/supabase'
import { classInService } from '@/lib/services/classin'
import { createLogger } from '@/lib/logger'

const logger = createLogger('SyncService')

export const syncService = {
  // 同步老师
  async syncTeachersFromClassIn(cookie: string) {
    try {
      logger.info('开始同步老师数据')
      
      // 1. 登录 ClassIn
      await classInService.login(cookie)
      
      // 2. 获取 ClassIn 老师列表
      const { list: classInTeachers, total } = await classInService.getTeachers({
        page: 1,
        pageSize: 1000
      })
      
      logger.info(`获取 ClassIn 老师 ${total} 条`)
      
      // 3. 保存到镜像表
      for (const teacher of classInTeachers) {
        await supabaseServer
          .from('teacher_classin')
          .upsert({
            uid: teacher.uid,
            st_id: teacher.stId,
            name: teacher.name,
            logo: teacher.logo,
            emp_no: teacher.empNo,
            position: teacher.position,
            mobile: teacher.mobile,
            email: teacher.email,
            account_status: teacher.accountStatus,
            is_del: teacher.isDel,
            join_type: teacher.joinType,
            departments_info: teacher.departmentsInfo,
            sync_time: new Date().toISOString(),
            classin_extra: teacher
          }, { 
            onConflict: 'uid'
          })
      }
      
      logger.info('老师镜像表更新完成')
      
      // 4. 同步到本地库（teachers）
      let created = 0, updated = 0
      
      for (const teacher of classInTeachers) {
        const { data: existing } = await supabaseServer
          .from('teachers')
          .select('id')
          .eq('classin_uid', teacher.uid)
          .single()
        
        if (existing) {
          // 更新
          await supabaseServer
            .from('teachers')
            .update({
              name: teacher.name,
              mobile: teacher.mobile,
              email: teacher.email,
              sync_time: new Date().toISOString()
            })
            .eq('classin_uid', teacher.uid)
          updated++
        } else {
          // 创建
          await supabaseServer
            .from('teachers')
            .insert({
              name: teacher.name,
              mobile: teacher.mobile,
              email: teacher.email,
              classin_uid: teacher.uid,
              tea_id: teacher.stId,
              sync_time: new Date().toISOString()
            })
          created++
        }
      }
      
      logger.info(`同步完成：新增 ${created}，更新 ${updated}`)
      
      return { success: true, created, updated, total }
    } catch (error: any) {
      logger.error('同步老师失败', { error: error.message })
      throw error
    }
  },

  // 同步学生
  async syncStudentsFromClassIn(cookie: string) {
    try {
      logger.info('开始同步学生数据')
      
      await classInService.login(cookie)
      
      const { list: classInStudents, total } = await classInService.getStudents({
        page: 1,
        pageSize: 1000
      })
      
      logger.info(`获取 ClassIn 学生 ${total} 条`)
      
      // 保存到镜像表
      for (const student of classInStudents) {
        await supabaseServer
          .from('students_classin')
          .upsert({
            uid: student.uid,
            stud_id: student.studId,
            name: student.name,
            mobile: student.mobile,
            email: student.email,
            account_status: student.accountStatus,
            isdel: student.isDel,
            sync_time: new Date().toISOString(),
            classin_extra: student
          }, {
            onConflict: 'uid'
          })
      }
      
      // 同步到本地库
      let created = 0, updated = 0
      
      for (const student of classInStudents) {
        const { data: existing } = await supabaseServer
          .from('students')
          .select('id')
          .eq('classin_uid', student.uid)
          .single()
        
        if (existing) {
          await supabaseServer
            .from('students')
            .update({
              student_name: student.name,
              parent_phone: student.mobile
            })
            .eq('classin_uid', student.uid)
          updated++
        } else {
          await supabaseServer
            .from('students')
            .insert({
              student_name: student.name,
              parent_phone: student.mobile,
              classin_uid: student.uid
            })
          created++
        }
      }
      
      return { success: true, created, updated, total }
    } catch (error: any) {
      logger.error('同步学生失败', { error: error.message })
      throw error
    }
  },

  // 检测重复/冲突
  async detectDuplicates() {
    // 学生重复检测
    const { data: studentDuplicates } = await supabaseServer
      .from('students')
      .select('parent_phone, count')
      .filter('parent_phone', 'neq', null)
      .rpc('count_duplicates_students')
    
    // 老师重复检测
    const { data: teacherDuplicates } = await supabaseServer
      .from('teachers')
      .select('mobile, count')
      .filter('mobile', 'neq', null)
      .rpc('count_duplicates_teachers')
    
    return {
      studentDuplicates: studentDuplicates || [],
      teacherDuplicates: teacherDuplicates || []
    }
  }
}
```

### 创建同步 API 路由

```typescript
// app/api/sync/teachers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { syncService } from '@/lib/services/sync-service'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:SyncTeachers')

export async function POST(request: NextRequest) {
  try {
    const { cookie } = await request.json()
    
    if (!cookie) {
      return NextResponse.json(
        { error: 'Cookie 为空' },
        { status: 400 }
      )
    }
    
    const result = await syncService.syncTeachersFromClassIn(cookie)
    
    return NextResponse.json({
      success: true,
      data: result,
      message: `同步完成：新增 ${result.created} 条，更新 ${result.updated} 条`
    })
  } catch (error: any) {
    logger.error('同步老师失败', { error: error.message })
    return NextResponse.json(
      { error: error.message || '同步失败' },
      { status: 500 }
    )
  }
}
```

## 安全注意

1. **数据隐私**：同步时处理敏感信息（手机号、邮箱）
2. **权限控制**：仅限管理员操作同步
3. **审计日志**：记录所有同步操作
4. **数据备份**：同步前备份本地库
5. **冲突处理**：人工审核重要冲突

## 常见问题

### Q：如何处理本地库已有的学生/老师？
A：通过 `classin_uid` 字段进行关联。如果已有记录没有 `classin_uid`，需要人工审核匹配。

### Q：ClassIn 数据更新后如何同步？
A：实现定时同步任务（建议每天凌晨）或 Webhook 机制。

### Q：能否只同步某些字段？
A：可以，在 upsert 时指定字段，其他字段保留原值。

### Q：如何处理被删除的记录？
A：ClassIn 返回的 `isDel` 字段标记删除，本地库中应该软删除（标记 status='deleted'）。

## 相关资源

- ClassIn API 文档：`CLASSIN_INTEGRATION.md`
- 数据库表结构：`supabase/migrations/`
- 当前服务实现：`lib/services/classin.ts`
- ClassIn SDK 页面：`/dashboard/classin-sdk`
