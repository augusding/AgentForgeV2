# AgentForge V2 — Smart Workstation Platform

## 会话续接
每次新会话开始前，先执行：`cat claude-progress.txt`
了解上次进度后再开始工作。
任务完成后执行 `/save-progress` 保存进度。

---


## 项目定位
流程驱动、AI辅助的智能工位平台。每个岗位拥有专属AI助手，在确定性工作流中嵌入概率性AI能力。

## 技术栈
- **后端**: Python 3.11+, aiohttp, aiosqlite, websockets
- **前端**: React 18, TypeScript, Vite, Tailwind CSS, ReactFlow
- **AI**: Claude/DeepSeek (多提供商降级), bge-base-zh embedding, ChromaDB
- **存储**: SQLite (业务数据) + ChromaDB (向量) + YAML (配置)

## 架构总览

```
请求 → API Routes → ForgeEngine → Pipeline → AgentRuntime → LLM
                                      ↓              ↓
                                  Knowledge       Tools
                                      ↓              ↓
                                    Memory ← ← ← ← ←
```

## 模块职责（每个目录有子 CLAUDE.md）

| 模块 | 职责 | 入口文件 |
|------|------|---------|
| `api/` | HTTP API 路由层，按领域拆分 | `api/app.py` |
| `core/` | 核心引擎：ForgeEngine + AgentRuntime + Pipeline | `core/engine.py` |
| `workflow/` | DAG 工作流引擎 + 节点 + 触发器 | `workflow/engine.py` |
| `knowledge/` | RAG: 文档解析 → 分块 → Embedding → 检索 | `knowledge/rag.py` |
| `memory/` | 按职责拆分的存储层 | `memory/session_store.py` |
| `tools/` | 工具注册 + 内置工具 | `tools/registry.py` |
| `builder/` | 引导式 Agent 配置构建器 | `builder/engine.py` |
| `observability/` | Token 追踪 + Mission 追踪 | `observability/tracer.py` |
| `guardrails/` | 预算 + 输出安全 | `guardrails/budget.py` |
| `profiles/` | 行业 YAML 配置 | 声明式，无代码 |

## 核心约束
1. **每个 .py 文件不超过 500 行**，超过必须拆分
2. **每个类不超过 20 个公开方法**，超过说明职责不单一
3. **禁止延迟导入超过 3 处/文件**，超过说明耦合过重
4. **ForgeEngine 只做编排**，不直接操作任何子系统的内部状态
5. **数据通过 dataclass 传递**，模块间不传 Engine 实例

## 消息处理管线 (8 步 → 精简为 5 步)
1. **CapabilityGate** — 基于信号的能力门控
2. **IntentRouter** — 意图识别 + 路由
3. **ContextBuilder** — RAG + 记忆 + Profile → 构建上下文
4. **AgentRuntime** — ReAct 循环 (LLM ↔ Tool)
5. **PostProcess** — 记忆存储 + 信号采集

## 开发规范
- 所有新文件必须有模块级 docstring
- 公开方法必须有 type hints
- 异步方法统一用 `async def`
- 配置统一从 `core/config/loader.py` 加载
- 错误处理: 业务错误用自定义 Exception，不要 bare except
- 新建功能模块前先查阅 `skills/` 目录下对应的 Skill 文件

## 数据隔离规则（强制）

### 模型
- 一个 user_id 对应一个用户，属于一个组织(org_id)，绑定一个岗位(position_id)
- 数据隔离主键：(user_id, org_id)
- position_id 是用户属性，不参与隔离（但某些数据按 position_id 分区查询）

### 规则
- 所有数据表必须有 org_id 和 user_id 字段
- 所有查询必须包含 WHERE user_id=? AND org_id=? 条件
- 知识库通过 metadata 中 org_id 过滤（同组织共享，不按用户隔离）
- 文件按 data/uploads/{org_id}/{user_id}/ 目录隔离
- 会话的读取和删除必须验证 user_id 归属
- JWT payload 必须包含 sub(user_id)、org_id、org_role

### 新功能检查清单
- [ ] 新表有 org_id + user_id？
- [ ] 查询按 org_id + user_id 过滤？
- [ ] API handler 从 JWT 提取了 org_id？
- [ ] 文件存到了隔离目录？

## 开发流程（Claude Code 必须遵守）

### 每次完成任务后必须执行
1. `python -m pytest tests/ -v`（确认测试通过）
2. 如果改了前端：`cd frontend && npm run build && cd ..`（确认构建通过）
3. `git add -A && git commit -m "合适的描述" && git push origin master`
4. 告知用户改动摘要和文件列表

### Commit Message 规范
- `feat: xxx` — 新功能
- `fix: xxx` — 修复 bug
- `refactor: xxx` — 重构
- `chore: xxx` — 杂项
