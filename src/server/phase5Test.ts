import { RoomManager } from './roomManager';
import { RoomStorage } from './storage';
import { selectRandomImposter, selectSecretWord } from './roleAssignment';
import { SECRET_WORD_CATEGORIES } from '../constants/secretWords';
import { RoomSessionResult, Room, RoleRevealData } from '../types/game';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runPhase5Tests() {
  console.log('\n=============================================');
  console.log(' SECRET AGENT PHASE 5/12 VERIFICATION SUITE ');
  console.log(' Secure Secret Role & Imposter Engine       ');
  console.log('=============================================\n');

  // --- 1. Unit Tests for Role Assignment & Word Engine ---
  console.log('--- TEST: Unit Tests for Word & Role Selector ---');
  const allWords = SECRET_WORD_CATEGORIES.flatMap((c) => c.words);
  assert(allWords.length >= 150, `Word database contains ${allWords.length} words (>= 150 required)`);

  const sampleWord = selectSecretWord();
  assert(allWords.includes(sampleWord.word), `Selected word "${sampleWord.word}" is in database`);
  assert(Boolean(sampleWord.category), `Selected category "${sampleWord.category}" is defined`);

  // Avoid consecutive repetition test
  const avoidedWord = selectSecretWord([sampleWord.word]);
  assert(avoidedWord.word !== sampleWord.word, `Avoided immediate word repetition (${avoidedWord.word} !== ${sampleWord.word})`);

  // --- 2. Statistical Distribution Test of Imposter Selection ---
  console.log('\n--- TEST: Statistical Imposter Distribution (100 rounds) ---');
  const testIds = ['op_1', 'op_2', 'op_3', 'op_4'];
  const counts: Record<string, number> = { op_1: 0, op_2: 0, op_3: 0, op_4: 0 };
  for (let i = 0; i < 100; i++) {
    const picked = selectRandomImposter(testIds);
    counts[picked]++;
  }
  for (const id of testIds) {
    assert(counts[id] > 0, `Player ${id} was selected as imposter (count: ${counts[id]}/100)`);
  }
  console.log(`Distribution across 4 slots in 100 rounds: ${JSON.stringify(counts)}`);

  // --- 3. Classic Mode with 3 Players ---
  console.log('\n--- TEST 1, 4, 5, 6, 7, 8, 9, 10: Classic Mode (3 Players) ---');
  const c3Host = await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'CHIEF_BOND',
    avatarId: 'falcon',
    gameMode: 'classic',
  });
  const c3HostData = c3Host.data as RoomSessionResult;
  const c3Code = c3HostData.room.roomCode;

  const c3P2 = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: c3Code,
    displayName: 'AGENT_HUNT',
    avatarId: 'ghost',
  });
  const c3P2Data = c3P2.data as RoomSessionResult;

  const c3P3 = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: c3Code,
    displayName: 'AGENT_BOURNE',
    avatarId: 'viper',
  });
  const c3P3Data = c3P3.data as RoomSessionResult;

  // Test 18: Host cannot start without all players ready
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: c3Code,
    playerId: c3P2Data.player.playerId,
    sessionToken: c3P2Data.sessionToken,
    isReady: true,
  });
  const prematureStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: c3Code,
    playerId: c3HostData.player.playerId,
    sessionToken: c3HostData.sessionToken,
  });
  assert(prematureStart.success === false, 'Host cannot start without all players ready');
  assert(prematureStart.code === 'PLAYERS_NOT_READY', 'Returned PLAYERS_NOT_READY');

  // Mark all ready
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: c3Code,
    playerId: c3HostData.player.playerId,
    sessionToken: c3HostData.sessionToken,
    isReady: true,
  });
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: c3Code,
    playerId: c3P3Data.player.playerId,
    sessionToken: c3P3Data.sessionToken,
    isReady: true,
  });

  // Test 17: Unauthorized player cannot initialize game
  const unauthStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: c3Code,
    playerId: c3P2Data.player.playerId,
    sessionToken: c3P2Data.sessionToken,
  });
  assert(unauthStart.success === false, 'Unauthorized non-host player cannot start game');

  // Start the mission
  const c3Start = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: c3Code,
    playerId: c3HostData.player.playerId,
    sessionToken: c3HostData.sessionToken,
  });
  assert(c3Start.success === true, 'Host successfully started mission');
  const c3Room = (c3Start.data as { room: Room }).room;

  // Test 22: All players reach ROLE_REVEAL status
  assert(c3Room.status === 'ROLE_REVEAL', 'Room status shifted to ROLE_REVEAL');
  assert(c3Room.currentRound?.roundNumber === 1, 'Current round is initialized to 1');
  assert(c3Room.currentRound?.status === 'ROLE_REVEAL', 'Current round status is ROLE_REVEAL');

  // Test 16: Duplicate initialization rejected
  const dupStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: c3Code,
    playerId: c3HostData.player.playerId,
    sessionToken: c3HostData.sessionToken,
  });
  assert(dupStart.success === false, 'Duplicate start request is safely rejected');
  assert(dupStart.code === 'ROOM_NOT_WAITING', 'Returned ROOM_NOT_WAITING');

  // Test 11 & 12: Public GET_ROOM does NOT expose secret word or Imposter identity
  console.log('\n--- TEST 11 & 12: Public Room Sanitization & Leaks Prevention ---');
  const publicRoomRes = await RoomManager.handleRequest({
    action: 'GET_ROOM',
    roomCode: c3Code,
  });
  const pubRoom = (publicRoomRes.data as { room: Room }).room;
  assert(!('secretWord' in (pubRoom.currentRound || {})), 'Public room does NOT expose secretWord');
  assert(!('selectedCategory' in (pubRoom.currentRound || {})), 'Public room does NOT expose selectedCategory');
  assert(!('imposterPlayerId' in (pubRoom.currentRound || {})), 'Public room does NOT expose imposterPlayerId');
  assert(!('playerRoles' in (pubRoom.currentRound || {})), 'Public room does NOT expose playerRoles');

  // Retrieve private roles for each of the 3 players
  console.log('\n--- TEST: Private Role Retrieval for 3 Players ---');
  const rHost = await RoomManager.handleRequest({
    action: 'GET_MY_ROLE',
    roomCode: c3Code,
    playerId: c3HostData.player.playerId,
    sessionToken: c3HostData.sessionToken,
  });
  assert(rHost.success === true, 'Host retrieved their private role');
  const hostRoleData = rHost.data as RoleRevealData;

  const rP2 = await RoomManager.handleRequest({
    action: 'GET_MY_ROLE',
    roomCode: c3Code,
    playerId: c3P2Data.player.playerId,
    sessionToken: c3P2Data.sessionToken,
  });
  assert(rP2.success === true, 'P2 retrieved their private role');
  const p2RoleData = rP2.data as RoleRevealData;

  const rP3 = await RoomManager.handleRequest({
    action: 'GET_MY_ROLE',
    roomCode: c3Code,
    playerId: c3P3Data.player.playerId,
    sessionToken: c3P3Data.sessionToken,
  });
  assert(rP3.success === true, 'P3 retrieved their private role');
  const p3RoleData = rP3.data as RoleRevealData;

  const allRoles = [hostRoleData, p2RoleData, p3RoleData];
  const imposters = allRoles.filter((r) => r.role === 'IMPOSTER');
  const agents = allRoles.filter((r) => r.role === 'AGENT');

  // Test 4 & 5: Exactly one Imposter, remaining Agents
  assert(imposters.length === 1, `Exactly 1 Imposter assigned in 3-player classic room (found: ${imposters.length})`);
  assert(agents.length === 2, `Exactly 2 Agents assigned in 3-player classic room (found: ${agents.length})`);

  // Test 7 & 8: All Agents receive the same secret word
  assert(agents[0].secretWord !== null, 'Agent 1 receives non-null secret word');
  assert(agents[0].secretWord === agents[1].secretWord, `All Agents receive the identical secret word: "${agents[0].secretWord}"`);
  assert(agents[0].category === agents[1].category, `All Agents receive the identical category: "${agents[0].category}"`);

  // Test 9 & 10: Imposter receives null secret word and classified warning
  assert(imposters[0].secretWord === null, 'Imposter receives null secretWord');
  assert(imposters[0].category === null, 'Imposter receives null category');
  assert(Boolean(imposters[0].warning?.includes('IMPOSTER')), 'Imposter receives classified warning');

  // Test 13: One player cannot retrieve another player's role (forged session token)
  console.log('\n--- TEST 13, 14 & 15: Security & Forgery Protection ---');
  const forgedRole = await RoomManager.handleRequest({
    action: 'GET_MY_ROLE',
    roomCode: c3Code,
    playerId: c3HostData.player.playerId, // Target host
    sessionToken: c3P2Data.sessionToken, // With P2's token
  });
  assert(forgedRole.success === false, 'Cannot retrieve another player role with forged sessionToken');
  assert(forgedRole.code === 'UNAUTHORIZED', 'Returned UNAUTHORIZED code');

  // Test 14: Invalid session cannot retrieve role
  const invalidSessionRole = await RoomManager.handleRequest({
    action: 'GET_MY_ROLE',
    roomCode: c3Code,
    playerId: c3HostData.player.playerId,
    sessionToken: 'invalid_token_999',
  });
  assert(invalidSessionRole.success === false, 'Invalid session token rejected');
  assert(invalidSessionRole.code === 'UNAUTHORIZED', 'Returned UNAUTHORIZED code');

  // Test 15: Player outside room cannot retrieve role
  const outsideRole = await RoomManager.handleRequest({
    action: 'GET_MY_ROLE',
    roomCode: c3Code,
    playerId: 'op_outside_999',
    sessionToken: 'token_outside',
  });
  assert(outsideRole.success === false, 'Player outside room rejected');

  // Test 21: Page refresh restores player's own role
  const refreshHostRole = await RoomManager.handleRequest({
    action: 'GET_MY_ROLE',
    roomCode: c3Code,
    playerId: c3HostData.player.playerId,
    sessionToken: c3HostData.sessionToken,
  });
  assert(refreshHostRole.success === true, 'Page refresh simulation successfully restores role');
  assert((refreshHostRole.data as RoleRevealData).role === hostRoleData.role, 'Restored role matches previous role');

  await RoomStorage.deleteRoom(c3Code);

  // --- 4. Duel Mode with 2 Players ---
  console.log('\n--- TEST 3: Duel Mode (2 Players) ---');
  const duel = await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'DUEL_P1',
    avatarId: 'specter',
    gameMode: 'duel',
  });
  const duelData = duel.data as RoomSessionResult;
  const dCode = duelData.room.roomCode;

  const duelP2 = await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: dCode,
    displayName: 'DUEL_P2',
    avatarId: 'titan',
  });
  const duelP2Data = duelP2.data as RoomSessionResult;

  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: dCode,
    playerId: duelData.player.playerId,
    sessionToken: duelData.sessionToken,
    isReady: true,
  });
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: dCode,
    playerId: duelP2Data.player.playerId,
    sessionToken: duelP2Data.sessionToken,
    isReady: true,
  });

  const duelStart = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: dCode,
    playerId: duelData.player.playerId,
    sessionToken: duelData.sessionToken,
  });
  assert(duelStart.success === true, 'Duel game started successfully');

  const dRole1 = await RoomManager.handleRequest({
    action: 'GET_MY_ROLE',
    roomCode: dCode,
    playerId: duelData.player.playerId,
    sessionToken: duelData.sessionToken,
  });
  const dRole2 = await RoomManager.handleRequest({
    action: 'GET_MY_ROLE',
    roomCode: dCode,
    playerId: duelP2Data.player.playerId,
    sessionToken: duelP2Data.sessionToken,
  });

  const dR1 = dRole1.data as RoleRevealData;
  const dR2 = dRole2.data as RoleRevealData;

  const duelRoles = [dR1.role, dR2.role];
  assert(duelRoles.includes('AGENT'), 'Duel mode contains exactly 1 Agent');
  assert(duelRoles.includes('IMPOSTER'), 'Duel mode contains exactly 1 Imposter');
  assert(dR1.role !== dR2.role, 'Duel mode players receive opposite roles');

  const duelAgent = dR1.role === 'AGENT' ? dR1 : dR2;
  const duelImposter = dR1.role === 'IMPOSTER' ? dR1 : dR2;
  assert(duelAgent.secretWord !== null, 'Duel Agent receives secret word');
  assert(duelImposter.secretWord === null, 'Duel Imposter receives null secret word');
  assert(Boolean(duelImposter.warning), 'Duel Imposter receives classified warning');

  await RoomStorage.deleteRoom(dCode);

  // --- 5. Classic Mode with 8 Players ---
  console.log('\n--- TEST 2: Classic Mode with 8 Players ---');
  const c8Host = await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'HOST_C8',
    avatarId: 'apex',
    gameMode: 'classic',
  });
  const c8HostData = c8Host.data as RoomSessionResult;
  const c8Code = c8HostData.room.roomCode;
  const playersList = [c8HostData];

  for (let i = 2; i <= 8; i++) {
    const joined = await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: c8Code,
      displayName: `OP_${i}`,
      avatarId: 'fox',
    });
    playersList.push(joined.data as RoomSessionResult);
  }

  // Mark all 8 ready
  for (const p of playersList) {
    await RoomManager.handleRequest({
      action: 'SET_READY',
      roomCode: c8Code,
      playerId: p.player.playerId,
      sessionToken: p.sessionToken,
      isReady: true,
    });
  }

  const c8Start = await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: c8Code,
    playerId: c8HostData.player.playerId,
    sessionToken: c8HostData.sessionToken,
  });
  assert(c8Start.success === true, 'Classic 8-player room started successfully');

  const c8Roles: RoleRevealData[] = [];
  for (const p of playersList) {
    const r = await RoomManager.handleRequest({
      action: 'GET_MY_ROLE',
      roomCode: c8Code,
      playerId: p.player.playerId,
      sessionToken: p.sessionToken,
    });
    c8Roles.push(r.data as RoleRevealData);
  }

  const c8Imposters = c8Roles.filter((r) => r.role === 'IMPOSTER');
  const c8Agents = c8Roles.filter((r) => r.role === 'AGENT');
  assert(c8Imposters.length === 1, `8-player room has exactly 1 Imposter (found: ${c8Imposters.length})`);
  assert(c8Agents.length === 7, `8-player room has exactly 7 Agents (found: ${c8Agents.length})`);

  const secretWordsSet = new Set(c8Agents.map((a) => a.secretWord));
  assert(secretWordsSet.size === 1, `All 7 Agents share the identical secret word: "${Array.from(secretWordsSet)[0]}"`);

  await RoomStorage.deleteRoom(c8Code);

  console.log('\n=============================================');
  console.log(' ALL 22 PHASE 5 VERIFICATION TESTS PASSED! ');
  console.log('=============================================\n');
}

runPhase5Tests().catch((err) => {
  console.error('Phase 5 Test suite failed:', err);
  process.exit(1);
});
