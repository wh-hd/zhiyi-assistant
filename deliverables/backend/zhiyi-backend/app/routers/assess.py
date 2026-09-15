"""
智医助手 — 健康评估 API
"""
from fastapi import APIRouter
from app.database import query_one
import json

router = APIRouter(prefix="/api/assess", tags=["健康评估"])


@router.get("/report")
def get_assess_report():
    """获取最新健康评估报告"""
    row = query_one("""
        SELECT score, grade, summary,
               dimensions, risks, suggestions, recommendations
        FROM health_assessments
        WHERE user_id = 1
        ORDER BY created_at DESC
        LIMIT 1
    """)

    if not row:
        return {"code": 404, "message": "暂无评估报告"}

    # JSON 字段需要解析
    for field in ["dimensions", "risks", "suggestions", "recommendations"]:
        if isinstance(row[field], str):
            row[field] = json.loads(row[field])

    return {"code": 0, "data": row}
