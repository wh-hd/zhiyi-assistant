"""
智医助手 — 健康指标 API
"""
from fastapi import APIRouter
from app.database import query_raw, query_one

router = APIRouter(prefix="/api/metrics", tags=["健康指标"])


@router.get("")
def get_metrics():
    """获取健康指标数据"""
    # 指标列表（取每个类型最新的一条）
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
            WHERE member_id = 1
            GROUP BY metric_type
        ) latest ON hm.metric_type = latest.metric_type AND hm.recorded_at = latest.maxtime
        WHERE hm.member_id = 1
    """)

    # 血压趋势（最近7天）
    bp_rows = query_raw("""
        SELECT systolic, diastolic, DATE_FORMAT(recorded_at, '%%m-%%d') AS dt
        FROM bp_trends
        WHERE member_id = 1
        ORDER BY recorded_at
    """)

    # 构建趋势数据 — 前端使用 SVG points
    systolic_points = _build_points(bp_rows, "systolic")
    diastolic_points = _build_points(bp_rows, "diastolic")

    trend = {
        "label": "血压趋势（近7天）",
        "systolic": {"color": "#3D8A5A", "label": "收缩压", "points": systolic_points},
        "diastolic": {"color": "#D89575", "label": "舒张压", "points": diastolic_points},
    }

    # 最近记录
    records = query_raw("""
        SELECT
            CONCAT(m.metric_label, ' ', m.metric_value, ' ', m.metric_unit, ' · ', fm.name) AS text,
            CASE
                WHEN DATE(m.recorded_at) = CURDATE() THEN CONCAT('今天 ', DATE_FORMAT(m.recorded_at, '%%H:%%i'))
                WHEN DATE(m.recorded_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN CONCAT('昨天 ', DATE_FORMAT(m.recorded_at, '%%H:%%i'))
                ELSE DATE_FORMAT(m.recorded_at, '%%m-%%d %%H:%%i')
            END AS time
        FROM health_metrics m
        JOIN family_members fm ON m.member_id = fm.id
        ORDER BY m.recorded_at DESC
        LIMIT 5
    """)

    return {
        "code": 0,
        "data": {
            "metrics": metrics,
            "trend": trend,
            "records": records,
        }
    }


def _build_points(rows: list[dict], key: str) -> str:
    """将数据库行转换为 SVG points 字符串"""
    if not rows:
        return ""
    base_val = 50 if key == "systolic" else 65  # 基线
    scale = 1.2
    points = []
    for i, row in enumerate(rows):
        x = i * 47
        y = base_val + int((row[key] - base_val) * scale)
        points.append(f"{x},{y}")
    return " ".join(points)
