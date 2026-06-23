# Supabase 数据迁移指南

将旧 Supabase 项目的业务数据（public schema）和登录用户（auth schema，含密码哈希）迁移到新 Supabase 项目。

## 文件说明

| 文件 | 说明 |
|------|------|
| `migrate-supabase.ps1` | **完整迁移脚本**：从源项目导出 + 清空目标项目 + 导入。需要 supabase CLI 和 Docker Desktop。 |
| `restore-only.ps1` | **仅恢复脚本**：跳过导出步骤，直接用已有的 SQL 文件导入到目标项目。不需要 supabase CLI 或 Docker。 |
| `reset-target.sql` | 清空目标项目的 SQL 脚本（DROP public schema + 清除 auth 表数据）。 |
| `roles.sql` | 从源项目导出的数据库角色（297 bytes）。 |
| `schema.sql` | 从源项目导出的表结构/DDL（~129 KB）。 |
| `data.sql` | 从源项目导出的数据/COPY 语句（~1.27 MB）。 |
| `storage-data.sql` | 从 data.sql 中提取的 storage 部分（buckets + objects 元数据）。 |
| `导入错误.txt` | 首次尝试直接导入完整 dump 时的错误日志，留作参考。 |

## 前置条件

### 1. 安装 psql（PostgreSQL 客户端）

已安装在 `D:\postgreSQL\bin\psql.exe`。如果路径不同，修改脚本中的 `$psql` 变量。

### 2. 安装 supabase CLI（仅完整迁移需要）

```powershell
# 用 scoop 安装（推荐，npm 安装的不支持 Windows 的 db dump）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

### 3. 安装并启动 Docker Desktop（仅完整迁移需要）

`supabase db dump` 依赖 Docker 容器执行导出。下载安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 并启动。

## 连接字符串

脚本中已内置以下连接串（特殊字符已 URL 编码）：

- **源项目（旧）**: `postgresql://postgres:Q1%29x_J0w%282hXwNQvCh_9UvAm@sbp-76uzx8fjpgfoyx2f.supabase.opentrust.net:5432/postgres?sslmode=disable`
  - 密码 `Q1)x_J0w(2hXwNQvCh_9UvAm`，其中 `)` = `%29`，`(` = `%28`

- **目标项目（新）**: `postgresql://postgres.abovmzqahzaahexaxpux:Longge73748096%26@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require`
  - 密码 `Longge73748096&`，其中 `&` = `%26`

## 使用方法

### 方式 A：完整迁移（导出 + 导入）

适用于从零开始，需要重新从源项目导出数据的情况。

```powershell
cd D:\atchaolong\xiaoniuhaoxue\xnhx-backend-management-system\scripts\supabase-import-guide
.\migrate-supabase.ps1
```

脚本会执行以下 7 个步骤：

1. **导出角色** → `roles.sql`（supabase CLI）
2. **导出表结构** → `schema.sql`（supabase CLI）
3. **导出数据** → `data.sql`（supabase CLI）
4. **清空目标项目** — 输入 `RESET` 确认后执行 `reset-target.sql`
5. **导入表结构** — 不使用 `ON_ERROR_STOP`，跳过 `publication already exists` 等非致命错误
6. **导入数据** — 先清除 auth/storage 残留，再设置 `session_replication_role = replica` 禁用外键检查，最后导入
7. **设置序列值** — 修正自增序列的当前值

### 方式 B：仅恢复（用已有 SQL 文件）

适用于 `roles.sql`、`schema.sql`、`data.sql` 已经生成好，只需导入到目标项目的情况。**不需要 supabase CLI 或 Docker。**

```powershell
cd D:\atchaolong\xiaoniuhaoxue\xnhx-backend-management-system\scripts\supabase-import-guide
.\restore-only.ps1
```

脚本会执行以下 4 个步骤：

1. **清空目标项目** — 输入 `RESET` 确认后执行 `reset-target.sql`
2. **导入表结构** — 跳过非致命错误
3. **导入数据** — 清除残留 + 禁用外键检查 + 导入
4. **设置序列值**

### 方式 C：手动逐步执行

如果想完全控制每一步，可以手动执行以下命令。将连接串和 psql 路径替换为你自己的。

#### 第 1 步：清空目标项目

```powershell
& "D:\postgreSQL\bin\psql.exe" --variable ON_ERROR_STOP=1 --file reset-target.sql --dbname "postgresql://postgres.abovmzqahzaahexaxpux:Longge73748096%26@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

#### 第 2 步：导入表结构

```powershell
& "D:\postgreSQL\bin\psql.exe" --file roles.sql --file schema.sql --dbname "postgresql://postgres.abovmzqahzaahexaxpux:Longge73748096%26@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

> **预期错误**（可忽略）：
> - `publication "logflare_pub" already exists` — 新项目自带此 publication
> - `must be able to SET ROLE "supabase_admin"` — 权限限制，不影响表结构

#### 第 3 步：导入数据

```powershell
& "D:\postgreSQL\bin\psql.exe" --variable ON_ERROR_STOP=1 --command "SET session_replication_role = replica" --command "DELETE FROM auth.audit_log_entries; DELETE FROM auth.refresh_tokens; DELETE FROM auth.mfa_amr_claims; DELETE FROM auth.mfa_challenges; DELETE FROM auth.mfa_factors; DELETE FROM auth.sessions; DELETE FROM auth.identities; DELETE FROM auth.one_time_tokens; DELETE FROM auth.flow_state; DELETE FROM auth.users;" --command "DELETE FROM storage.objects; DELETE FROM storage.buckets; DELETE FROM storage.s3_multipart_uploads; DELETE FROM storage.s3_multipart_uploads_parts;" --file data.sql --dbname "postgresql://postgres.abovmzqahzaahexaxpux:Longge73748096%26@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

> **关键点**：
> - `SET session_replication_role = replica` 禁用外键检查和触发器（包括 storage 的 `protect_delete` 保护）
> - 在**同一个 psql 会话**中先 DELETE 清除残留数据再导入，避免新项目自动生成的新数据导致主键冲突
> - `ON_ERROR_STOP=1` 确保有真正的错误时停止

#### 第 4 步：设置序列值

```powershell
& "D:\postgreSQL\bin\psql.exe" --command "SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 2148, true);" --command "SELECT pg_catalog.setval('"public"."leads_report_number_seq"', 12345790, true);" --command "SELECT pg_catalog.setval('"public"."teacher_code_seq"', 10, true);" --command "SELECT pg_catalog.setval('"public"."uuid_v7_seq"', 720, true);" --dbname "postgresql://postgres.abovmzqahzaahexaxpux:Longge73748096%26@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

## 验证

迁移完成后，登录 [Supabase Dashboard](https://supabase.com/dashboard) 检查：

1. **Table Editor** → 查看 `public` 下的表（`leads`、`students`、`formal_orders`、`user_profiles` 等）是否有数据
2. **Authentication** → Users 列表是否有迁移过来的用户
3. 用旧账号密码登录，确认密码哈希是否正确
4. **Storage** → 查看 `teacher-photos`、`trial-lessons`、`formal-orders` 等桶是否存在

## 已知限制

- **storage.objects 元数据**：如果源项目和目标项目的 Supabase 版本不同，`storage.objects` 表的列结构可能不一致（如源库有 `level` 列而目标库没有），导致文件元数据导入失败。此情况下 buckets 可以正常导入，但 objects 会跳过。
- **文件内容**：数据库只存储文件元数据，实际文件内容存储在 Supabase 的对象存储后端，需要通过 Storage API 单独迁移。
- **`iceberg_namespaces` / `iceberg_tables`**：源库版本较新时可能有这些表，目标库不存在时会报错，但数据为空，不影响使用。

## 踩坑记录

以下是迁移过程中遇到的问题及解决方案，供参考：

1. **外键约束冲突** — `session_replication_role = replica` 禁用 FK 检查
2. **`publication already exists`** — 导入 schema 时不用 `ON_ERROR_STOP`，跳过此错误
3. **`audit_log_entries` 主键冲突** — 新项目会自动生成审计日志，需在导入数据前清除
4. **`storage.protect_delete` 触发器** — `session_replication_role = replica` 同时禁用此触发器
5. **`must be owner of table`** — supabase CLI 导出时跳过内部 schema，避免权限问题
6. **PowerShell 编码问题** — 脚本使用英文注释，避免中文编码问题
7. **`psql` 不在 PATH** — 脚本中使用完整路径 `D:\postgreSQL\bin\psql.exe`
