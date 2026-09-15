"""
快速权限诊断 — 检查 TiDB 用户权限
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import query_raw, query_one

print("=" * 60)
print("  TiDB 权限诊断")
print("=" * 60)

# 检查当前用户权限
try:
    grants = query_raw("SHOW GRANTS FOR CURRENT_USER()")
    print("\n📋 当前用户权限:")
    for g in grants:
        print(f"  {list(g.values())[0]}")
except Exception as e:
    print(f"  ⚠️ 无法获取权限: {e}")

# 尝试创建表（不带外键）
print("\n🔧 尝试创建最简表（无外键）...")
try:
    query_raw("""
        CREATE TABLE IF NOT EXISTS test_table (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50)
        )
    """)
    print("  ✅ 可以创建表!")
    query_raw("DROP TABLE IF EXISTS test_table")
except Exception as e:
    print(f"  ❌ 无法创建: {e}")

# 检查可用的数据库
try:
    dbs = query_raw("SHOW DATABASES")
    print("\n📊 可用的数据库:")
    for db in dbs:
        print(f"  - {list(db.values())[0]}")
except Exception as e:
    print(f"  ⚠️ 无法列出数据库: {e}")

# 尝试 USE test 数据库
print("\n🔄 尝试使用 test 数据库...")
try:
    from app.database import execute_raw
    execute_raw("CREATE DATABASE IF NOT EXISTS test")
    print("  ✅ test 数据库可用")
except Exception as e:
    print(f"  ❌ test 数据库: {e}")
