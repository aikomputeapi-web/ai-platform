#!/bin/bash

# Admin Authentication Test Script
# This script tests the new session-based authentication system

echo "🧪 Testing Admin Authentication System"
echo "======================================"
echo ""

BASE_URL="http://localhost:3000"

echo "1️⃣ Testing login endpoint..."
LOGIN_RESPONSE=$(curl -s -c cookies.txt -w "\n%{http_code}" -X POST \
  "${BASE_URL}/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"admin"}')

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Login successful"
  echo "   Response: $RESPONSE_BODY"
else
  echo "❌ Login failed (HTTP $HTTP_CODE)"
  echo "   Response: $RESPONSE_BODY"
  exit 1
fi

echo ""
echo "2️⃣ Testing session check..."
CHECK_RESPONSE=$(curl -s -b cookies.txt -w "\n%{http_code}" \
  "${BASE_URL}/api/admin/auth/check")

HTTP_CODE=$(echo "$CHECK_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$CHECK_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] && echo "$RESPONSE_BODY" | grep -q '"authenticated":true'; then
  echo "✅ Session is valid"
  echo "   Response: $RESPONSE_BODY"
else
  echo "❌ Session check failed (HTTP $HTTP_CODE)"
  echo "   Response: $RESPONSE_BODY"
  exit 1
fi

echo ""
echo "3️⃣ Testing protected endpoint access..."
ANALYTICS_RESPONSE=$(curl -s -b cookies.txt -w "\n%{http_code}" \
  "${BASE_URL}/api/admin/analytics?range=7d")

HTTP_CODE=$(echo "$ANALYTICS_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Can access protected endpoint with session"
else
  echo "❌ Cannot access protected endpoint (HTTP $HTTP_CODE)"
  exit 1
fi

echo ""
echo "4️⃣ Testing logout..."
LOGOUT_RESPONSE=$(curl -s -c cookies_after_logout.txt -w "\n%{http_code}" -X POST \
  -b cookies.txt \
  "${BASE_URL}/api/admin/auth/logout")

HTTP_CODE=$(echo "$LOGOUT_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Logout successful"
else
  echo "❌ Logout failed (HTTP $HTTP_CODE)"
  exit 1
fi

echo ""
echo "5️⃣ Testing access after logout..."
CHECK_AFTER_LOGOUT=$(curl -s -b cookies_after_logout.txt -w "\n%{http_code}" \
  "${BASE_URL}/api/admin/auth/check")

HTTP_CODE=$(echo "$CHECK_AFTER_LOGOUT" | tail -n1)
RESPONSE_BODY=$(echo "$CHECK_AFTER_LOGOUT" | head -n-1)

if echo "$RESPONSE_BODY" | grep -q '"authenticated":false'; then
  echo "✅ Session properly cleared after logout"
else
  echo "❌ Session still active after logout"
  exit 1
fi

echo ""
echo "6️⃣ Testing invalid password..."
INVALID_LOGIN=$(curl -s -w "\n%{http_code}" -X POST \
  "${BASE_URL}/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"password":"wrong-password"}')

HTTP_CODE=$(echo "$INVALID_LOGIN" | tail -n1)

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Invalid password properly rejected"
else
  echo "❌ Invalid password not rejected (HTTP $HTTP_CODE)"
  exit 1
fi

# Cleanup
rm -f cookies.txt cookies_after_logout.txt

echo ""
echo "======================================"
echo "✅ All tests passed!"
echo ""
echo "Next steps:"
echo "1. Visit http://localhost:3000/admin in your browser"
echo "2. You should be redirected to /admin/login"
echo "3. Enter password: admin"
echo "4. You should be able to navigate all admin pages without re-entering password"
echo "5. Click logout button to test logout flow"
