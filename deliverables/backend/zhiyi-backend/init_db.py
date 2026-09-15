"""
智医助手 — 数据库连接测试 + 建表 + 种子数据 一次性执行脚本
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, query_one, execute_raw
from app.schema import create_all_tables
from app.seed import seed_all


def main():
    print("=" * 60)
    print("  智医助手 · 数据库初始化")
    print("=" * 60)

    # 1. 测试连接
    print("\n🔌 Step 1: 测试 TiDB 连接...")
    try:
        result = query_one("SELECT VERSION() AS version, NOW() AS server_time")
        print(f"  ✅ 连接成功! 数据库版本: {result['version']}")
        print(f"  🕐 服务器时间: {result['server_time']}")
    except Exception as e:
        print(f"  ❌ 连接失败: {e}")
        return

    # 2. 清空旧表（TRUNCATE — 重置自增ID + 不受FK约束影响）
    print("\n🧹 Step 2: 清空旧数据...")
    tables_reverse = [
        "medication_adherence", "home_tasks", "health_assessments",
        "consultation_messages", "member_timeline", "health_events",
        "medication_logs", "medications", "bp_trends",
        "health_metrics", "family_members", "user_stats", "users",
    ]
    # TiDB 需要先关闭外键检查才能 truncate
    execute_raw("SET FOREIGN_KEY_CHECKS = 0")
    for t in tables_reverse:
        try:
            execute_raw(f"TRUNCATE TABLE {t}")
        except Exception as e:
            print(f"  ⚠️  TRUNCATE {t} 失败: {e}")
    execute_raw("SET FOREIGN_KEY_CHECKS = 1")
    print("  ✅ 旧数据已清除 (AUTO_INCREMENT 已重置)")

    # 3. 建表
    print("\n📋 Step 3: 创建/重建数据库表...")
    create_all_tables()

    # 4. 种子数据
    print("\n🌱 Step 4: 写入种子数据...")
    seed_all()

    # 5. 验证
    print("\n🔍 Step 5: 数据验证...")
    tables_check = [
        "users", "user_stats", "family_members", "health_metrics",
        "bp_trends", "medications", "medication_logs", "health_events",
        "member_timeline", "consultation_messages", "health_assessments",
        "home_tasks", "medication_adherence"
    ]
    for t in tables_check:
        row = query_one(f"SELECT COUNT(*) AS cnt FROM {t}")
        print(f"  📊 {t:25s} → {row['cnt']} 条记录")

    print("\n" + "=" * 60)
    print("  ✅ 数据库初始化完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
