"""
智医助手 — 首页 API
"""
from fastapi import APIRouter
from app.database import query_raw, query_one

router = APIRouter(prefix="/api/home", tags=["首页"])


@router.get("")
def get_home():
    """获取首页聚合数据"""
    # 家庭健康评分
    score = {
        "label": "家庭健康评分",
        "value": 82,
        "badge": "良好"
    }

    # 统计行
    stats_row = [
        {"value": "4人", "label": "在管成员", "variant": "default"},
        {"value": "3/4", "label": "今日用药", "variant": "secondary"},
        {"value": "2件", "label": "待办事项", "variant": "tertiary"},
    ]

    # 家庭成员卡片
    members_raw = query_raw("""
        SELECT id, name, avatar_text AS avatarText, avatar_color AS avatarColor,
               status, status_type AS statusType
        FROM family_members
        WHERE user_id = 1
        ORDER BY sort_order
    """)

    # 首页任务
    tasks_raw = query_raw("""
        SELECT title, detail, icon_bg AS iconBg, icon_stroke AS iconStroke,
               icon_svg AS icon
        FROM home_tasks
        WHERE user_id = 1
        ORDER BY sort_order
    """)

    return {
        "code": 0,
        "data": {
            "healthScore": score,
            "statsRow": stats_row,
            "familyMembers": members_raw,
            "tasks": tasks_raw,
        }
    }
