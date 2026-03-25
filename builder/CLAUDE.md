# Builder 模块

## 职责
引导式 Agent Profile 创建器。通过对话采集业务信息，自动生成岗位配置。

## 流程
1. **Intake** — 对话式采集：行业、岗位、工具、知识范围
2. **Generate** — LLM 生成 YAML 配置
3. **Review** — 用户审核 + 微调
4. **Deploy** — 写入 profiles/ 并热加载

## 文件说明
| 文件 | 职责 |
|------|------|
| `engine.py` | BuilderEngine 主控 |
| `intake.py` | 对话式信息采集 |
| `generator.py` | LLM 驱动的配置生成 |
| `models.py` | Builder 专用数据结构 |

## 约束
- Builder 使用独立 SQLite 存储 (data/builder.db)
- 生成的 YAML 必须符合 PositionConfig schema
