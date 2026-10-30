/**
 * Production Multiplayer Fix Verification Test Suite
 *
 * Verifies:
 * 1. Missing production credentials rejection (returns clear configuration error, no silent fallback).
 * 2. Strong-consistency Netlify Blobs API access configuration (edgeAccess: false, origin-backed).
 * 3. Room creation and duplicate room-code rejection (atomic onlyIfNew).
 * 4. Concurrent room updates and stale-version rejection (optimistic concurrency / ETag checks).
 * 5. Room reads immediately after writes (authoritative fresh state, no stale cache).
 * 6. Local development compatibility without requiring credentials.
 */

import {
  RoomStorage,
  isProductionEnvironment,
  isNetlifyBlobsAvailable,
  getNetlifyStore,
} from './storage';
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
  console.log(' SECRET AGENT PRODUCTION MULTIPLAYER STORAGE VERIFICATION SUITE ');
  console.log('================================================================\n');

  console.log('--- TEST 1: Local Development Compatibility (No Credentials Required) ---');
  // Confirm local mode detection
  assert(!isProductionEnvironment(), 'Local test environment detected as non-production');
  assert(!isNetlifyBlobsAvailable(), 'Netlify Blobs credentials absent in clean local environment');

  const localRoomCode = 'LOCDEV';
  const sampleRoom: InternalRoom = {
    roomCode: localRoomCode,
    roomId: `room_${localRoomCode}_123`,
    hostPlayerId: 'op_test_1',
    gameMode: 'classic',
    status: 'WAITING',
    players: [
      {
        playerId: 'op_test_1',
        displayName: 'LOCAL_AGENT',
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

  // 1A. Room Creation & Immediate Authoritative Read
  const saveRes = await RoomStorage.saveRoom(sampleRoom, { onlyIfNew: true });
  assert(saveRes.success, 'Room created in local store without requiring credentials');

  const { room: fetchedRoom } = await RoomStorage.getRoom(localRoomCode);
  assert(fetchedRoom !== null, 'Room retrieved immediately after write');
  assert(fetchedRoom?.roomCode === localRoomCode, 'Retrieved room code matches');
  assert(fetchedRoom?.version === 1, 'Version incremented to 1');

  // 1B. Duplicate Room-Code Rejection
  const dupRes = await RoomStorage.saveRoom(sampleRoom, { onlyIfNew: true });
  assert(!dupRes.success, 'Duplicate room code creation rejected');
  assert(dupRes.error === 'Room code already exists', 'Returns "Room code already exists" error');

  // 1C. Concurrent Room Updates & Stale-Version Rejection
  const staleUpdateRes = await RoomStorage.saveRoom(
    { ...fetchedRoom!, status: 'DISCUSSION' },
    { expectedVersion: 0 } // Expected version 0, but current is 1
  );
  assert(!staleUpdateRes.success, 'Stale-version update rejected');
  assert(
    staleUpdateRes.error === 'Concurrent room update conflict',
    'Returns "Concurrent room update conflict" error'
  );

  // Valid sequential update with correct expectedVersion
  const validUpdateRes = await RoomStorage.saveRoom(
    { ...fetchedRoom!, status: 'DISCUSSION' },
    { expectedVersion: 1 }
  );
  assert(validUpdateRes.success, 'Sequential update with matching expectedVersion succeeds');
  const { room: updatedRoom } = await RoomStorage.getRoom(localRoomCode);
  assert(updatedRoom?.version === 2, 'Version updated to 2');
  assert(updatedRoom?.status === 'DISCUSSION', 'Status updated to DISCUSSION');

  // Clean up local room
  await RoomStorage.deleteRoom(localRoomCode);
  console.log('Test 1 passed.\n');

  console.log('--- TEST 2: Missing Production Credentials Protection ---');
  // Temporarily simulate Netlify production without environment variables
  process.env.NETLIFY = 'true';
  delete process.env.NETLIFY_SITE_ID;
  delete process.env.SITE_ID;
  delete process.env.NETLIFY_BLOBS_TOKEN;
  delete process.env.NETLIFY_AUTH_TOKEN;

  assert(isProductionEnvironment(), 'Simulated production environment active');
  assert(!isNetlifyBlobsAvailable(), 'Netlify Blobs API credentials absent');

  // Attempting to save in unconfigured production fails with actionable error
  const unconfiguredSave = await RoomStorage.saveRoom(sampleRoom);
  assert(!unconfiguredSave.success, 'Production save without credentials rejected');
  assert(
    Boolean(
      unconfiguredSave.error?.includes('NETLIFY_SITE_ID') &&
        unconfiguredSave.error?.includes('NETLIFY_BLOBS_TOKEN')
    ),
    'Returns clear actionable error specifying NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN'
  );

  // Attempting to get in unconfigured production returns null (never reads local disk)
  const { room: unconfiguredGet } = await RoomStorage.getRoom(localRoomCode);
  assert(unconfiguredGet === null, 'Production getRoom never reads local disk when unconfigured');

  // Function handler returns 503 STORAGE_CONFIG_ERROR
  const mockPostEvent = createMockEvent({
    httpMethod: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'CREATE_ROOM',
      displayName: 'PROD_AGENT',
      avatarId: 'falcon',
      gameMode: 'classic',
    }),
  });
  const handlerRes = (await handler(mockPostEvent, mockContext)) as HandlerResponse;
  assert(handlerRes.statusCode === 503, 'Netlify Function returns 503 when credentials are unconfigured');
  const handlerBody = JSON.parse(handlerRes.body || '{}');
  assert(handlerBody.code === 'STORAGE_CONFIG_ERROR', 'Returns code STORAGE_CONFIG_ERROR');
  assert(
    Boolean(handlerBody.error?.includes('NETLIFY_SITE_ID') && handlerBody.error?.includes('NETLIFY_BLOBS_TOKEN')),
    'Returns clear dashboard setup instructions in response body'
  );

  // Clean up production simulation
  delete process.env.NETLIFY;
  console.log('Test 2 passed.\n');

  console.log('--- TEST 3: Strong-Consistency API Access Configuration ---');
  // Set mock Netlify Blobs API credentials
  process.env.NETLIFY_SITE_ID = 'site_mock_12345';
  process.env.NETLIFY_BLOBS_TOKEN = 'nfp_mock_token_67890';

  assert(isNetlifyBlobsAvailable(), 'isNetlifyBlobsAvailable() is true when credentials are set');

  const apiStore = getNetlifyStore();
  // Inspect internal client options constructed by @netlify/blobs
  const client = (apiStore as unknown as { client: { edgeAccess: boolean; edgeURL?: string; siteID: string } }).client;

  assert(client.edgeAccess === false, 'edgeAccess is false (routes to API, not edge)');
  assert(client.edgeURL === undefined, 'edgeURL is undefined (bypasses CDN edge caching)');
  assert(client.siteID === 'site_mock_12345', 'Site ID matches configured NETLIFY_SITE_ID');

  // Clean up
  delete process.env.NETLIFY_SITE_ID;
  delete process.env.NETLIFY_BLOBS_TOKEN;
  console.log('Test 3 passed.\n');

  console.log('--- TEST 4: Options Preflight & CORS Support ---');
  const optionsEvent = createMockEvent({ httpMethod: 'OPTIONS' });
  const optionsRes = (await handler(optionsEvent, mockContext)) as HandlerResponse;
  assert(optionsRes.statusCode === 204, 'OPTIONS preflight returns 204 No Content');
  assert(
    Boolean(optionsRes.headers && optionsRes.headers['Access-Control-Allow-Origin'] === '*'),
    'CORS header Access-Control-Allow-Origin: * present'
  );
  console.log('Test 4 passed.\n');

  console.log('================================================================');
  console.log(' ALL PRODUCTION MULTIPLAYER STORAGE TESTS PASSED (4/4)!         ');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
