#!/bin/bash
# API Testing Script for aikompute.com

echo "==================================="
echo "Testing aikompute.com API"
echo "==================================="
echo ""

# Test 1: Health Check
echo "1. Testing Health Endpoint..."
curl -s https://aikompute.com/health | jq '.' 2>/dev/null || curl -s https://aikompute.com/health
echo -e "\n"

# Test 2: Models List (Admin Key)
echo "2. Testing /v1/models with Admin Key..."
curl -s -H "Authorization: Bearer sk-b2e2b7d47730b978-7d471f-92437b8e" \
  https://aikompute.com/v1/models | jq '.data[0:3]' 2>/dev/null || echo "Failed"
echo -e "\n"

# Test 3: Models List (Standard Key)
echo "3. Testing /v1/models with Standard Key..."
curl -s -H "Authorization: Bearer sk-31d4e255c5683b48-99460d-0edcb1d3" \
  https://aikompute.com/v1/models | jq '.data[0:3]' 2>/dev/null || echo "Failed"
echo -e "\n"

# Test 4: Chat Completion (Admin Key)
echo "4. Testing Chat Completion with Admin Key..."
curl -X POST https://aikompute.com/v1/chat/completions \
  -H "Authorization: Bearer sk-b2e2b7d47730b978-7d471f-92437b8e" \
  -H "Content-Type: application/json" \
  -d '{"model":"antigravity/gemini-2.5-flash","messages":[{"role":"user","content":"Reply with just OK"}],"stream":false}' 2>&1 | grep -v "Total\|Dload\|Speed"
echo -e "\n"

# Test 5: Chat Completion (Standard Key with Plan Check)
echo "5. Testing Chat Completion with Standard Key (tests database plan resolution)..."
curl -X POST https://aikompute.com/v1/chat/completions \
  -H "Authorization: Bearer sk-31d4e255c5683b48-99460d-0edcb1d3" \
  -H "Content-Type: application/json" \
  -d '{"model":"antigravity/gemini-2.5-flash","messages":[{"role":"user","content":"Reply with just OK"}],"stream":false}' 2>&1 | grep -v "Total\|Dload\|Speed"
echo -e "\n"

echo "==================================="
echo "All Tests Complete"
echo "==================================="
