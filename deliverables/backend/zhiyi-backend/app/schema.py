"""
智医助手 — 数据库建表 DDL
根据 test_data.js 数据结构设计 MySQL 表
"""
from app.database import execute_raw

# 全部建表 SQL
DDL_STATEMENTS = [
    # ─── 1. 用户表 ──────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS users (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(50)  NOT NULL COMMENT '用户昵称',
        avatar_text VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '头像缩写',
        greeting    VARCHAR(100) NOT NULL DEFAULT '' COMMENT '问候语',
        greeting_sub VARCHAR(200) NOT NULL DEFAULT '' COMMENT '问候副标题',
        profile_tag VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '身份标签',
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='用户表';
    """,

    # ─── 2. 用户统计表 ──────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS user_stats (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT          NOT NULL COMMENT '用户ID',
        stat_value VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '统计数值',
        stat_label VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '统计标签',
        sort_order INT          NOT NULL DEFAULT 0 COMMENT '排序',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_stats_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='用户统计表';
    """,

    # ─── 3. 家庭成员表 ──────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS family_members (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        user_id         INT          NOT NULL COMMENT '所属用户ID',
        name            VARCHAR(50)  NOT NULL COMMENT '姓名',
        relation        VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '关系（爸爸/妈妈/儿子/女儿/配偶/其他）',
        gender          VARCHAR(5)   NOT NULL DEFAULT '' COMMENT '性别',
        age             INT          NOT NULL DEFAULT 0 COMMENT '年龄',
        avatar_text     VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '头像缩写',
        avatar_color    VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '头像颜色',
        info            VARCHAR(200) NOT NULL DEFAULT '' COMMENT '格式化信息',
        status          VARCHAR(100) NOT NULL DEFAULT '' COMMENT '健康状态描述',
        status_type     VARCHAR(20)  NOT NULL DEFAULT 'ok' COMMENT '状态类型 warn/ok',
        status_label    VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '状态标签',
        health_condition VARCHAR(200) NOT NULL DEFAULT '' COMMENT '慢性病情况',
        sort_order      INT          NOT NULL DEFAULT 0 COMMENT '排序',
        created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_family_user (user_id),
        INDEX idx_family_sort (user_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='家庭成员表';
    """,

    # ─── 4. 健康指标表 ──────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS health_metrics (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        member_id    INT          NOT NULL COMMENT '成员ID',
        metric_type  VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '指标类型 bp/weight/glucose/hr/height/vision',
        metric_label VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '指标名称',
        metric_value VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '指标值',
        metric_unit  VARCHAR(80)  NOT NULL DEFAULT '' COMMENT '单位与描述',
        unit_type    VARCHAR(20)  NOT NULL DEFAULT 'default' COMMENT '单位类型 warn/ok/default',
        recorded_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
        FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
        INDEX idx_metrics_member (member_id),
        INDEX idx_metrics_type (member_id, metric_type),
        INDEX idx_metrics_time (recorded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='健康指标表';
    """,

    # ─── 5. 血压趋势表 ──────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS bp_trends (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        member_id    INT          NOT NULL COMMENT '成员ID',
        systolic     INT          NOT NULL DEFAULT 0 COMMENT '收缩压',
        diastolic    INT          NOT NULL DEFAULT 0 COMMENT '舒张压',
        recorded_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
        FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
        INDEX idx_bp_trend_member (member_id),
        INDEX idx_bp_trend_time (recorded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='血压趋势表';
    """,

    # ─── 6. 用药表 ──────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS medications (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        member_id      INT          NOT NULL COMMENT '成员ID',
        med_name       VARCHAR(100) NOT NULL DEFAULT '' COMMENT '药品名称',
        med_detail     VARCHAR(200) NOT NULL DEFAULT '' COMMENT '用药说明',
        time_slot      VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '服药时间 如 08:00',
        time_color     VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '时间颜色',
        frequency      VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '频次 每日一次/两次/三次',
        method         VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '服用方式 饭前/饭后/睡前/随时',
        is_active      TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用',
        sort_order     INT          NOT NULL DEFAULT 0 COMMENT '排序',
        created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
        INDEX idx_meds_member (member_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='用药表';
    """,

    # ─── 7. 用药日志表 ──────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS medication_logs (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        medication_id  INT          NOT NULL COMMENT '药品ID',
        taken          TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否已服用',
        log_date       DATE         NOT NULL COMMENT '记录日期',
        created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
        INDEX idx_medlog_date (medication_id, log_date),
        UNIQUE KEY uk_med_date (medication_id, log_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='用药日志表';
    """,

    # ─── 8. 健康事件表（首页时间线） ────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS health_events (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        member_id   INT          NOT NULL COMMENT '成员ID',
        event_text  VARCHAR(200) NOT NULL DEFAULT '' COMMENT '事件描述',
        event_time  VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '时间展示文本',
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
        INDEX idx_events_member (member_id),
        INDEX idx_events_time (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='健康事件表';
    """,

    # ─── 9. 成员时间线表 ────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS member_timeline (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        member_id   INT          NOT NULL COMMENT '成员ID',
        event_time  TIMESTAMP    NOT NULL COMMENT '事件时间',
        title       VARCHAR(100) NOT NULL DEFAULT '' COMMENT '事件标题',
        description TEXT         NOT NULL COMMENT '事件描述',
        event_type  VARCHAR(20)  NOT NULL DEFAULT 'default' COMMENT '事件类型 warn/default',
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
        INDEX idx_timeline_member (member_id),
        INDEX idx_timeline_time (event_time DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='成员时间线表';
    """,

    # ─── 10. AI 咨询消息表 ──────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS consultation_messages (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT          NOT NULL COMMENT '用户ID',
        msg_type     VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '消息类型 ai/user',
        avatar_color VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '头像颜色',
        avatar_icon  TEXT         NOT NULL COMMENT '头像 SVG 图标',
        avatar_text  VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '头像文字',
        msg_text     TEXT         NOT NULL COMMENT '消息内容',
        status_tag   VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '状态标签',
        sort_order   INT          NOT NULL DEFAULT 0 COMMENT '排序',
        created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_consult_user (user_id),
        INDEX idx_consult_order (user_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='AI咨询消息表';
    """,

    # ─── 11. 健康评估报告表 ─────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS health_assessments (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        user_id        INT          NOT NULL COMMENT '用户ID',
        score          INT          NOT NULL DEFAULT 0 COMMENT '总分',
        grade          VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '等级',
        summary        TEXT         NOT NULL COMMENT '评估总结',
        dimensions     JSON         NOT NULL COMMENT '各维度评分',
        risks          JSON         NOT NULL COMMENT '风险提示',
        suggestions    JSON         NOT NULL COMMENT '改进建议',
        recommendations JSON        NOT NULL COMMENT '行动推荐',
        created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_assess_user (user_id),
        INDEX idx_assess_time (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='健康评估报告表';
    """,

    # ─── 12. 首页任务表 ─────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS home_tasks (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT          NOT NULL COMMENT '用户ID',
        title        VARCHAR(200) NOT NULL DEFAULT '' COMMENT '任务标题',
        detail       VARCHAR(200) NOT NULL DEFAULT '' COMMENT '任务详情',
        icon_bg      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '图标背景色',
        icon_stroke  VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '图标描边色',
        icon_svg     TEXT         NOT NULL COMMENT '图标SVG',
        sort_order   INT          NOT NULL DEFAULT 0 COMMENT '排序',
        created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_tasks_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='首页任务表';
    """,

    # ─── 13. 用药依从性统计表 ───────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS medication_adherence (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        user_id       INT          NOT NULL COMMENT '用户ID',
        week_label    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '周期标签',
        percent       VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '百分比',
        description   VARCHAR(200) NOT NULL DEFAULT '' COMMENT '描述',
        total_count   INT          NOT NULL DEFAULT 0 COMMENT '总次数',
        taken_count   INT          NOT NULL DEFAULT 0 COMMENT '已服用次数',
        missed_count  INT          NOT NULL DEFAULT 0 COMMENT '漏服次数',
        created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_adherence_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='用药依从性统计表';
    """,
]


def create_all_tables():
    """执行全部建表语句"""
    for i, sql in enumerate(DDL_STATEMENTS):
        try:
            execute_raw(sql)
            print(f"  ✅ 表 {i+1}/{len(DDL_STATEMENTS)} 创建成功")
        except Exception as e:
            print(f"  ⚠️ 表 {i+1}/{len(DDL_STATEMENTS)} 建表异常: {e}")
