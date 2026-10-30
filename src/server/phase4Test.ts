import { RoomManager } from './roomManager';
import { RoomStorage } from './storage';
import { RoomSessionResult, Room } from '../types/game';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runPhase4Tests() {
  console.log('\n=============================================');
  console.log(' SECRET AGENT PHASE 4/12 VERIFICATION SUITE ');
  console.log(' Waiting Lobby & Player Management          ');
  console.log('=============================================\n');

  // Test 1: Host creates lobby and appears as NOT READY
  console.log('--- TEST 1 & 3: Host Lobby Initialization ---');
  const hostCreate = await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'CHIEF_OPERATIVE',
    avatarId: 'falcon',
    gameMode: 'classic',
  });
  assert(hostCreate.success === true, 'Host created classic lobby');
  const hostData = hostCreate.data as RoomSessionResult;
  assert(hostData.room.players.length === 1, 'Host appears in the lobby roster');
  assert(hostData.player.isHost === true, 'Host player is marked as host');
  assert(hostData.player.isReady === false, 'Host starts as NOT READY');
  const classicCode = hostData.room.roomCode;

  // Test 2: Newly joined players appear and start NOT READY
  console.log('\n--- TEST 2 & 3: Player Joins and Readiness Initial State ---');
  const joinP2 = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: classicCode,
    displayName: 'AGENT_GHOST',
    avatarId: 'ghost',
  });
  assert(joinP2.success === true, 'Agent 2 joined lobby');
  const p2Data = joinP2.data as RoomSessionResult;
  assert(p2Data.player.isReady === false, 'New player 2 starts as NOT READY');
  assert(p2Data.room.players.length === 2, 'Lobby roster now has 2 operatives');

  const joinP3 = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: classicCode,
    displayName: 'AGENT_VIPER',
    avatarId: 'viper',
  });
  assert(joinP3.success === true, 'Agent 3 joined lobby');
  const p3Data = joinP3.data as RoomSessionResult;
  assert(p3Data.player.isReady === false, 'New player 3 starts as NOT READY');
  assert(p3Data.room.players.length === 3, 'Lobby roster now has 3 operatives');

  // Test 4 & 5: Players toggle readiness (Ready -> Not Ready -> Ready)
  console.log('\n--- TEST 4 & 5: Readiness Toggling ---');
  const p2Ready = await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: classicCode,
    playerId: p2Data.player.playerId,
    sessionToken: p2Data.sessionToken,
    isReady: true,
  });
  assert(p2Ready.success === true, 'Player 2 confirmed READY');
  const p2ReadyRoom = (p2Ready.data as { room: Room }).room;
  const p2InRoom = p2ReadyRoom.players.find((p) => p.playerId === p2Data.player.playerId);
  assert(p2InRoom?.isReady === true, 'Player 2 isReady persisted as true');

  // Toggle back to NOT READY
  const p2Unready = await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: classicCode,
    playerId: p2Data.player.playerId,
    sessionToken: p2Data.sessionToken,
    isReady: false,
  });
  assert(p2Unready.success === true, 'Player 2 toggled back to NOT READY');
  const p2UnreadyRoom = (p2Unready.data as { room: Room }).room;
  const p2InRoomAfter = p2UnreadyRoom.players.find((p) => p.playerId === p2Data.player.playerId);
  assert(p2InRoomAfter?.isReady === false, 'Player 2 isReady persisted as false');

  // Re-confirm Ready for P2 and P3
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: classicCode,
    playerId: p2Data.player.playerId,
    sessionToken: p2Data.sessionToken,
    isReady: true,
  });
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: classicCode,
    playerId: p3Data.player.playerId,
    sessionToken: p3Data.sessionToken,
    isReady: true,
  });

  // Test 6: One player CANNOT change another player's readiness
  console.log('\n--- TEST 6: Unauthorized Readiness Tampering Rejection ---');
  const forgedReady = await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: classicCode,
    playerId: p2Data.player.playerId, // Target P2
    sessionToken: p3Data.sessionToken, // But using P3's token!
    isReady: false,
  });
  assert(forgedReady.success === false, 'Rejected forged readiness request');
  assert(forgedReady.code === 'UNAUTHORIZED', 'Returned UNAUTHORIZED code');

  // Test 7: Classic room cannot start with fewer than 3 players (create separate 2-player classic room)
  console.log('\n--- TEST 7: Classic Mode Minimum Player Enforcement ---');
  const smallClassic = await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'EARLY_HOST',
    avatarId: 'titan',
    gameMode: 'classic',
  });
  const smallClassicData = smallClassic.data as RoomSessionResult;
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: smallClassicData.room.roomCode,
    playerId: smallClassicData.player.playerId,
    sessionToken: smallClassicData.sessionToken,
    isReady: true,
  });
  const earlyStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: smallClassicData.room.roomCode,
    playerId: smallClassicData.player.playerId,
    sessionToken: smallClassicData.sessionToken,
  });
  assert(earlyStart.success === false, 'Classic room cannot start with fewer than 3 players (1/3)');
  assert(earlyStart.code === 'INSUFFICIENT_PLAYERS', 'Returned INSUFFICIENT_PLAYERS');
  await RoomStorage.deleteRoom(smallClassicData.room.roomCode);

  // Test 8: Classic room cannot start when any player is NOT READY
  console.log('\n--- TEST 8: All Operatives Ready Enforcement ---');
  // In classicCode, P2 and P3 are READY, but Host is NOT READY!
  const unreadyStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: classicCode,
    playerId: hostData.player.playerId,
    sessionToken: hostData.sessionToken,
  });
  assert(unreadyStart.success === false, 'Cannot start when host/any player is NOT READY');
  assert(unreadyStart.code === 'PLAYERS_NOT_READY', 'Returned PLAYERS_NOT_READY code');

  // Test 10 & 11: Duel Mode Start Conditions
  console.log('\n--- TEST 10 & 11: Duel Mode Start Conditions ---');
  const duelCreate = await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'DUELIST_ALPHA',
    avatarId: 'specter',
    gameMode: 'duel',
  });
  const duelData = duelCreate.data as RoomSessionResult;
  const duelCode = duelData.room.roomCode;

  // Set host ready, but only 1 player in duel room
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: duelCode,
    playerId: duelData.player.playerId,
    sessionToken: duelData.sessionToken,
    isReady: true,
  });
  const duelSingleStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: duelCode,
    playerId: duelData.player.playerId,
    sessionToken: duelData.sessionToken,
  });
  assert(duelSingleStart.success === false, 'Duel room cannot start with 1 player (needs exactly 2)');

  // Join second player
  const duelP2 = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: duelCode,
    displayName: 'DUELIST_OMEGA',
    avatarId: 'mirage',
  });
  const duelP2Data = duelP2.data as RoomSessionResult;
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: duelCode,
    playerId: duelP2Data.player.playerId,
    sessionToken: duelP2Data.sessionToken,
    isReady: true,
  });

  // Duel room can now start with exactly 2 ready players
  const duelValidStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: duelCode,
    playerId: duelData.player.playerId,
    sessionToken: duelData.sessionToken,
  });
  assert(duelValidStart.success === true, 'Duel room started successfully with 2 ready players');
  const duelStartedRoom = (duelValidStart.data as { room: Room }).room;
  assert(
    duelStartedRoom.status === 'STARTING' || duelStartedRoom.status === 'ROLE_REVEAL',
    'Duel room transitioned to STARTING / ROLE_REVEAL status'
  );

  // Clean up duel room
  await RoomStorage.deleteRoom(duelCode);

  // Test 12 & 13: Non-Host & Unauthenticated Start Rejection
  console.log('\n--- TEST 12 & 13: Host Authentication & Permissions ---');
  const nonHostStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: classicCode,
    playerId: p2Data.player.playerId, // Non-host!
    sessionToken: p2Data.sessionToken,
  });
  assert(nonHostStart.success === false, 'Non-host cannot start the game');
  assert(nonHostStart.code === 'HOST_ONLY', 'Returned HOST_ONLY code');

  const unauthStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: classicCode,
    playerId: hostData.player.playerId,
    sessionToken: 'bogus_token_123',
  });
  assert(unauthStart.success === false, 'Unauthenticated request cannot start the game');
  assert(unauthStart.code === 'UNAUTHORIZED', 'Returned UNAUTHORIZED code');

  // Test 9: Classic room can start with 3 ready players
  console.log('\n--- TEST 9: Classic Room Successful Start ---');
  // Mark host ready
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: classicCode,
    playerId: hostData.player.playerId,
    sessionToken: hostData.sessionToken,
    isReady: true,
  });

  const classicValidStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: classicCode,
    playerId: hostData.player.playerId,
    sessionToken: hostData.sessionToken,
  });
  assert(classicValidStart.success === true, 'Classic room started successfully with 3 ready players');
  const startedRoom = (classicValidStart.data as { room: Room }).room;
  assert(
    startedRoom.status === 'STARTING' || startedRoom.status === 'ROLE_REVEAL',
    'Classic room status is now STARTING / ROLE_REVEAL'
  );

  // Test 14: Duplicate start requests rejected safely
  console.log('\n--- TEST 14: Duplicate Start Request Protection ---');
  const duplicateStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: classicCode,
    playerId: hostData.player.playerId,
    sessionToken: hostData.sessionToken,
  });
  assert(duplicateStart.success === false, 'Duplicate start request rejected safely');
  assert(duplicateStart.code === 'ROOM_NOT_WAITING', 'Returned ROOM_NOT_WAITING');

  // Test 18: Readiness cannot change after STARTING
  console.log('\n--- TEST 18: Readiness Immutability After STARTING ---');
  const postStartReadyChange = await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: classicCode,
    playerId: p2Data.player.playerId,
    sessionToken: p2Data.sessionToken,
    isReady: false,
  });
  assert(postStartReadyChange.success === false, 'Readiness cannot be changed after STARTING');
  assert(postStartReadyChange.code === 'ROOM_ALREADY_STARTING', 'Returned ROOM_ALREADY_STARTING');

  // Test 15, 16 & 17: Multi-client sync, Player departure, Host departure & reassignment
  console.log('\n--- TEST 15, 16 & 17: Sync, Departure & Host Reassignment ---');
  const syncRoomRes = await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'HOST_LEADER',
    avatarId: 'apex',
    gameMode: 'classic',
  });
  const syncRoom = syncRoomRes.data as RoomSessionResult;
  const sCode = syncRoom.room.roomCode;

  const sP2 = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: sCode,
    displayName: 'SUB_AGENT',
    avatarId: 'fox',
  });
  const sP2Data = sP2.data as RoomSessionResult;

  // Test 19: Page refresh / GET_ROOM restores state
  const refreshCheck = await RoomManager.handleRequest({
    action: 'GET_ROOM',
    roomCode: sCode,
  });
  const refreshedRoom = (refreshCheck.data as { room: Room }).room;
  assert(refreshedRoom.players.length === 2, 'Page refresh restores full player list');

  // Host departs: verify host reassignment
  const hostDeparture = await RoomManager.handleRequest({
    action: 'LEAVE_ROOM',
    roomCode: sCode,
    playerId: syncRoom.player.playerId,
    sessionToken: syncRoom.sessionToken,
  });
  assert(hostDeparture.success === true, 'Host successfully departed');

  const afterLeave = await RoomManager.handleRequest({
    action: 'GET_ROOM',
    roomCode: sCode,
  });
  const leftRoom = (afterLeave.data as { room: Room }).room;
  assert(leftRoom.players.length === 1, 'Only 1 operative remains after host left');
  assert(leftRoom.players[0].playerId === sP2Data.player.playerId, 'Sub-agent remains in room');
  assert(leftRoom.players[0].isHost === true, 'Sub-agent automatically promoted to host');
  assert(leftRoom.hostPlayerId === sP2Data.player.playerId, 'Room hostPlayerId updated to sub-agent');

  // Test 20: Concurrency version checking prevents silent overwrites
  console.log('\n--- TEST 20: Concurrency Version Conflict Handling ---');
  const conflictTest = await RoomStorage.saveRoom(
    {
      ...syncRoom.room,
      players: [],
      currentRound: undefined,
      currentVoting: undefined,
    },
    { expectedVersion: 999 } // Mismatched version
  );
  assert(conflictTest.success === false, 'Conditional write rejected mismatched version');
  assert(Boolean(conflictTest.error?.includes('conflict')), 'Reported concurrency conflict');

  // Clean up
  await RoomStorage.deleteRoom(classicCode);
  await RoomStorage.deleteRoom(sCode);
  console.log('Test rooms cleaned up successfully');

  console.log('\n=============================================');
  console.log(' ALL 20 PHASE 4 VERIFICATION TESTS PASSED! ');
  console.log('=============================================\n');
}

runPhase4Tests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
