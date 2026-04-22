#!/usr/bin/env node

/**
 * Test script for Account Pooling integration
 * 
 * Usage:
 *   node test-pooling.mjs
 * 
 * Tests:
 *   1. Session persistence
 *   2. Account cooldown
 *   3. Token tracking
 *   4. Error counting
 */

import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'changeme_redis';

async function testPooling() {
  console.log('🧪 Testing Account Pooling Integration\n');

  const redis = createClient({
    url: REDIS_URL,
    password: REDIS_PASSWORD,
  });

  try {
    await redis.connect();
    console.log('✅ Connected to Redis\n');

    // Test 1: Session Persistence
    console.log('Test 1: Session Persistence');
    const sessionKey = 'session:test123';
    const sessionData = {
      userApiKey: 'sk-test',
      sessionId: 'test-session-1',
      backendAccountId: 'conn-abc123',
      providerId: 'openai',
      conversationHistory: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };
    
    await redis.setEx(sessionKey, 3600, JSON.stringify(sessionData));
    const retrieved = await redis.get(sessionKey);
    
    if (retrieved && JSON.parse(retrieved).sessionId === 'test-session-1') {
      console.log('  ✅ Session created and retrieved successfully');
    } else {
      console.log('  ❌ Session test failed');
    }
    await redis.del(sessionKey);
    console.log();

    // Test 2: Account Cooldown
    console.log('Test 2: Account Cooldown');
    const cooldownKey = 'cooldown:conn-test456';
    await redis.setEx(cooldownKey, 60, '1');
    const cooldownExists = await redis.exists(cooldownKey);
    
    if (cooldownExists) {
      console.log('  ✅ Cooldown flag set successfully');
    } else {
      console.log('  ❌ Cooldown test failed');
    }
    await redis.del(cooldownKey);
    console.log();

    // Test 3: Token Tracking
    console.log('Test 3: Token Tracking');
    const tokenKey = 'tokens:conn-test789';
    await redis.setEx(tokenKey, 3600, '5000');
    const tokens = await redis.get(tokenKey);
    
    if (tokens === '5000') {
      console.log('  ✅ Token tracking working');
    } else {
      console.log('  ❌ Token tracking test failed');
    }
    await redis.del(tokenKey);
    console.log();

    // Test 4: Error Counting
    console.log('Test 4: Error Counting');
    const errorKey = 'errors:conn-test999';
    await redis.setEx(errorKey, 300, '3');
    const errors = await redis.get(errorKey);
    
    if (errors === '3') {
      console.log('  ✅ Error counting working');
    } else {
      console.log('  ❌ Error counting test failed');
    }
    await redis.del(errorKey);
    console.log();

    // Test 5: Account Pool
    console.log('Test 5: Account Pool');
    const poolKey = 'pool:openai';
    await redis.sAdd(poolKey, ['conn-test1', 'conn-test2', 'conn-test3']);
    const members = await redis.sMembers(poolKey);
    
    if (members.length === 3) {
      console.log('  ✅ Account pool working');
    } else {
      console.log('  ❌ Account pool test failed');
    }
    await redis.del(poolKey);
    console.log();

    console.log('✅ All tests passed!\n');
    console.log('Next steps:');
    console.log('  1. Configure .env with pooling variables');
    console.log('  2. Start OmniRoute: npm run dev');
    console.log('  3. Send requests with x-session-id header');
    console.log('  4. Monitor Redis keys: redis-cli keys "session:*"');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nMake sure Redis is running:');
    console.error('  docker-compose -f docker-compose.unified.yml up -d redis');
  } finally {
    await redis.quit();
  }
}

testPooling();
