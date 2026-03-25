"""
AgentForge V2 — 存储层测试
"""

import asyncio
import os
import pytest
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from memory.session_store import SessionStore
from memory.signal_store import SignalStore


@pytest.fixture
def tmp_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    os.unlink(path)


@pytest.mark.asyncio
async def test_session_lifecycle(tmp_db):
    store = SessionStore(tmp_db)

    # 创建会话
    sid = await store.create_session("user1", org_id="org1", position_id="pm")
    assert sid

    # 添加消息
    mid = await store.add_message(sid, "user", "你好")
    assert mid
    await store.add_message(sid, "assistant", "你好！有什么可以帮你的？")

    # 获取历史
    history = await store.get_history(sid)
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"

    # 消息计数
    count = await store.count_messages(sid)
    assert count == 2

    # LLM 格式历史
    llm_msgs = await store.get_history_as_llm_messages(sid)
    assert len(llm_msgs) == 2
    assert llm_msgs[0]["role"] == "user"

    # 会话列表
    sessions = await store.list_sessions("user1")
    assert len(sessions) == 1
    assert sessions[0]["id"] == sid

    # 更新标题
    await store.update_session_title(sid, "测试对话")
    session = await store.get_session(sid)
    assert session["title"] == "测试对话"

    # 删除
    await store.delete_session(sid)
    assert await store.get_session(sid) is None


@pytest.mark.asyncio
async def test_session_list_filter(tmp_db):
    store = SessionStore(tmp_db)
    await store.create_session("u1", org_id="org1", position_id="pm")
    await store.create_session("u1", org_id="org1", position_id="dev")
    await store.create_session("u2", org_id="org1", position_id="pm")

    # 按用户过滤
    sessions = await store.list_sessions("u1")
    assert len(sessions) == 2

    # 按岗位过滤
    sessions = await store.list_sessions("u1", position_id="pm")
    assert len(sessions) == 1


@pytest.mark.asyncio
async def test_signal_store(tmp_db):
    store = SignalStore(tmp_db)

    # 添加信号
    sid = await store.add_signal("u1", "org1", "pm", "preference", "用户偏好中文回答")
    assert sid

    signals = await store.get_recent_signals("u1", "org1")
    assert len(signals) == 1

    # 模式
    pid = await store.upsert_pattern("u1", "org1", "pm", "language", "偏好中文")
    assert pid
    # 重复 upsert 应该更新计数
    await store.upsert_pattern("u1", "org1", "pm", "language", "偏好中文")
    patterns = await store.get_patterns("u1", "org1")
    assert len(patterns) == 1
    assert patterns[0]["occurrence_count"] == 2

    # 洞察
    iid = await store.add_insight("u1", "org1", "pm", "suggestion", "建议", "优化工作流")
    assert iid
    insights = await store.get_insights("u1", "org1")
    assert len(insights) == 1

    # 标记已读
    await store.mark_insight_read(iid)
    unread = await store.get_insights("u1", "org1", unread_only=True)
    assert len(unread) == 0
