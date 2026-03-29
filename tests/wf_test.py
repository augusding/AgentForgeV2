#!/usr/bin/env python3
"""
AgentForge V2 — 工作流全面测试脚本

用法:
    python tests/wf_test.py                     # 完整测试（清空 + T1 + T2）
    python tests/wf_test.py --skip-cleanup      # 跳过清空，直接测试
    python tests/wf_test.py --cleanup-only      # 只清空工作流列表
    python tests/wf_test.py --keep              # 测试后保留测试工作流（不删除）

测试报告:
    终端：实时输出
    JSON：data/wf_test_report.json
    HTML：data/wf_test_report.html（浏览器打开）
"""

import json
import sys
import time
import os
import argparse
from datetime import datetime

try:
    import requests
except ImportError:
    print("请先安装: pip install requests")
    sys.exit(1)

# ══════════════════════════════════════════════════════════════
# 配置
# ══════════════════════════════════════════════════════════════

BASE = os.environ.get("AGENTFORGE_API", "http://localhost:8080/api/v1")
USERNAME = os.environ.get("AGENTFORGE_USER", "admin")
PASSWORD = os.environ.get("AGENTFORGE_PASS", "admin123")
TOKEN = ""
TEST_PREFIX = "[自动测试]"

# 计数
PASS = FAIL = SKIP = 0
RESULTS: list[dict] = []
START_TIME = 0.0


# ══════════════════════════════════════════════════════════════
# 工具函数
# ══════════════════════════════════════════════════════════════

def auth():
    global TOKEN
    try:
        r = requests.post(f"{BASE}/auth/login", json={"username": USERNAME, "password": PASSWORD}, timeout=5)
        TOKEN = r.json().get("token", "")
    except Exception as e:
        print(f"❌ 连接失败: {e}")
        print(f"   请确认服务运行在 {BASE}")
        sys.exit(1)
    if not TOKEN:
        print("❌ 登录失败，请检查用户名密码")
        sys.exit(1)
    print(f"✅ 登录成功")


def hdr():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def cleanup_all_workflows():
    """清空所有工作流"""
    r = requests.get(f"{BASE}/workflows", headers=hdr(), timeout=10)
    if r.status_code != 200:
        print(f"  ⚠️ 获取工作流列表失败: {r.status_code}")
        return 0
    wfs = r.json().get("workflows", [])
    if not wfs:
        print("  ✅ 工作流列表已为空")
        return 0
    deleted = 0
    for wf in wfs:
        wf_id = wf.get("id", "")
        wf_name = wf.get("name", "")
        try:
            requests.delete(f"{BASE}/workflows/{wf_id}", headers=hdr(), timeout=5)
            deleted += 1
            print(f"  🗑️  删除: {wf_name} ({wf_id})")
        except Exception as e:
            print(f"  ⚠️ 删除失败: {wf_name} — {e}")
    print(f"  ✅ 共删除 {deleted} 个工作流")
    return deleted


def cleanup_test_workflows():
    """只清理带测试前缀的工作流"""
    r = requests.get(f"{BASE}/workflows", headers=hdr(), timeout=10)
    if r.status_code != 200:
        return
    wfs = r.json().get("workflows", [])
    for wf in wfs:
        if wf.get("name", "").startswith(TEST_PREFIX):
            try:
                requests.delete(f"{BASE}/workflows/{wf['id']}", headers=hdr(), timeout=5)
            except Exception:
                pass


def create_and_run(name, nodes, edges, trigger_data=None, keep=False):
    """创建工作流 → 执行 → 返回结果 → 清理（除非 keep=True）"""
    wf_id = ""
    try:
        wf = {
            "name": f"{TEST_PREFIX} {name}",
            "description": "自动化测试",
            "nodes": nodes,
            "edges": edges,
        }
        r = requests.post(f"{BASE}/workflows", json=wf, headers=hdr(), timeout=10)
        if r.status_code != 200:
            return None, f"创建失败 [{r.status_code}]: {r.text[:100]}"
        wf_id = r.json().get("id", "")

        body = {"trigger_data": trigger_data or {}}
        r = requests.post(f"{BASE}/workflows/{wf_id}/execute", json=body, headers=hdr(), timeout=30)
        if r.status_code != 200:
            return None, f"执行失败 [{r.status_code}]: {r.text[:100]}"
        return r.json(), None
    except requests.Timeout:
        return None, "请求超时(30s)"
    except Exception as e:
        return None, str(e)
    finally:
        if wf_id and not keep:
            try:
                requests.delete(f"{BASE}/workflows/{wf_id}", headers=hdr(), timeout=5)
            except Exception:
                pass


def log(status, test_id, name, detail=""):
    global PASS, FAIL, SKIP
    icon = {"PASS": "✅", "FAIL": "❌", "SKIP": "⚠️"}[status]
    if status == "PASS":
        PASS += 1
    elif status == "FAIL":
        FAIL += 1
    else:
        SKIP += 1
    line = f"  {icon} {test_id:10} {name:42} {detail[:80]}"
    print(line)
    RESULTS.append({
        "test_id": test_id,
        "name": name,
        "status": status,
        "detail": detail,
        "timestamp": time.strftime("%H:%M:%S"),
    })


def assert_node(result, node_id, field=None, expected=None):
    """验证节点执行结果"""
    if not result:
        return False, "result is None"
    nr = result.get("node_results", {}).get(node_id, {})
    if not nr:
        return False, f"node '{node_id}' 不在结果中, 可用: {list(result.get('node_results', {}).keys())}"
    if nr.get("status") not in ("completed", "skipped"):
        return False, f"node '{node_id}' status={nr.get('status')} error={nr.get('error', '')}"
    if field is not None and expected is not None:
        out = nr.get("output", {})
        actual = out.get(field)
        if actual != expected:
            return False, f"{field}: expected={expected!r} actual={actual!r}"
    return True, "ok"


def assert_all_completed(result, node_ids):
    """验证多个节点都完成"""
    for nid in node_ids:
        ok, d = assert_node(result, nid)
        if not ok:
            return False, d
    return True, "all completed"


# ══════════════════════════════════════════════════════════════
# T1：单节点测试
# ══════════════════════════════════════════════════════════════

KEEP = False  # 全局标志，由命令行参数控制


def t1_manual_trigger():
    r, err = create_and_run("T1-1a 手动触发", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
    ], [], keep=KEEP)
    if err:
        return log("FAIL", "T1-1a", "manualTrigger 基础", err)
    ok, d = assert_node(r, "t")
    log("PASS" if ok else "FAIL", "T1-1a", "manualTrigger 基础", d)


def t1_manual_trigger_data():
    r, err = create_and_run("T1-1b 触发+数据", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
    ], [], trigger_data={"key": "val"}, keep=KEEP)
    if err:
        return log("FAIL", "T1-1b", "manualTrigger 带数据", err)
    ok, d = assert_node(r, "t")
    log("PASS" if ok else "FAIL", "T1-1b", "manualTrigger 带 trigger_data", d)


def t1_code_basic():
    r, err = create_and_run("T1-2a code基础", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "c", "type": "code", "label": "计算",
         "config": {"code": "result = {'sum': 1+2, 'msg': 'hello'}"}},
    ], [{"source": "t", "target": "c"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-2a", "code 基础计算", err)
    ok, d = assert_node(r, "c", "sum", 3)
    log("PASS" if ok else "FAIL", "T1-2a", "code 基础计算 (1+2=3)", d)


def t1_code_import():
    r, err = create_and_run("T1-2b code import", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "c", "type": "code", "label": "计算", "config": {
            "code": "import json, math, hashlib\nresult = {'pi': round(math.pi,2), 'hash': hashlib.md5(b'test').hexdigest()[:8]}"}},
    ], [{"source": "t", "target": "c"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-2b", "code import stdlib", err)
    ok, d = assert_node(r, "c", "pi", 3.14)
    log("PASS" if ok else "FAIL", "T1-2b", "code import (math.pi=3.14)", d)


def t1_code_error():
    r, err = create_and_run("T1-2c code语法错误", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "c", "type": "code", "label": "错误", "config": {"code": "result = {"}},
    ], [{"source": "t", "target": "c"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-2c", "code 语法错误", err)
    nr = r.get("node_results", {}).get("c", {})
    ok = nr.get("status") == "failed"
    log("PASS" if ok else "FAIL", "T1-2c", "code 语法错误 → status=failed",
        f"status={nr.get('status')} error={nr.get('error', '')[:50]}")


def t1_code_empty():
    r, err = create_and_run("T1-2d code空代码", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "c", "type": "code", "label": "空", "config": {"code": ""}},
    ], [{"source": "t", "target": "c"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-2d", "code 空代码", err)
    ok, d = assert_node(r, "c")
    log("PASS" if ok else "FAIL", "T1-2d", "code 空代码 → completed", d)


def t1_if_true():
    r, err = create_and_run("T1-2e if true", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "c", "type": "code", "label": "数据", "config": {"code": "result = {'score': 90}"}},
        {"id": "i", "type": "if", "label": "判断", "config": {"mode": "expression", "expression": "$input.score > 80"}},
    ], [{"source": "t", "target": "c"}, {"source": "c", "target": "i"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-2e", "if true (score=90>80)", err)
    ok, d = assert_node(r, "i", "_output_index", 0)
    log("PASS" if ok else "FAIL", "T1-2e", "if true (score=90>80) → idx=0", d)


def t1_if_false():
    r, err = create_and_run("T1-2f if false", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "c", "type": "code", "label": "数据", "config": {"code": "result = {'score': 50}"}},
        {"id": "i", "type": "if", "label": "判断", "config": {"mode": "expression", "expression": "$input.score > 80"}},
    ], [{"source": "t", "target": "c"}, {"source": "c", "target": "i"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-2f", "if false (score=50<80)", err)
    ok, d = assert_node(r, "i", "_output_index", 1)
    log("PASS" if ok else "FAIL", "T1-2f", "if false (score=50<80) → idx=1", d)


def t1_set():
    r, err = create_and_run("T1-2n set", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "s", "type": "set", "label": "变量", "config": {"assignments": {"name": "test", "count": 42}}},
    ], [{"source": "t", "target": "s"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-2n", "set 设置变量", err)
    ok, d = assert_node(r, "s", "name", "test")
    log("PASS" if ok else "FAIL", "T1-2n", "set 设置变量 (name=test)", d)


def t1_delay():
    r, err = create_and_run("T1-2l delay", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "d", "type": "delay", "label": "延时", "config": {"seconds": 1, "unit": "seconds"}},
    ], [{"source": "t", "target": "d"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-2l", "delay 1秒", err)
    nr = r.get("node_results", {}).get("d", {})
    ok = nr.get("status") == "completed" and (nr.get("duration", 0) or 0) >= 0.5
    log("PASS" if ok else "FAIL", "T1-2l", "delay 1秒",
        f"status={nr.get('status')} duration={nr.get('duration', 0):.2f}s")


def t1_notification():
    r, err = create_and_run("T1-5a notify", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "n", "type": "notification", "label": "通知", "config": {"title": "测试", "message": "hello"}},
    ], [{"source": "t", "target": "n"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-5a", "notification 系统通知", err)
    ok, d = assert_node(r, "n", "notification_sent", True)
    log("PASS" if ok else "FAIL", "T1-5a", "notification 系统通知", d)


def t1_kv_write():
    r, err = create_and_run("T1-3b kv write", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "k", "type": "kvStore", "label": "写入", "config": {"action": "set", "key": "wf_test_k", "value": "hello_kv"}},
    ], [{"source": "t", "target": "k"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-3b", "kvStore 写入", err)
    ok, d = assert_node(r, "k")
    log("PASS" if ok else "FAIL", "T1-3b", "kvStore 写入", d)


def t1_http():
    r, err = create_and_run("T1-4a http", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "h", "type": "http", "label": "GET", "config": {"method": "GET", "url": "https://httpbin.org/get"}},
    ], [{"source": "t", "target": "h"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-4a", "HTTP GET", err)
    nr = r.get("node_results", {}).get("h", {})
    ok = nr.get("status") == "completed"
    log("PASS" if ok else "FAIL", "T1-4a", "HTTP GET httpbin.org",
        f"status={nr.get('status')} output_keys={list(nr.get('output', {}).keys())[:5]}")


def t1_http_error():
    r, err = create_and_run("T1-4b http error", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "h", "type": "http", "label": "BAD", "config": {"method": "GET", "url": "https://invalid-host-99999.test"}},
    ], [{"source": "t", "target": "h"}], keep=KEEP)
    if err:
        return log("FAIL", "T1-4b", "HTTP 错误地址", err)
    nr = r.get("node_results", {}).get("h", {})
    ok = nr.get("status") == "failed"
    log("PASS" if ok else "FAIL", "T1-4b", "HTTP 错误地址 → failed",
        f"status={nr.get('status')} error={nr.get('error', '')[:50]}")


# ══════════════════════════════════════════════════════════════
# T2：组合链路测试
# ══════════════════════════════════════════════════════════════

def t2_linear_chain():
    """线性链：触发 → 代码 → 设置变量 → 通知"""
    r, err = create_and_run("T2-1 线性链", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "c", "type": "code", "label": "生成", "config": {"code": "result = {'name': '张三', 'score': 95}"}},
        {"id": "s", "type": "set", "label": "格式化", "config": {"assignments": {"display": "{{ $input.name }} 得分 {{ $input.score }}"}}},
        {"id": "n", "type": "notification", "label": "通知", "config": {"title": "结果", "message": "{{ $input.display }}"}},
    ], [
        {"source": "t", "target": "c"},
        {"source": "c", "target": "s"},
        {"source": "s", "target": "n"},
    ], keep=KEEP)
    if err:
        return log("FAIL", "T2-1", "线性链 数据流转", err)
    ok_all, d1 = assert_all_completed(r, ["t", "c", "s", "n"])
    s_out = r.get("node_results", {}).get("s", {}).get("output", {})
    display = s_out.get("display", "")
    data_ok = "张三" in str(display) and "95" in str(display)
    ok = ok_all and data_ok
    log("PASS" if ok else "FAIL", "T2-1", "线性链 (触发→代码→变量→通知)",
        f"display={display!r}" if not ok else f"display='{display}'")


def t2_condition_branch():
    """条件分支：score=85 → true分支"""
    r, err = create_and_run("T2-2 条件分支", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "c", "type": "code", "label": "数据", "config": {"code": "result = {'score': 85}"}},
        {"id": "i", "type": "if", "label": "判断", "config": {"mode": "expression", "expression": "$input.score > 80"}},
        {"id": "a", "type": "notification", "label": "优秀", "config": {"title": "优秀", "message": "恭喜"}},
        {"id": "b", "type": "notification", "label": "加油", "config": {"title": "加油", "message": "继续努力"}},
    ], [
        {"source": "t", "target": "c"},
        {"source": "c", "target": "i"},
        {"source": "i", "target": "a", "sourceOutput": 0},
        {"source": "i", "target": "b", "sourceOutput": 1},
    ], keep=KEEP)
    if err:
        return log("FAIL", "T2-2", "条件分支 score=85", err)
    nr = r.get("node_results", {})
    a_st = nr.get("a", {}).get("status", "missing")
    b_st = nr.get("b", {}).get("status", "missing")
    # score=85 > 80 → true → a 应执行, b 不执行
    ok = a_st == "completed" and b_st != "completed"
    log("PASS" if ok else "FAIL", "T2-2", "条件分支 (85>80 → 优秀✅ 加油❌)",
        f"优秀={a_st} 加油={b_st}")


def t2_code_chain():
    """代码链：上游输出 → 下游 input_data 引用"""
    r, err = create_and_run("T2-3 代码链", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "a", "type": "code", "label": "A", "config": {"code": "result = {'x': 10}"}},
        {"id": "b", "type": "code", "label": "B", "config": {"code": "result = {'y': 20}"}},
        {"id": "c", "type": "code", "label": "C", "config": {
            "code": "result = {'z': input_data.get('y', 0) + variables.get('x', 0)}"}},
    ], [
        {"source": "t", "target": "a"},
        {"source": "a", "target": "b"},
        {"source": "b", "target": "c"},
    ], keep=KEEP)
    if err:
        return log("FAIL", "T2-3", "代码链 数据传递", err)
    c_out = r.get("node_results", {}).get("c", {}).get("output", {})
    z = c_out.get("z")
    # B 的 output.y=20 → C 的 input_data.y=20, A 的 output.x=10 进入 variables
    ok = z == 30
    log("PASS" if ok else "FAIL", "T2-3", "代码链 (A.x=10 + B.y=20 = 30)",
        f"z={z} (expected 30)")


def t2_http_process():
    """HTTP → 代码处理"""
    r, err = create_and_run("T2-5 HTTP+处理", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "h", "type": "http", "label": "请求", "config": {"method": "GET", "url": "https://httpbin.org/get?foo=bar"}},
        {"id": "c", "type": "code", "label": "提取", "config": {
            "code": "data = input_data or {}\nresult = {'has_data': bool(data), 'keys': list(data.keys())[:5]}"}},
    ], [
        {"source": "t", "target": "h"},
        {"source": "h", "target": "c"},
    ], keep=KEEP)
    if err:
        return log("FAIL", "T2-5", "HTTP → 代码处理", err)
    c_out = r.get("node_results", {}).get("c", {}).get("output", {})
    ok = c_out.get("has_data") is True
    log("PASS" if ok else "FAIL", "T2-5", "HTTP → 代码处理",
        f"has_data={c_out.get('has_data')} keys={c_out.get('keys')}")


def t2_kv_readwrite():
    """KV 读写链"""
    ts = str(int(time.time()))
    r, err = create_and_run("T2-7 KV读写", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "w", "type": "kvStore", "label": "写入", "config": {"action": "set", "key": f"chain_{ts}", "value": "chain_ok"}},
        {"id": "r", "type": "kvStore", "label": "读取", "config": {"action": "get", "key": f"chain_{ts}"}},
    ], [
        {"source": "t", "target": "w"},
        {"source": "w", "target": "r"},
    ], keep=KEEP)
    if err:
        return log("FAIL", "T2-7", "KV 读写链", err)
    r_out = r.get("node_results", {}).get("r", {}).get("output", {})
    val = r_out.get("value")
    ok = val == "chain_ok"
    log("PASS" if ok else "FAIL", "T2-7", "KV 写入→读取 (chain_ok)",
        f"value={val!r}")


def t2_set_expression():
    """设置变量 + 表达式引用"""
    r, err = create_and_run("T2-6 表达式", [
        {"id": "t", "type": "manualTrigger", "label": "触发"},
        {"id": "c", "type": "code", "label": "数据", "config": {"code": "result = {'x': 7}"}},
        {"id": "s", "type": "set", "label": "计算", "config": {"assignments": {"doubled": "{{ $input.x * 2 }}"}}},
    ], [
        {"source": "t", "target": "c"},
        {"source": "c", "target": "s"},
    ], keep=KEEP)
    if err:
        return log("FAIL", "T2-6", "表达式 $input.x*2", err)
    s_out = r.get("node_results", {}).get("s", {}).get("output", {})
    doubled = s_out.get("doubled")
    ok = doubled == 14 or str(doubled) == "14"
    log("PASS" if ok else "FAIL", "T2-6", "表达式 $input.x*2 = 14",
        f"doubled={doubled!r}")


# ══════════════════════════════════════════════════════════════
# 报告生成
# ══════════════════════════════════════════════════════════════

def generate_report():
    """生成 JSON + HTML 报告"""
    duration = round(time.time() - START_TIME, 1)
    total = PASS + FAIL + SKIP
    rate = f"{PASS / max(PASS + FAIL, 1) * 100:.0f}%"
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    summary = {
        "timestamp": ts,
        "duration_seconds": duration,
        "total": total,
        "pass": PASS,
        "fail": FAIL,
        "skip": SKIP,
        "rate": rate,
    }

    # ── JSON 报告 ──
    os.makedirs("data", exist_ok=True)
    report = {"summary": summary, "results": RESULTS}
    json_path = "data/wf_test_report.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # ── HTML 报告 ──
    html_path = "data/wf_test_report.html"
    rows_html = ""
    for r in RESULTS:
        color = {"PASS": "#22c55e", "FAIL": "#ef4444", "SKIP": "#f59e0b"}[r["status"]]
        icon = {"PASS": "✅", "FAIL": "❌", "SKIP": "⚠️"}[r["status"]]
        detail_esc = r["detail"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        rows_html += f"""<tr>
  <td style="color:{color};font-weight:600">{icon} {r["status"]}</td>
  <td><code>{r["test_id"]}</code></td>
  <td>{r["name"]}</td>
  <td style="color:#a1a1aa;font-size:12px">{detail_esc}</td>
  <td style="color:#a1a1aa">{r["timestamp"]}</td>
</tr>\n"""

    bar_pass = PASS / max(total, 1) * 100
    bar_fail = FAIL / max(total, 1) * 100
    bar_skip = SKIP / max(total, 1) * 100

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>工作流测试报告 — {ts}</title>
<style>
  body {{ font-family: -apple-system, 'Noto Sans SC', sans-serif; background: #0f1117; color: #e4e4e7; margin: 0; padding: 24px; }}
  .container {{ max-width: 1000px; margin: 0 auto; }}
  h1 {{ font-size: 20px; margin-bottom: 4px; }}
  .meta {{ color: #a1a1aa; font-size: 13px; margin-bottom: 24px; }}
  .cards {{ display: flex; gap: 16px; margin-bottom: 24px; }}
  .card {{ flex: 1; background: #1a1d27; border-radius: 12px; padding: 16px; border: 1px solid #2a2d37; }}
  .card .num {{ font-size: 28px; font-weight: 700; }}
  .card .label {{ font-size: 12px; color: #a1a1aa; margin-top: 2px; }}
  .bar {{ height: 8px; border-radius: 4px; background: #2a2d37; overflow: hidden; margin-bottom: 24px; display: flex; }}
  .bar-pass {{ background: #22c55e; width: {bar_pass:.1f}%; }}
  .bar-fail {{ background: #ef4444; width: {bar_fail:.1f}%; }}
  .bar-skip {{ background: #f59e0b; width: {bar_skip:.1f}%; }}
  table {{ width: 100%; border-collapse: collapse; background: #1a1d27; border-radius: 12px; overflow: hidden; }}
  th {{ text-align: left; padding: 10px 12px; background: #22252f; color: #a1a1aa; font-size: 12px; font-weight: 600; }}
  td {{ padding: 8px 12px; border-top: 1px solid #2a2d37; font-size: 13px; }}
  tr:hover {{ background: #22252f; }}
  code {{ background: #22252f; padding: 2px 6px; border-radius: 4px; font-size: 12px; }}
  .footer {{ text-align: center; color: #52525b; font-size: 11px; margin-top: 24px; }}
</style>
</head>
<body>
<div class="container">
  <h1>📋 AgentForge V2 — 工作流测试报告</h1>
  <div class="meta">{ts} · 耗时 {duration}s · {BASE}</div>

  <div class="cards">
    <div class="card"><div class="num" style="color:#e4e4e7">{total}</div><div class="label">总用例</div></div>
    <div class="card"><div class="num" style="color:#22c55e">{PASS}</div><div class="label">通过</div></div>
    <div class="card"><div class="num" style="color:#ef4444">{FAIL}</div><div class="label">失败</div></div>
    <div class="card"><div class="num" style="color:#14b8a6">{rate}</div><div class="label">通过率</div></div>
  </div>

  <div class="bar">
    <div class="bar-pass"></div>
    <div class="bar-fail"></div>
    <div class="bar-skip"></div>
  </div>

  <table>
    <thead><tr><th>状态</th><th>编号</th><th>用例名称</th><th>详情</th><th>时间</th></tr></thead>
    <tbody>{rows_html}</tbody>
  </table>

  <div class="footer">AgentForge V2 Workflow Test Suite · Generated at {ts}</div>
</div>
</body>
</html>"""

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    return json_path, html_path


# ══════════════════════════════════════════════════════════════
# 主程序
# ══════════════════════════════════════════════════════════════

def main():
    global KEEP, START_TIME

    parser = argparse.ArgumentParser(description="AgentForge V2 工作流全面测试")
    parser.add_argument("--skip-cleanup", action="store_true", help="跳过清空现有工作流")
    parser.add_argument("--cleanup-only", action="store_true", help="只清空工作流列表，不执行测试")
    parser.add_argument("--keep", action="store_true", help="测试后保留测试工作流")
    parser.add_argument("--api", default=None, help="API 地址 (默认 http://localhost:8080/api/v1)")
    args = parser.parse_args()

    if args.api:
        global BASE
        BASE = args.api
    KEEP = args.keep
    START_TIME = time.time()

    print()
    print("═" * 60)
    print("  AgentForge V2 — 工作流全面测试")
    print("═" * 60)
    print(f"  API: {BASE}")
    print(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # ── 登录 ──
    auth()

    # ── 清空 ──
    if not args.skip_cleanup:
        print("\n▶ 阶段 0: 清空工作流列表")
        cleanup_all_workflows()
        if args.cleanup_only:
            print("\n✅ 清空完成")
            return 0

    # ── T1: 单节点 ──
    print("\n▶ T1: 单节点验证")
    print("  " + "-" * 56)
    t1_manual_trigger()
    t1_manual_trigger_data()
    t1_code_basic()
    t1_code_import()
    t1_code_error()
    t1_code_empty()
    t1_if_true()
    t1_if_false()
    t1_set()
    t1_delay()
    t1_notification()
    t1_kv_write()
    t1_http()
    t1_http_error()

    # ── T2: 组合链路 ──
    print("\n▶ T2: 组合链路验证")
    print("  " + "-" * 56)
    t2_linear_chain()
    t2_condition_branch()
    t2_code_chain()
    t2_set_expression()
    t2_http_process()
    t2_kv_readwrite()

    # ── 安全清理 ──
    if not KEEP:
        cleanup_test_workflows()

    # ── 报告 ──
    json_path, html_path = generate_report()

    duration = round(time.time() - START_TIME, 1)
    total = PASS + FAIL + SKIP
    rate = f"{PASS / max(PASS + FAIL, 1) * 100:.0f}%"

    print()
    print("═" * 60)
    print("  测试报告")
    print("═" * 60)
    print(f"  ✅ 通过: {PASS}    ❌ 失败: {FAIL}    ⚠️ 跳过: {SKIP}    总计: {total}")
    print(f"  📊 通过率: {rate}    ⏱️ 耗时: {duration}s")
    print()

    if FAIL:
        print("  ── 失败项 ──")
        for r in RESULTS:
            if r["status"] == "FAIL":
                print(f"  ❌ {r['test_id']:10} {r['name']}")
                if r["detail"]:
                    print(f"     {r['detail'][:120]}")
        print()

    print(f"  📄 JSON 报告: {json_path}")
    print(f"  🌐 HTML 报告: {html_path}")
    print(f"     浏览器打开: http://localhost:7070/{html_path}")
    print()

    return FAIL


if __name__ == "__main__":
    sys.exit(main())
