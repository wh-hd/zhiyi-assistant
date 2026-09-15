"""
智医助手 — 数据库连接管理
使用 SQLAlchemy + PyMySQL 连接 TiDB Cloud
"""
import ssl
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import DATABASE_URL, DB_CONNECT_ARGS

# TiDB Cloud 需要 TLS，创建 SSL 上下文
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

connect_args = {"ssl": ssl_context}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,       # 连接前检测有效性
    pool_recycle=3600,        # 每小时回收连接
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI 依赖注入：获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def execute_raw(sql: str, params: dict = None):
    """执行原始 SQL（建表 / 种子数据）"""
    with engine.connect() as conn:
        conn.execute(text(sql), params or {})
        conn.commit()


def query_raw(sql: str, params: dict = None) -> list[dict]:
    """查询并返回字典列表"""
    with engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        rows = result.fetchall()
        if not rows:
            return []
        columns = list(result.keys())
        return [dict(zip(columns, row)) for row in rows]


def query_one(sql: str, params: dict = None) -> dict | None:
    """查询单行"""
    with engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        row = result.fetchone()
        if not row:
            return None
        columns = list(result.keys())
        return dict(zip(columns, row))
