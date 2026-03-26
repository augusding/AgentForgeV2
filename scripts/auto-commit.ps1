# scripts/auto-commit.ps1 — 自动 git add + commit + push
# 用法: .\scripts\auto-commit.ps1 "commit message"

param(
    [Parameter(Position=0)]
    [string]$Message = "chore: auto commit"
)

$ErrorActionPreference = "Stop"

Write-Host "`n[AutoCommit] 开始提交..." -ForegroundColor Cyan

$status = git status --porcelain
if (-not $status) {
    Write-Host "[AutoCommit] 没有文件变更，跳过" -ForegroundColor Yellow
    exit 0
}

Write-Host "[AutoCommit] 变更文件:" -ForegroundColor Gray
git diff --stat

git add -A
git commit -m $Message
git push origin master

Write-Host "[AutoCommit] 已提交并推送到 GitHub" -ForegroundColor Green
