-- ============================================================
-- M3 健康档案长文本字段迁移：VARCHAR(4000) -> TEXT
-- ============================================================
-- 背景：schema.prisma 中 health_records 的五字段与 knowledge.tags 现已定义为 @db.Text，
--       但因历史迁移文件损坏（202607100002_release_hardening）导致 `prisma migrate dev` 不可用，
--       真实库（TiDB Cloud）中这些列仍可能是 VARCHAR(4000)，超长病史/过敏/标签会触发 500。
-- 本 SQL 用于在【已连上真实库】后手动执行，把列类型改为 TEXT（长文本，无 4000 长度上限）。
--
-- 执行方式（任选其一）：
--   1) TiDB Cloud 控制台 → SQL Playground 粘贴执行
--   2) 命令行：mysql -h <host> -P 4000 -u <user> -p zhiyi_dev < M3-text-migration.sql
--   3) 或：cat M3-text-migration.sql | prisma db execute --schema prisma/schema.prisma --stdin
--
-- 执行前可选确认当前列类型（无匹配行说明已是 TEXT）：
--   SELECT COLUMN_NAME, COLUMN_TYPE
--   FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA = DATABASE()
--     AND TABLE_NAME IN ('health_records','knowledge')
--     AND COLUMN_NAME IN ('chronic_diseases','allergies','surgeries','family_history','vaccinations','tags');
-- ============================================================

ALTER TABLE health_records MODIFY COLUMN chronic_diseases TEXT;
ALTER TABLE health_records MODIFY COLUMN allergies        TEXT;
ALTER TABLE health_records MODIFY COLUMN surgeries        TEXT;
ALTER TABLE health_records MODIFY COLUMN family_history   TEXT;
ALTER TABLE health_records MODIFY COLUMN vaccinations     TEXT;

ALTER TABLE knowledge MODIFY COLUMN tags TEXT;

-- 说明：以上 ALTER 为幂等可重跑（已为 TEXT 的列再次 MODIFY 无副作用，仅轻微 DDL 开销）。
-- 若你后续改用 `prisma db push` 同步（可绕开损坏的 migrate 历史），结果与本 SQL 等价。
