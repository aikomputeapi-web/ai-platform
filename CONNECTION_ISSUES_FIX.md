# OmniRoute Connection Issues — Root Cause & Fix

## Problem Summary

Your users are experiencing API connection issues, and the OmniRoute admin panel shows provider accounts as "banned" or "not working" — even though the accounts work fine when you log into them directly.

## Root Cause

**The dual OmniRoute instances (`omniroute-1` and `omniroute-2`) are sharing a single SQLite database, causing race conditions and state corruption.**

### Why This Happens

1. **SQLite is not multi-process safe**: Both OmniRoute instances write to the same SQLite database file in the shared `omniroute_data` volume. SQLite locks the entire database file during writes, causing:
   - Write conflicts
   - Stale reads
   - Corrupted state (one instance marks a provider as "banned", the other reads it)

2. **In-memory state divergence**: Each instance has its own in-memory cache for:
   - Quota tracking (`quotaCache`)
   - Model lockouts (`modelLockouts`)
   - Circuit breakers (provider failure tracking)
   - Credential health status
   
   When nginx load-balances between the two instances, you see inconsistent state in the admin panel.

3. **Duplicate credential health checks**: Both instances run the background credential health scheduler independently, testing the same provider accounts simultaneously every 5 minutes. This can:
   - Trigger rate limits on the provider side
   - Look like suspicious activity (same account, different IPs/fingerprints)
   - Write conflicting test results to the database

4. **Load balancing confusion**: Your nginx config load-balances both the dashboard AND the API between the two instances. This means:
   - Admin panel requests hit different instances on each page load
   - API requests from users get routed to instances with different quota/lockout state
   - One instance thinks a provider is healthy, the other thinks it's banned

## The Fix

I've reverted your configuration to use **single instances** of both OmniRoute and the customer portal.

### Files Changed

1. **docker-compose.unified.yml**
   - Removed `omniroute-2` and `customer-portal-2`
   - Renamed `omniroute-1` → `omniroute`
   - Renamed `customer-portal-1` → `customer-portal`

2. **nginx/nginx.conf**
   - Removed dual-instance load balancing
   - Removed failover logic (not needed for single instance)
   - Simplified upstream definitions

3. **revert-to-single-instance.sh** (new script)
   - Automates the cleanup and restart process
   - Optionally clears the corrupted SQLite state

## How to Apply the Fix

### Option 1: Clean Restart (Recommended)

This will reset all OmniRoute state (provider connections, API keys, settings):

```bash
cd /home/stevenleblanc62920/ai-platform
./revert-to-single-instance.sh
```

After restart, you'll need to:
- Re-add your provider connections in the admin panel
- Re-create any API keys
- Re-configure any custom settings

### Option 2: Preserve Data (Risky)

If you want to keep your existing provider connections:

```bash
cd /home/stevenleblanc62920/ai-platform

# Stop containers
docker-compose -f docker-compose.unified.yml down

# Remove old dual instances
docker rm -f omniroute-1 omniroute-2 customer-portal-1 customer-portal-2

# Start single instance (reuses existing volume)
docker-compose -f docker-compose.unified.yml up -d
```

**Warning**: The SQLite database may still have corrupted state. If you continue seeing "banned" errors, you'll need to do Option 1.

## Verifying the Fix

After restart:

1. **Check only one instance is running**:
   ```bash
   docker ps | grep omniroute
   # Should show only "omniroute" (not omniroute-1 or omniroute-2)
   ```

2. **Check admin panel**:
   - Go to https://admin.yourdomain.com
   - Navigate to Providers → Connections
   - All connections should show consistent status (not flickering between states)

3. **Test provider connections**:
   - Click "Test" on each provider connection
   - Should show "active" if credentials are valid
   - If still showing errors, the account may have been temporarily rate-limited — wait 5-10 minutes and test again

4. **Monitor logs**:
   ```bash
   docker-compose -f docker-compose.unified.yml logs -f omniroute
   ```
   - Look for credential health check logs
   - Should NOT see duplicate tests happening simultaneously

## Additional Issues Found

### CLIProxyAPI Configuration

Your `cliproxyapi-config.yaml` has:
```yaml
host: ""
api-keys: []
```

This means CLIProxyAPI is not actually proxying anything. Your provider requests are going out from your server's real IP without TLS fingerprint spoofing. This can trigger provider bans.

**To fix**: Either configure CLIProxyAPI properly, or disable the TLS fingerprint features in docker-compose:
```yaml
# Comment out or set to false:
ENABLE_TLS_FINGERPRINT: "false"
ENABLE_SOCKS5_PROXY: "false"
```

### Credential Health Scheduler

The background credential health check is aggressive (tests every 5 minutes). If you have many provider connections, this can trigger rate limits.

**To adjust**: Add to OmniRoute environment in docker-compose:
```yaml
CREDENTIAL_HEALTH_CHECK_INTERVAL: 900000  # 15 minutes instead of 5
```

Or disable it entirely:
```yaml
OMNIROUTE_DISABLE_CREDENTIAL_HEALTH_CHECK: "true"
```

## Why Dual Instances Don't Work (Yet)

OmniRoute is designed as a single-instance application with SQLite for simplicity. To run multiple instances for high availability, you would need:

1. **External database**: Switch from SQLite to PostgreSQL for all OmniRoute state (not just the customer portal)
2. **Shared cache**: Use Redis for in-memory state (quota cache, circuit breakers, model lockouts)
3. **Leader election**: Only one instance should run background jobs (credential health checks, quota refresh)
4. **Sticky sessions**: Nginx should route admin panel requests to the same instance

These changes would require significant modifications to OmniRoute's architecture.

## Next Steps

1. Run the revert script: `./revert-to-single-instance.sh`
2. Re-add your provider connections in the admin panel
3. Test API requests from your users
4. Monitor logs for any remaining issues
5. If you need high availability, consider:
   - Running OmniRoute on a VM with auto-restart (systemd)
   - Using a managed Kubernetes cluster with proper state management
   - Contributing to OmniRoute to add multi-instance support

## Questions?

If you still see "banned" errors after the fix:
1. Check the provider's actual status by logging in directly
2. Wait 10-15 minutes (rate limits may need to expire)
3. Clear the provider's error state in the admin panel (Edit → Clear Error)
4. Check OmniRoute logs for the actual error message from the provider
