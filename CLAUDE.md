# AgentForge V2 — Smart Workstation Platform

## ⚠️ 平台约束（最高优先级）

**本项目运行在 Windows 11 + PowerShell 环境。**
- 禁止使用 `sed`, `lsof`, `kill`, `grep`, `cat`, `awk`, `xargs` 等 Unix 命令
- 用 `Select-String` 替代 `grep`，`Get-Content` 替代 `cat`，`taskkill /F /PID` 替代 `kill`
- 用 `netstat -ano | findstr :端口` 查端口占用
- 字符串用双引号 `"`，不用单引号 `'`（PowerShell 语法）
- 路径分隔符用 `\` 或 `/`（Python 中都可以），Shell 命令中用 `\`

---

## 会话续接

每次新会话开始前，先执行：`cat claude-progress.txt`
了解上次进度后再开始工作。
任务完成后执行 `/save-progress` 保存进度。

---

## 项目定位

流程驱动、AI辅助的智能工位平台。每个岗位拥有专属AI助手，在确定性工作流中嵌入概率性AI能力。

## 技术栈

- **后端**: Python 3.11+, aiohttp, aiosqlite, websockets
- **前端**: React 18, TypeScript, Vite, Tailwind CSS v4, @xyflow/react v12
- **AI**: Claude/DeepSeek (多提供商降级), bge-base-zh embedding, ChromaDB
- **存储**: SQLite (业务数据) + ChromaDB (向量) + YAML (配置)
- **端口**: 后端 8080, 前端 3001

## 架构总览

```
请求 → API Routes → ForgeEngine → Pipeline → AgentRuntime → LLM
                         ↓              ↓
                     Knowledge       Tools
                         ↓              ↓
                       Memory ← ← ← ← ←
```

## 目录结构（改文件前必须确认路径）

| 模块 | 职责 | 入口文件 |
|------|------|---------|
| `api/` | HTTP API 路由层，按领域拆分 | `api/app.py` |
| `api/routes/` | 各领域路由处理器 | `workflow.py`, `chat.py`, `knowledge.py`, `connectors.py`, `compat.py` |
| `core/` | 核心引擎：ForgeEngine + AgentRuntime + Pipeline | `core/engine.py` |
| `workflow/` | DAG 工作流引擎 + 27个节点 + 触发器 | `workflow/engine.py` |
| `workflow/nodes/` | 节点执行器（logic/conditions/ai_node/http_node 等） | `__init__.py` 注册所有节点 |
| `knowledge/` | RAG: 文档解析 → 分块 → Embedding → 检索 | `knowledge/rag.py` |
| `knowledge/connectors/` | 企业数据源连接器（web/sql/confluence/local_file） | `registry.py` |
| `memory/` | 按职责拆分的存储层 | `memory/session_store.py` |
| `tools/` | 工具注册 + 内置工具 | `tools/registry.py` |
| `profiles/` | 行业 YAML 配置（岗位定义 + onboarding prompts） | 声明式，无代码 |
| `frontend/src/pages/` | 页面组件 | `Chat.tsx`, `Knowledge.tsx`, `Workflows.tsx`, `Settings.tsx` |
| `frontend/src/pages/workflows/` | 工作流编辑器组件 | `WorkflowEditor.tsx`, `WfNode.tsx`, `PropertyPanel.tsx` |
| `frontend/src/api/` | 前端 API 调用层 | `client.ts`, `workflow.ts`, `chat.ts`, `knowledge.ts` |
| `tests/` | 测试脚本 | `wf_test.py`（工作流全面测试） |

**改文件前必须确认**：要改的内容属于前端还是后端？前端组件在 `frontend/src/`，不要改成 markdown 或后端文件。

---

## 服务管理

### 启动服务
```powershell
cd D:\AgentForgeV2
python forge.py serve
# 等待看到 "API 服务已启动: http://0.0.0.0:8080"
```

### 重启服务（先杀再启）
```powershell
taskkill /F /IM python.exe
Start-Sleep 2
cd D:\AgentForgeV2
python forge.py serve
```

### 端口被占用时
```powershell
netstat -ano | findstr :8080
# 找到 PID 后
taskkill /PID <PID> /F
```

### 判断是否需要重启
- 改了 `*.py` 后端文件 → **需要重启**
- 改了 `frontend/src/` 前端文件 → **不需要**（Vite 热更新）
- 改了 `profiles/*.yaml` 配置文件 → **需要重启**

---

## 核心约束

1. **每个 .py 文件不超过 500 行**，超过必须拆分
2. **每个类不超过 20 个公开方法**，超过说明职责不单一
3. **禁止延迟导入超过 3 处/文件**，超过说明耦合过重
4. **ForgeEngine 只做编排**，不直接操作任何子系统的内部状态
5. **数据通过 dataclass 传递**，模块间不传 Engine 实例
6. **所有 async 函数中使用 asyncio 前必须 import asyncio**（历史高频 bug）

## 消息处理管线

1. **CapabilityGate** — 基于信号的能力门控
2. **IntentRouter** — 意图识别 + 路由
3. **ContextBuilder** — RAG + 记忆 + Profile → 构建上下文
4. **AgentRuntime** — ReAct 循环 (LLM ↔ Tool)
5. **PostProcess** — 记忆存储 + 信号采集

---

## ⚠️ 开发规范（强制执行）

### 修改后必须验证（不验证不准报完成）

**Python 文件修改后**：
```bash
python -c "import ast; ast.parse(open('修改的文件路径').read()); print('OK')"
```

**前端文件修改后**：
```bash
cd frontend && npx tsc --noEmit && npm run build
```

**涉及工作流引擎的改动**：
```bash
python tests/wf_test.py
```

**涉及多文件改动时**，逐个验证语法：
```bash
python -c "
import ast, pathlib
for f in ['文件1', '文件2', '文件3']:
    ast.parse(pathlib.Path(f).read_text())
    print(f'OK: {f}')
"
```

### 高频 bug 检查清单（每次提交前核对）

- [ ] 新文件是否 import 了所有用到的模块？（特别是 `asyncio`, `json`, `time`）
- [ ] 新增的 async 函数是否在文件顶部 import 了 asyncio？
- [ ] 修改是否引入了回归？（改一个功能有没有破坏另一个）
- [ ] 前端修改是否通过了 `tsc --noEmit`？
- [ ] 如果改了 API 路由，路由是否在 register() 中注册了？

### 修复 bug 的正确流程

1. **先复现**：用用户描述的步骤复现问题
2. **定位根因**：不要猜，读代码找到具体出错的行
3. **最小修改**：只改必要的代码，不要顺手重构
4. **验证修复**：跑验证命令，确认修复生效
5. **回归检查**：确认没有破坏其他功能
6. **不要声称"已修复"除非你跑了验证**

### 代码修改安全规则

- 引用任何类的属性（self._xxx）前，必须先用 grep 或 view 确认该属性在 __init__ 中存在，禁止凭记忆假设
- 修改函数时，必须先读取该函数的完整当前代码，不得基于历史版本或记忆中的版本修改
- 每个 return 路径、每个 except 分支都必须检查，不得"留给后续处理"

---

## 任务管理规范

### 每个会话限 2-3 个任务

不要在一个会话中做超过 3 个任务。每个任务完成并测试通过后 `git commit`，再做下一个。

### 提示模板
```
本次会话只做以下任务：
1. [具体任务]
2. [具体任务]
每个任务完成并测试通过后 git commit，再做下一个。不要跳跃。
```

### 大任务拆分原则
- 超过 5 个文件的改动 → 拆成 2-3 批
- 每批有明确的验证标准
- 每批完成后 git commit + push

---

## 数据隔离原则（强制 — 所有业务实现和表结构必须遵守）

### 核心原则

**user_id 是基础隔离维度，org_id 是管理维度。**

每个用户的所有数据默认私有，包括但不限于：知识库文档、工作流、连接器、任务、日程、跟进、会话、信号。
org_id 用于多部门/多公司场景的上层管理聚合，不替代 user_id 隔离。

### 两级隔离模型

```
user_id（基础维度 — 数据归属）
  → 所有业务表必须有 user_id 字段（NOT NULL）
  → 写入：自动注入当前用户的 user_id，禁止由前端传入
  → 查询：WHERE user_id = ?（默认只看自己的数据）
  → 更新：WHERE id = ? AND user_id = ?（校验归属）
  → 删除：WHERE id = ? AND user_id = ?（校验归属）

org_id（管理维度 — 组织聚合）
  → 所有业务表必须有 org_id 字段
  → 用于 admin 角色跨用户查看本组织数据
  → 用于组织级统计/报表聚合
  → 用于用户离职时按 org_id + user_id 批量归档
  → 普通用户的查询不依赖 org_id 做隔离（user_id 已经足够）
```

### 各模块隔离标准

| 模块 | 隔离级别 | 查询条件 | 说明 |
|------|---------|---------|------|
| 知识库 (ChromaDB) | user_id | metadata.user_id = ? | 每个用户的知识库完全私有 |
| 工作流 (workflows) | user_id (created_by) | created_by = ? | 个人资产，默认只看自己的 |
| 工作流执行 (executions) | user_id + org_id | user_id = ? | 追溯谁触发，admin 可按 org 查看 |
| 连接器 (connectors) | user_id (created_by) | created_by = ? | 数据源连接是个人配置，含敏感凭证 |
| 工位数据 (priorities/schedules/followups/work_items) | user_id + org_id | user_id = ? AND org_id = ? | 已有字段，需加归属校验 |
| 会话 (sessions) | user_id + org_id | user_id = ? | 已合格 |
| 文件上传 | user_id + org_id | 目录隔离 data/uploads/{org_id}/{user_id}/ | 已合格 |
| 信号/模式/洞察 | user_id + org_id | user_id = ? | 已合格 |
| 组织设置 (orgs) | org_id | — | 组织级资源，无需 user_id |
| 审计日志 | append-only | — | 记录 actor，不按 user_id 过滤 |

### 新功能/新表检查清单（强制）

每次创建新表或新功能时，必须逐条确认：

- [ ] 表结构有 user_id TEXT NOT NULL 字段？
- [ ] 表结构有 org_id TEXT DEFAULT '' 字段？
- [ ] 创建索引包含 user_id？（如 idx_xxx_user ON xxx(user_id, org_id)）
- [ ] API 写入时从 JWT 自动注入 user_id（不信任前端传值）？
- [ ] API 查询默认按 user_id 过滤？
- [ ] API 更新/删除的 WHERE 条件包含 user_id？
- [ ] 删除操作返回受影响行数，0 行时返回 403？
- [ ] admin 角色的跨用户查询走独立接口（如 /admin/xxx）？
- [ ] ChromaDB 操作传入 user_id 到 metadata？

### 禁止事项

- 禁止只按 id 删除/更新数据（必须附带 user_id 条件）
- 禁止信任前端传入的 user_id（必须从 JWT 的 sub 字段提取）
- 禁止用 org_id 替代 user_id 做数据隔离（org_id 是管理维度，不是隔离维度）
- 禁止知识库按 org_id 共享（每个用户的知识库是私有的）
- 禁止在没有 user_id 过滤的情况下返回数据列表

---

## Git 规范

### 每次完成任务后必须执行
1. 验证命令全部通过（见上方验证规范）
2. `git add -A && git commit -m "合适的描述" && git push origin master`
3. 告知用户：改动摘要 + 文件列表 + 验证结果

### Commit Message 规范
- `feat: xxx` — 新功能
- `fix: xxx` — 修复 bug
- `refactor: xxx` — 重构
- `chore: xxx` — 杂项
- `test: xxx` — 测试相关

---

## 工作流引擎关键信息

### 27 个节点类型
- **触发器**(3): manualTrigger, scheduleTrigger, webhookTrigger
- **逻辑**(8): code, condition, if, switch, loop, delay, merge, subWorkflow
- **数据**(6): set, excel, document, database, transform, kvStore
- **AI**(1): ai
- **Action**(3): http, scraper, approval
- **通知**(5): notification, email, feishu, dingtalk, wecom
- **飞书**(1): feishu_api

### 引擎特性
- DAG 拓扑排序 + 并行批次执行
- 条件分支路由（_output_index）
- 执行状态持久化（每节点完成后写 DB）
- 工作流级超时（默认 300s）
- 并发度控制（Semaphore 10）
- 错误输出分支（on_error: stop/continue/error_output）
- 代码节点安全白名单（30 个模块）
- 服务重启恢复（recover_on_startup）

### 全面测试
```bash
python tests/wf_test.py
# 预期：25/25 全通过
# 报告：data/wf_test_report.html
```

---

## 常见错误及修复模式

| 症状 | 根因 | 修复 |
|------|------|------|
| `NameError: asyncio` | 文件缺少 `import asyncio` | 在文件顶部加 `import asyncio` |
| 前端 405 错误 | 路由未注册或 method 不匹配 | 检查 api/routes/ 中的 register() |
| 服务启动端口被占 | 旧进程未退出 | `taskkill /F /IM python.exe` |
| React Flow handle 无法连线 | Handle inline style 覆盖 | 不要给 Handle 传自定义 style |
| 推荐问题不匹配岗位 | API 未按 position_id 过滤 | 传 position_id 参数 |
| 工作流执行失败 | engine.py 内部异常 | 查 data/logs/forge.log |
| Windows 编码乱码 | 日志文件未指定 UTF-8 | FileHandler 加 encoding="utf-8" |

---

## 文件编辑安全规则

- 修改 API 路由文件时，确认新路由在 `register()` 函数中注册
- 修改 workflow/nodes/ 时，确认节点在 `__init__.py` 的 `register_all_nodes` 中导入
- 修改前端组件时，确认 import 路径正确，不要改到 markdown 文件
- 修改 store 层时，确认 SQL 用参数化查询（?占位符），不要用 f-string 拼接用户输入
- 新增 Python 文件时，确保模块级 docstring + type hints
