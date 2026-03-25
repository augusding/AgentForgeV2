# AgentForge V2 — Smart Workstation Platform

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
