运行工作流全面测试。

确保后端服务在运行（先检查 `curl http://localhost:8080/api/v1/health`），然后执行：
```bash
python tests/wf_test.py
```
报告测试结果，如有失败项分析原因。
