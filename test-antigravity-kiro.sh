#!/bin/bash
# Test All Antigravity and Kiro Models

echo "=========================================="
echo "Testing Antigravity & Kiro Models"
echo "=========================================="

API_KEY="sk-b2e2b7d47730b978-7d471f-92437b8e"
BASE_URL="https://aikompute.com/v1"

# Get all antigravity and kiro models
MODELS=$(curl -s -H "Authorization: Bearer $API_KEY" "$BASE_URL/models" | \
  jq -r '.data[] | select(.owned_by == "antigravity" or .owned_by == "kiro") | select(.type != "image") | .id' | \
  sort -u)

echo ""
echo "Found models:"
echo "$MODELS"
echo ""
echo "=========================================="

test_model() {
  local model=$1
  printf "%-50s " "$model"
  
  response=$(timeout 15 curl -s -X POST "$BASE_URL/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with just: OK\"}],\"stream\":false,\"max_tokens\":20}" 2>&1)
  
  exit_code=$?
  
  if [ $exit_code -eq 124 ]; then
    echo "⏱️  TIMEOUT (15s)"
  elif echo "$response" | grep -q '"error"'; then
    error_msg=$(echo "$response" | jq -r '.error.message' 2>/dev/null || echo "Unknown error")
    echo "❌ ERROR: $error_msg"
  elif echo "$response" | grep -q '"choices"'; then
    content=$(echo "$response" | jq -r '.choices[0].message.content' 2>/dev/null | head -c 30)
    tokens=$(echo "$response" | jq -r '.usage.total_tokens' 2>/dev/null)
    echo "✅ SUCCESS (${tokens} tokens) - $content"
  else
    echo "⚠️  UNKNOWN RESPONSE"
  fi
}

# Test each model
while IFS= read -r model; do
  [ -z "$model" ] && continue
  test_model "$model"
  sleep 0.5
done <<< "$MODELS"

echo ""
echo "=========================================="
echo "Testing Complete"
echo "=========================================="
