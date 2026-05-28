#!/usr/bin/env node

/**
 * Debug script to check API key linkage between customer portal and OmniRoute
 */

const OMNIROUTE_URL = process.env.OMNIROUTE_URL || 'http://127.0.0.1:20128';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function getOmniRouteToken() {
  const res = await fetch(`${OMNIROUTE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }

  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/auth_token=([^;]+)/);
  if (!match) throw new Error('No auth_token in response');
  
  return match[1];
}

async function getOmniRouteKeys(token) {
  const res = await fetch(`${OMNIROUTE_URL}/api/keys`, {
    headers: { Cookie: `auth_token=${token}` },
  });
  
  if (!res.ok) {
    throw new Error(`Failed to get keys: ${res.status} ${await res.text()}`);
  }
  
  return res.json();
}

async function getOmniRouteAnalytics(token, range = '30d') {
  const res = await fetch(`${OMNIROUTE_URL}/api/usage/analytics?range=${range}`, {
    headers: { Cookie: `auth_token=${token}` },
  });
  
  if (!res.ok) {
    throw new Error(`Failed to get analytics: ${res.status} ${await res.text()}`);
  }
  
  return res.json();
}

async function getPortalKeys() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/customer_portal'
      }
    }
  });
  
  const keys = await prisma.userApiKey.findMany({
    include: {
      user: {
        select: {
          email: true,
          name: true,
        }
      }
    }
  });
  
  await prisma.$disconnect();
  return keys;
}

async function main() {
  console.log('🔍 Debugging API Key Linkage\n');
  
  try {
    // 1. Get portal keys
    console.log('📋 Customer Portal API Keys:');
    const portalKeys = await getPortalKeys();
    console.log(`Found ${portalKeys.length} keys in customer portal\n`);
    
    portalKeys.forEach(key => {
      console.log(`  - User: ${key.user.email}`);
      console.log(`    Portal Key ID: ${key.id}`);
      console.log(`    OmniRoute Key ID: ${key.omnirouteKeyId}`);
      console.log(`    Name: ${key.name}`);
      console.log(`    Last Four: ${key.lastFour}`);
      console.log(`    Active: ${key.isActive}\n`);
    });
    
    // 2. Get OmniRoute keys
    console.log('🔑 OmniRoute API Keys:');
    const token = await getOmniRouteToken();
    const omniKeys = await getOmniRouteKeys(token);
    const omniKeysArray = Array.isArray(omniKeys) ? omniKeys : [];
    console.log(`Found ${omniKeysArray.length} keys in OmniRoute\n`);
    
    omniKeysArray.slice(0, 10).forEach(key => {
      console.log(`  - ID: ${key.id}`);
      console.log(`    Name: ${key.name}`);
      console.log(`    Machine ID: ${key.machineId}`);
      console.log(`    Created: ${key.createdAt}\n`);
    });
    
    // 3. Get analytics
    console.log('📊 OmniRoute Analytics (byApiKey):');
    const analytics = await getOmniRouteAnalytics(token, '30d');
    
    if (analytics.byApiKey && analytics.byApiKey.length > 0) {
      console.log(`Found ${analytics.byApiKey.length} API keys with usage\n`);
      
      analytics.byApiKey.forEach(usage => {
        console.log(`  - API Key ID: ${usage.apiKeyId || 'NULL'}`);
        console.log(`    API Key Name: ${usage.apiKeyName || 'NULL'}`);
        console.log(`    Requests: ${usage.requests || 0}`);
        console.log(`    Tokens: ${usage.totalTokens || 0}`);
        console.log(`    Cost: $${(usage.totalCost || 0).toFixed(4)}\n`);
      });
    } else {
      console.log('No API key usage data found\n');
    }
    
    // 4. Cross-reference
    console.log('🔗 Cross-Reference Check:');
    const portalKeyIds = new Set(portalKeys.map(k => k.omnirouteKeyId));
    const omniKeyIds = new Set(omniKeysArray.map(k => k.id));
    const analyticsKeyIds = new Set((analytics.byApiKey || []).map(k => k.apiKeyId).filter(Boolean));
    
    console.log(`\nPortal has ${portalKeyIds.size} unique OmniRoute key IDs`);
    console.log(`OmniRoute has ${omniKeyIds.size} total keys`);
    console.log(`Analytics has ${analyticsKeyIds.size} keys with usage\n`);
    
    // Check for mismatches
    const portalKeysNotInOmni = [...portalKeyIds].filter(id => !omniKeyIds.has(id));
    const analyticsKeysNotInPortal = [...analyticsKeyIds].filter(id => !portalKeyIds.has(id));
    
    if (portalKeysNotInOmni.length > 0) {
      console.log('⚠️  Portal keys NOT found in OmniRoute:');
      portalKeysNotInOmni.forEach(id => console.log(`  - ${id}`));
      console.log();
    }
    
    if (analyticsKeysNotInPortal.length > 0) {
      console.log('⚠️  Analytics keys NOT found in Portal:');
      analyticsKeysNotInPortal.forEach(id => {
        const usage = analytics.byApiKey.find(k => k.apiKeyId === id);
        console.log(`  - ${id} (${usage?.apiKeyName || 'unknown'}) - ${usage?.requests || 0} requests`);
      });
      console.log();
    }
    
    // Show which portal users have usage
    console.log('👥 Portal Users with Usage:');
    portalKeys.forEach(key => {
      const usage = analytics.byApiKey?.find(k => k.apiKeyId === key.omnirouteKeyId);
      if (usage && usage.requests > 0) {
        console.log(`  ✅ ${key.user.email}: ${usage.requests} requests, ${usage.totalTokens} tokens`);
      }
    });
    
    console.log('\n👥 Portal Users WITHOUT Usage:');
    portalKeys.forEach(key => {
      const usage = analytics.byApiKey?.find(k => k.apiKeyId === key.omnirouteKeyId);
      if (!usage || usage.requests === 0) {
        console.log(`  ❌ ${key.user.email}: 0 requests`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
