"""
智医助手 — 数据库与服务器配置
"""

import os

# ─── TiDB Cloud (MySQL 兼容) 数据库连接 ────────────────────────────────────
# ⚠️ 凭据一律通过环境变量注入，切勿在源码中硬编码真实账号密码。
DB_HOST = os.getenv("DB_HOST", "")
DB_PORT = int(os.getenv("DB_PORT", "4000"))
DB_USER = os.getenv("DB_USER", "")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "zhiyi_dev")

# TiDB Cloud 需要 TLS 加密连接
DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@"
    f"{DB_HOST}:{DB_PORT}/{DB_NAME}"
    "?charset=utf8mb4"
)

# TiDB TLS 连接参数
DB_CONNECT_ARGS = {
    "ssl": {
        "ssl": True,
    }
}

# ─── 服务器配置 ────────────────────────────────────────────────────────────
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# ─── CORS 配置 ─────────────────────────────────────────────────────────────
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
    "null",  # file:// 协议直接打开 HTML
    "*",
]
