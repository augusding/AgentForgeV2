"""AgentForgeV2 — 单请求全链路追踪（内存 LRU，500 条）"""
from __future__ import annotations
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from threading import Lock


@dataclass
class Span:
    name: str; timestamp: float; duration: float = 0.0; data: dict = field(default_factory=dict)


@dataclass
class Trace:
    request_id: str; start_time: float; end_time: float = 0.0
    status: str = "running"; metadata: dict = field(default_factory=dict)
    spans: list[Span] = field(default_factory=list)

    @property
    def duration(self) -> float:
        return round((self.end_time or time.time()) - self.start_time, 3)

    def to_dict(self) -> dict:
        return {
            "request_id": self.request_id, "status": self.status,
            "start_time": self.start_time, "end_time": self.end_time,
            "duration": self.duration, "metadata": self.metadata,
            "spans": [{"name": s.name, "timestamp": s.timestamp,
                       "offset_ms": round((s.timestamp - self.start_time) * 1000),
                       "duration_ms": round(s.duration * 1000, 1), "data": s.data}
                      for s in self.spans],
            "summary": {
                "total_spans": len(self.spans),
                "llm_calls": sum(1 for s in self.spans if s.name.startswith("llm_call")),
                "tool_calls": sum(1 for s in self.spans if s.name.startswith("tool_")),
                "llm_time_ms": round(sum(s.duration for s in self.spans if s.name.startswith("llm_call")) * 1000),
                "tool_time_ms": round(sum(s.duration for s in self.spans if s.name.startswith("tool_")) * 1000),
            },
        }


class RequestTracer:
    def __init__(self, max_traces: int = 500):
        self._lock = Lock()
        self._traces: OrderedDict[str, Trace] = OrderedDict()
        self._max = max_traces

    def start(self, request_id: str, metadata: dict | None = None) -> None:
        with self._lock:
            self._traces[request_id] = Trace(request_id=request_id, start_time=time.time(), metadata=metadata or {})
            while len(self._traces) > self._max:
                self._traces.popitem(last=False)

    def span(self, request_id: str, name: str, duration: float = 0, **data) -> None:
        with self._lock:
            t = self._traces.get(request_id)
            if t: t.spans.append(Span(name=name, timestamp=time.time(), duration=duration, data=data))

    def end(self, request_id: str, status: str = "completed", **data) -> None:
        with self._lock:
            t = self._traces.get(request_id)
            if t:
                t.end_time = time.time(); t.status = status
                if data: t.metadata.update(data)

    def get(self, request_id: str) -> dict | None:
        with self._lock:
            t = self._traces.get(request_id)
            return t.to_dict() if t else None

    def list_recent(self, limit: int = 20) -> list[dict]:
        with self._lock:
            items = list(self._traces.values())[-limit:]
            items.reverse()
            return [{"request_id": t.request_id, "status": t.status, "duration": t.duration,
                     "user_id": t.metadata.get("user_id", ""), "content": t.metadata.get("content", "")[:50],
                     "spans_count": len(t.spans), "start_time": t.start_time} for t in items]
