<#
  Restore-only script.
  Uses the already-generated roles.sql / schema.sql / data.sql.
  Does NOT need supabase CLI or Docker.

  Steps:
    1. RESET target project (drop public schema + clear auth residue)
    2. Import schema (non-fatal errors skipped, e.g. "publication already exists")
    3. Clean auth + storage residue, then import data (FK checks disabled)
    4. Set sequence values
#>

$ErrorActionPreference = "Stop"

$NEW  = "postgresql://postgres.abovmzqahzaahexaxpux:Longge73748096%26@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
$psql = "D:\postgreSQL\bin\psql.exe"

$outDir = $PSScriptRoot
$rolesFile  = Join-Path $outDir "roles.sql"
$schemaFile = Join-Path $outDir "schema.sql"
$dataFile   = Join-Path $outDir "data.sql"
$resetFile  = Join-Path $outDir "reset-target.sql"

foreach ($f in @($rolesFile, $schemaFile, $dataFile, $resetFile)) {
    if (-not (Test-Path $f)) { Write-Host "Missing file: $f" -ForegroundColor Red; exit 1 }
}

Write-Host "==> [1/4] RESET target project (DROP public schema + clear auth data)" -ForegroundColor Yellow
Write-Host "    This permanently deletes existing data in the NEW project." -ForegroundColor Yellow
$confirm = Read-Host "    Type 'RESET' to continue"
if ($confirm -ne "RESET") {
    Write-Host "Aborted by user. No changes made to target." -ForegroundColor Red
    exit 1
}
& $psql --variable ON_ERROR_STOP=1 --file $resetFile --dbname $NEW

# Step 2: Import schema WITHOUT --single-transaction and WITHOUT ON_ERROR_STOP
# This allows non-fatal errors like "publication already exists" to be skipped
Write-Host "==> [2/4] Importing schema (non-fatal errors skipped) ..." -ForegroundColor Cyan
& $psql --file $rolesFile --file $schemaFile --dbname $NEW

# Step 3: Clean auth + storage residue + import data in the SAME psql session
# session_replication_role=replica disables FK checks and storage protect_delete trigger
Write-Host "==> [3/4] Importing data (auth + public + storage) ..." -ForegroundColor Cyan
& $psql `
  --variable ON_ERROR_STOP=1 `
  --command "SET session_replication_role = replica" `
  --command "DELETE FROM auth.audit_log_entries; DELETE FROM auth.refresh_tokens; DELETE FROM auth.mfa_amr_claims; DELETE FROM auth.mfa_challenges; DELETE FROM auth.mfa_factors; DELETE FROM auth.sessions; DELETE FROM auth.identities; DELETE FROM auth.one_time_tokens; DELETE FROM auth.flow_state; DELETE FROM auth.users;" `
  --command "DELETE FROM storage.objects; DELETE FROM storage.buckets; DELETE FROM storage.s3_multipart_uploads; DELETE FROM storage.s3_multipart_uploads_parts;" `
  --file $dataFile `
  --dbname $NEW

# Step 4: Set sequence values (extracted from tail of data.sql)
Write-Host "==> [4/4] Setting sequence values ..." -ForegroundColor Cyan
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
