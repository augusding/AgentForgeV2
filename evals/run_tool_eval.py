#!/usr/bin/env python3
"""
AgentForgeV2 — Tool Call Eval Runner

用法：
    python evals/run_tool_eval.py                  # 跑全部 88 条
    python evals/run_tool_eval.py --quick           # 只跑前 30 条
    python evals/run_tool_eval.py --tags core       # 只跑 core 标签
    python evals/run_tool_eval.py --category negative  # 只跑反例

输出：
    - 终端实时打印每条结果
    - 按 category 统计准确率
    - 结果保存到 evals/results/YYYY-MM-DD_HHMM.json
"""

import asyncio
import json
import sys
import time
from pathlib import Path
from collections import defaultdict

# 项目根目录
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Tool Call Eval")
    parser.add_argument("--quick", action="store_true", help="只跑前 30 条")
    parser.add_argument("--tags", type=str, default="", help="按标签过滤，逗号分隔")
    parser.add_argument("--category", type=str, default="", help="按分类过滤")
    args = parser.parse_args()

    # ── 初始化 LLM 和工具（复制 engine.py 的注册流程）──
    from core.config.loader import ConfigLoader
    from core.llm import LLMClient
    from tools.registry import ToolRegistry
    from tools.builtin.core_tools import register_all

    loader = ConfigLoader(root_dir=ROOT)
    config = loader.load_forge_config()
    llm = LLMClient(config)

    registry = ToolRegistry()
    register_all(registry)

    # 额外注册 workstation/workflow/knowledge 工具
    try:
        from tools.builtin.workstation_tools import create_workstation_tools
        from memory.work_item_store import WorkItemStore
        store = WorkItemStore(str(ROOT / "data" / "memories.db"))
        await store.ensure_tables()
        for t in create_workstation_tools(store):
            registry.register(t)
    except Exception as e:
        print(f"  Warning: Workstation tools failed: {e}")

    try:
        from knowledge.rag import KnowledgeBase
        from tools.builtin.search_knowledge import create_search_knowledge_tool, create_knowledge_list_tool
        kb = KnowledgeBase(data_dir=str(ROOT / "data"))
        await kb.init()
        registry.register(create_search_knowledge_tool(kb))
        registry.register(create_knowledge_list_tool(kb))
    except Exception as e:
        print(f"  Warning: Knowledge tools failed: {e}")

    try:
        from workflow.store import WorkflowStore
        from tools.builtin.workflow_tools import create_workflow_tools
        wf_store = WorkflowStore(str(ROOT / "data" / "workflows.db"))
        await wf_store.ensure_tables()
        for t in create_workflow_tools(wf_store):
            registry.register(t)
    except Exception as e:
        print(f"  Warning: Workflow tools failed: {e}")

    tools = registry.get_all_tools_for_llm()
    tool_names = [t["name"] for t in tools]

    # ── 加载测试集 ──
    from evals.golden_set import GOLDEN_SET

    cases = list(GOLDEN_SET)
    if args.quick:
        cases = cases[:30]
    if args.tags:
        tag_set = set(args.tags.split(","))
        cases = [c for c in cases if tag_set & set(c.tags)]
    if args.category:
        cases = [c for c in cases if c.category == args.category]

    # 过滤掉期望工具不在注册表中的 case（避免误判）
    available = set(tool_names)
    skipped = []
    valid_cases = []
    for c in cases:
        if c.expected_tool and c.expected_tool not in available:
            skipped.append(c)
        else:
            valid_cases.append(c)

    model_name = config.llm.get("tiers", {})
    tier1 = list(model_name.values())[0] if model_name else {}
    model_display = tier1.get("model", "unknown")

    print(f"\n{'='*60}")
    print(f"  AgentForgeV2 Tool Call Eval")
    print(f"  Model: {model_display}")
    print(f"  Tools: {len(tools)} registered ({', '.join(tool_names[:5])}...)")
    print(f"  Cases: {len(valid_cases)} ({len(skipped)} skipped - tool not registered)")
    print(f"{'='*60}\n")

    if skipped:
        for c in skipped:
            print(f"  >> #{c.id:3d} skipped: tool '{c.expected_tool}' not registered")
        print()

    # ── 逐条执行 ──
    system_prompt = (
        "你是一个AI助手，可以使用工具帮助用户完成任务。"
        "简单操作直接执行，复杂问题给完整回答。"
        "不需要工具时直接用文字回答，不要强行调用工具。"
    )

    results = []
    passed = 0
    total_tokens = 0
    start_time = time.time()

    for i, case in enumerate(valid_cases):
        try:
            resp = await llm.chat(
                system=system_prompt,
                messages=[{"role": "user", "content": case.input}],
                tools=tools,
                temperature=0,
                max_tokens=500,
            )

            actual_tool = None
            if resp.tool_calls:
                actual_tool = resp.tool_calls[0].get("name")

            ok = (actual_tool == case.expected_tool)
            if ok:
                passed += 1

            total_tokens += resp.total_tokens
            expected = case.expected_tool or "(none)"
            actual = actual_tool or "(none)"
            status = "PASS" if ok else "FAIL"

            print(f"  {status} #{case.id:3d} | exp: {expected:22s} | got: {actual:22s} | {case.input[:40]}")

            results.append({
                "id": case.id,
                "input": case.input,
                "expected": case.expected_tool,
                "actual": actual_tool,
                "passed": ok,
                "category": case.category,
                "tokens": resp.total_tokens,
                "model": resp.model,
            })

        except Exception as e:
            print(f"  ERR  #{case.id:3d} | ERROR: {e} | {case.input[:40]}")
            results.append({
                "id": case.id,
                "input": case.input,
                "expected": case.expected_tool,
                "actual": f"ERROR: {e}",
                "passed": False,
                "category": case.category,
            })

        # 避免 API 限流
        if (i + 1) % 10 == 0:
            await asyncio.sleep(1)

    # ── 汇总 ──
    total = len(results)
    accuracy = passed / total if total else 0
    duration = time.time() - start_time

    print(f"\n{'='*60}")
    print(f"  Results: {passed}/{total} passed ({accuracy:.0%})")
    print(f"  Duration: {duration:.0f}s | Tokens: {total_tokens:,}")
    print(f"{'='*60}")

    # 按 category 统计
    cat_pass = defaultdict(int)
    cat_total = defaultdict(int)
    for r in results:
        cat_total[r["category"]] += 1
        if r["passed"]:
            cat_pass[r["category"]] += 1

    print(f"\n  By category:")
    for cat in sorted(cat_total.keys()):
        p, t = cat_pass[cat], cat_total[cat]
        pct = p / t if t else 0
        bar = "#" * int(pct * 20) + "." * (20 - int(pct * 20))
        level = "OK" if pct >= 0.85 else "WARN" if pct >= 0.70 else "LOW"
        print(f"    [{level:4s}] {cat:18s} {bar} {p}/{t} ({pct:.0%})")

    # 失败用例详情
    failed = [r for r in results if not r["passed"]]
    if failed:
        print(f"\n  Failed cases ({len(failed)}):")
        for r in failed:
            print(f"    #{r['id']:3d} | exp: {r['expected'] or '(none)':20s} | got: {r['actual'] or '(none)':20s} | {r['input'][:50]}")

    # 混淆矩阵（最常见的错误工具对）
    confusion = defaultdict(int)
    for r in failed:
        key = f"{r['expected'] or 'none'} -> {r['actual'] or 'none'}"
        confusion[key] += 1
    if confusion:
        print(f"\n  Top confusion pairs:")
        for pair, count in sorted(confusion.items(), key=lambda x: -x[1])[:5]:
            print(f"    {pair}: {count} times")

    # ── 保存结果 ──
    output_dir = Path(__file__).parent / "results"
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / f"{time.strftime('%Y-%m-%d_%H%M')}.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.time(),
            "model": model_display,
            "tools_count": len(tools),
            "total": total,
            "passed": passed,
            "accuracy": accuracy,
            "duration": duration,
            "total_tokens": total_tokens,
            "by_category": {cat: {"passed": cat_pass[cat], "total": cat_total[cat],
                                   "accuracy": cat_pass[cat] / cat_total[cat] if cat_total[cat] else 0}
                            for cat in cat_total},
            "failed_cases": failed,
            "all_results": results,
        }, f, ensure_ascii=False, indent=2)

    print(f"\n  Results saved: {output_file}")

    # 门禁检查
    if accuracy < 0.85:
        print(f"\n  WARNING: BELOW THRESHOLD: {accuracy:.0%} < 85%")
        return 1
    else:
        print(f"\n  PASSED: {accuracy:.0%} >= 85%")
        return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
