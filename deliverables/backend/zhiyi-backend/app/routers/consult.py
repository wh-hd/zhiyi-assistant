"""
智医助手 — AI 咨询 API
"""
from fastapi import APIRouter
from app.database import query_raw

router = APIRouter(prefix="/api/consult", tags=["AI咨询"])


@router.get("/messages")
def get_messages():
    """获取AI咨询消息列表"""
    messages = query_raw("""
        SELECT id, msg_type AS type, avatar_color AS avatarColor,
               avatar_icon AS avatarIcon, avatar_text AS avatarText,
               msg_text AS text, status_tag AS statusTag
        FROM consultation_messages
        WHERE user_id = 1
        ORDER BY sort_order
    """)
    return {"code": 0, "data": {"messages": messages}}
