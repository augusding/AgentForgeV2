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
    from workflow.nodes.messaging import register_messaging
    from workflow.nodes.document_node import register_document
    from workflow.nodes.database_node import register_database
    from workflow.nodes.scraper_node import register_scraper
    from workflow.nodes.flow_nodes import register_flow
    from workflow.nodes.data_nodes import register_data_nodes

    register_triggers(registry)
    register_logic(registry)
    register_conditions(registry)
    register_notify(registry)
    register_ai(registry)
    register_http(registry)
    register_excel(registry)
    register_email(registry)
    register_messaging(registry)
    register_document(registry)
    register_database(registry)
    register_scraper(registry)
    register_flow(registry)
    register_data_nodes(registry)
