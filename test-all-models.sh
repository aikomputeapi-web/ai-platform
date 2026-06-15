#!/bin/bash
# Comprehensive Model Testing Script for aikompute.com

echo "==================================="
echo "Testing Multiple Models on aikompute.com"
echo "==================================="
echo ""

API_KEY="sk-b2e2b7d47730b978-7d471f-92437b8e"
BASE_URL="https://aikompute.com/v1"

# Array of models to test
MODELS=(
  "antigravity/gemini-2.5-flash"
  "antigravity/gemini-2.5-pro"
  "antigravity/gemini-3.1-flash-lite"
  "codex/gpt-5.5"
  "codex/gpt-5.4"
  "opencode/big-pickle"
  "opencode/minimax-m2.5-free"
  "openrouter/auto"
)

test_model() {
  local model=$1
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Testing: $model"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  response=$(curl -s -X POST "$BASE_URL/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with just: Model OK\"}],\"stream\":false,\"max_tokens\":50}" \
    2>&1)
  
  # Check if response contains error
  if echo "$response" | grep -q "error"; then
    echo "❌ FAILED"
    echo "$response" | jq '.error' 2>/dev/null || echo "$response"
  elif echo "$response" | grep -q "choices"; then
    echo "✅ SUCCESS"
    echo "$response" | jq -r '.choices[0].message.content' 2>/dev/null || echo "Response received but couldn't parse"
    echo "$response" | jq '.usage' 2>/dev/null
  else
    echo "⚠️  UNKNOWN RESPONSE"
    echo "$response" | head -5
  fi
  
  echo ""
  sleep 1
}

# Test each model
for model in "${MODELS[@]}"; do
  test_model "$model"
done

echo "==================================="
echo "Testing Complete"
echo "==================================="
