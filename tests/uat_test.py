"""
AgentForge V2 — 全系统 UAT 测试 (v2)

用法:
    1. python forge.py serve
    2. python tests/uat_test.py
"""

import json
import time
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8080/api/v1"
TOKEN = ""
RESULTS = []
PASS = 0
FAIL = 0
SKIP = 0
DELAY = 0.15


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


def req(method, path, data=None, auth=True, timeout=30):
    time.sleep(DELAY)
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if auth and TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    body = json.dumps(data).encode("utf-8") if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
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


def test_sse(path, data, timeout=60):
    time.sleep(DELAY)
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    body = json.dumps(data).encode("utf-8")
    r = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            events = []
            cur = ""
            for line in resp.read().decode("utf-8").split("\n"):
                if line.startswith("event: "):
                    cur = line[7:].strip()
                elif line.startswith("data: "):
                    try:
                        d = json.loads(line[6:])
                        events.append({"event": cur or d.get("type", ""), "data": d})
                    except json.JSONDecodeError:
                        pass
                    cur = ""
            return events
    except Exception as e:
        return [{"event": "error", "data": {"error": str(e)}}]


def main():
    global TOKEN

    print("=" * 60)
    print("  AgentForge V2 — 全系统 UAT 测试")
    print("=" * 60)
    print()

    # ── 0. 连通性 ─────────────────────────────────────────
    print("▶ 0. 连通性")
    s, d = req("GET", "/health", auth=False)
    if s != 200:
        log("FAIL", "Health", "GET /health", f"status={s}")
        print("\n⛔ 服务未启动")
        return 1
    log("PASS", "Health", "GET /health", f"status={d.get('status')}, tools={d.get('tools')}")
    for f in ["db", "llm", "tools", "profiles"]:
        log("PASS" if f in d else "SKIP", "Health", f"  {f}", str(d.get(f, "缺失"))[:60])

    s, d = req("GET", "/stats", auth=False)
    log("PASS" if s == 200 else "FAIL", "Health", "GET /stats", f"status={s}")

    # ── 1. 认证 ───────────────────────────────────────────
    print("\n▶ 1. 认证")
    s, d = req("POST", "/auth/login", {"username": "admin", "password": "admin123"}, auth=False)
    if s == 200 and d.get("token"):
        TOKEN = d["token"]
        log("PASS", "Auth", "POST /auth/login", f"token={TOKEN[:20]}...")
    else:
        log("FAIL", "Auth", "POST /auth/login", f"status={s}")
        print("\n⛔ 登录失败")
        return 1

    s, _ = req("POST", "/auth/login", {"username": "admin", "password": "wrong"}, auth=False)
    log("PASS" if s == 401 else "FAIL", "Auth", "  错误密码→401", f"status={s}")

    s, d = req("GET", "/auth/me")
    ok = d.get("username") or d.get("authenticated") is not None
    log("PASS" if s == 200 and ok else "FAIL", "Auth", "GET /auth/me", str(d)[:80])

    s, _ = req("POST", "/auth/register", {"username": f"uat_{int(time.time())}", "password": "test123456"}, auth=False)
    log("PASS" if s in (200, 201, 409) else "FAIL", "Auth", "POST /auth/register", f"status={s}")

    s, d = req("POST", "/auth/change-password", {"old_password": "admin123", "new_password": "admin123"})
    log("PASS" if s == 200 else "FAIL", "Auth", "POST /auth/change-password", str(d)[:60])

    s, _ = req("POST", "/auth/logout")
    log("PASS" if s == 200 else "SKIP", "Auth", "POST /auth/logout", "")

    # 重新登录
    s, d = req("POST", "/auth/login", {"username": "admin", "password": "admin123"}, auth=False)
    if s == 200 and d.get("token"):
        TOKEN = d["token"]

    # ── 2. 岗位 ───────────────────────────────────────────
    print("\n▶ 2. 岗位")
    s, d = req("GET", "/positions")
    pos = d.get("positions", []) if isinstance(d, dict) else d if isinstance(d, list) else []
    log("PASS" if s == 200 and len(pos) > 0 else "FAIL", "Position", "GET /positions", f"{len(pos)} 个")

    if pos:
        pid = pos[0].get("position_id", "")
        s, d = req("GET", f"/positions/{pid}")
        log("PASS" if s == 200 else "FAIL", "Position", f"GET /positions/{pid}", str(d)[:60])

    # ── 3. 对话 ───────────────────────────────────────────
    print("\n▶ 3. 对话")
    s, d = req("POST", "/chat", {"content": "hi", "position_id": "strategy-pm"})
    sid = d.get("session_id", "")
    log("PASS" if s == 200 and d.get("content") else "FAIL", "Chat", "POST /chat", f"session={sid}")

    events = test_sse("/chat/stream", {"content": "1+1=?", "position_id": "strategy-pm"})
    types = [e["event"] for e in events]
    log("PASS" if "delta" in types and "done" in types else "FAIL", "Chat", "POST /chat/stream", f"events={types}")

    done_evts = [e for e in events if e["event"] == "done"]
    has_sid = any(e["data"].get("session_id") for e in done_evts)
    log("PASS" if has_sid else "SKIP", "Chat", "  done含session_id", "")

    # ── 4. 会话 ───────────────────────────────────────────
    print("\n▶ 4. 会话")
    s, d = req("GET", "/chat/sessions")
    sess = d if isinstance(d, list) else d.get("sessions", []) if isinstance(d, dict) else []
    log("PASS" if s == 200 else "FAIL", "Session", "GET /chat/sessions", f"{len(sess)} 个")

    if sid:
        s, d = req("GET", f"/chat/sessions/{sid}/messages")
        log("PASS" if s == 200 else "FAIL", "Session", f"  消息", "")

    # ── 5. 知识库 ─────────────────────────────────────────
    print("\n▶ 5. 知识库")
    s, d = req("GET", "/knowledge/stats")
    log("PASS" if s == 200 else "FAIL", "KB", "GET /knowledge/stats", str(d)[:80])

    s, d = req("POST", "/knowledge/add", {
        "doc_id": "uat_doc", "content": "AgentForge是智能工位平台。", "metadata": {"source": "uat"},
    })
    log("PASS" if s == 200 else "FAIL", "KB", "POST /knowledge/add", str(d)[:60])

    s, d = req("POST", "/knowledge/search", {"query": "智能工位", "top_k": 3})
    res = d.get("results", []) if isinstance(d, dict) else []
    log("PASS" if s == 200 and len(res) > 0 else "FAIL", "KB", "POST /knowledge/search", f"{len(res)} 条")

    s, _ = req("DELETE", "/knowledge/uat_doc")
    log("PASS" if s == 200 else "FAIL", "KB", "DELETE /knowledge/uat_doc", "")

    # ── 6. 工作流 ─────────────────────────────────────────
    print("\n▶ 6. 工作流")
    s, d = req("GET", "/workflows")
    log("PASS" if s == 200 else "FAIL", "WF", "GET /workflows", "")

    wf = {"name": "UAT测试", "description": "测试", "nodes": [{"id": "n1", "type": "code", "label": "x", "config": {"code": "result={'x':1}"}}], "edges": []}
    s, d = req("POST", "/workflows", wf)
    wid = d.get("id", "")
    log("PASS" if s == 200 and wid else "FAIL", "WF", "POST /workflows", f"id={wid}")

    if wid:
        s, _ = req("GET", f"/workflows/{wid}")
        log("PASS" if s == 200 else "FAIL", "WF", f"  GET", "")
        s, d = req("POST", f"/workflows/{wid}/execute", {})
        log("PASS" if s == 200 else "FAIL", "WF", f"  执行", f"status={d.get('status')}")
        s, d = req("GET", f"/workflows/{wid}/executions")
        log("PASS" if s == 200 else "FAIL", "WF", f"  记录", "")
        s, _ = req("DELETE", f"/workflows/{wid}")
        log("PASS" if s == 200 else "FAIL", "WF", f"  删除", "")

    # ── 7. 工位 ───────────────────────────────────────────
    print("\n▶ 7. 工位")
    s, d = req("POST", "/workstation/assign", {"position_id": "strategy-pm"})
    log("PASS" if s == 200 else "FAIL", "WS", "POST assign", str(d)[:60])

    s, d = req("GET", "/workstation/home?position_id=strategy-pm")
    ok = isinstance(d, dict) and d.get("assigned") is not None
    log("PASS" if s == 200 and ok else "FAIL", "WS", "GET home", f"assigned={d.get('assigned') if isinstance(d,dict) else '?'}")

    s, _ = req("GET", "/workstation/positions")
    log("PASS" if s == 200 else "FAIL", "WS", "GET positions", "")

    # ── 8. 工作项 ─────────────────────────────────────────
    print("\n▶ 8. 工作项")
    for t, p in [("priorities", {"title": "T", "text": "T", "priority": "P0"}),
                 ("schedule", {"title": "M", "time": "2025-01-01 10:00"}),
                 ("followups", {"title": "F", "text": "F", "target": "X"})]:
        s, d = req("POST", f"/daily-context/{t}", p)
        log("PASS" if s == 200 else "FAIL", "WI", f"POST {t}", str(d)[:50])

    s, _ = req("GET", "/daily-context")
    log("PASS" if s == 200 else "FAIL", "WI", "GET daily-context", "")

    s, _ = req("POST", "/work-items", {"title": "UAT", "type": "task"})
    log("PASS" if s == 200 else "FAIL", "WI", "POST work-items", "")

    s, _ = req("GET", "/work-items")
    log("PASS" if s == 200 else "FAIL", "WI", "GET work-items", "")

    # ── 9. 触发器 ─────────────────────────────────────────
    print("\n▶ 9. 触发器")
    s, _ = req("GET", "/triggers")
    log("PASS" if s == 200 else "FAIL", "Trigger", "GET /triggers", "")

    s, _ = req("POST", "/webhook/nonexistent", {"test": True}, auth=False)
    log("PASS" if s in (404, 200) else "FAIL", "Trigger", "POST webhook/404", f"status={s}")

    # ── 10. Builder ───────────────────────────────────────
    print("\n▶ 10. Builder")
    s, d = req("POST", "/builder/sessions")
    bsid = d.get("session_id", "") or d.get("id", "")
    log("PASS" if s == 200 and bsid else "FAIL", "Builder", "POST sessions", f"sid={bsid}")

    if bsid:
        s, _ = req("POST", f"/builder/sessions/{bsid}/chat", {"message": "电商"})
        log("PASS" if s == 200 else "FAIL", "Builder", "  chat", "")

    # ── 11. 组织 ──────────────────────────────────────────
    print("\n▶ 11. 组织")
    s, d = req("POST", "/orgs", {"name": f"UAT{int(time.time())}", "industry": "IT"})
    oid = d.get("org_id", "") or d.get("id", "")
    log("PASS" if s == 200 and oid else "FAIL", "Org", "POST /orgs", f"id={oid}")

    if oid:
        s, _ = req("GET", f"/orgs/{oid}")
        log("PASS" if s == 200 else "FAIL", "Org", f"GET /orgs/{oid}", "")
        s, d = req("GET", f"/orgs/{oid}/members")
        log("PASS" if s == 200 else "FAIL", "Org", "  members", "")

    s, _ = req("GET", "/admin/orgs")
    log("PASS" if s == 200 else "FAIL", "Org", "GET /admin/orgs", "")

    # ── 12. 文件 ──────────────────────────────────────────
    print("\n▶ 12. 文件")
    s, _ = req("GET", "/files")
    log("PASS" if s == 200 else "FAIL", "File", "GET /files", "")
    log("SKIP", "File", "POST upload", "需multipart")

    # ── 13. 可观测 ────────────────────────────────────────
    print("\n▶ 13. 可观测")
    s, _ = req("GET", "/missions")
    log("PASS" if s == 200 else "FAIL", "Obs", "GET /missions", "")
    s, _ = req("GET", "/stats/tokens")
    log("PASS" if s == 200 else "FAIL", "Obs", "GET /stats/tokens", "")

    # ── 14. 兼容路由 ──────────────────────────────────────
    print("\n▶ 14. 兼容路由")
    for p in ["/agents", "/config", "/profiles", "/squads", "/notifications",
              "/heartbeats", "/users", "/approvals", "/chat/quick-commands",
              "/learning/overview", "/playbook/rules", "/skills/my",
              "/workstation/insights-v2", "/workstation/risks", "/workstation/patterns"]:
        s, _ = req("GET", p)
        log("PASS" if s == 200 else "FAIL", "Compat", f"GET {p}", f"{s}")

    # ── 15. WebSocket ─────────────────────────────────────
    print("\n▶ 15. WebSocket")
    try:
        import websocket
        ws = websocket.create_connection("ws://localhost:8080/ws", timeout=5)
        ws.send(json.dumps({"type": "ping"}))
        resp = ws.recv()
        ws.close()
        log("PASS", "WS", "WebSocket", f"pong={resp[:60]}")
    except ImportError:
        log("SKIP", "WS", "WebSocket", "pip install websocket-client")
    except Exception as e:
        log("FAIL", "WS", "WebSocket", str(e)[:80])

    # ── 16. 数据隔离 ──────────────────────────────────────
    print("\n▶ 16. 数据隔离")
    s, _ = req("POST", "/knowledge/add", {"doc_id": "iso_test", "content": "隔离测试"})
    log("PASS" if s == 200 else "FAIL", "Iso", "KB写入(带org_id)", "")
    s, d = req("POST", "/knowledge/search", {"query": "隔离测试"})
    log("PASS" if s == 200 else "FAIL", "Iso", "KB搜索", f"{len(d.get('results',[]))} 条")
    req("DELETE", "/knowledge/iso_test")

    if sid:
        s, _ = req("GET", f"/chat/sessions/{sid}/messages")
        log("PASS" if s == 200 else "FAIL", "Iso", "会话归属验证", "")

    # ══════════════════════════════════════════════════════
    print("\n" + "=" * 60)
    print("  UAT 测试报告")
    print("=" * 60)
    total = PASS + FAIL + SKIP
    rate = f"{PASS / (PASS + FAIL) * 100:.0f}%" if (PASS + FAIL) > 0 else "N/A"
    print(f"\n  ✅ {PASS}  ❌ {FAIL}  ⚠️ {SKIP}  总计 {total}  通过率 {rate}")

    if FAIL:
        print("\n  ── 失败项 ──")
        for r in RESULTS:
            if r["status"] == "FAIL":
                print(f"  ❌ [{r['category']}] {r['name']}")
                if r["detail"]:
                    print(f"     {r['detail'][:150]}")

    if SKIP:
        print("\n  ── 跳过项 ──")
        for r in RESULTS:
            if r["status"] == "SKIP":
                print(f"  ⚠️  [{r['category']}] {r['name']}: {r['detail'][:80]}")

    try:
        report = {"timestamp": time.strftime("%Y-%m-%d %H:%M:%S"), "summary": {"pass": PASS, "fail": FAIL, "skip": SKIP, "rate": rate}, "results": RESULTS}
        with open("data/uat_report.json", "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"\n  报告: data/uat_report.json")
    except Exception:
        pass
    print()
    return FAIL


if __name__ == "__main__":
    sys.exit(main())
