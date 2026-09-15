"""
智医助手 — 家庭档案 API
"""
from fastapi import APIRouter
from app.database import query_raw, query_one

router = APIRouter(prefix="/api/archive", tags=["家庭档案"])


@router.get("/members")
def get_archive_members():
    """获取档案页成员列表"""
    members = query_raw("""
        SELECT id, name, avatar_text AS avatarText, avatar_color AS avatarColor,
               relation, age, info AS detail,
               CASE status_type
                   WHEN 'warn' THEN 'var(--primary)'
                   WHEN 'ok' THEN 'var(--primary)'
                   ELSE 'var(--tertiary)'
               END AS dotColor,
               'screen:member-detail' AS action,
               (id - 1) AS memberIdx
        FROM family_members
        WHERE user_id = 1
        ORDER BY sort_order
    """)

    # 为每个成员构造合适的 detail 文案
    detail_map = {
        "张明":   "48岁 · 高血压 · 定期复查中",
        "李芳":   "45岁 · 健康状态良好",
        "张小明": "12岁 · 生长发育期 · 关注营养",
    }
    for m in members:
        if m["name"] in detail_map:
            m["detail"] = detail_map[m["name"]]

    return {"code": 0, "data": {"members": members}}


@router.get("/events")
def get_archive_events():
    """获取档案页健康事件列表"""
    events = query_raw("""
        SELECT e.event_text AS text, e.event_time AS time
        FROM health_events e
        JOIN family_members m ON e.member_id = m.id
        WHERE m.user_id = 1
        ORDER BY e.created_at DESC
        LIMIT 10
    """)
    return {"code": 0, "data": {"events": events}}
