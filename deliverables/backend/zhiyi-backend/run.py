"""
智医助手 — 启动脚本
直接运行此文件启动后端服务
"""
from app.main import app
import uvicorn
from app.config import SERVER_HOST, SERVER_PORT, DEBUG

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=SERVER_HOST,
        port=SERVER_PORT,
        reload=DEBUG,
        log_level="info",
    )
