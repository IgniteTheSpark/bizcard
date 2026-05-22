"""
clear_data.py — 清空所有用户数据（保留 Skill 定义）

用法：
  cd Eureka-BrandNew/backend
  python scripts/clear_data.py

清空顺序（遵守 FK 约束）：
  1. asset_fields  (FK → assets CASCADE DELETE，先删以防止孤行)
  2. assets        (FK → sessions, user_skills)
  3. sessions
  4. contacts

保留：
  global_skills / user_skills  ← Skill 定义是系统配置，不是用户数据
"""

import sys
import os
import io
from pathlib import Path

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# 确保能 import 到 backend 包
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from db.database import sync_engine
from sqlalchemy import text

TABLES_TO_CLEAR = [
    "asset_fields",   # 必须先删，FK CASCADE 否则会阻止删 assets
    "assets",
    "sessions",
    "contacts",
]

def confirm(prompt: str) -> bool:
    answer = input(f"{prompt} [yes/N]: ").strip().lower()
    return answer == "yes"

def main():
    print("=" * 52)
    print("  ⚠️  Eureka 数据清空工具")
    print("=" * 52)
    print()
    print("将清空以下表的 ALL 行：")
    for t in TABLES_TO_CLEAR:
        print(f"  • {t}")
    print()
    print("保留（Skill 定义）：global_skills, user_skills")
    print()

    if not confirm("确认清空？输入 yes 继续"):
        print("已取消。")
        return

    with sync_engine.connect() as conn:
        conn.execute(text("BEGIN"))
        try:
            for table in TABLES_TO_CLEAR:
                result = conn.execute(text(f"DELETE FROM {table}"))
                print(f"  ✓ {table}: {result.rowcount} 行已删除")
            conn.execute(text("COMMIT"))
            print()
            print("✅ 数据清空完成。")
        except Exception as e:
            conn.execute(text("ROLLBACK"))
            print(f"\n❌ 清空失败，已回滚: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
