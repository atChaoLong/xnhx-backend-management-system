<#
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
  npm uninstall -g supabase
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase
  supabase --version

  Supabase migration script: source project -> new project
  Migrates: public business data + auth users (incl. password hashes)

  How it works:
    1. Use supabase CLI to dump roles / schema / data separately
       (only dumps auth/storage/public business schemas, skips internal schemas)
    2. On import, set session_replication_role = replica to temporarily
       disable FK constraints / triggers, fixing the FK errors

  Prerequisites:
    - supabase CLI installed: npm install -g supabase
    - psql (PostgreSQL client) installed

  Note: special chars in connection strings are URL-encoded
    old password Q1)x_J0w(2hXwNQvCh_9UvAm  ->  ) = %29  ( = %28
    new password Longge73748096&           ->  & = %26
#>

$ErrorActionPreference = "Stop"

# ===== Connection strings (URL-encoded) =====
$OLD = "postgresql://postgres:Q1%29x_J0w%282hXwNQvCh_9UvAm@sbp-76uzx8fjpgfoyx2f.supabase.opentrust.net:5432/postgres?sslmode=disable"
$NEW = "postgresql://postgres.abovmzqahzaahexaxpux:Longge73748096%26@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Full path to psql (D:\postgreSQL\bin is not on PATH)
$psql = "D:\postgreSQL\bin\psql.exe"

$outDir = $PSScriptRoot
$rolesFile  = Join-Path $outDir "roles.sql"
$schemaFile = Join-Path $outDir "schema.sql"
$dataFile   = Join-Path $outDir "data.sql"
$resetFile  = Join-Path $outDir "reset-target.sql"

Write-Host "==> [1/5] Dumping roles -> roles.sql ..." -ForegroundColor Cyan
supabase db dump --db-url $OLD -f $rolesFile --role-only

Write-Host "==> [2/5] Dumping schema -> schema.sql ..." -ForegroundColor Cyan
supabase db dump --db-url $OLD -f $schemaFile

Write-Host "==> [3/5] Dumping data -> data.sql ..." -ForegroundColor Cyan
supabase db dump --db-url $OLD -f $dataFile --data-only --use-copy

# ----- Destructive cleanup of the TARGET (new) project -----
Write-Host ""
Write-Host "==> [4/5] RESET target project (DROP public schema + clear auth data)" -ForegroundColor Yellow
Write-Host "    This permanently deletes existing data in the NEW project." -ForegroundColor Yellow
$confirm = Read-Host "    Type 'RESET' to continue"
if ($confirm -ne "RESET") {
    Write-Host "Aborted by user. No changes made to target." -ForegroundColor Red
    exit 1
}
& $psql --variable ON_ERROR_STOP=1 --file $resetFile --dbname $NEW

# Step 5: Import schema WITHOUT --single-transaction and WITHOUT ON_ERROR_STOP
# This allows non-fatal errors like "publication already exists" to be skipped
Write-Host "==> [5/7] Importing schema (non-fatal errors skipped) ..." -ForegroundColor Cyan
& $psql --file $rolesFile --file $schemaFile --dbname $NEW

# Step 6: Clean auth residue + import data in the SAME psql session
# session_replication_role=replica disables FK checks and storage protect_delete trigger
Write-Host "==> [6/7] Importing data (auth + public + storage) ..." -ForegroundColor Cyan
& $psql `
  --variable ON_ERROR_STOP=1 `
  --command "SET session_replication_role = replica" `
  --command "DELETE FROM auth.audit_log_entries; DELETE FROM auth.refresh_tokens; DELETE FROM auth.mfa_amr_claims; DELETE FROM auth.mfa_challenges; DELETE FROM auth.mfa_factors; DELETE FROM auth.sessions; DELETE FROM auth.identities; DELETE FROM auth.one_time_tokens; DELETE FROM auth.flow_state; DELETE FROM auth.users;" `
  --command "DELETE FROM storage.objects; DELETE FROM storage.buckets; DELETE FROM storage.s3_multipart_uploads; DELETE FROM storage.s3_multipart_uploads_parts;" `
  --file $dataFile `
  --dbname $NEW

# Step 7: Set sequence values (extracted from tail of data.sql)
Write-Host "==> [7/7] Setting sequence values ..." -ForegroundColor Cyan
& $psql `
  --command "SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 2148, true);" `
  --command "SELECT pg_catalog.setval('"public"."leads_report_number_seq"', 12345790, true);" `
  --command "SELECT pg_catalog.setval('"public"."teacher_code_seq"', 10, true);" `
  --command "SELECT pg_catalog.setval('"public"."uuid_v7_seq"', 720, true);" `
  --dbname $NEW

Write-Host "==> Migration done. Verify in Supabase Dashboard." -ForegroundColor Green
Write-Host "    - Table Editor: check public tables have data" -ForegroundColor White
Write-Host "    - Authentication: check Users list" -ForegroundColor White
Write-Host "    - Storage: check buckets exist" -ForegroundColor White
Write-Host "    Note: storage.objects file metadata may fail if source/target versions differ." -ForegroundColor Yellow
Write-Host "    Note: Actual file contents in object storage need separate migration via Storage API." -ForegroundColor Yellow
