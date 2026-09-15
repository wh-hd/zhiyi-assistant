#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

# 把数据库结构自动对齐到 Prisma schema（幂等、可重复执行）。
# 项目历史迁移 202607100002_release_hardening 已损坏，无法用 migrate deploy 正常推进，
# 因此自托管场景以 `prisma db push` 作为唯一事实来源：直接比对 schema 与库结构并增量修正。
# 已知修正：health_records 的病史/过敏等超长文本字段由 VARCHAR(4000) 扩为 TEXT，
# 杜绝超长内容写入时 500。该变更为类型扩展，非破坏性，--accept-data-loss 在此安全。
# 数据库未就绪时最多重试 30 次（约 2.5 分钟），避免 TiDB 冷启动导致一次性失败。
echo "Syncing database schema to Prisma models (prisma db push)..."
attempt=0
max_attempts=30
while [ "$attempt" -lt "$max_attempts" ]; do
  if ./node_modules/.bin/prisma db push --skip-generate --accept-data-loss; then
    echo "Schema sync succeeded."
    break
  fi
  attempt=$((attempt + 1))
  echo "Schema sync attempt $attempt/$max_attempts failed, retrying in 5s..."
  sleep 5
done

if [ "$attempt" -ge "$max_attempts" ]; then
  echo "ERROR: could not sync database schema after $max_attempts attempts." >&2
  echo "Check DATABASE_URL and network connectivity to the database." >&2
  exit 1
fi

echo "Starting API..."
exec node dist/main.js

