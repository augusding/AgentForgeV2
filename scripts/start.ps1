# AgentForge V2 — 一键启动脚本
param([int]$Port = 8080)

Write-Host "`n=== AgentForge V2 启动 ===" -ForegroundColor Cyan

# 杀占用端口的进程
$conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($conns) {
    $conns | ForEach-Object {
        Write-Host "  杀进程 PID=$($_.OwningProcess) (端口 $Port)" -ForegroundColor Yellow
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep 2
}

# 启动后端
Write-Host "  启动后端服务..." -ForegroundColor Gray
$proc = Start-Process python -ArgumentList "forge.py", "serve" -WorkingDirectory $PSScriptRoot\.. -PassThru -WindowStyle Normal
Write-Host "  PID: $($proc.Id)" -ForegroundColor Gray

# 等待健康检查
Write-Host "  等待服务就绪..." -ForegroundColor Gray
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep 1
    try {
        $r = Invoke-WebRequest "http://localhost:$Port/api/v1/health" -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch {}
    Write-Host "." -NoNewline
}
Write-Host ""

if ($ok) {
    Write-Host "`n  ✅ 后端已启动: http://localhost:$Port" -ForegroundColor Green
    Write-Host "  ✅ API 文档: http://localhost:$Port/api/v1/health" -ForegroundColor Green
} else {
    Write-Host "`n  ❌ 启动超时，请检查 data/logs/forge.log" -ForegroundColor Red
}
