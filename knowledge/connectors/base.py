"""
AgentForge V2 — Source Adapter 抽象基类

设计要点：
  - Adapter 只负责"拉取原始数据"，不做 NLP 处理
  - extract() 返回 AsyncIterator（流式），避免大批量全量加载内存
  - cursor=None 全量，cursor=<字符串> 增量续传，含义由 Adapter 自定义
  - validate() 须同时验证"能连接"和"有读权限"
  - 所有网络请求强制开启 SSL，不允许 verify=False
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class RawDoc:
    """所有 Adapter 的统一输出格式。Pipeline 和 Storage 不感知数据来源。"""
    doc_id: str
    content: str
    title: str = ""
    source_url: str = ""
    source_type: str = ""
    content_hash: str = ""
    lang: str = ""
    quality_score: float = 1.0
    extra_meta: dict = field(default_factory=dict)


class BaseAdapter(ABC):
    """连接器抽象基类。新 Adapter 只需实现 validate() 和 extract()。"""

    connector_type: str = "base"

    def __init__(self, connector_id: str, config: dict):
        self.connector_id = connector_id
        self.config = config

    @abstractmethod
    async def validate(self) -> tuple[bool, str]:
        """验证连接可用性和权限。返回 (ok, message)。"""

    @abstractmethod
    async def extract(self, cursor: str | None) -> AsyncIterator[RawDoc]:
        """流式拉取文档。cursor=None 全量，cursor=<值> 增量。"""

    def get_config_schema(self) -> dict:
        """返回配置 JSON Schema，前端据此动态渲染表单。子类应覆盖。"""
        return {"type": "object", "properties": {}, "required": []}
