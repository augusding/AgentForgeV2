# Memory 模块

## 职责
持久化存储，按领域拆分为多个 Store，每个 Store 职责单一。

## 文件说明
| 文件 | 职责 | 表 |
|------|------|-----|
| `base.py` | SQLite 连接管理 + 公共工具方法 | - |
| `session_store.py` | 对话历史 + 会话管理 | sessions, messages |
| `signal_store.py` | 信号 + 模式 + 洞察 | signals, patterns, insights |
| `work_item_store.py` | 工作项 + 日程 + 跟进 | work_items, schedules, followups |

## 约束
- 每个 Store 只操作自己的表
- Store 之间不互相引用
- 所有方法接受 user_id + org_id 参数做隔离
- 使用 aiosqlite 异步操作
