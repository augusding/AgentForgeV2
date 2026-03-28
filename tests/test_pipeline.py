"""
AgentForge V2 — Pipeline + Knowledge 测试
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.models import Mission, PositionConfig
from core.pipeline.context_builder import ContextBuilder
from knowledge.chunker import DocumentChunker


# ── ContextBuilder 测试 ───────────────────────────────────

class TestContextBuilder:

    def setup_method(self):
        self.builder = ContextBuilder()
        self.position = PositionConfig(
            position_id="test-pm",
            display_name="测试PM",
            role="你是一个产品经理的AI助手。",
            goal="帮助产品经理管理产品。",
            context="产品管理方法论：用户故事、Sprint 规划、需求优先级排序。",
        )

    def test_basic_build(self):
        mission = Mission(id="t1", instruction="帮我分析需求")
        ctx = self.builder.build(self.position, mission)
        assert "产品经理" in ctx.system_prompt
        assert ctx.complexity in ("simple", "standard", "complex")
        assert len(ctx.messages) == 1
        assert ctx.messages[0]["role"] == "user"

    def test_with_history(self):
        mission = Mission(id="t2", instruction="继续上次的分析")
        history = [
            {"role": "user", "content": "分析一下竞品"},
            {"role": "assistant", "content": "好的，我来分析..."},
        ]
        ctx = self.builder.build(self.position, mission, history=history)
        assert len(ctx.messages) == 3  # 2 history + 1 new

    def test_with_rag(self):
        mission = Mission(id="t3", instruction="根据文档回答")
        rag = [{"title": "需求文档", "content": "用户需要一个搜索功能"}]
        ctx = self.builder.build(self.position, mission, rag_results=rag)
        assert "参考资料" in ctx.system_prompt
        assert "搜索功能" in ctx.system_prompt

    def test_complexity_simple(self):
        mission = Mission(id="t4", instruction="你好")
        ctx = self.builder.build(self.position, mission)
        assert ctx.complexity == "simple"

    def test_complexity_standard(self):
        mission = Mission(id="t5", instruction="帮我制定一个完整的产品战略规划方案")
        ctx = self.builder.build(self.position, mission)
        assert ctx.complexity == "standard"


# ── DocumentChunker 测试 ──────────────────────────────────

class TestDocumentChunker:

    def setup_method(self):
        self.chunker = DocumentChunker(chunk_size=200, overlap=50)

    def test_short_text(self):
        chunks = self.chunker.chunk_text("短文本")
        assert len(chunks) == 1
        assert chunks[0].content == "短文本"

    def test_long_text_split(self):
        text = "这是一段测试文本。" * 50  # ~450 chars
        chunks = self.chunker.chunk_text(text)
        assert len(chunks) > 1

    def test_paragraph_split(self):
        text = "段落一内容。\n\n段落二内容。\n\n段落三内容。"
        chunks = self.chunker.chunk_text(text)
        assert len(chunks) >= 1

    def test_markdown_split(self):
        text = "# 标题一\n内容一\n## 标题二\n内容二\n## 标题三\n内容三"
        chunks = self.chunker.chunk_markdown(text)
        assert len(chunks) >= 2

    def test_empty_text(self):
        assert self.chunker.chunk_text("") == []
        assert self.chunker.chunk_markdown("") == []

    def test_chunk_metadata(self):
        chunks = self.chunker.chunk_text("测试", metadata={"source": "test"})
        assert chunks[0].metadata["source"] == "test"
