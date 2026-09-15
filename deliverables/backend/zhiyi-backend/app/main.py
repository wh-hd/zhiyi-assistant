"""
智医助手 — FastAPI 主应用入口
"""
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import CORS_ORIGINS, SERVER_HOST, SERVER_PORT, DEBUG
from app.database import engine
from app.schema import create_all_tables
from app.seed import seed_all

from app.routers import (
    user, home, consult, archive, meds, metrics, members, assess, config_router
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时建表 + 种子数据，关闭时释放连接"""
    print("\n" + "=" * 60)
    print("  🏗️  智医助手 · 后端服务启动中...")
    print("=" * 60)

    # 1. 建表
    print("\n📋 Step 1: 创建数据库表...")
    create_all_tables()

    # 2. 种子数据（检查是否需要）
    print("\n🌱 Step 2: 检查种子数据...")
    try:
        from app.database import query_one
        existing = query_one("SELECT COUNT(*) AS cnt FROM users")
        if existing and existing["cnt"] == 0:
            seed_all()
        else:
            print("  ℹ️  数据库已有数据，跳过种子写入")
    except Exception as e:
        print(f"  ⚠️  检查失败，尝试写入种子: {e}")
        seed_all()

    print("\n" + "=" * 60)
    print(f"  ✅ 服务就绪: http://{SERVER_HOST}:{SERVER_PORT}")
    print(f"  📖 API 文档: http://{SERVER_HOST}:{SERVER_PORT}/docs")
    print("=" * 60 + "\n")

    yield

    # 关闭引擎
    engine.dispose()
    print("\n👋 智医助手服务已停止")


app = FastAPI(
    title="智医助手 API",
    description="AI 家庭健康管理后端服务",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 中间件 — 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(user.router)
app.include_router(home.router)
app.include_router(consult.router)
app.include_router(archive.router)
app.include_router(meds.router)
app.include_router(metrics.router)
app.include_router(members.router)
app.include_router(assess.router)
app.include_router(config_router.router)


@app.get("/")
def root():
    return {
        "app": "智医助手",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    """健康检查端点"""
    return {"status": "ok", "timestamp": __import__("datetime").datetime.now().isoformat()}


# ─── 直接启动入口 ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=SERVER_HOST,
        port=SERVER_PORT,
        reload=DEBUG,
        log_level="info",
    )
