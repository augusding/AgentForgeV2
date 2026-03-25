# Workflow 模块

## 职责
DAG 工作流引擎：定义 → 存储 → 触发 → 调度 → 执行。

## 文件说明
| 文件 | 职责 |
|------|------|
| `engine.py` | WorkflowEngine: DAG 执行调度器 |
| `store.py` | 工作流定义 + 执行记录的持久化 |
| `trigger.py` | 统一触发器：Cron / Webhook / Chat |
| `types.py` | 工作流数据结构 |
| `nodes/` | 节点类型实现 |

## 约束
- 工作流定义用 YAML，运行时用 dataclass
- 每个节点是独立函数/类，可单独测试
- 执行状态全部持久化到 SQLite
