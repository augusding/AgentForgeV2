重启 AgentForge V2 后端服务。

执行以下步骤：
1. 杀掉所有 python 进程：`taskkill /F /IM python.exe`
2. 等待 2 秒
3. 在项目根目录启动：`python forge.py serve`
4. 等待 10 秒后健康检查：`curl http://localhost:8080/api/v1/health`
5. 报告启动结果
