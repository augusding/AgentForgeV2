"""ConnectorRegistry：connector_type → Adapter 类的全局路由表（单例）。"""
from __future__ import annotations

import logging
from typing import Type

from knowledge.connectors.base import BaseAdapter

logger = logging.getLogger(__name__)


class ConnectorRegistry:
    _instance: "ConnectorRegistry | None" = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._registry: dict[str, Type[BaseAdapter]] = {}
        return cls._instance

    def register(self, adapter_cls: Type[BaseAdapter]) -> None:
        ct = adapter_cls.connector_type
        if ct in self._registry:
            logger.warning("覆盖已注册 Adapter: %s", ct)
        self._registry[ct] = adapter_cls

    def get(self, connector_type: str) -> Type[BaseAdapter] | None:
        return self._registry.get(connector_type)

    def build(self, connector_id: str, connector_type: str, config: dict) -> BaseAdapter:
        cls = self.get(connector_type)
        if not cls:
            raise ValueError(f"未知类型: {connector_type}，已注册: {list(self._registry)}")
        return cls(connector_id=connector_id, config=config)

    def list_types(self) -> list[dict]:
        result = []
        for ct, cls in self._registry.items():
            obj = cls.__new__(cls)
            obj.connector_id = ""
            obj.config = {}
            result.append({"type": ct, "schema": obj.get_config_schema()})
        return result


def get_registry() -> ConnectorRegistry:
    return ConnectorRegistry()


def _auto_register() -> None:
    try:
        from knowledge.connectors.adapters.local_file import LocalFileAdapter
        get_registry().register(LocalFileAdapter)
    except ImportError:
        pass
    try:
        from knowledge.connectors.adapters.web import WebAdapter
        get_registry().register(WebAdapter)
    except ImportError:
        pass
    try:
        from knowledge.connectors.adapters.confluence import ConfluenceAdapter
        get_registry().register(ConfluenceAdapter)
    except ImportError:
        pass
    try:
        from knowledge.connectors.adapters.sql import SQLAdapter
        get_registry().register(SQLAdapter)
    except ImportError:
        pass


_auto_register()
