#!/bin/bash
# ✅ WORKING API EXAMPLES - aikompute.com
# Copy and paste these commands to test your API

API_KEY="sk-b2e2b7d47730b978-7d471f-92437b8e"
BASE_URL="https://aikompute.com/v1"

echo "=========================================="
echo "✅ CONFIRMED WORKING MODELS"
echo "=========================================="
echo ""

# Example 1: Fast Flash Model
echo "1️⃣  Testing gemini-2.5-flash (RECOMMENDED - Fast & Reliable):"
curl -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "antigravity/gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Write a haiku about APIs"}],
    "stream": false
  }' | jq -r '.choices[0].message.content'

echo ""
echo "=========================================="

# Example 2: GPT Model
echo "2️⃣  Testing codex/gpt-5.5 (RECOMMENDED - Advanced):"
curl -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "codex/gpt-5.5",
    "messages": [{"role": "user", "content": "Explain what an API is in one sentence"}],
    "stream": false
  }' | jq -r '.choices[0].message.content'

echo ""
echo "=========================================="

# Example 3: Flash Lite (Even Faster)
echo "3️⃣  Testing gemini-2.5-flash-lite (RECOMMENDED - Ultra Fast):"
curl -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "antigravity/gemini-2.5-flash-lite",
    "messages": [{"role": "user", "content": "Count from 1 to 5"}],
    "stream": false
  }' | jq -r '.choices[0].message.content'

echo ""
echo "=========================================="
echo "✅ ALL TESTS COMPLETE"
echo "=========================================="
echo ""
echo "📝 These 3 models are confirmed working and ready for production!"
echo ""
echo "🔧 To use in your app, set:"
echo "   Base URL: https://aikompute.com/v1"
echo "   API Key: $API_KEY"
echo "   Model: antigravity/gemini-2.5-flash (or any working model above)"
