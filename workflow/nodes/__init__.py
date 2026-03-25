"""注册所有内置工作流节点。"""

from workflow.registry import NodeRegistry


def register_all_nodes(registry: NodeRegistry, llm_client=None) -> None:
    from workflow.nodes.triggers import register_triggers
    from workflow.nodes.logic import register_logic
    from workflow.nodes.conditions import register_conditions
    from workflow.nodes.notify import register_notify
    from workflow.nodes.ai_node import register_ai
    from workflow.nodes.http_node import register_http
    from workflow.nodes.excel_node import register_excel
    from workflow.nodes.email_node import register_email

    register_triggers(registry)
    register_logic(registry)
    register_conditions(registry)
    register_notify(registry)
    register_ai(registry)
    register_http(registry)
    register_excel(registry)
    register_email(registry)
