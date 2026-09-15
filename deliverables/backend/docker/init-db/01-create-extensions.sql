-- ============================================================
-- 智医助手 - DB 扩展初始化
-- 在 PostgreSQL 容器首次启动时自动执行
-- ============================================================

-- 启用 TimescaleDB 扩展
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 启用 UUID 生成
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 启用 pg_stat_statements（慢查询监控）
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 启用 pgcrypto（加密函数）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 启用向量搜索（为 V3 AI 功能预留）
-- CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE ' 智医助手 - 数据库扩展初始化完成';
    RAISE NOTICE ' TimescaleDB: ✅';
    RAISE NOTICE ' uuid-ossp: ✅';
    RAISE NOTICE ' pg_stat_statements: ✅';
    RAISE NOTICE ' pgcrypto: ✅';
    RAISE NOTICE '==============================================';
END $$;
