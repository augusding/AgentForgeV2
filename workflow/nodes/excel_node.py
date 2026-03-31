"""Excel 处理节点：read / create / append"""

import json
import logging
import os
from pathlib import Path

from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)
_ROOT = Path(os.environ.get("AGENTFORGE_ROOT", ".")).resolve()


async def _excel_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    try: import openpyxl
    except ImportError: return NodeResult(node_id=node.id, status="failed", error="需要安装 openpyxl")

    action = node.config.get("action", "read")
    source_type = node.config.get("source_type", "file")
    raw = node.config.get("path", "")
    if source_type == "upstream":
        uv = node.config.get("upstream_var", "")
        if uv:
            parts = uv.split(".", 1)
            if len(parts) == 2:
                no = ctx.get(parts[0], {})
                if isinstance(no, dict): raw = no.get(parts[1], no.get("path", ""))
            if not raw: raw = str(variables.get(uv, ""))
    if not raw: return NodeResult(node_id=node.id, status="failed", error="文件路径为空，请选择文件或配置上游引用")
    path = (_ROOT / raw).resolve()
    if not str(path).startswith(str(_ROOT)):
        return NodeResult(node_id=node.id, status="failed", error="路径越界")

    try:
        if action == "read":
            if not path.is_file(): return NodeResult(node_id=node.id, status="failed", error=f"文件不存在: {raw}")
            wb = openpyxl.load_workbook(str(path), read_only=True)
            sn = node.config.get("sheet", "")
            ws = wb[sn] if sn and sn in wb.sheetnames else wb.active
            rows, headers = [], []
            for i, row in enumerate(ws.iter_rows(max_row=1000, values_only=True)):
                cells = [str(c) if c is not None else "" for c in row]
                if i == 0: headers = cells
                else: rows.append(dict(zip(headers, cells)) if headers else {"row": cells})
            wb.close()
            return NodeResult(node_id=node.id, status="completed", output={"items": rows, "headers": headers, "row_count": len(rows)})

        if action == "create":
            data = node.config.get("data", "[]")
            if isinstance(data, str):
                try: data = json.loads(data)
                except json.JSONDecodeError: data = []
            if not data:
                last = ctx.get("_last_output", {})
                data = last.get("items", last.get("data", []))
            wb = openpyxl.Workbook(); ws = wb.active; ws.title = node.config.get("sheet", "Sheet1")
            if isinstance(data, list) and data:
                if isinstance(data[0], dict):
                    hdrs = list(data[0].keys()); ws.append(hdrs)
                    for r in data: ws.append([r.get(h, "") for h in hdrs])
                else:
                    for r in data: ws.append(r if isinstance(r, list) else [r])
            path.parent.mkdir(parents=True, exist_ok=True); wb.save(str(path))
            return NodeResult(node_id=node.id, status="completed", output={"path": raw, "rows": len(data)})

        if action == "append":
            if not path.is_file(): return NodeResult(node_id=node.id, status="failed", error=f"文件不存在: {raw}")
            data = ctx.get("_last_output", {}).get("items", [])
            ds = node.config.get("data", "")
            if ds: data = json.loads(ds) if isinstance(ds, str) else ds
            wb = openpyxl.load_workbook(str(path)); ws = wb.active; cnt = 0
            for r in data:
                ws.append(list(r.values()) if isinstance(r, dict) else (r if isinstance(r, list) else [r])); cnt += 1
            wb.save(str(path))
            return NodeResult(node_id=node.id, status="completed", output={"appended_rows": cnt})

        return NodeResult(node_id=node.id, status="failed", error=f"未知操作: {action}")
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=f"Excel 失败: {e}")


def register_excel(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(
        name="excel", display_name="Excel 处理", group="data", icon="table",
        description="读取、创建、追加 Excel 文件",
        parameters=[
            {"name": "action", "type": "options", "displayName": "操作", "default": "read",
             "options": [{"name": "读取", "value": "read"}, {"name": "创建", "value": "create"}, {"name": "追加", "value": "append"}]},
            {"name": "source_type", "type": "options", "displayName": "文件来源", "default": "file",
             "options": [{"name": "选择文件", "value": "file"}, {"name": "上游引用", "value": "upstream"}, {"name": "手动输入", "value": "manual"}]},
            {"name": "path", "type": "string", "displayName": "文件路径", "default": ""},
            {"name": "upstream_var", "type": "string", "displayName": "上游变量", "default": ""},
            {"name": "sheet", "type": "string", "displayName": "工作表", "default": ""},
            {"name": "data", "type": "json", "displayName": "数据", "default": "[]"},
        ], executor=_excel_executor))
