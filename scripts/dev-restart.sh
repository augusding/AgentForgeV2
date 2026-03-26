#!/bin/bash
# scripts/dev-restart.sh — 构建前端 + 重启后端
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "========================================"
echo "  AgentForge V2 — 重启服务"
echo "========================================"

echo "[1/4] 停止现有服务..."
pkill -f "forge.py serve" 2>/dev/null || true
sleep 1

echo "[2/4] 拉取最新代码..."
git pull origin master

echo "[3/4] 构建前端..."
cd frontend && npm run build && cd ..

echo "[4/4] 启动后端..."
python forge.py serve &
sleep 3

if curl -s http://localhost:8080/api/v1/health | grep -q "ok"; then
    echo ""
    echo "========================================"
    echo "  服务已就绪: http://localhost:8080"
    echo "========================================"
else
    echo "  服务可能还在启动中..."
fi
