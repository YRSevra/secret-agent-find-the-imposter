import { RoomManager } from './roomManager';
import { generateRoomCode } from './security';
import { RoomStorage } from './storage';
import { RoomSessionResult, Room } from '../types/game';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runPhase3Tests() {
  console.log('\n=============================================');
  console.log(' SECRET AGENT PHASE 3/12 VERIFICATION SUITE ');
  console.log('=============================================\n');

  // Test 1: Create a Classic Room
  console.log('--- TEST 1: Classic Room Creation ---');
  const classicRes = await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'HOST_COMMANDER',
    avatarId: 'falcon',
    gameMode: 'classic',
  });
  assert(classicRes.success === true, 'Classic room created successfully');
  const classicData = classicRes.data as RoomSessionResult;
  assert(classicData.room.gameMode === 'classic', 'Game mode is classic');
  assert(classicData.room.minPlayers === 3, 'Min players is 3');
  assert(classicData.room.maxPlayers === 8, 'Max players is 8');
  assert(classicData.room.status === 'WAITING', 'Status is WAITING');
  assert(classicData.player.isHost === true, 'Creator is marked as host');
  assert(typeof classicData.sessionToken === 'string', 'Session token generated for host');
  const classicCode = classicData.room.roomCode;

  // Test 2: Create a Duel Room
  console.log('\n--- TEST 2: Duel Room Creation ---');
  const duelRes = await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'SOLO_SNIPER',
    avatarId: 'ghost',
    gameMode: 'duel',
  });
  assert(duelRes.success === true, 'Duel room created successfully');
  const duelData = duelRes.data as RoomSessionResult;
  assert(duelData.room.gameMode === 'duel', 'Game mode is duel');
  assert(duelData.room.minPlayers === 2, 'Min players is 2');
  assert(duelData.room.maxPlayers === 2, 'Max players is 2');
  assert(duelData.room.status === 'WAITING', 'Duel status is WAITING');
  const duelCode = duelData.room.roomCode;

  // Test 3: Validate 6-character room codes
  console.log('\n--- TEST 3: Room Code Validation ---');
  const codeRegex = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
  assert(codeRegex.test(classicCode), `Classic code ${classicCode} matches 6-char cryptographically safe charset`);
  assert(codeRegex.test(duelCode), `Duel code ${duelCode} matches 6-char cryptographically safe charset`);
  for (let i = 0; i < 50; i++) {
    const code = generateRoomCode();
    assert(code.length === 6 && codeRegex.test(code), `Generated code ${code} is valid`);
  }

  // Test 4: Join an existing room
  console.log('\n--- TEST 4: Join Room & Multi-Device Simulation ---');
  const join1 = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: classicCode,
    displayName: 'OPERATIVE_VIPER',
    avatarId: 'viper',
  });
  assert(join1.success === true, 'Operative 2 joined classic room');
  const join1Data = join1.data as RoomSessionResult;
  assert(join1Data.player.displayName === 'OPERATIVE_VIPER', 'Player name persisted');
  assert(join1Data.player.avatarId === 'viper', 'Avatar persisted');
  assert(join1Data.player.isHost === false, 'Joining player cannot claim host');
  assert(join1Data.room.players.length === 2, 'Room now contains 2 players');

  // Test 5: Join from another device
  const join2 = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: classicCode,
    displayName: 'CIPHER_GHOST',
    avatarId: 'cipher',
  });
  assert(join2.success === true, 'Operative 3 joined from simulated 3rd browser');
  const join2Data = join2.data as RoomSessionResult;
  assert(join2Data.room.players.length === 3, 'Room now contains 3 players');
  assert(join1Data.sessionToken !== join2Data.sessionToken, 'Different players receive distinct session tokens');

  // Test 6: Verify GET_ROOM & Page Refresh Persistence
  console.log('\n--- TEST 6: GET_ROOM & State Persistence ---');
  const getRes = await RoomManager.handleRequest({
    action: 'GET_ROOM',
    roomCode: classicCode,
  });
  assert(getRes.success === true, 'GET_ROOM retrieved state');
  const getData = getRes.data as { room: Room };
  assert(getData.room.roomCode === classicCode, 'Retrieved same room code');
  assert(getData.room.players.length === 3, 'Retrieved all 3 persisted operatives');

  // Test 7: Verify session tokens are NOT exposed in public room data
  console.log('\n--- TEST 7: Privacy & Security Sanitization ---');
  for (const p of getData.room.players) {
    assert(!('sessionToken' in p), `Player ${p.displayName} does not leak sessionToken in public room`);
  }

  // Test 8: Reject invalid room codes
  console.log('\n--- TEST 8: Invalid Input Rejection ---');
  const invalidCodeRes = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: 'NONEXISTENT',
    displayName: 'TESTER',
    avatarId: 'falcon',
  });
  assert(invalidCodeRes.success === false, 'Rejected non-6-char room code');

  const notFoundRes = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: 'ZZZZZZ',
    displayName: 'TESTER',
    avatarId: 'falcon',
  });
  assert(notFoundRes.success === false, 'Rejected non-existent room code');

  // Test 9: Reject invalid display names
  const emptyNameRes = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: classicCode,
    displayName: '   ',
    avatarId: 'falcon',
  });
  assert(emptyNameRes.success === false, 'Rejected empty player name');

  const longNameRes = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: classicCode,
    displayName: 'SUPER_LONG_NAME_BEYOND_LIMIT',
    avatarId: 'falcon',
  });
  assert(longNameRes.success === false, 'Rejected display name exceeding limit');

  // Test 10: Reject duplicate active codename in same room
  const dupNameRes = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: classicCode,
    displayName: 'operative_viper', // lowercase version of existing
    avatarId: 'specter',
  });
  assert(dupNameRes.success === false, 'Rejected duplicate active codename in the same room');

  // Test 11: Enforce Duel Capacity = 2
  console.log('\n--- TEST 11: Capacity Enforcements ---');
  const duelJoin1 = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: duelCode,
    displayName: 'DUEL_RIVAL',
    avatarId: 'titan',
  });
  assert(duelJoin1.success === true, 'Player 2 joined Duel room (2/2 full)');

  const duelJoinOver = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: duelCode,
    displayName: 'INTRUDER_3',
    avatarId: 'fox',
  });
  assert(duelJoinOver.success === false, 'Player 3 rejected from Duel room (exceeds capacity of 2)');
  assert(duelJoinOver.code === 'ROOM_FULL', 'Received ROOM_FULL error code');

  // Test 12: Enforce Classic Capacity = 8
  for (let i = 4; i <= 8; i++) {
    const res = await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: classicCode,
      displayName: `OPERATIVE_${i}`,
      avatarId: 'raven',
    });
    assert(res.success === true, `Joined player ${i}/8 in classic room`);
  }

  const classicJoinOver = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: classicCode,
    displayName: 'OPERATIVE_9',
    avatarId: 'apex',
  });
  assert(classicJoinOver.success === false, 'Player 9 rejected from Classic room (exceeds capacity of 8)');
  assert(classicJoinOver.code === 'ROOM_FULL', 'Received ROOM_FULL error code');

  // Test 13: Leave Room & Host Reassignment
  console.log('\n--- TEST 13: Leave Room & Host Reassignment ---');
  const hostLeave = await RoomManager.handleRequest({
    action: 'LEAVE_ROOM',
    roomCode: classicCode,
    playerId: classicData.player.playerId,
    sessionToken: classicData.sessionToken,
  });
  assert(hostLeave.success === true, 'Host successfully left room');

  const afterHostLeave = await RoomManager.handleRequest({
    action: 'GET_ROOM',
    roomCode: classicCode,
  });
  const remainingRoom = (afterHostLeave.data as { room: Room }).room;
  assert(remainingRoom.players.length === 7, '7 operatives remain');
  assert(remainingRoom.players[0].isHost === true, 'Next operative automatically designated as host');

  // Clean up duel room
  await RoomStorage.deleteRoom(duelCode);
  await RoomStorage.deleteRoom(classicCode);
  console.log('Cleaned up test rooms successfully');

  console.log('\n=============================================');
  console.log(' ALL 16 PHASE 3 VERIFICATION TESTS PASSED! ');
  console.log('=============================================\n');
}

runPhase3Tests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
