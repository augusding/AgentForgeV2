"""网页抓取节点"""

import re, logging
from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)


async def _scraper_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    import aiohttp
    url = node.config.get("url", "")
    extract = node.config.get("extract", "text")
    selector = node.config.get("selector", "")
    if not url: return NodeResult(node_id=node.id, status="failed", error="URL 不能为空")

    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(url, headers={"User-Agent": "Mozilla/5.0 (AgentForge)"}, timeout=aiohttp.ClientTimeout(total=30)) as r:
                if r.status != 200:
                    return NodeResult(node_id=node.id, status="failed", error=f"HTTP {r.status}")
                if extract == "json":
                    return NodeResult(node_id=node.id, status="completed", output={"data": await r.json()})
                html = await r.text()
                if extract == "html":
                    return NodeResult(node_id=node.id, status="completed", output={"html": html[:50000], "length": len(html)})
                # text
                text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
                text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
                text = re.sub(r'<[^>]+>', ' ', text)
                text = re.sub(r'\s+', ' ', text).strip()
                if selector:
                    text = '。'.join(l for l in text.split('。') if selector in l)
                return NodeResult(node_id=node.id, status="completed", output={"text": text[:20000], "length": len(text), "url": url})
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=f"抓取失败: {e}")


def register_scraper(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(name="scraper", display_name="网页抓取", group="action", icon="scan",
        description="获取网页内容", parameters=[
            {"name": "url", "type": "string", "displayName": "URL", "default": ""},
            {"name": "extract", "type": "options", "displayName": "提取", "default": "text",
             "options": [{"name": "文本", "value": "text"}, {"name": "HTML", "value": "html"}, {"name": "JSON", "value": "json"}]},
            {"name": "selector", "type": "string", "displayName": "过滤关键词", "default": ""},
        ], executor=_scraper_executor))
