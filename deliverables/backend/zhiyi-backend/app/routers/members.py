"""
智医助手 — 成员详情 API
"""
from fastapi import APIRouter
from app.database import query_raw, query_one

router = APIRouter(prefix="/api/members", tags=["成员详情"])


@router.get("/{member_id}")
def get_member_detail(member_id: int):
    """获取指定成员的健康档案详情"""
    member = query_one("""
        SELECT id, name, avatar_text AS avatarText, avatar_color AS avatarColor,
               info, status_label AS statusLabel, status_type AS statusType
        FROM family_members
        WHERE id = %(mid)s
    """, {"mid": member_id})

    if not member:
        return {"code": 404, "message": "成员不存在"}

    # 健康指标
    metrics = query_raw("""
        SELECT
            hm.metric_label AS label,
            hm.metric_value AS value,
            hm.metric_unit  AS unit,
            hm.unit_type    AS unitType
        FROM health_metrics hm
        INNER JOIN (
            SELECT metric_type, MAX(recorded_at) AS maxtime
            FROM health_metrics
            WHERE member_id = %(mid)s
            GROUP BY metric_type
        ) latest ON hm.metric_type = latest.metric_type AND hm.recorded_at = latest.maxtime
        WHERE hm.member_id = %(mid)s
    """, {"mid": member_id})

    # 用药列表
    medications = query_raw("""
        SELECT med_name AS name, med_detail AS detail
        FROM medications
        WHERE member_id = %(mid)s AND is_active = 1
        ORDER BY sort_order
    """, {"mid": member_id})

    # 时间线
    timeline = query_raw("""
        SELECT
            DATE_FORMAT(event_time, '%%Y-%%m-%%d %%H:%%i') AS time,
            title,
            description AS `desc`,
            event_type AS type
        FROM member_timeline
        WHERE member_id = %(mid)s
        ORDER BY event_time DESC
    """, {"mid": member_id})

    member["metrics"] = metrics
    member["medications"] = medications
    member["timeline"] = timeline

    return {"code": 0, "data": {"member": member}}


@router.get("")
def get_all_members():
    """获取全部成员列表（用于详情页下拉）"""
    members = query_raw("""
        SELECT id, name, avatar_text AS avatarText, avatar_color AS avatarColor,
               info, status_label AS statusLabel, status_type AS statusType
        FROM family_members
        WHERE user_id = 1
        ORDER BY sort_order
    """)
    return {"code": 0, "data": {"members": members}}
