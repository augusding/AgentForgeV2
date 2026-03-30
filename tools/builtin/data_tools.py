"""
AgentForge V2 — 数据工具集

data_analysis: 基础数据分析（均值、求和、过滤、统计）
chart_generator: ECharts JSON 图表生成
"""

from __future__ import annotations

import json
import logging

from tools.registry import ToolDefinition

logger = logging.getLogger(__name__)


# ── 数据分析 ──────────────────────────────────────────────

async def _data_analysis_handler(args: dict) -> str:
    data_str = args.get("data", "")
    action = args.get("action", "stats")
    field = args.get("field", "")

    try:
        data = json.loads(data_str)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"数据解析错误: {e}"}, ensure_ascii=False)

    if not isinstance(data, list) or not data:
        return json.dumps({"error": "data 必须是非空数组"}, ensure_ascii=False)

    values = _extract_values(data, field)
    if not values:
        return json.dumps({"error": f"无法提取数值 (field={field})"}, ensure_ascii=False)

    if action == "sum":
        return json.dumps({"result": sum(values)}, ensure_ascii=False)
    elif action == "avg":
        return json.dumps({"result": round(sum(values) / len(values), 4)}, ensure_ascii=False)
    elif action == "max":
        return json.dumps({"result": max(values)}, ensure_ascii=False)
    elif action == "min":
        return json.dumps({"result": min(values)}, ensure_ascii=False)
    elif action == "sort":
        return json.dumps({"result": sorted(values)}, ensure_ascii=False)
    elif action == "filter":
        condition = args.get("condition", "")
        filtered = _filter_values(values, condition)
        return json.dumps({"result": filtered, "count": len(filtered)}, ensure_ascii=False)
    elif action == "stats":
        return json.dumps({
            "count": len(values), "sum": round(sum(values), 4),
            "avg": round(sum(values) / len(values), 4),
            "max": max(values), "min": min(values),
        }, ensure_ascii=False)
    return json.dumps({"error": f"未知操作: {action}"}, ensure_ascii=False)


def _extract_values(data: list, field: str) -> list[float]:
    values = []
    for item in data:
        if isinstance(item, (int, float)):
            values.append(float(item))
        elif isinstance(item, dict) and field:
            val = item.get(field)
            if isinstance(val, (int, float)):
                values.append(float(val))
    return values


def _filter_values(values: list[float], condition: str) -> list[float]:
    if not condition:
        return values
    try:
        for op, func in [(">=", lambda v, t: v >= t), ("<=", lambda v, t: v <= t),
                          (">", lambda v, t: v > t), ("<", lambda v, t: v < t),
                          ("==", lambda v, t: v == t)]:
            if condition.startswith(op):
                threshold = float(condition[len(op):])
                return [v for v in values if func(v, threshold)]
    except ValueError:
        pass
    return values


data_analysis = ToolDefinition(
    name="data_analysis",
    description="基础数据分析: 计算均值、求和、最大最小值、排序、过滤、统计。",
    input_schema={
        "type": "object",
        "properties": {
            "data": {"type": "string", "description": "JSON 数组，如 '[1,2,3]' 或 '[{\"name\":\"A\",\"value\":10}]'"},
            "action": {"type": "string", "enum": ["sum", "avg", "max", "min", "sort", "filter", "stats"], "description": "分析操作"},
            "field": {"type": "string", "description": "操作字段名（对象数组时）"},
            "condition": {"type": "string", "description": "过滤条件，如 '>10'"},
        },
        "required": ["data", "action"],
    },
    handler=_data_analysis_handler,
    category="data",
)


# ── 图表生成 ──────────────────────────────────────────────

async def _chart_handler(args: dict) -> str:
    chart_type = args.get("chart_type", "bar")
    title = args.get("title", "")
    data_str = args.get("data", "")

    try:
        data = json.loads(data_str)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"数据解析错误: {e}"}, ensure_ascii=False)

    if chart_type == "custom":
        return json.dumps({"type": "echarts", "option": data}, ensure_ascii=False)

    option = _build_echarts_option(chart_type, title, data)
    return json.dumps({"type": "echarts", "option": option}, ensure_ascii=False)


_CHART_COLORS = ["#5b8ff9", "#5ad8a6", "#f6bd16", "#e86452", "#6dc8ec",
                  "#945fb9", "#ff9845", "#1e9493", "#ff99c3", "#269a99"]

def _build_echarts_option(chart_type: str, title: str, data) -> dict:
    option: dict = {
        "color": _CHART_COLORS,
        "title": {"text": title, "left": "center", "textStyle": {"fontSize": 14, "fontWeight": 500}} if title else {},
        "tooltip": {"trigger": "axis" if chart_type in ("bar", "line") else "item", "borderWidth": 0, "padding": [8, 12]},
        "grid": {"left": "3%", "right": "4%", "bottom": "3%", "top": title and "15%" or "8%", "containLabel": True},
    }

    if chart_type in ("bar", "line"):
        categories = data.get("categories", []) if isinstance(data, dict) else []
        series_data = data.get("series", []) if isinstance(data, dict) else []
        option["xAxis"] = {"type": "category", "data": categories,
            "axisLabel": {"fontSize": 11, "rotate": 30 if len(categories) > 6 else 0}}
        option["yAxis"] = {"type": "value", "axisLabel": {"fontSize": 11}}
        option["series"] = [
            {"name": s.get("name", f"系列{i+1}"), "type": chart_type, "data": s.get("values", []),
             "barMaxWidth": 32, "itemStyle": {"borderRadius": [3, 3, 0, 0]} if chart_type == "bar" else {}}
            for i, s in enumerate(series_data)
        ]
        if len(series_data) > 1:
            option["legend"] = {"data": [s.get("name", "") for s in series_data], "top": "30", "textStyle": {"fontSize": 11}}

    elif chart_type == "pie":
        items = data if isinstance(data, list) else data.get("items", [])
        option["series"] = [{"type": "pie", "radius": ["40%", "65%"], "data": items,
            "label": {"fontSize": 11}, "itemStyle": {"borderRadius": 4, "borderWidth": 2}}]
        option.pop("grid", None)

    elif chart_type == "scatter":
        series_data = data.get("series", []) if isinstance(data, dict) else []
        option["xAxis"] = {"type": "value", "name": data.get("xLabel", ""), "nameTextStyle": {"fontSize": 11}}
        option["yAxis"] = {"type": "value", "name": data.get("yLabel", ""), "nameTextStyle": {"fontSize": 11}}
        option["series"] = [
            {"name": s.get("name", ""), "type": "scatter", "data": s.get("values", []), "symbolSize": 8}
            for s in series_data
        ]

    elif chart_type == "radar":
        indicators = data.get("indicators", []) if isinstance(data, dict) else []
        series_data = data.get("series", []) if isinstance(data, dict) else []
        option["radar"] = {"indicator": [
            {"name": i.get("name", i) if isinstance(i, dict) else str(i),
             "max": i.get("max", 100) if isinstance(i, dict) else 100}
            for i in indicators
        ]}
        option["series"] = [{"type": "radar", "data": [
            {"name": s.get("name", ""), "value": s.get("values", [])} for s in series_data
        ], "areaStyle": {"opacity": 0.15}}]
        option.pop("grid", None)

    return option


chart_generator = ToolDefinition(
    name="chart_generator",
    description="生成数据可视化图表（ECharts JSON）。支持柱状图、折线图、饼图、散点图、雷达图。",
    input_schema={
        "type": "object",
        "properties": {
            "chart_type": {"type": "string", "enum": ["bar", "line", "pie", "scatter", "radar", "custom"], "description": "图表类型"},
            "title": {"type": "string", "description": "图表标题"},
            "data": {"type": "string", "description": "JSON 数据。柱状图/折线图: {\"categories\":[...],\"series\":[{\"name\":\"...\",\"values\":[...]}]}，饼图: [{\"name\":\"A\",\"value\":10}]"},
        },
        "required": ["chart_type", "data"],
    },
    handler=_chart_handler,
    category="data",
)


ALL_DATA_TOOLS = [data_analysis, chart_generator]
