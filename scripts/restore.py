"""
AgentForge V2 — 数据恢复脚本

用法:
    python scripts/restore.py                             # 从最新备份恢复
    python scripts/restore.py backups/agentforge_backup_xxx.zip  # 从指定备份恢复

注意: 恢复前会自动备份当前数据到 data.before_restore/
"""

import os
import shutil
import sys
import zipfile


def main():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(project_root, "data")
    backup_root = os.path.join(project_root, "backups")

    if len(sys.argv) > 1:
        archive = sys.argv[1]
    else:
        if not os.path.isdir(backup_root):
            print("ERROR: 无备份目录"); sys.exit(1)
        backups = sorted([f for f in os.listdir(backup_root) if f.endswith(".zip")], reverse=True)
        if not backups:
            print("ERROR: 无可用备份"); sys.exit(1)
        archive = os.path.join(backup_root, backups[0])
        print(f"自动选择最新备份: {archive}")

    if not os.path.isfile(archive):
        print(f"ERROR: 文件不存在: {archive}"); sys.exit(1)

    answer = input(f"确定恢复? 当前 data/ 将被替换。[y/N] ").strip().lower()
    if answer != "y":
        print("已取消"); sys.exit(0)

    if os.path.isdir(data_dir):
        safety_dir = data_dir + ".before_restore"
        if os.path.exists(safety_dir):
            shutil.rmtree(safety_dir)
        shutil.move(data_dir, safety_dir)
        print(f"当前数据已移至: {safety_dir}")

    with zipfile.ZipFile(archive, "r") as z:
        z.extractall(project_root)

    extracted_name = os.path.basename(archive).replace(".zip", "")
    extracted_path = os.path.join(project_root, extracted_name)
    if os.path.isdir(extracted_path) and extracted_path != data_dir:
        if os.path.exists(data_dir):
            shutil.rmtree(data_dir)
        shutil.move(extracted_path, data_dir)

    print("恢复完成! 请重启后端服务。")
    print(f"如需回退: mv {data_dir}.before_restore {data_dir}")


if __name__ == "__main__":
    main()
