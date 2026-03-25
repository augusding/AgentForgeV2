# API 模块

## 职责
HTTP REST API 层。按领域拆分路由，每个文件 < 500 行。

## 文件说明
| 文件 | 职责 | 路由前缀 |
|------|------|---------|
| `app.py` | aiohttp app 创建 + 中间件挂载 | - |
| `routes/auth.py` | 登录/注册/JWT/密码 | `/api/v1/auth/` |
| `routes/chat.py` | 对话/消息/会话 | `/api/v1/chat/` |
| `routes/positions.py` | 岗位列表/详情 | `/api/v1/positions/` |
| `routes/health.py` | 健康检查 | `/api/v1/` |
| `middleware/auth.py` | JWT 认证中间件 | - |
| `middleware/cors.py` | CORS 中间件 | - |

## 约束
- 路由函数只做：解析请求 → 调用 engine → 格式化响应
- 业务逻辑不写在路由里
- 统一用 `_json` 返回 JSON
- 认证通过中间件统一处理
