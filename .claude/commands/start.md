启动 AgentForge V2 后端服务。

执行以下步骤：
1. 先杀掉占用 8080 端口的进程：
```powershell
   $c = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
   if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }
```
2. 等待 2 秒
3. 在项目根目录启动服务：`python forge.py serve`
4. 等待 10 秒后健康检查：`curl http://localhost:8080/api/v1/health`
5. 报告启动结果
