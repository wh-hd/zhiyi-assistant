#!/bin/sh
# ============================================================
# 智医助手 — Ollama 模型部署脚本
# 部署 huggingface.co/fableforge-ai/NEXUS-Medical (医疗领域 LLM)
#
# 说明:
#   - fableforge-ai/NEXUS-Medical 仓库本身只含 safetensors (非 Ollama 可直接运行)
#   - 可运行的 GGUF 量化版本在兄弟仓库 King3Djbl/nexus-medical-GGUF
#   - 官方 README 推荐: ollama run hf.co/King3Djbl/nexus-medical-GGUF:Q4_K_M
#   - 本脚本从 HuggingFace 拉取 Q4_K_M (~986MB)，并创建稳定别名 nexus-medical
#   - NEXUS-Medical 要求 ChatML 模板，Modelfile 中显式声明
# ============================================================
set -e

MODEL_ALIAS="nexus-medical"
HF_MODEL="hf.co/King3Djbl/nexus-medical-GGUF:Q4_K_M"
REGISTRY_MODEL="fableforge-ai/nexus-medical:q4_k_m"
FALLBACK_MODEL="qwen2.5:1.5b"

OLLAMA_HOST="${OLLAMA_HOST:-ollama:11434}"

echo "============================================"
echo "  Ollama 模型部署 — NEXUS-Medical (HuggingFace)"
echo "  OLLAMA_HOST=$OLLAMA_HOST"
echo "============================================"

# [1] 等待 Ollama 服务就绪
echo "[1] 等待 Ollama 服务就绪..."
for i in $(seq 1 30); do
  if OLLAMA_HOST=$OLLAMA_HOST ollama list >/dev/null 2>&1; then
    echo "  -> Ollama 就绪"; break
  fi
  echo "  ... 等待 Ollama ($i/30)"
  sleep 2
done

# [2] 拉取模型（HF -> Ollama 仓库 -> 基础模型，三级回退）
echo "[2] 从 HuggingFace 拉取 NEXUS-Medical GGUF: $HF_MODEL"
if OLLAMA_HOST=$OLLAMA_HOST ollama pull "$HF_MODEL" 2>&1; then
  SOURCE_MODEL="$HF_MODEL"
  echo "  -> HuggingFace 拉取成功"
elif OLLAMA_HOST=$OLLAMA_HOST ollama pull "$REGISTRY_MODEL" 2>&1; then
  SOURCE_MODEL="$REGISTRY_MODEL"
  echo "  -> Ollama 官方仓库拉取成功"
else
  echo "  -> 前两者均失败，回退到基础模型: $FALLBACK_MODEL"
  OLLAMA_HOST=$OLLAMA_HOST ollama pull "$FALLBACK_MODEL" 2>&1
  SOURCE_MODEL="$FALLBACK_MODEL"
fi

# [3] 创建稳定别名 nexus-medical，并强制 ChatML 模板（NEXUS-Medical 要求）
echo "[3] 创建模型别名 '$MODEL_ALIAS' (ChatML 模板)"
cat > /tmp/Modelfile <<EOF
FROM $SOURCE_MODEL
TEMPLATE """{{ if .System }}<|im_start|>system
{{ .System }}<|im_end|>
{{ end }}{{ if .Prompt }}<|im_start|>user
{{ .Prompt }}<|im_end|>
{{ end }}<|im_start|>assistant
{{ .Response }}<|im_end|>
"""
SYSTEM """你是"智医助手"，一个温暖、专业的家庭健康助手。"""
EOF

OLLAMA_HOST=$OLLAMA_HOST ollama rm -f "$MODEL_ALIAS" >/dev/null 2>&1 || true
OLLAMA_HOST=$OLLAMA_HOST ollama create "$MODEL_ALIAS" -f /tmp/Modelfile >/dev/null 2>&1 \
  && echo "  -> 别名 '$MODEL_ALIAS' 创建成功" \
  || echo "  -> 别名创建失败（程序将回退使用 $SOURCE_MODEL）"

# [4] 验证
echo "[4] 已部署模型列表:"
OLLAMA_HOST=$OLLAMA_HOST ollama list

echo "============================================"
echo "  Ollama 模型部署完成"
echo "  程序将使用模型: $MODEL_ALIAS"
echo "============================================"
