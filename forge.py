"""
AgentForge V2 — CLI 入口

用法:
    python forge.py serve          # 启动 API 服务
    python forge.py chat           # 交互式对话
    python forge.py positions      # 列出岗位
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def main():
    import typer
    from rich.console import Console

    app = typer.Typer(name="forge", help="AgentForge V2 — Smart Workstation Platform")
    console = Console()

    @app.command()
    def serve(
        host: str = "0.0.0.0",
        port: int = 8080,
    ):
        """启动 API 服务。"""
        from core.engine import ForgeEngine
        import logging
        log_format = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"
        log_dir = ROOT_DIR / "data" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        logging.basicConfig(
            level=logging.INFO, format=log_format,
            handlers=[
                logging.StreamHandler(),
                logging.FileHandler(str(log_dir / "forge.log"), encoding="utf-8"),
            ],
        )

        engine = ForgeEngine(ROOT_DIR)
        console.print(f"[bold cyan]AgentForge V2[/bold cyan] — 启动中...")
        asyncio.run(engine.serve(host=host, api_port=port))

    @app.command()
    def chat(
        position: str = typer.Option("strategy-pm", help="岗位 ID"),
        user_id: str = typer.Option("cli-user", help="用户 ID"),
    ):
        """交互式命令行对话。"""
        from core.engine import ForgeEngine
        from core.models import UnifiedMessage
        import logging
        logging.basicConfig(level=logging.WARNING)

        engine = ForgeEngine(ROOT_DIR)

        async def _chat():
            await engine.init()
            session_id = ""
            console.print(f"[bold green]AgentForge V2[/bold green] — 岗位: {position}")
            console.print("输入消息开始对话，Ctrl+C 退出\n")

            while True:
                try:
                    user_input = console.input("[bold blue]你: [/bold blue]")
                except (KeyboardInterrupt, EOFError):
                    console.print("\n再见！")
                    break

                if not user_input.strip():
                    continue

                msg = UnifiedMessage(
                    content=user_input,
                    user_id=user_id,
                    position_id=position,
                    session_id=session_id,
                    channel="cli",
                )
                result = await engine.handle_message(msg)
                session_id = result.get("session_id", session_id)
                console.print(f"\n[bold green]AI: [/bold green]{result.get('content', '')}\n")

        asyncio.run(_chat())

    @app.command()
    def positions(
        profile: str = typer.Option("", help="Profile 名"),
    ):
        """列出所有岗位。"""
        from core.config.loader import ConfigLoader
        loader = ConfigLoader(ROOT_DIR)
        for name in loader.list_profiles():
            if profile and name != profile:
                continue
            bundle = loader.load_profile(name)
            console.print(f"\n[bold]{name}[/bold] ({len(bundle.positions)} 岗位)")
            for pos in bundle.positions.values():
                console.print(f"  {pos.position_id:20s} {pos.display_name:12s} [{pos.department}]")

    app()


if __name__ == "__main__":
    main()
