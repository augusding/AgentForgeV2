"""
AgentForge V2 — LLM 调用客户端

支持多提供商 (Anthropic / OpenAI-Compatible) + 自动降级。
保持简洁：一个类，清晰的接口，无隐式状态。
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, AsyncIterator

from core.models import ForgeConfig, LLMResponse

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """LLM 调用错误基类。"""


class BudgetExhaustedError(LLMError):
    """预算耗尽。"""


class AllProvidersFailedError(LLMError):
    """所有提供商均失败。"""


# ── 提供商适配器 ──────────────────────────────────────────

class _AnthropicAdapter:
    """Anthropic (Claude) 原生 SDK 适配。"""

    def __init__(self, api_key: str):
        import anthropic
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.provider = "anthropic"

    async def chat(
        self, model: str, system: str, messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.7, max_tokens: int = 4096,
        thinking_budget: int = 0,
    ) -> LLMResponse:
        start = time.time()
        kwargs: dict[str, Any] = {
            "model": model,
            "system": system,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = tools
        # Extended thinking
        if thinking_budget > 0:
            kwargs["temperature"] = 1  # Anthropic 要求 thinking 时 temperature=1
            kwargs["thinking"] = {"type": "enabled", "budget_tokens": thinking_budget}
        else:
            kwargs["temperature"] = temperature

        resp = await self.client.messages.create(**kwargs)

        content = ""
        tool_calls = []
        for block in resp.content:
            if block.type == "text":
                content += block.text
            elif block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "arguments": block.input,
                })

        return LLMResponse(
            content=content,
            model=resp.model,
            provider=self.provider,
            input_tokens=resp.usage.input_tokens,
            output_tokens=resp.usage.output_tokens,
            total_tokens=resp.usage.input_tokens + resp.usage.output_tokens,
            finish_reason=resp.stop_reason or "",
            duration=time.time() - start,
            tool_calls=tool_calls,
        )

    async def stream(
        self, model: str, system: str, messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.7, max_tokens: int = 4096,
        tool_choice: str | dict | None = None,
    ) -> AsyncIterator[dict]:
        kwargs: dict[str, Any] = {
            "model": model,
            "system": system,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
            if tool_choice:
                kwargs["tool_choice"] = tool_choice

        async with self.client.messages.stream(**kwargs) as stream:
            async for event in stream:
                if hasattr(event, "type"):
                    if event.type == "content_block_delta":
                        if hasattr(event.delta, "text"):
                            yield {"type": "text", "text": event.delta.text}
                        elif hasattr(event.delta, "partial_json"):
                            yield {"type": "tool_input", "text": event.delta.partial_json}
                    elif event.type == "content_block_start":
                        if hasattr(event.content_block, "name"):
                            yield {"type": "tool_start", "name": event.content_block.name, "id": event.content_block.id}
                    elif event.type == "message_delta":
                        yield {"type": "message_delta", "stop_reason": getattr(event.delta, "stop_reason", "")}


class _OpenAICompatAdapter:
    """OpenAI 兼容接口适配 (DeepSeek, Qwen, MiniMax, Kimi 等)。"""

    def __init__(self, api_key: str, base_url: str, provider: str):
        import openai
        self.client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.provider = provider

    async def chat(
        self, model: str, system: str, messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.7, max_tokens: int = 4096,
        thinking_budget: int = 0,
    ) -> LLMResponse:
        start = time.time()
        full_messages = [{"role": "system", "content": system}] + messages
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": full_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = self._convert_tools(tools)

        resp = await self.client.chat.completions.create(**kwargs)
        choice = resp.choices[0] if resp.choices else None
        content = choice.message.content or "" if choice else ""
        tool_calls = []
        if choice and choice.message.tool_calls:
            import json
            for tc in choice.message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": json.loads(tc.function.arguments) if tc.function.arguments else {},
                })

        usage = resp.usage
        return LLMResponse(
            content=content,
            model=resp.model or model,
            provider=self.provider,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            total_tokens=usage.total_tokens if usage else 0,
            finish_reason=choice.finish_reason or "" if choice else "",
            duration=time.time() - start,
            tool_calls=tool_calls,
        )

    async def stream(
        self, model: str, system: str, messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.7, max_tokens: int = 4096,
        tool_choice: str | dict | None = None,
    ) -> AsyncIterator[dict]:
        full_messages = [{"role": "system", "content": system}] + messages
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": full_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if tools:
            kwargs["tools"] = self._convert_tools(tools)
            if tool_choice:
                kwargs["tool_choice"] = tool_choice

        stream = await self.client.chat.completions.create(**kwargs)
        tool_acc: dict[int, dict] = {}  # index → {id, name, arg_parts}
        finish = ""
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            finish = chunk.choices[0].finish_reason or finish
            if delta.content:
                yield {"type": "text", "text": delta.content}
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_acc:
                        tool_acc[idx] = {"id": tc.id or f"call_{idx}", "name": "", "arg_parts": []}
                    if tc.id:
                        tool_acc[idx]["id"] = tc.id
                    if tc.function and tc.function.name:
                        tool_acc[idx]["name"] = tc.function.name
                    if tc.function and tc.function.arguments:
                        tool_acc[idx]["arg_parts"].append(tc.function.arguments)
        # 流结束后 yield 完整的工具调用
        for idx in sorted(tool_acc):
            ta = tool_acc[idx]
            import json as _json
            raw = "".join(ta["arg_parts"])
            try:
                args = _json.loads(raw) if raw else {}
            except _json.JSONDecodeError:
                args = {"raw": raw}
            yield {"type": "tool_call", "id": ta["id"], "name": ta["name"], "arguments": args}
        yield {"type": "message_done", "stop_reason": "tool_use" if tool_acc else (finish or "end_turn")}

    @staticmethod
    def _convert_tools(tools: list[dict]) -> list[dict]:
        """Anthropic tool format → OpenAI function format."""
        result = []
        for t in tools:
            result.append({
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "parameters": t.get("input_schema", {}),
                },
            })
        return result


# ── 提供商注册表 ──────────────────────────────────────────

_OPENAI_COMPAT_PROVIDERS: dict[str, str] = {
    "deepseek": "https://api.deepseek.com/v1",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "minimax": "https://api.minimaxi.com/v1",
    "kimi": "https://api.moonshot.cn/v1",
    "zhipu": "https://open.bigmodel.cn/api/paas/v4",
    "doubao": "https://ark.cn-beijing.volces.com/api/v3",
    "openai": "https://api.openai.com/v1",
}


# ── 主客户端 ──────────────────────────────────────────────

class LLMClient:
    """
    多提供商 LLM 客户端，支持 Tier 降级。

    用法:
        client = LLMClient(forge_config)
        resp = await client.chat(system="你是助手", messages=[...])
    """

    def __init__(self, config: ForgeConfig):
        self.config = config
        llm_cfg = config.llm
        self._tiers: list[dict] = []
        self._adapters: dict[str, Any] = {}
        self._cooldowns: dict[str, float] = {}
        self._cooldown_seconds = llm_cfg.get("cooldown_seconds", 300)

        # 构建 Tier 链
        tiers_cfg = llm_cfg.get("tiers", {})
        for tier_key in ["tier1", "tier2", "tier3"]:
            tier = tiers_cfg.get(tier_key, {})
            if not tier or (tier_key != "tier1" and not tier.get("enabled", True)):
                continue
            provider = tier.get("provider", "")
            model = tier.get("model", "")
            api_key_env = tier.get("api_key_env", "")
            api_key = os.environ.get(api_key_env, "")
            if not api_key:
                logger.warning("Tier %s: API key 未配置 (%s)", tier_key, api_key_env)
                continue
            self._tiers.append({
                "key": tier_key,
                "provider": provider,
                "model": model,
                "api_key": api_key,
                "base_url": tier.get("base_url", ""),
            })
            # 创建适配器
            if provider not in self._adapters:
                self._adapters[provider] = self._create_adapter(provider, api_key, tier.get("base_url", ""))

        if not self._tiers:
            logger.error("没有可用的 LLM Tier，请检查配置和环境变量")

    def _create_adapter(self, provider: str, api_key: str, base_url: str = "") -> Any:
        if provider == "anthropic":
            return _AnthropicAdapter(api_key)
        url = base_url or _OPENAI_COMPAT_PROVIDERS.get(provider, "")
        if not url:
            raise LLMError(f"未知提供商: {provider}")
        return _OpenAICompatAdapter(api_key, url, provider)

    def _is_cooled_down(self, tier_key: str) -> bool:
        expire = self._cooldowns.get(tier_key, 0)
        return time.time() < expire

    def _set_cooldown(self, tier_key: str) -> None:
        self._cooldowns[tier_key] = time.time() + self._cooldown_seconds
        logger.warning("Tier %s 进入冷却 (%ds)", tier_key, self._cooldown_seconds)

    async def chat(
        self, system: str, messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.7, max_tokens: int = 4096,
        model_override: str | None = None,
        thinking_budget: int = 0,
    ) -> LLMResponse:
        """
        调用 LLM，自动 Tier 降级。
        model_override: 强制使用特定模型 (跳过 tier 链)。
        """
        errors = []
        for tier in self._tiers:
            if self._is_cooled_down(tier["key"]):
                continue
            adapter = self._adapters.get(tier["provider"])
            if not adapter:
                continue
            model = model_override or tier["model"]
            try:
                resp = await adapter.chat(
                    model=model, system=system, messages=messages,
                    tools=tools, temperature=temperature,
                    max_tokens=max_tokens, thinking_budget=thinking_budget,
                )
                logger.info(
                    "LLM 调用成功: tier=%s provider=%s model=%s tokens=%d",
                    tier["key"], tier["provider"], resp.model, resp.total_tokens,
                )
                return resp
            except Exception as e:
                logger.warning("Tier %s 失败: %s", tier["key"], e)
                errors.append(f"{tier['key']}: {e}")
                self._set_cooldown(tier["key"])

        raise AllProvidersFailedError(f"所有 Tier 均失败: {'; '.join(errors)}")

    async def stream(
        self, system: str, messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.7, max_tokens: int = 4096,
        tool_choice: str | dict | None = None,
    ) -> AsyncIterator[dict]:
        """流式调用，自动选择第一个可用 Tier。"""
        for tier in self._tiers:
            if self._is_cooled_down(tier["key"]):
                continue
            adapter = self._adapters.get(tier["provider"])
            if not adapter:
                continue
            try:
                async for chunk in adapter.stream(
                    model=tier["model"], system=system, messages=messages,
                    tools=tools, temperature=temperature, max_tokens=max_tokens,
                    tool_choice=tool_choice,
                ):
                    yield chunk
                return
            except Exception as e:
                logger.warning("Stream tier %s 失败: %s", tier["key"], e)
                self._set_cooldown(tier["key"])

        raise AllProvidersFailedError("所有 Tier 流式调用均失败")
