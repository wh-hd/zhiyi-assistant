"""
智医助手 — 用药管理 API
"""
from fastapi import APIRouter
from app.database import query_raw, query_one

router = APIRouter(prefix="/api/meds", tags=["用药管理"])


@router.get("")
def get_medications():
    """获取用药列表"""
    meds = query_raw("""
        SELECT m.id, m.time_slot AS time, m.time_color AS timeColor,
               m.med_name AS name, m.med_detail AS detail,
               COALESCE(ml.taken, 0) AS taken
        FROM medications m
        LEFT JOIN medication_logs ml
            ON m.id = ml.medication_id AND ml.log_date = CURDATE()
        ORDER BY m.sort_order
    """)
    return {"code": 0, "data": {"medications": meds}}


@router.get("/adherence")
def get_adherence():
    """获取用药依从性统计"""
    adh = query_one("""
        SELECT week_label AS label, percent, description AS `desc`
        FROM medication_adherence
        WHERE user_id = 1
        ORDER BY created_at DESC
        LIMIT 1
    """)
    if not adh:
        adh = {"label": "本周服药依从性", "percent": "0%", "desc": "暂无数据"}
    return {"code": 0, "data": {"adherence": adh}}
