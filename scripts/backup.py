"""
AgentForge V2 — 数据备份脚本

用法:
    python scripts/backup.py              # 备份到 backups/ 目录
    python scripts/backup.py /path/to/dir # 备份到指定目录

备份内容: data/ 目录（SQLite + ChromaDB + uploads）
保留策略: 默认保留最近 7 份（通过 BACKUP_KEEP_COUNT 环境变量控制）
"""

import datetime
import os
import shutil
import sys


def main():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(project_root, "data")
    backup_root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(project_root, "backups")
    keep_count = int(os.environ.get("BACKUP_KEEP_COUNT", "7"))

    if not os.path.isdir(data_dir):
        print(f"ERROR: data 目录不存在: {data_dir}")
        sys.exit(1)

    os.makedirs(backup_root, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"agentforge_backup_{timestamp}"
    backup_path = os.path.join(backup_root, backup_name)

    print(f"开始备份: {data_dir} -> {backup_path}")
    shutil.copytree(data_dir, backup_path, dirs_exist_ok=False)
    archive_path = shutil.make_archive(backup_path, "zip", backup_root, backup_name)
    shutil.rmtree(backup_path)

    size_mb = os.path.getsize(archive_path) / (1024 * 1024)
    print(f"备份完成: {archive_path} ({size_mb:.1f} MB)")

    backups = sorted(
        [f for f in os.listdir(backup_root) if f.startswith("agentforge_backup_") and f.endswith(".zip")],
        reverse=True,
    )
    if len(backups) > keep_count:
        for old in backups[keep_count:]:
            old_path = os.path.join(backup_root, old)
            os.remove(old_path)
            print(f"清理旧备份: {old}")

    print(f"当前保留 {min(len(backups), keep_count)} 份备份")


if __name__ == "__main__":
    main()
