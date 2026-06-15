#!/bin/bash
# Fast Model Testing Script with Timeouts

echo "==================================="
echo "Quick Model Tests"
echo "==================================="

API_KEY="sk-b2e2b7d47730b978-7d471f-92437b8e"
BASE_URL="https://aikompute.com/v1"

test_model() {
  local model=$1
  echo -n "Testing $model... "
  
  response=$(timeout 10 curl -s -X POST "$BASE_URL/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Say OK\"}],\"stream\":false,\"max_tokens\":10}" 2>&1)
  
  exit_code=$?
  
  if [ $exit_code -eq 124 ]; then
    echo "⏱️ TIMEOUT"
  elif echo "$response" | grep -q '"error"'; then
    error_msg=$(echo "$response" | jq -r '.error.message' 2>/dev/null || echo "Unknown error")
    echo "❌ ERROR: $error_msg"
  elif echo "$response" | grep -q '"choices"'; then
    content=$(echo "$response" | jq -r '.choices[0].message.content' 2>/dev/null)
    echo "✅ SUCCESS - Response: $content"
  else
    echo "⚠️ UNKNOWN"
  fi
}

# Test a few key models
echo ""
test_model "antigravity/gemini-2.5-flash"
test_model "antigravity/gemini-2.5-pro"
test_model "codex/gpt-5.5"
test_model "opencode/big-pickle"
test_model "openrouter/auto"

echo ""
echo "==================================="
echo "Tests Complete"
echo "==================================="
