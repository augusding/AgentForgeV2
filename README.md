# AgentForge V2 — Smart Workstation Platform

流程驱动、AI辅助的智能工位平台。每个岗位拥有专属AI助手。

## Quick Start

### 1. Install

```bash
git clone https://github.com/augusding/AgentForge.git
cd AgentForge
pip install -r requirements.txt
```

### 2. Configure

```bash
cp .env.example .env
# 编辑 .env，填入 API Key
```

### 3. Run

```bash
# API 服务
python forge.py serve

# 命令行对话
python forge.py chat --position strategy-pm

# 查看岗位
python forge.py positions
```

## Architecture

```
请求 → API Routes → ForgeEngine → Pipeline → AgentRuntime → LLM
                                      ↓              ↓
                                  Knowledge       Tools
                                      ↓              ↓
                                    Memory ← ← ← ← ←
```

## Project Structure

```
AgentForge/
├── forge.py                 # CLI 入口 (typer)
├── config/forge.yaml        # 全局配置
├── CLAUDE.md                # 项目导航 (Claude Code 用)
│
├── api/                     # HTTP API 层 (按领域拆分)
│   ├── app.py               # aiohttp app + 中间件
│   └── routes/
│       ├── auth.py          # 认证
│       ├── chat.py          # 对话
│       ├── positions.py     # 岗位
│       └── sessions.py      # 会话
│
├── core/                    # 核心引擎
│   ├── engine.py            # ForgeEngine 编排器
│   ├── agent.py             # AgentRuntime (ReAct)
│   ├── llm.py               # 多提供商 LLM 客户端
│   ├── models.py            # 数据模型
│   ├── config/loader.py     # 配置加载
│   └── pipeline/
│       └── context_builder.py
│
├── memory/                  # 按职责拆分的存储
│   ├── session_store.py     # 对话历史
│   └── signal_store.py      # 信号/模式/洞察
│
├── tools/                   # 工具系统
│   ├── registry.py          # 工具注册表
│   └── builtin/core_tools.py
│
├── profiles/                # 行业 YAML 配置
│   └── ad-monetization/
│       ├── positions/*.yaml
│       └── workflows/*.yaml
│
└── data/                    # 运行时数据
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | 健康检查 |
| POST | `/api/v1/chat` | 发送消息 |
| POST | `/api/v1/chat/stream` | 流式对话 (SSE) |
| GET | `/api/v1/positions` | 岗位列表 |
| GET | `/api/v1/positions/{id}` | 岗位详情 |
| GET | `/api/v1/sessions` | 会话列表 |
| GET | `/api/v1/sessions/{id}/messages` | 会话历史 |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, aiohttp, aiosqlite |
| AI | DeepSeek / Claude (multi-tier fallback) |
| Storage | SQLite + YAML |

## License

MIT
