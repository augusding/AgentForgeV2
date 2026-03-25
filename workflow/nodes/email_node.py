"""邮件发送节点"""

import logging
import os

from workflow.registry import NodeRegistry, NodeTypeInfo
from workflow.types import WorkflowNode, NodeResult

logger = logging.getLogger(__name__)


async def _email_executor(node: WorkflowNode, variables: dict, ctx: dict) -> NodeResult:
    to = node.config.get("to", ""); subject = node.config.get("subject", ""); body = node.config.get("body", "")
    if not to or not subject:
        return NodeResult(node_id=node.id, status="failed", error="to 和 subject 不能为空")

    smtp_host = os.environ.get("SMTP_HOST", "")
    if not smtp_host:
        return NodeResult(node_id=node.id, status="completed", output={"status": "draft", "to": to, "subject": subject, "note": "SMTP 未配置"})

    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        msg = MIMEMultipart(); msg["Subject"] = subject
        msg["From"] = os.environ.get("SMTP_USER", "noreply@agentforge.ai"); msg["To"] = to
        msg.attach(MIMEText(body, "html" if node.config.get("html") else "plain", "utf-8"))
        with smtplib.SMTP(smtp_host, int(os.environ.get("SMTP_PORT", "587"))) as s:
            s.starttls()
            user, pw = os.environ.get("SMTP_USER", ""), os.environ.get("SMTP_PASS", "")
            if user and pw: s.login(user, pw)
            s.send_message(msg)
        return NodeResult(node_id=node.id, status="completed", output={"status": "sent", "to": to, "subject": subject})
    except Exception as e:
        return NodeResult(node_id=node.id, status="failed", error=f"邮件发送失败: {e}")


def register_email(registry: NodeRegistry) -> None:
    registry.register(NodeTypeInfo(
        name="email", display_name="邮件发送", group="notify", icon="mail",
        description="通过 SMTP 发送邮件",
        parameters=[
            {"name": "to", "type": "string", "displayName": "收件人", "default": ""},
            {"name": "subject", "type": "string", "displayName": "主题", "default": ""},
            {"name": "body", "type": "string", "displayName": "正文", "default": ""},
            {"name": "html", "type": "boolean", "displayName": "HTML", "default": False},
        ], executor=_email_executor))
