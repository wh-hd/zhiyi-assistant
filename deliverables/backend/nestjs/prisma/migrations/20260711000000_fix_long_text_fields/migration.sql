-- 将健康档案中 5 个 JSON 字段由 VARCHAR(4000) 改为 TEXT（TiDB MySQL 长文本类型）
-- 注意：TEXT 列不支持 DEFAULT，现有行已由 baseline 填充为 '[]'
-- 关联任务：P1-M3

ALTER TABLE `health_records`
    MODIFY COLUMN `chronicDiseases` TEXT NOT NULL,
    MODIFY COLUMN `allergies` TEXT NOT NULL,
    MODIFY COLUMN `surgeries` TEXT NOT NULL,
    MODIFY COLUMN `familyHistory` TEXT NOT NULL,
    MODIFY COLUMN `vaccinations` TEXT NOT NULL;
