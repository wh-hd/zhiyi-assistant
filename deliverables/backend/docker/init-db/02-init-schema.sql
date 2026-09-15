-- ============================================================
-- 智医助手 - 开发环境 Schema 初始化 + 种子数据
-- ============================================================

-- ============================================================
-- 用户与认证
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wx_openid       VARCHAR(128) UNIQUE NOT NULL,
    wx_unionid      VARCHAR(128),
    nickname        VARCHAR(100),
    avatar_url      TEXT,
    phone           VARCHAR(20),
    gender          SMALLINT CHECK (gender IN (0, 1, 2)),
    birthday        DATE,
    age_group       VARCHAR(20),
    is_elderly_mode BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) UNIQUE NOT NULL,
    device_info     VARCHAR(255),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_wx_openid ON users(wx_openid) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id, expires_at) WHERE revoked_at IS NULL;

-- ============================================================
-- 家庭与成员
-- ============================================================

CREATE TABLE IF NOT EXISTS families (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    member_count    SMALLINT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    role            VARCHAR(20) NOT NULL DEFAULT 'member',
    nickname        VARCHAR(100) NOT NULL,
    relation        VARCHAR(20),
    avatar_url      TEXT,
    age             SMALLINT,
    gender          SMALLINT,
    is_primary      BOOLEAN DEFAULT false,
    sort_order      SMALLINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_family_user UNIQUE (family_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id);

-- ============================================================
-- 健康档案
-- ============================================================

CREATE TABLE IF NOT EXISTS health_records (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id           UUID NOT NULL UNIQUE REFERENCES family_members(id) ON DELETE CASCADE,
    blood_type          VARCHAR(5),
    height_cm           DECIMAL(5,1),
    weight_kg           DECIMAL(5,1),
    chronic_diseases    JSONB DEFAULT '[]',
    allergies           JSONB DEFAULT '[]',
    surgeries           JSONB DEFAULT '[]',
    family_history      JSONB DEFAULT '[]',
    vaccinations        JSONB DEFAULT '[]',
    last_checkup_date   DATE,
    checkup_summary     TEXT,
    last_assessment_id  UUID,
    last_assessment_score SMALLINT,
    last_assessment_date TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_records_member ON health_records(member_id);

-- ============================================================
-- 健康自评
-- ============================================================

CREATE TABLE IF NOT EXISTS assessments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    family_id       UUID NOT NULL REFERENCES families(id),
    type            VARCHAR(30) DEFAULT 'initial',
    total_score     SMALLINT,
    category_scores JSONB,
    top_concerns    JSONB,
    radar_chart     JSONB,
    full_analysis   TEXT,
    raw_answers     JSONB,
    status          VARCHAR(20) DEFAULT 'completed',
    completed_at    TIMESTAMPTZ,
    next_review_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessments_member ON assessments(member_id, created_at DESC);

-- ============================================================
-- AI 健康咨询
-- ============================================================

CREATE TABLE IF NOT EXISTS consultations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id           UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    family_id           UUID NOT NULL REFERENCES families(id),
    session_id          UUID NOT NULL,
    query_text          TEXT NOT NULL,
    input_type          VARCHAR(20) DEFAULT 'text',
    response_text       TEXT,
    response_type       VARCHAR(20),
    red_line_triggered  BOOLEAN DEFAULT false,
    red_line_category   VARCHAR(50),
    red_line_severity   VARCHAR(20),
    self_harm_detected  BOOLEAN DEFAULT false,
    disclaimer_shown    BOOLEAN DEFAULT true,
    satisfaction        SMALLINT,
    feedback_text       TEXT,
    llm_model           VARCHAR(50),
    prompt_version      VARCHAR(20),
    tokens_used         INTEGER,
    response_time_ms    INTEGER,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_member ON consultations(member_id, created_at DESC);

-- ============================================================
-- 用药管理
-- ============================================================

CREATE TABLE IF NOT EXISTS medication_plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    family_id       UUID NOT NULL REFERENCES families(id),
    medicine_name   VARCHAR(200) NOT NULL,
    medicine_code   VARCHAR(100),
    dosage          VARCHAR(50),
    dosage_unit     VARCHAR(20),
    frequency       VARCHAR(50) NOT NULL,
    custom_schedule JSONB,
    start_date      DATE NOT NULL,
    end_date        DATE,
    source          VARCHAR(20) DEFAULT 'manual',
    ocr_image_url   TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    reminder_user_id UUID,
    is_active       BOOLEAN DEFAULT true,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medication_adherence (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id         UUID NOT NULL REFERENCES medication_plans(id) ON DELETE CASCADE,
    scheduled_at    TIMESTAMPTZ NOT NULL,
    taken_at        TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'pending',
    confirmed_by    UUID REFERENCES users(id),
    missed_notified BOOLEAN DEFAULT false,
    missed_notified_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 健康指标（TimescaleDB 超表）
-- ============================================================

CREATE TABLE IF NOT EXISTS health_metrics (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    metric_type     VARCHAR(30) NOT NULL,
    value           DECIMAL(10,2) NOT NULL,
    unit            VARCHAR(20) NOT NULL,
    group_id        UUID,
    input_method    VARCHAR(20) DEFAULT 'manual',
    device_id       VARCHAR(100),
    notes           TEXT,
    recorded_at     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 转换为 TimescaleDB 超表（自动按7天分区）
-- 注意：如果表非空，需要先迁移数据
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'health_metrics'
    ) THEN
        PERFORM create_hypertable('health_metrics', 'recorded_at',
            chunk_time_interval => INTERVAL '7 days',
            if_not_exists => TRUE
        );
        RAISE NOTICE 'TimescaleDB hypertable "health_metrics" created';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_metrics_member_type_time ON health_metrics(member_id, metric_type, recorded_at DESC);

-- ============================================================
-- 通知消息
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    family_id       UUID REFERENCES families(id),
    type            VARCHAR(30) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    body            TEXT,
    action_url      TEXT,
    channel         VARCHAR(20) DEFAULT 'wechat_subscribe',
    status          VARCHAR(20) DEFAULT 'pending',
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    retry_count     SMALLINT DEFAULT 0,
    max_retries     SMALLINT DEFAULT 3,
    last_error      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 指标阈值配置
-- ============================================================

CREATE TABLE IF NOT EXISTS metric_thresholds (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type             VARCHAR(30) NOT NULL,
    min_normal              DECIMAL(10,2),
    max_normal              DECIMAL(10,2),
    alert_consecutive_count SMALLINT DEFAULT 3,
    alert_window            INTERVAL DEFAULT INTERVAL '7 days',
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 预置阈值
INSERT INTO metric_thresholds (metric_type, min_normal, max_normal) VALUES
    ('blood_pressure_systolic', 90, 140),
    ('blood_pressure_diastolic', 60, 90),
    ('blood_glucose_fasting', 3.9, 6.1),
    ('blood_glucose_postprandial', 3.9, 7.8),
    ('heart_rate', 60, 100),
    ('body_temp', 36.0, 37.3)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 完成
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE ' 智医助手 - Schema 初始化完成';
    RAISE NOTICE ' 表已创建: users, families, members, records,';
    RAISE NOTICE '          assessments, consultations, medications,';
    RAISE NOTICE '          health_metrics (超表), notifications';
    RAISE NOTICE '==============================================';
END $$;
