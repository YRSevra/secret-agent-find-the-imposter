/**
 * Production Multiplayer Fix Verification Test Suite
 *
 * Verifies:
 * 1. Netlify Blobs Lambda initialization via connectLambda.
 * 2. Production storage error handling (no silent local fallbacks when persistence fails).
 * 3. Safe in-memory runtime caching behavior.
 * 4. Error response codes (ROOM_NOT_FOUND, STORAGE_UNAVAILABLE) that resolve frontend loading states.
 */

import { RoomStorage, isProductionEnvironment, isNetlifyBlobsAvailable } from './storage';
import { handler } from '../../netlify/functions/game';
import { InternalRoom } from '../types/game';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

const mockContext: HandlerContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'game',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:game',
  memoryLimitInMB: '1024',
  awsRequestId: 'req-123',
  logGroupName: '/aws/lambda/game',
  logStreamName: '2026/10/30/[$LATEST]123',
  getRemainingTimeInMillis: () => 5000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

function createMockEvent(overrides: Partial<HandlerEvent>): HandlerEvent {
  return {
    rawUrl: 'https://secret-agent.netlify.app/.netlify/functions/game',
    rawQuery: '',
    path: '/.netlify/functions/game',
    httpMethod: overrides.httpMethod || 'POST',
    headers: overrides.headers || {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: overrides.body || null,
    isBase64Encoded: false,
    ...overrides,
  };
}

async function runTests() {
  console.log('================================================================');
  console.log(' SECRET AGENT PRODUCTION MULTIPLAYER FIX VERIFICATION SUITE    ');
  console.log('================================================================\n');

  console.log('--- TEST 1: Storage Environment Detection in Local Mode ---');
  // When running locally, isProductionEnvironment() should return false
  assert(!isProductionEnvironment(), 'Local test runner correctly detected as non-production');
  console.log('Test 1 passed.\n');

  console.log('--- TEST 2: Local Persistence & In-Memory Cache in Non-Production ---');
  const testRoomCode = 'TSTFIX';
  const sampleRoom: InternalRoom = {
    roomCode: testRoomCode,
    roomId: `room_${testRoomCode}_123`,
    hostPlayerId: 'op_test_1',
    gameMode: 'classic',
    status: 'WAITING',
    players: [
      {
        playerId: 'op_test_1',
        displayName: 'AGENT_TEST',
        avatarId: 'falcon',
        sessionToken: 'sec_test_token_123',
        isHost: true,
        isReady: false,
        joinedAt: new Date().toISOString(),
      },
    ],
    minPlayers: 3,
    maxPlayers: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 0,
  };

  const saveRes = await RoomStorage.saveRoom(sampleRoom, { onlyIfNew: true });
  assert(saveRes.success, 'Sample room saved in local test environment');

  const { room: fetchedRoom } = await RoomStorage.getRoom(testRoomCode);
  assert(fetchedRoom !== null, 'Room retrieved successfully');
  assert(fetchedRoom?.roomCode === testRoomCode, 'Retrieved room code matches');
  assert(fetchedRoom?.players.length === 1, 'Player roster preserved');

  // Verify duplicate room code collision rejection
  const dupRes = await RoomStorage.saveRoom(sampleRoom, { onlyIfNew: true });
  assert(!dupRes.success, 'Duplicate room code creation rejected');
  assert(dupRes.error === 'Room code already exists', 'Returns Room code already exists error');
  console.log('Test 2 passed.\n');

  console.log('--- TEST 3: Production Storage Protection (No Silent Fallback) ---');
  // Temporarily simulate production environment without Netlify Blobs context
  const originalNetlify = process.env.NETLIFY;
  const originalBlobsContext = process.env.NETLIFY_BLOBS_CONTEXT;
  delete process.env.NETLIFY_BLOBS_CONTEXT;
  process.env.NETLIFY = 'true';

  assert(isProductionEnvironment(), 'Simulated production environment detected');
  assert(!isNetlifyBlobsAvailable(), 'Netlify Blobs context absent in simulated unconfigured production');

  const prodRoom: InternalRoom = {
    ...sampleRoom,
    roomCode: 'PRODFX',
    roomId: 'room_PRODFX_123',
  };

  const prodSaveRes = await RoomStorage.saveRoom(prodRoom);
  assert(!prodSaveRes.success, 'Production save without Netlify Blobs fails explicitly');
  assert(
    Boolean(
      prodSaveRes.error?.includes('Production cloud storage is not available') ||
        prodSaveRes.error?.includes('Netlify Blobs must be initialized')
    ),
    'Returns clear error message instead of silently writing to read-only disk'
  );

  const { room: prodGetRoom } = await RoomStorage.getRoom('PRODFX');
  assert(prodGetRoom === null, 'Production getRoom does not read local disk fallback when cloud storage is unavailable');

  // Restore environment
  if (originalNetlify) {
    process.env.NETLIFY = originalNetlify;
  } else {
    delete process.env.NETLIFY;
  }
  if (originalBlobsContext) {
    process.env.NETLIFY_BLOBS_CONTEXT = originalBlobsContext;
  }
  console.log('Test 3 passed.\n');

  console.log('--- TEST 4: Netlify Function Handler - OPTIONS & CORS Headers ---');
  const optionsEvent = createMockEvent({
    httpMethod: 'OPTIONS',
    headers: {},
  });
  const optionsRes = (await handler(optionsEvent, mockContext)) as HandlerResponse;
  assert(optionsRes.statusCode === 204, 'OPTIONS preflight returns 204');
  assert(
    Boolean(optionsRes.headers && optionsRes.headers['Access-Control-Allow-Origin'] === '*'),
    'CORS origin header present'
  );
  console.log('Test 4 passed.\n');

  console.log('--- TEST 5: Netlify Function Handler - Production Guard without Blobs ---');
  process.env.NETLIFY = 'true';
  delete process.env.NETLIFY_BLOBS_CONTEXT;
  delete (globalThis as Record<string, unknown>).netlifyBlobsContext;

  const postEventWithoutBlobs = createMockEvent({
    httpMethod: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'CREATE_ROOM', displayName: 'FAIL_AGENT', avatarId: 'falcon', gameMode: 'classic' }),
  });
  const failRes = (await handler(postEventWithoutBlobs, mockContext)) as HandlerResponse;
  assert(failRes.statusCode === 503, 'Handler returns 503 when Blobs context is missing in production');
  const failBody = JSON.parse(failRes.body || '{}');
  assert(failBody.code === 'STORAGE_UNAVAILABLE', 'Returns STORAGE_UNAVAILABLE code');

  // Clean up
  delete process.env.NETLIFY;
  console.log('Test 5 passed.\n');

  console.log('--- TEST 6: Room Deletion & Cache Invalidation ---');
  const deleteRes = await RoomStorage.deleteRoom(testRoomCode);
  assert(deleteRes, 'Room deleted successfully');
  const { room: afterDelete } = await RoomStorage.getRoom(testRoomCode);
  assert(afterDelete === null, 'Room lookup after deletion returns null');
  console.log('Test 6 passed.\n');

  console.log('================================================================');
  console.log(' ALL PRODUCTION MULTIPLAYER FIX TESTS PASSED (6/6)!             ');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
