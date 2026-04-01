"""
AgentForgeV2 — 运行时指标采集（滑动窗口，内存中，不依赖 Prometheus）

使用: metrics.inc("requests_total", position_id="pm")
      metrics.observe("llm_latency", 2.3, model="qwen3.5-plus")
"""
from __future__ import annotations
import time
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Lock


@dataclass
class _Point:
    timestamp: float
    value: float
    labels: dict = field(default_factory=dict)


class MetricsCollector:
    def __init__(self, window_seconds: int = 3600):
        self._window = window_seconds
        self._lock = Lock()
        self._counters: dict[str, list[_Point]] = defaultdict(list)
        self._histograms: dict[str, list[_Point]] = defaultdict(list)

    def inc(self, name: str, value: float = 1, **labels) -> None:
        with self._lock:
            self._counters[name].append(_Point(time.time(), value, labels))

    def observe(self, name: str, value: float, **labels) -> None:
        with self._lock:
            self._histograms[name].append(_Point(time.time(), value, labels))

    def get_counter(self, name: str, minutes: int = 60) -> float:
        cutoff = time.time() - minutes * 60
        with self._lock:
            self._counters[name] = self._cleanup(self._counters[name])
            return sum(p.value for p in self._counters[name] if p.timestamp > cutoff)

    def get_histogram(self, name: str, minutes: int = 60) -> dict:
        cutoff = time.time() - minutes * 60
        with self._lock:
            self._histograms[name] = self._cleanup(self._histograms[name])
            values = sorted(p.value for p in self._histograms[name] if p.timestamp > cutoff)
        if not values:
            return {"count": 0, "avg": 0, "p50": 0, "p95": 0, "p99": 0, "min": 0, "max": 0}
        n = len(values)
        return {"count": n, "avg": round(sum(values)/n, 3), "p50": round(values[int(n*0.5)], 3),
                "p95": round(values[min(int(n*0.95), n-1)], 3), "p99": round(values[min(int(n*0.99), n-1)], 3),
                "min": round(values[0], 3), "max": round(values[-1], 3)}

    def get_counter_by_label(self, name: str, label_key: str, minutes: int = 60) -> dict:
        cutoff = time.time() - minutes * 60
        with self._lock:
            self._counters[name] = self._cleanup(self._counters[name])
            result: dict[str, float] = defaultdict(float)
            for p in self._counters[name]:
                if p.timestamp > cutoff:
                    result[p.labels.get(label_key, "unknown")] += p.value
            return dict(result)

    def get_histogram_by_label(self, name: str, label_key: str, minutes: int = 60) -> dict:
        cutoff = time.time() - minutes * 60
        with self._lock:
            self._histograms[name] = self._cleanup(self._histograms[name])
            groups: dict[str, list[float]] = defaultdict(list)
            for p in self._histograms[name]:
                if p.timestamp > cutoff:
                    groups[p.labels.get(label_key, "unknown")].append(p.value)
        result = {}
        for key, vals in groups.items():
            vals.sort(); n = len(vals)
            result[key] = {"count": n, "avg": round(sum(vals)/n, 3), "p95": round(vals[min(int(n*0.95), n-1)], 3)}
        return result

    def snapshot(self) -> dict:
        req = self.get_counter("requests_total", 60)
        err = self.get_counter("errors_total", 60)
        tc = self.get_counter("tool_calls", 60)
        te = self.get_counter("tool_errors", 60)
        fu = self.get_counter("feedback_up", 1440)
        fd = self.get_counter("feedback_down", 1440)
        return {
            "requests_total_1h": req, "requests_by_position": self.get_counter_by_label("requests_total", "position_id", 60),
            "errors_total_1h": err, "error_rate_1h": round(err / max(req, 1), 4),
            "llm_calls_total_1h": self.get_counter("llm_calls", 60),
            "llm_calls_by_model": self.get_counter_by_label("llm_calls", "model", 60),
            "llm_calls_by_tier": self.get_counter_by_label("llm_calls", "tier", 60),
            "llm_errors_total_1h": self.get_counter("llm_errors", 60),
            "llm_fallbacks_1h": self.get_counter("llm_fallback", 60),
            "llm_latency_1h": self.get_histogram("llm_latency", 60),
            "llm_ttft_1h": self.get_histogram("llm_ttft", 60),
            "llm_latency_by_model": self.get_histogram_by_label("llm_latency", "model", 60),
            "tokens_input_1h": self.get_counter("tokens_input", 60),
            "tokens_output_1h": self.get_counter("tokens_output", 60),
            "tokens_total_1h": self.get_counter("tokens_input", 60) + self.get_counter("tokens_output", 60),
            "tool_calls_total_1h": tc, "tool_calls_by_name": self.get_counter_by_label("tool_calls", "tool", 60),
            "tool_errors_total_1h": te, "tool_errors_by_name": self.get_counter_by_label("tool_errors", "tool", 60),
            "tool_success_rate_1h": round(1 - te / max(tc, 1), 4),
            "tool_latency_1h": self.get_histogram("tool_latency", 60),
            "tool_latency_by_name": self.get_histogram_by_label("tool_latency", "tool", 60),
            "guardrail_blocks_1h": self.get_counter("guardrail_blocks", 60),
            "feedback_up_24h": fu, "feedback_down_24h": fd,
            "satisfaction_rate_24h": round(fu / max(fu + fd, 1), 4),
            # RAG 级
            "rag_searches_1h": self.get_counter("rag_searches", 60),
            "rag_skipped_1h": self.get_counter("rag_skipped", 60),
            "rag_reranked_1h": self.get_counter("rag_reranked", 60),
            "rag_query_rewritten_1h": self.get_counter("rag_query_rewritten", 60),
            "rag_top_score_1h": self.get_histogram("rag_top_score", 60),
            "collected_at": time.time(),
        }

    def _cleanup(self, points: list[_Point]) -> list[_Point]:
        cutoff = time.time() - self._window
        return [p for p in points if p.timestamp > cutoff]
