"""
AgentForge V2 — 全系统 UAT 测试

对运行中的服务执行全面功能验证。
用法：
    1. 先启动服务: python forge.py serve
    2. 新终端运行: python tests/uat_test.py

会自动测试所有 API 端点并生成报告。
"""

import json
import time
import sys
import urllib.request
import urllib.error
import urllib.parse

BASE = "http://localhost:8080/api/v1"
TOKEN = ""
RESULTS = []
PASS = 0
FAIL = 0
SKIP = 0


def log(status, category, name, detail=""):
    global PASS, FAIL, SKIP
    icon = {"PASS": "✅", "FAIL": "❌", "SKIP": "⚠️"}.get(status, "?")
    if status == "PASS": PASS += 1
    elif status == "FAIL": FAIL += 1
    else: SKIP += 1
    RESULTS.append({"status": status, "category": category, "name": name, "detail": detail})
    line = f"  {icon} [{category}] {name}"
    if detail:
        line += f" — {detail[:120]}"
    print(line)


def req(method, path, data=None, expect_status=200, auth=True):
    """发送请求，返回 (status_code, response_body_dict)"""
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if auth and TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"

    body = json.dumps(data).encode("utf-8") if data else None
    request = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(request, timeout=30) as resp:
            text = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(text)
            except json.JSONDecodeError:
                return resp.status, {"_raw": text[:500]}
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(text)
        except json.JSONDecodeError:
            return e.code, {"_raw": text[:500], "error": str(e)}
    except Exception as e:
        return 0, {"error": str(e)}


def test_sse_stream(path, data):
    """测试 SSE 流式端点，返回收到的事件列表。"""
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"

    body = json.dumps(data).encode("utf-8")
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(request, timeout=60) as resp:
            events = []
            current_event = ""
            for line in resp.read().decode("utf-8").split("\n"):
                if line.startswith("event: "):
                    current_event = line[7:].strip()
                elif line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        events.append({"event": current_event or data.get("type", ""), "data": data})
                    except json.JSONDecodeError:
                        pass
                    current_event = ""
            return events
    except Exception as e:
        return [{"event": "error", "data": {"error": str(e)}}]


# ══════════════════════════════════════════════════════════
# UAT 测试开始
# ══════════════════════════════════════════════════════════

def main():
    global TOKEN

    print("=" * 60)
    print("  AgentForge V2 — 全系统 UAT 测试")
    print("=" * 60)
    print()

    # ── 0. 连通性检查 ──────────────────────────────────────
    print("▶ 0. 连通性检查")
    status, data = req("GET", "/health", auth=False)
    if status == 200:
        log("PASS", "Health", "GET /health", f"status={data.get('status')}, version={data.get('version')}")
        # 检查健康检查增强字段
        for field in ["db", "llm", "tools", "profiles"]:
            if field in data:
                log("PASS", "Health", f"  增强字段: {field}", str(data[field])[:80])
            else:
                log("SKIP", "Health", f"  增强字段: {field}", "字段缺失")
    else:
        log("FAIL", "Health", "GET /health", f"status={status} — 服务未运行？")
        print("\n⛔ 服务未启动，请先运行 python forge.py serve")
        return

    status, data = req("GET", "/stats", auth=False)
    log("PASS" if status == 200 else "FAIL", "Health", "GET /stats", str(data)[:100])

    # ── 1. 认证系统 ────────────────────────────────────────
    print("\n▶ 1. 认证系统")

    # 登录
    status, data = req("POST", "/auth/login", {"username": "admin", "password": "admin123"}, auth=False)
    if status == 200 and data.get("token"):
        TOKEN = data["token"]
        log("PASS", "Auth", "POST /auth/login", f"token={TOKEN[:20]}...")
    else:
        log("FAIL", "Auth", "POST /auth/login", f"status={status}, data={str(data)[:100]}")
        print("\n⛔ 登录失败，后续需要认证的测试将跳过")

    # 错误登录
    status, _ = req("POST", "/auth/login", {"username": "admin", "password": "wrong"}, auth=False)
    log("PASS" if status == 401 else "FAIL", "Auth", "  错误密码 → 401", f"实际 status={status}")

    # /auth/me
    status, data = req("GET", "/auth/me")
    log("PASS" if status == 200 and data.get("username") else "FAIL", "Auth", "GET /auth/me", str(data)[:100])

    # 注册（可能失败如果用户已存在，都算正常）
    status, data = req("POST", "/auth/register", {"username": "uat_test_user", "password": "test123456", "display_name": "UAT"}, auth=False)
    log("PASS" if status in (200, 409) else "FAIL", "Auth", "POST /auth/register", f"status={status}")

    # 修改密码
    status, data = req("POST", "/auth/change-password", {"old_password": "admin123", "new_password": "admin123"})
    log("PASS" if status == 200 else "FAIL", "Auth", "POST /auth/change-password", str(data)[:100])

    # logout
    status, data = req("POST", "/auth/logout")
    log("PASS" if status == 200 else "SKIP", "Auth", "POST /auth/logout", str(data)[:100])

    # 重新登录（后续测试需要 token）
    status, data = req("POST", "/auth/login", {"username": "admin", "password": "admin123"}, auth=False)
    if status == 200 and data.get("token"):
        TOKEN = data["token"]

    # ── 2. 岗位系统 ────────────────────────────────────────
    print("\n▶ 2. 岗位系统")

    status, data = req("GET", "/positions")
    positions = data.get("positions", []) if isinstance(data, dict) else data if isinstance(data, list) else []
    log("PASS" if status == 200 and len(positions) > 0 else "FAIL", "Position", "GET /positions", f"{len(positions)} 个岗位")

    if positions:
        pid = positions[0].get("position_id", "")
        status, data = req("GET", f"/positions/{pid}")
        log("PASS" if status == 200 else "FAIL", "Position", f"GET /positions/{pid}", str(data)[:80])

    # ── 3. 对话系统（核心）─────────────────────────────────
    print("\n▶ 3. 对话系统")

    # 非流式对话
    status, data = req("POST", "/chat", {"content": "你好，简短回答", "position_id": "strategy-pm", "user_id": "admin"})
    session_id = data.get("session_id", "")
    if status == 200 and data.get("content"):
        log("PASS", "Chat", "POST /chat (非流式)", f"session={session_id}, content={data['content'][:50]}...")
    else:
        log("FAIL", "Chat", "POST /chat (非流式)", f"status={status}, data={str(data)[:100]}")

    # SSE 流式对话
    events = test_sse_stream("/chat/stream", {"content": "1+1等于几？简短回答", "position_id": "strategy-pm", "user_id": "admin"})
    event_types = [e["event"] for e in events]
    has_thinking = "thinking" in event_types
    has_delta = "delta" in event_types
    has_done = "done" in event_types
    if has_delta and has_done:
        log("PASS", "Chat", "POST /chat/stream (SSE)", f"events: {event_types}")
    else:
        log("FAIL", "Chat", "POST /chat/stream (SSE)", f"events: {event_types}, 缺少 delta 或 done")

    # SSE 事件格式检查
    log("PASS" if has_thinking else "SKIP", "Chat", "  SSE event: thinking", "")
    log("PASS" if has_delta else "FAIL", "Chat", "  SSE event: delta", "")
    log("PASS" if has_done else "FAIL", "Chat", "  SSE event: done", "")

    # ── 4. 会话管理 ────────────────────────────────────────
    print("\n▶ 4. 会话管理")

    status, data = req("GET", "/sessions?user_id=admin")
    sessions = data.get("sessions", []) if isinstance(data, dict) else []
    log("PASS" if status == 200 else "FAIL", "Session", "GET /sessions", f"{len(sessions)} 个会话")

    # 兼容路由
    status, data = req("GET", "/chat/sessions")
    log("PASS" if status == 200 else "FAIL", "Session", "GET /chat/sessions (兼容)", str(data)[:80])

    if session_id:
        status, data = req("GET", f"/sessions/{session_id}/messages")
        msgs = data.get("messages", []) if isinstance(data, dict) else []
        log("PASS" if status == 200 else "FAIL", "Session", f"GET /sessions/{session_id}/messages", f"{len(msgs)} 条消息")

        # 兼容路由
        status, data = req("GET", f"/chat/sessions/{session_id}/messages")
        log("PASS" if status == 200 else "FAIL", "Session", f"GET /chat/sessions/{session_id}/messages (兼容)", "")

    # ── 5. 知识库 ──────────────────────────────────────────
    print("\n▶ 5. 知识库")

    status, data = req("GET", "/knowledge/stats")
    log("PASS" if status == 200 else "FAIL", "Knowledge", "GET /knowledge/stats", str(data)[:100])

    # 添加文档
    status, data = req("POST", "/knowledge/add", {
        "doc_id": "uat_test_doc",
        "content": "AgentForge 是一个智能工位平台。它支持多岗位AI助手、知识库检索、工作流引擎等功能。",
        "metadata": {"source": "uat_test"},
        "is_markdown": False,
    })
    log("PASS" if status == 200 and data.get("chunks", 0) > 0 else "FAIL", "Knowledge", "POST /knowledge/add", str(data)[:100])

    # 搜索
    status, data = req("POST", "/knowledge/search", {"query": "智能工位", "top_k": 3})
    results = data.get("results", []) if isinstance(data, dict) else []
    log("PASS" if status == 200 and len(results) > 0 else "FAIL", "Knowledge", "POST /knowledge/search", f"{len(results)} 条结果")

    # 删除
    status, data = req("DELETE", "/knowledge/uat_test_doc")
    log("PASS" if status == 200 else "FAIL", "Knowledge", "DELETE /knowledge/uat_test_doc", str(data)[:80])

    # ── 6. 工作流 ──────────────────────────────────────────
    print("\n▶ 6. 工作流")

    status, data = req("GET", "/workflows")
    log("PASS" if status == 200 else "FAIL", "Workflow", "GET /workflows", str(data)[:80])

    # 创建工作流
    test_wf = {
        "name": "UAT 测试工作流",
        "description": "自动化测试用",
        "nodes": [
            {"id": "n1", "type": "code", "label": "计算", "config": {"code": "result = {'x': 42}"}},
            {"id": "n2", "type": "notification", "label": "通知", "config": {"message": "结果: {{x}}"}},
        ],
        "edges": [{"source": "n1", "target": "n2"}],
    }
    status, data = req("POST", "/workflows", test_wf)
    wf_id = data.get("id", "")
    log("PASS" if status == 200 and wf_id else "FAIL", "Workflow", "POST /workflows (创建)", f"id={wf_id}")

    if wf_id:
        # 查询
        status, data = req("GET", f"/workflows/{wf_id}")
        log("PASS" if status == 200 else "FAIL", "Workflow", f"GET /workflows/{wf_id}", "")

        # 执行
        status, data = req("POST", f"/workflows/{wf_id}/execute", {})
        exec_status = data.get("status", "")
        log("PASS" if status == 200 and exec_status == "completed" else "FAIL", "Workflow", f"POST /workflows/{wf_id}/execute", f"status={exec_status}")

        # 执行记录
        status, data = req("GET", f"/workflows/{wf_id}/executions")
        execs = data.get("executions", []) if isinstance(data, dict) else []
        log("PASS" if status == 200 and len(execs) > 0 else "FAIL", "Workflow", f"GET /workflows/{wf_id}/executions", f"{len(execs)} 条记录")

        # 删除
        status, data = req("DELETE", f"/workflows/{wf_id}")
        log("PASS" if status == 200 else "FAIL", "Workflow", f"DELETE /workflows/{wf_id}", "")

    # workflow-engine 兼容路由
    status, data = req("GET", "/workflow-engine/nodes")
    log("PASS" if status == 200 else "FAIL", "Workflow", "GET /workflow-engine/nodes (兼容)", str(data)[:80])

    status, data = req("GET", "/workflow-engine/workflows")
    log("PASS" if status == 200 else "FAIL", "Workflow", "GET /workflow-engine/workflows (兼容)", str(data)[:80])

    # AI 生成工作流
    status, data = req("POST", "/workflow-engine/generate", {"prompt": "创建一个简单的审批流程"})
    if status == 200 and data.get("workflow"):
        log("PASS", "Workflow", "POST /workflow-engine/generate (AI生成)", f"nodes={len(data['workflow'].get('nodes', []))}")
    elif status == 200:
        log("SKIP", "Workflow", "POST /workflow-engine/generate (AI生成)", str(data)[:100])
    else:
        log("FAIL", "Workflow", "POST /workflow-engine/generate (AI生成)", f"status={status}, {str(data)[:100]}")

    # ── 7. 工位系统 ────────────────────────────────────────
    print("\n▶ 7. 工位系统")

    status, data = req("GET", "/workstation/home?position_id=strategy-pm")
    has_focus = "focus" in data if isinstance(data, dict) else False
    log("PASS" if status == 200 and has_focus else "FAIL", "Workstation", "GET /workstation/home", str(data)[:100])

    status, data = req("GET", "/workstation/positions")
    log("PASS" if status == 200 else "FAIL", "Workstation", "GET /workstation/positions", "")

    status, data = req("POST", "/workstation/assign", {"position_id": "strategy-pm"})
    log("PASS" if status == 200 else "FAIL", "Workstation", "POST /workstation/assign", str(data)[:80])

    # ── 8. 工作项管理 ──────────────────────────────────────
    print("\n▶ 8. 工作项管理")

    # 优先事项
    status, data = req("POST", "/daily-context/priorities", {"title": "UAT测试事项", "priority": "P0", "position_id": "strategy-pm"})
    log("PASS" if status == 200 else "FAIL", "WorkItem", "POST /daily-context/priorities", str(data)[:80])

    # 日程
    status, data = req("POST", "/daily-context/schedule", {"title": "UAT测试会议", "time": "2025-01-01 10:00", "position_id": "strategy-pm"})
    log("PASS" if status == 200 else "FAIL", "WorkItem", "POST /daily-context/schedule", str(data)[:80])

    # 跟进
    status, data = req("POST", "/daily-context/followups", {"title": "UAT跟进项", "target": "测试团队", "position_id": "strategy-pm"})
    log("PASS" if status == 200 else "FAIL", "WorkItem", "POST /daily-context/followups", str(data)[:80])

    # 每日上下文
    status, data = req("GET", "/daily-context?position_id=strategy-pm")
    log("PASS" if status == 200 else "FAIL", "WorkItem", "GET /daily-context", str(data)[:100])

    # 工作项
    status, data = req("POST", "/work-items", {"title": "UAT测试工作项", "type": "task", "priority": "P1"})
    log("PASS" if status == 200 else "FAIL", "WorkItem", "POST /work-items", str(data)[:80])

    status, data = req("GET", "/work-items")
    items = data if isinstance(data, list) else data.get("work_items", []) if isinstance(data, dict) else []
    log("PASS" if status == 200 else "FAIL", "WorkItem", "GET /work-items", f"{len(items)} 个工作项")

    # ── 9. 触发器 ──────────────────────────────────────────
    print("\n▶ 9. 触发器")

    status, data = req("GET", "/triggers")
    log("PASS" if status == 200 else "FAIL", "Trigger", "GET /triggers", str(data)[:100])

    # Webhook 测试（随机 trigger_id 应返回 404）
    status, data = req("POST", "/webhook/nonexistent", {"test": True}, auth=False)
    log("PASS" if status == 404 else "FAIL", "Trigger", "POST /webhook/nonexistent → 404", f"status={status}")

    # ── 10. Builder ────────────────────────────────────────
    print("\n▶ 10. Builder")

    status, data = req("POST", "/builder/sessions")
    builder_sid = data.get("session_id", "")
    builder_msg = data.get("message", "")
    log("PASS" if status == 200 and builder_sid else "FAIL", "Builder", "POST /builder/sessions", f"sid={builder_sid}, msg={builder_msg[:50]}")

    if builder_sid:
        status, data = req("POST", f"/builder/sessions/{builder_sid}/chat", {"message": "我们是一家电商公司，做跨境B2C"})
        log("PASS" if status == 200 else "FAIL", "Builder", f"POST /builder/sessions/{builder_sid}/chat", str(data)[:80])

        status, data = req("GET", f"/builder/sessions/{builder_sid}")
        log("PASS" if status == 200 else "FAIL", "Builder", f"GET /builder/sessions/{builder_sid}", str(data)[:80])

    # ── 11. 组织管理 ───────────────────────────────────────
    print("\n▶ 11. 组织管理")

    status, data = req("POST", "/orgs", {"name": "UAT测试公司", "industry": "科技"})
    org_id = data.get("org_id", "")
    log("PASS" if status == 200 and org_id else "FAIL", "Org", "POST /orgs", f"org_id={org_id}")

    if org_id:
        status, data = req("GET", f"/orgs/{org_id}")
        log("PASS" if status == 200 else "FAIL", "Org", f"GET /orgs/{org_id}", str(data)[:80])

        status, data = req("GET", f"/orgs/{org_id}/members")
        members = data.get("members", []) if isinstance(data, dict) else []
        log("PASS" if status == 200 and len(members) > 0 else "FAIL", "Org", f"GET /orgs/{org_id}/members", f"{len(members)} 成员")

    status, data = req("GET", "/admin/orgs")
    log("PASS" if status == 200 else "FAIL", "Org", "GET /admin/orgs", str(data)[:80])

    # ── 12. 文件上传 ───────────────────────────────────────
    print("\n▶ 12. 文件上传")

    status, data = req("GET", "/files")
    log("PASS" if status == 200 else "FAIL", "File", "GET /files", str(data)[:80])

    # multipart 上传需要特殊处理，用 stub 测试
    # 这里只验证端点存在
    log("SKIP", "File", "POST /files/upload (需 multipart)", "需手动测试")

    # ── 13. Token 追踪 + Mission ───────────────────────────
    print("\n▶ 13. 可观测性")

    status, data = req("GET", "/missions?user_id=admin")
    missions = data.get("missions", []) if isinstance(data, dict) else []
    log("PASS" if status == 200 else "FAIL", "Observability", "GET /missions", f"{len(missions)} 条记录")

    status, data = req("GET", "/stats/tokens")
    log("PASS" if status == 200 else "FAIL", "Observability", "GET /stats/tokens", str(data)[:100])

    # ── 14. 兼容路由批量检查 ───────────────────────────────
    print("\n▶ 14. 兼容路由（Stub）")

    compat_routes = [
        ("GET", "/agents"),
        ("GET", "/config"),
        ("GET", "/profiles"),
        ("GET", "/squads"),
        ("GET", "/notifications"),
        ("GET", "/heartbeats"),
        ("GET", "/users"),
        ("GET", "/approvals"),
        ("GET", "/chat/quick-commands"),
        ("GET", "/learning/overview"),
        ("GET", "/playbook/rules"),
        ("GET", "/skills/my"),
    ]
    for method, path in compat_routes:
        status, data = req(method, path)
        log("PASS" if status == 200 else "FAIL", "Compat", f"{method} {path}", f"status={status}")

    # ── 15. WebSocket 连通性 ───────────────────────────────
    print("\n▶ 15. WebSocket")
    try:
        import websocket
        ws = websocket.create_connection("ws://localhost:8080/ws", timeout=5)
        ws.send(json.dumps({"type": "ping"}))
        resp = ws.recv()
        ws.close()
        log("PASS", "WebSocket", "ws://localhost:8080/ws", f"pong: {resp[:80]}")
    except ImportError:
        log("SKIP", "WebSocket", "ws://localhost:8080/ws", "websocket-client 未安装 (pip install websocket-client)")
    except Exception as e:
        log("FAIL", "WebSocket", "ws://localhost:8080/ws", str(e)[:100])

    # ══════════════════════════════════════════════════════
    # 报告
    # ══════════════════════════════════════════════════════
    print("\n" + "=" * 60)
    print("  UAT 测试报告")
    print("=" * 60)
    print(f"\n  通过: {PASS}  失败: {FAIL}  跳过: {SKIP}  总计: {PASS + FAIL + SKIP}")
    print(f"  通过率: {PASS / (PASS + FAIL) * 100:.0f}%" if (PASS + FAIL) > 0 else "  无有效测试")
    print()

    if FAIL > 0:
        print("  ── 失败项 ──")
        for r in RESULTS:
            if r["status"] == "FAIL":
                print(f"  ❌ [{r['category']}] {r['name']}")
                if r["detail"]:
                    print(f"     {r['detail'][:150]}")
        print()

    if SKIP > 0:
        print("  ── 跳过项 ──")
        for r in RESULTS:
            if r["status"] == "SKIP":
                print(f"  ⚠️  [{r['category']}] {r['name']}: {r['detail'][:100]}")
        print()

    # 保存 JSON 报告
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "summary": {"pass": PASS, "fail": FAIL, "skip": SKIP},
        "results": RESULTS,
    }
    report_path = "data/uat_report.json"
    try:
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"  报告已保存: {report_path}")
    except Exception:
        pass

    print()
    return FAIL


if __name__ == "__main__":
    sys.exit(main())
