#!/bin/sh
# 智医助手自托管启动器（Linux / macOS）
# 自动探测宿主机 NVIDIA GPU，有则合并 docker-compose.gpu.yml 启用加速，无则 CPU。
set -e
cd "$(dirname "$0")"

echo "=== ZhiYi Assistant - Backend Launcher ==="

if command -v nvidia-smi >/dev/null 2>&1; then
  echo "NVIDIA GPU detected - enabling GPU acceleration for local LLM."
  GPU_FILE="-f docker-compose.gpu.yml"
else
  echo "No NVIDIA GPU detected - local LLM will run on CPU."
  GPU_FILE=""
fi

echo "Building and starting all services..."
docker compose -f docker-compose.yml $GPU_FILE up -d --build

echo "Waiting for API health..."
for i in $(seq 1 36); do
  if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
    echo "API is healthy."
    break
  fi
  echo "Waiting... ($i/36)"
  sleep 5
done

echo "Open: http://localhost:3000/prototype.html"
