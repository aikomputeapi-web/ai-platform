# Admin Session-Based Authentication Implementation

## Overview

This implementation replaces the client-side password authentication with secure session-based authentication using HTTP-only cookies.

## What Was Implemented

### 1. Session Management (`src/lib/admin-session.ts`)
- JWT-based session tokens with 30-minute expiration
- HTTP-only cookie storage for security
- Session verification utilities for both API routes and server components

### 2. Authentication API Endpoints
- **POST `/api/admin/auth/login`** - Validates password and creates session
- **POST `/api/admin/auth/logout`** - Clears session cookie
- **GET `/api/admin/auth/check`** - Checks if user has valid session

### 3. Next.js Middleware (`middleware.ts`)
- Protects all `/admin/*` routes (except `/admin/login`)
- Automatically redirects unauthenticated users to login page
- Validates session tokens on every request
- Clears invalid sessions

### 4. Admin Login Page (`src/app/admin/login/page.tsx`)
- Clean, modern login interface
- Auto-redirects if already authenticated
- Preserves intended destination after login
- Shows session expiration notice

### 5. Updated Admin Layout (`src/app/admin/layout.tsx`)
- Added logout button in navigation
- Hides navigation on login page
- Handles logout with redirect

## How It Works

### Authentication Flow

```
1. User visits /admin → Middleware checks session
2. No session → Redirect to /admin/login
3. User enters password → POST /api/admin/auth/login
4. Server validates password → Creates JWT token
5. Server sets HTTP-only cookie with token
6. User redirected to /admin
7. All subsequent requests include cookie automatically
8. Middleware validates session on each request
9. Session expires after 30 minutes
10. User clicks logout → Cookie cleared → Redirect to login
```

### Security Features

✅ **HTTP-only cookies** - JavaScript cannot access the session token (XSS protection)
✅ **SameSite=Lax** - CSRF protection
✅ **Secure flag in production** - HTTPS-only cookies
✅ **JWT with expiration** - Sessions automatically expire
✅ **Server-side validation** - Every request validates the session
✅ **Automatic cleanup** - Invalid sessions are cleared immediately

## Testing Instructions

### 1. Rebuild and Restart Docker Container

The container needs to be rebuilt to include the new files:

```bash
# Stop the current container
docker-compose -f docker-compose.unified.yml down customer-portal

# Rebuild with new code
docker-compose -f docker-compose.unified.yml build customer-portal

# Start the container
docker-compose -f docker-compose.unified.yml up -d customer-portal

# Check logs
docker logs -f customer-portal
```

### 2. Test Login Flow

1. **Visit admin page**: `http://localhost:3000/admin`
   - Should redirect to `http://localhost:3000/admin/login`

2. **Enter password**: `admin` (or your `ADMIN_API_SECRET` value)
   - Click "Login to Admin Dashboard"
   - Should redirect back to `/admin`

3. **Navigate between pages**: Click different admin sections
   - Should NOT ask for password again
   - Session persists across all admin pages

4. **Test logout**: Click "🚪 Logout" button
   - Should redirect to login page
   - Trying to access `/admin` should require login again

### 3. Test Session Expiration

```bash
# Check session cookie in browser DevTools
# Application → Cookies → localhost:3000
# Look for "admin_session" cookie

# Wait 30 minutes (or modify SESSION_DURATION in admin-session.ts for testing)
# Try to access any admin page
# Should redirect to login (expired session)
```

### 4. Test Security

```bash
# Try to access admin API without session
curl http://localhost:3000/api/admin/analytics
# Should return 403 or redirect

# Try to access admin page without session
curl -I http://localhost:3000/admin
# Should return 307 redirect to /admin/login
```

### 5. Verify Cookie Settings

In browser DevTools (Application → Cookies):
- **Name**: `admin_session`
- **HttpOnly**: ✓ (checked)
- **Secure**: ✓ (in production only)
- **SameSite**: Lax
- **Expires**: ~30 minutes from creation

## Environment Variables

The system uses these environment variables (in order of precedence):

1. `ADMIN_API_SECRET` - Primary admin password
2. `OMNIROUTE_INITIAL_PASSWORD` - Fallback admin password
3. `"admin"` - Default if neither is set

Session encryption uses:
- `PORTAL_JWT_SECRET` or `JWT_SECRET`

## Migration Notes

### What Changed

**Before**: Each admin page had its own authentication state
- Password required on every page navigation
- State stored in React component
- No session persistence

**After**: Centralized session-based authentication
- Login once, access all pages
- Session stored in HTTP-only cookie
- Automatic session validation via middleware

### Backward Compatibility

The old admin pages still work without modification because:
- Middleware handles authentication before pages load
- Pages no longer need their own auth logic
- The old `secret` and `authed` state can be removed gradually

### Removing Old Auth Code (Optional)

You can optionally clean up the old authentication code from admin pages:

```typescript
// OLD CODE (can be removed):
const [secret, setSecret] = useState('');
const [authed, setAuthed] = useState(false);

if (!authed) {
  return <LoginForm />;
}

// NEW CODE (already handled by middleware):
// Just render the page content directly
```

## Troubleshooting

### "Invalid password" error
- Check `ADMIN_API_SECRET` in `.env` file
- Verify container has restarted with new env vars
- Check: `docker exec customer-portal printenv ADMIN_API_SECRET`

### Redirects to login on every page
- Session cookie not being set
- Check browser console for errors
- Verify JWT_SECRET is set in environment
- Check middleware is running: `docker logs customer-portal | grep middleware`

### Session expires too quickly
- Adjust `SESSION_DURATION` in `src/lib/admin-session.ts`
- Default is 30 minutes (1800000 ms)

### Cookie not visible in DevTools
- HTTP-only cookies don't show in JavaScript
- Check in Application → Cookies tab in DevTools
- They're still sent with requests automatically

## Production Recommendations

### Before Going Live

1. **Set strong admin password**:
   ```bash
   ADMIN_API_SECRET=your-very-strong-random-password-here
   ```

2. **Enable HTTPS**: Ensure `NODE_ENV=production` and SSL is configured

3. **Consider adding**:
   - Rate limiting on login endpoint (prevent brute force)
   - Account lockout after failed attempts
   - Two-factor authentication (TOTP)
   - IP allowlisting for admin access
   - Audit logging for all admin actions (already partially implemented)

4. **Monitor**:
   - Failed login attempts
   - Session creation/expiration patterns
   - Unusual access times or locations

## Files Created/Modified

### New Files
- `customer-portal/src/lib/admin-session.ts` - Session management utilities
- `customer-portal/src/app/api/admin/auth/login/route.ts` - Login endpoint
- `customer-portal/src/app/api/admin/auth/logout/route.ts` - Logout endpoint
- `customer-portal/src/app/api/admin/auth/check/route.ts` - Session check endpoint
- `customer-portal/src/app/admin/login/page.tsx` - Login page UI
- `customer-portal/middleware.ts` - Route protection middleware
- `customer-portal/ADMIN_AUTH_IMPLEMENTATION.md` - This documentation

### Modified Files
- `customer-portal/src/app/admin/layout.tsx` - Added logout button

### Existing Files (No Changes Needed)
- All other admin pages work as-is with the new authentication system
- The middleware handles authentication before pages load
