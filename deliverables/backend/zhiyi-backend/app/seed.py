"""
智医助手 — 数据库种子数据
将 test_data.js 中的模拟数据写入 TiDB Cloud
"""
from app.database import execute_raw


def seed_all():
    """执行全部种子数据插入"""
    print("\n🌱 开始写入种子数据...\n")

    _seed_users()
    _seed_user_stats()
    _seed_family_members()
    _seed_health_metrics()
    _seed_bp_trends()
    _seed_medications()
    _seed_medication_logs()
    _seed_health_events()
    _seed_member_timeline()
    _seed_consultation_messages()
    _seed_health_assessments()
    _seed_home_tasks()
    _seed_medication_adherence()

    print("\n✅ 种子数据写入完成！\n")


def _seed_users():
    execute_raw("""
        INSERT INTO users (id, name, avatar_text, greeting, greeting_sub, profile_tag)
        VALUES (1, '晓琳', '晓', '早上好，晓琳', '今天家人都还好吗？', '家庭健康管理师')
        ON DUPLICATE KEY UPDATE
            name = VALUES(name), avatar_text = VALUES(avatar_text),
            greeting = VALUES(greeting), greeting_sub = VALUES(greeting_sub),
            profile_tag = VALUES(profile_tag);
    """)
    print("  ✅ users — 1 条")


def _seed_user_stats():
    execute_raw("""
        INSERT INTO user_stats (user_id, stat_value, stat_label, sort_order) VALUES
        (1, '3',  '家庭成员',  1),
        (1, '28', '健康记录',  2),
        (1, '12', '咨询次数',  3)
        ON DUPLICATE KEY UPDATE
            stat_value = VALUES(stat_value);
    """)
    print("  ✅ user_stats — 3 条")


def _seed_family_members():
    execute_raw("""
        INSERT INTO family_members
            (id, user_id, name, relation, gender, age, avatar_text, avatar_color,
             info, status, status_type, status_label, health_condition, sort_order)
        VALUES
        (1, 1, '张明',   '爸爸', '男', 48, '张', 'var(--primary)',
         '48岁 · 男 · 爸爸',   '血压偏高',   'warn', '需关注',   '高血压,糖尿病,高血脂', 1),
        (2, 1, '李芳',   '妈妈', '女', 45, '李', 'var(--tertiary)',
         '45岁 · 女 · 妈妈',   '健康良好',   'ok',   '健康良好', '无慢性病', 2),
        (3, 1, '张小明', '儿子', '男', 12, '明', 'var(--secondary)',
         '12岁 · 男 · 儿子',   '1岁·健康',   'ok',   '成长关注', '无慢性病', 3)
        ON DUPLICATE KEY UPDATE
            name = VALUES(name), status = VALUES(status),
            status_type = VALUES(status_type), health_condition = VALUES(health_condition);
    """)
    print("  ✅ family_members — 3 条")


def _seed_health_metrics():
    execute_raw("""
        INSERT INTO health_metrics
            (member_id, metric_type, metric_label, metric_value, metric_unit, unit_type, recorded_at)
        VALUES
        -- 张明 (member_id=1) — 首页指标
        (1, 'bp',     '血压（收缩压/舒张压）', '128 / 85', 'mmHg · 正常偏高', 'warn',    '2026-07-08 09:00:00'),
        (1, 'weight', '体重',                 '65.2',     'kg · BMI 23.1',  'default', '2026-07-07 08:30:00'),
        (1, 'glucose','空腹血糖',              '5.6',      'mmol/L · 正常范围','ok',    '2026-07-08 07:00:00'),
        (1, 'hr',     '静息心率',              '72',       'bpm · 正常',      'ok',     '2026-07-08 09:00:00'),

        -- 张明 详情页指标
        (1, 'bp',     '血压',                  '128/85',  'mmHg · 正常偏高',  'warn',    '2026-07-08 09:00:00'),
        (1, 'weight', '体重',                  '72.5',    'kg · BMI 23.8',   'default', '2026-07-08 09:00:00'),
        (1, 'glucose','空腹血糖',              '5.8',     'mmol/L · 正常',   'ok',      '2026-07-07 14:00:00'),
        (1, 'hr',     '静息心率',              '76',      'bpm · 正常',      'ok',      '2026-07-08 09:00:00'),

        -- 李芳 (member_id=2)
        (2, 'bp',     '血压',                  '118/75',  'mmHg · 正常',     'ok',      '2026-07-08 09:00:00'),
        (2, 'weight', '体重',                  '58.0',    'kg · BMI 21.5',   'default', '2026-07-06 08:30:00'),
        (2, 'glucose','空腹血糖',              '5.2',     'mmol/L · 正常',   'ok',      '2026-07-06 08:30:00'),
        (2, 'hr',     '静息心率',              '70',      'bpm · 正常',      'ok',      '2026-07-06 08:30:00'),

        -- 张小明 (member_id=3)
        (3, 'height', '身高',                  '152',     'cm · 正常发育',   'ok',      '2026-07-04 10:00:00'),
        (3, 'weight', '体重',                  '42.0',    'kg · BMI 18.2',   'default', '2026-07-07 08:00:00'),
        (3, 'vision', '视力',                  '5.0/4.8', '正常 · 关注',     'warn',    '2026-07-04 10:00:00'),
        (3, 'hr',     '心率',                  '82',      'bpm · 正常',      'ok',      '2026-07-04 10:00:00');
    """)
    print("  ✅ health_metrics — 16 条")


def _seed_bp_trends():
    """最近 7 天血压趋势（张明）"""
    execute_raw("""
        INSERT INTO bp_trends (member_id, systolic, diastolic, recorded_at) VALUES
        (1, 128, 85, '2026-07-08 09:00:00'),
        (1, 125, 82, '2026-07-07 09:00:00'),
        (1, 130, 88, '2026-07-06 09:00:00'),
        (1, 122, 80, '2026-07-05 09:00:00'),
        (1, 127, 84, '2026-07-04 09:00:00'),
        (1, 132, 89, '2026-07-03 09:00:00'),
        (1, 126, 83, '2026-07-02 09:00:00');
    """)
    print("  ✅ bp_trends — 7 条")


def _seed_medications():
    execute_raw("""
        INSERT INTO medications
            (id, member_id, med_name, med_detail, time_slot, time_color, frequency, method, sort_order)
        VALUES
        (1, 1, '缬沙坦 80mg',       '张明 · 降压药 · 每日一次',     '08:00', 'var(--primary)',  '每日一次', '饭后', 1),
        (2, 1, '二甲双胍 500mg',    '张明 · 降糖药 · 饭后服用',     '12:30', 'var(--primary)',  '每日两次', '饭后', 2),
        (3, 1, '阿托伐他汀 20mg',   '张明 · 降脂药 · 晚餐后服用',   '20:00', 'var(--tertiary)', '每日一次', '饭后', 3),
        (4, 2, '维生素 D 软胶囊',   '李芳 · 补充剂 · 随早餐服用',   '09:00', 'var(--primary)',  '每日一次', '饭前', 4)
        ON DUPLICATE KEY UPDATE
            med_name = VALUES(med_name), med_detail = VALUES(med_detail),
            time_slot = VALUES(time_slot);
    """)
    print("  ✅ medications — 4 条")


def _seed_medication_logs():
    """今日用药日志（2026-07-08）"""
    execute_raw("""
        INSERT INTO medication_logs (medication_id, taken, log_date) VALUES
        (1, 1, '2026-07-08'),  -- 缬沙坦 已服
        (2, 1, '2026-07-08'),  -- 二甲双胍 已服
        (3, 0, '2026-07-08'),  -- 阿托伐他汀 未服
        (4, 1, '2026-07-08')   -- 维生素D 已服
        ON DUPLICATE KEY UPDATE taken = VALUES(taken);
    """)
    print("  ✅ medication_logs — 4 条")


def _seed_health_events():
    execute_raw("""
        INSERT INTO health_events (member_id, event_text, event_time, created_at) VALUES
        (1, '张明完成血压测量 128/85', '2小时前', '2026-07-08 07:00:00'),
        (3, '张小明体重记录 42kg',    '昨天',   '2026-07-07 08:00:00'),

        -- 指标记录
        (1, '血压 128/85 mmHg · 张明', '今天 09:00', '2026-07-08 09:00:00'),
        (1, '体重 65.2 kg · 张明',     '昨天 08:30', '2026-07-07 08:30:00');
    """)
    print("  ✅ health_events — 4 条")


def _seed_member_timeline():
    execute_raw("""
        INSERT INTO member_timeline (member_id, event_time, title, description, event_type) VALUES
        -- 张明
        (1, '2026-07-08 09:00:00', '血压记录',  '收缩压 128 / 舒张压 85 mmHg — 正常偏高，建议持续监测', 'warn'),
        (1, '2026-07-07 14:00:00', '血糖记录',  '空腹血糖 5.8 mmol/L — 正常范围', 'default'),
        (1, '2026-07-05 10:00:00', '医院复诊',  '高血压定期复查，医生建议继续服药并保持低盐饮食', 'default'),
        (1, '2026-07-01 08:00:00', '用药调整',  '缬沙坦剂量由 40mg 调整为 80mg · 每日一次', 'warn'),
        -- 李芳
        (2, '2026-07-08 09:00:00', '血压记录',  '收缩压 118 / 舒张压 75 mmHg — 正常范围', 'default'),
        (2, '2026-07-06 08:30:00', '体重记录',  '体重 58.0 kg — BMI 21.5，处于正常范围', 'default'),
        (2, '2026-07-03 15:00:00', '年度体检',  '各项指标正常，建议保持现有健康习惯', 'default'),
        -- 张小明
        (3, '2026-07-07 08:00:00', '体重记录',  '体重 42.0 kg — 生长发育正常', 'default'),
        (3, '2026-07-04 10:00:00', '视力检查',  '左眼 5.0 / 右眼 4.8 — 建议注意用眼卫生', 'warn'),
        (3, '2026-06-28 14:00:00', '学校体检',  '常规体检完成，各项指标正常', 'default');
    """)
    print("  ✅ member_timeline — 10 条")


def _seed_consultation_messages():
    execute_raw("""
        INSERT INTO consultation_messages
            (id, user_id, msg_type, avatar_color, avatar_icon, avatar_text, msg_text, status_tag, sort_order)
        VALUES
        (1, 1, 'ai', 'var(--primary)',
         '<path d=\"M12 2a3 3 0 00-3 3v1H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2h-2V5a3 3 0 00-3-3zM10 5a2 2 0 114 0v1h-4V5z\"/>',
         '', '您好！我是智医助手AI。请描述您或家人的健康问题，我会为您提供健康咨询建议。', '', 1),

        (2, 1, 'user', 'var(--secondary)',
         '', '我',
         '我爸爸今早上血压150/95，头有点晕，需要马上去医院吗？', '', 2),

        (3, 1, 'ai', 'var(--primary)',
         '<path d=\"M12 2a3 3 0 00-3 3v1H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2h-2V5a3 3 0 00-3-3zM10 5a2 2 0 114 0v1h-4V5z\"/>',
         '', '根据您描述的症状，血压150/95属于轻度偏高，头晕可能是血压波动引起的。建议：先在家休息观察30分钟，保持安静环境。若头晕持续或血压超过160/100，请及时就医。',
         '暂无风险', 3)
        ON DUPLICATE KEY UPDATE
            msg_text = VALUES(msg_text), status_tag = VALUES(status_tag);
    """)
    print("  ✅ consultation_messages — 3 条")


def _seed_health_assessments():
    from app.database import engine
    from sqlalchemy import text as sa_text

    dimensions = '[{"label":"慢性病管理","score":72,"level":"mid"},{"label":"日常习惯","score":85,"level":"high"},{"label":"心理健康","score":80,"level":"high"},{"label":"预防保健","score":68,"level":"mid"}]'
    risks = '["慢性病管理评分偏低，建议加强血压、血糖的日常监测与记录","预防保健维度有待提升，建议定期体检并关注家庭成员疫苗接种"]'
    suggestions = '[{"title":"建立规律监测习惯","desc":"每日固定时间测量血压并记录，有助于及时发现异常波动"},{"title":"完善预防保健档案","desc":"记录家庭成员的体检计划和疫苗接种情况，设置定期提醒"},{"title":"关注家人心理健康","desc":"定期与家人沟通情绪状态，营造温暖的家庭氛围"}]'
    recommendations = '[{"title":"AI 健康咨询","desc":"获取个性化健康管理建议","target":"consult","iconBg":"rgba(61,138,90,.1)","iconStroke":"#3D8A5A","icon":"<path d=\\"M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z\\"/>"},{"title":"家庭健康档案","desc":"查看和管理全家健康数据","target":"archive","iconBg":"rgba(212,166,74,.1)","iconStroke":"#D4A64A","icon":"<path d=\\"M3 7V19a2 2 0 002 2h14a2 2 0 002-2V7M3 7L5 3h14l2 4M9 11h6\\"/>"}]'

    with engine.connect() as conn:
        conn.execute(sa_text("""
            INSERT INTO health_assessments
                (id, user_id, score, grade, summary, dimensions, risks, suggestions, recommendations)
            VALUES (1, 1, 78, '良好',
                :summary, :dimensions, :risks, :suggestions, :recommendations)
            ON DUPLICATE KEY UPDATE
                score = VALUES(score), grade = VALUES(grade)
        """), {
            "summary": '您的家庭健康管理整体状况良好，部分维度仍有提升空间。建议关注慢性病管理和预防保健。',
            "dimensions": dimensions,
            "risks": risks,
            "suggestions": suggestions,
            "recommendations": recommendations,
        })
        conn.commit()
    print("  ✅ health_assessments — 1 条")


def _seed_home_tasks():
    execute_raw("""
        INSERT INTO home_tasks (user_id, title, detail, icon_bg, icon_stroke, icon_svg, sort_order) VALUES
        (1, '提醒爸爸测量血压',
         '08:00 · 已设置闹钟',
         'rgba(208,128,104,.1)', '#D08068',
         '<path d=\"M3 12h4l3-8 4 16 3-8h4\"/>', 1),
        (1, '妈妈服用维生素D',
         '09:00 · 随早餐服用',
         'rgba(216,149,117,.1)', '#D89575',
         '<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"4\"/>', 2)
        ON DUPLICATE KEY UPDATE
            title = VALUES(title);
    """)
    print("  ✅ home_tasks — 2 条")


def _seed_medication_adherence():
    execute_raw("""
        INSERT INTO medication_adherence
            (user_id, week_label, percent, description, total_count, taken_count, missed_count)
        VALUES
        (1, '本周服药依从性', '85%', '本周共28次，已服用24次，漏服4次', 28, 24, 4)
        ON DUPLICATE KEY UPDATE
            percent = VALUES(percent), description = VALUES(description);
    """)
    print("  ✅ medication_adherence — 1 条")
