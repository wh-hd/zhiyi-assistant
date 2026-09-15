#!/bin/sh
# Ollama 启动脚本：先拉起 ollama serve，首次启动时自动拉取 NEXUS-Medical 模型。
# 模型名必须与后端 ollama.provider.ts 中的 LLM_MODEL 一致（fableforge-ai/nexus-medical:q4_k_m），
# 否则后端走安全兜底、AI 咨询无真实回复。
set -e

# 后台启动 Ollama 服务
ollama serve &
SERVER_PID=$!

# 容器停止时一并终止 ollama 服务
trap 'kill -TERM "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null' EXIT INT TERM

echo "[ollama] waiting for Ollama server to be ready..."
for _ in $(seq 1 60); do
  if ollama list >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

MODEL="fableforge-ai/nexus-medical:q4_k_m"
HF="hf.co/fableforge-ai/NEXUS-Medical"

if ollama list | grep -q "$MODEL"; then
  echo "[ollama] model $MODEL already present, skipping pull."
else
  echo "[ollama] first start: pulling $MODEL ..."
  if ollama pull "$MODEL"; then
    echo "[ollama] pulled $MODEL from Ollama registry."
  else
    echo "[ollama] Ollama registry pull failed, pulling from HuggingFace ($HF)..."
    if ollama pull "$HF"; then
      ollama create "$MODEL" --from "$HF" \
        && echo "[ollama] created $MODEL from HuggingFace source."
    else
      echo "[ollama] WARNING: model pull failed. AI consultation will use the built-in safe fallback until the model is available."
    fi
  fi
fi

echo "[ollama] model check complete. Server running (PID $SERVER_PID)."
wait "$SERVER_PID"
