# scripts/dev-restart.ps1 — 构建前端 + 重启后端服务
# 用法: .\scripts\dev-restart.ps1

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  AgentForge V2 — 重启服务" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "[1/4] 停止现有服务..." -ForegroundColor Yellow
$procs = Get-Process -Name "python" -ErrorAction SilentlyContinue
if ($procs) {
    $procs | Stop-Process -Force
    Write-Host "  已停止 $($procs.Count) 个进程" -ForegroundColor Gray
    Start-Sleep -Seconds 1
} else {
    Write-Host "  没有运行中的服务" -ForegroundColor Gray
}

Write-Host "[2/4] 拉取最新代码..." -ForegroundColor Yellow
Set-Location $root
git pull origin master 2>&1 | Write-Host

Write-Host "[3/4] 构建前端..." -ForegroundColor Yellow
Set-Location "$root\frontend"
$buildResult = npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  前端构建失败!" -ForegroundColor Red
    $buildResult | Write-Host
    exit 1
}
Write-Host "  前端构建成功" -ForegroundColor Green

Write-Host "[4/4] 启动后端服务..." -ForegroundColor Yellow
Set-Location $root
Start-Process -FilePath "python" -ArgumentList "forge.py serve" -NoNewWindow
Write-Host "  后端启动中... 等待 3 秒" -ForegroundColor Gray
Start-Sleep -Seconds 3

try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/health" -TimeoutSec 5
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  服务已就绪: http://localhost:8080" -ForegroundColor Green
    Write-Host "  状态: $($health.status)" -ForegroundColor Green
    Write-Host "  工具: $($health.tools) 个" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
} catch {
    Write-Host "`n  健康检查失败，服务可能还在启动中" -ForegroundColor Yellow
    Write-Host "  请手动访问 http://localhost:8080`n" -ForegroundColor Yellow
}
