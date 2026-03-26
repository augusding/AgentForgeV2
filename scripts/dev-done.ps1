# scripts/dev-done.ps1 — 开发任务完成后一键执行
# 用法: .\scripts\dev-done.ps1 "feat: description"

param(
    [Parameter(Position=0)]
    [string]$Message = "chore: update"
)

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "`n=== AgentForge V2 — 开发完成 ===" -ForegroundColor Cyan

Write-Host "`n[Step 1] Git 提交..." -ForegroundColor Yellow
& "$root\scripts\auto-commit.ps1" $Message

Write-Host "`n[Step 2] 重启服务..." -ForegroundColor Yellow
& "$root\scripts\dev-restart.ps1"

Write-Host "`n=== 全部完成 ===" -ForegroundColor Green
