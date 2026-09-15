"""
智医助手 — 用户相关 API
"""
from fastapi import APIRouter
from app.database import query_one, query_raw

router = APIRouter(prefix="/api/user", tags=["用户"])


@router.get("")
def get_user():
    """获取当前用户信息（含统计）"""
    user = query_one("""
        SELECT id, name, avatar_text AS avatarText, greeting,
               greeting_sub AS greetingSub, profile_tag AS profileTag
        FROM users WHERE id = 1
    """)
    if not user:
        return {"code": 404, "message": "用户不存在"}

    # 单独查询 user_stats，在 Python 端构建数组
    stats_rows = query_raw("""
        SELECT stat_value AS value, stat_label AS label
        FROM user_stats WHERE user_id = 1
        ORDER BY sort_order
    """)
    user["stats"] = stats_rows if stats_rows else []

    return {"code": 0, "data": user}
