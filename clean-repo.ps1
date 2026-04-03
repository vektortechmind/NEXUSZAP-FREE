# Remove artefatos locais (node_modules, dist, base SQLite, backups) para estado "tipo clone fresco".
# Pare o backend/frontend (e PM2 na VPS) antes de correr, senao ficheiros .db podem ficar bloqueados.

$ErrorActionPreference = "Continue"
$Root = $PSScriptRoot

Write-Host "A limpar em: $Root" -ForegroundColor Cyan

$dirs = @(
  "$Root\backend\node_modules",
  "$Root\frontend\node_modules",
  "$Root\node_modules",
  "$Root\backend\dist",
  "$Root\frontend\dist",
  "$Root\backend\backups",
  "$Root\backups",
  "$Root\updates"
)
foreach ($d in $dirs) {
  if (Test-Path $d) {
    Remove-Item -LiteralPath $d -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Removido pasta: $d" -ForegroundColor DarkGray
  }
}

Get-ChildItem "$Root\backend\prisma" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '\.(db|db-wal|db-shm)$' } | ForEach-Object {
  Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
  if (Test-Path $_.FullName) { Write-Host "  [AVISO] Nao foi possivel apagar (ficheiro em uso?): $($_.Name)" -ForegroundColor Yellow }
  else { Write-Host "  Removido: $($_.Name)" -ForegroundColor DarkGray }
}

foreach ($f in @("$Root\backend\.encryption_key", "$Root\frontend\.env.production", "$Root\frontend\.env.production.local")) {
  if (Test-Path $f) {
    Remove-Item $f -Force -ErrorAction SilentlyContinue
    Write-Host "  Removido: $f" -ForegroundColor DarkGray
  }
}

Write-Host "Concluido. Volte a criar backend\.env com .\setup-env.ps1 antes de instalar." -ForegroundColor Green
