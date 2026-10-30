/**
 * Phase 6/12 Verification Test Suite
 * Real-Time Question Turns, Answers & Live Discussion System
 */

import { RoomManager } from './roomManager';
import { RoomStorage } from './storage';
import {
  RoomSessionResult,
  Room,
  DiscussionState,
  ApiResponse,
} from '../types/game';

async function runPhase6Tests() {
  console.log('\n=============================================');
  console.log(' SECRET AGENT PHASE 6/12 VERIFICATION SUITE ');
  console.log(' Question Turns, Answers & Live Discussion  ');
  console.log('=============================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      process.exitCode = 1;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // --- SECTION 1: SETUP 3-PLAYER CLASSIC ROOM & START GAME ---
  console.log('--- TEST 1: Setup 3-Player Room & Advance to ROLE_REVEAL ---');
  const hostRes = (await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'HOST_COMMANDER',
    avatarId: 'agent-1',
    gameMode: 'classic',
  })) as ApiResponse<RoomSessionResult>;
  assert(hostRes.success, 'Host created classic room');
  const roomCode = hostRes.data!.room.roomCode;
  const hostToken = hostRes.data!.sessionToken;
  const hostId = hostRes.data!.player.playerId;

  const p2Res = (await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode,
    displayName: 'OPERATIVE_VIPER',
    avatarId: 'agent-2',
  })) as ApiResponse<RoomSessionResult>;
  assert(p2Res.success, 'Player 2 joined classic room');
  const p2Token = p2Res.data!.sessionToken;
  const p2Id = p2Res.data!.player.playerId;

  const p3Res = (await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode,
    displayName: 'CIPHER_GHOST',
    avatarId: 'agent-3',
  })) as ApiResponse<RoomSessionResult>;
  assert(p3Res.success, 'Player 3 joined classic room');
  const p3Token = p3Res.data!.sessionToken;
  const p3Id = p3Res.data!.player.playerId;

  // Set all operatives ready
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode,
    playerId: hostId,
    sessionToken: hostToken,
    isReady: true,
  });
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode,
    playerId: p2Id,
    sessionToken: p2Token,
    isReady: true,
  });
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode,
    playerId: p3Id,
    sessionToken: p3Token,
    isReady: true,
  });

  // Start game -> ROLE_REVEAL
  const startMission = (await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode,
    playerId: hostId,
    sessionToken: hostToken,
  })) as ApiResponse<{ room: Room }>;
  assert(startMission.success, 'Host started mission');
  assert(startMission.data!.room.status === 'ROLE_REVEAL', 'Room entered ROLE_REVEAL status');

  // --- SECTION 2: START DISCUSSION PERMISSIONS & INITIALIZATION ---
  console.log('\n--- TEST 2: Start Discussion Security & 90s Timer Initialization ---');
  // Non-host attempts to start discussion
  const nonHostStart = (await RoomManager.handleRequest({
    action: 'START_DISCUSSION',
    roomCode,
    playerId: p2Id,
    sessionToken: p2Token,
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!nonHostStart.success, 'Non-host is rejected from starting discussion');
  assert(nonHostStart.code === 'HOST_ONLY', 'Returns HOST_ONLY error code');

  // Invalid token attempts to start discussion
  const invalidTokenStart = (await RoomManager.handleRequest({
    action: 'START_DISCUSSION',
    roomCode,
    playerId: hostId,
    sessionToken: 'forged_tampered_token',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!invalidTokenStart.success, 'Invalid session token rejected from starting discussion');
  assert(invalidTokenStart.code === 'UNAUTHORIZED', 'Returns UNAUTHORIZED error code');

  // Host starts discussion successfully
  const startDiscRes = (await RoomManager.handleRequest({
    action: 'START_DISCUSSION',
    roomCode,
    playerId: hostId,
    sessionToken: hostToken,
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(startDiscRes.success, 'Host started discussion successfully');
  const discState = startDiscRes.data!.discussion;
  assert(discState.status === 'ACTIVE', 'Discussion status initialized to ACTIVE');
  assert(discState.currentPhase === 'ASKING', 'Initial discussion phase is ASKING');
  assert(discState.currentTurnIndex === 0, 'Current turn index initialized to 0');
  assert(discState.playerOrder.length === 3, 'Player order contains all 3 players');
  assert(discState.activePlayerId === discState.playerOrder[0], 'Active player matches playerOrder[0]');
  assert(discState.targetPlayerId === null, 'Target player is null in ASKING phase');

  // Verify 90-second duration
  const startMs = new Date(discState.startTime).getTime();
  const endMs = new Date(discState.endTime).getTime();
  const durationSec = Math.round((endMs - startMs) / 1000);
  assert(durationSec === 90, `Discussion duration is exactly 90 seconds (measured: ${durationSec}s)`);

  // Verify room status transitioned to DISCUSSION
  const roomCheck = (await RoomManager.handleRequest({
    action: 'GET_ROOM',
    roomCode,
  })) as ApiResponse<{ room: Room }>;
  assert(roomCheck.data!.room.status === 'DISCUSSION', 'Room status transitioned to DISCUSSION');

  // Duplicate start attempt when discussion already active
  const dupStart = (await RoomManager.handleRequest({
    action: 'START_DISCUSSION',
    roomCode,
    playerId: hostId,
    sessionToken: hostToken,
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!dupStart.success, 'Duplicate start discussion rejected');
  assert(dupStart.code === 'DISCUSSION_ALREADY_ACTIVE', 'Returns DISCUSSION_ALREADY_ACTIVE code');

  // --- SECTION 3: TURN 1 QUESTION SUBMISSION & VALIDATION ---
  console.log('\n--- TEST 3: Turn 1 Question Submission & Validation ---');
  const turn1AskerId = discState.activePlayerId;
  const turn1AskerToken = turn1AskerId === hostId ? hostToken : (turn1AskerId === p2Id ? p2Token : p3Token);
  const inactiveId = turn1AskerId === hostId ? p2Id : hostId;
  const inactiveToken = inactiveId === hostId ? hostToken : (inactiveId === p2Id ? p2Token : p3Token);

  // Inactive player tries to ask
  const wrongTurnQ = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode,
    playerId: inactiveId,
    sessionToken: inactiveToken,
    targetPlayerId: p3Id,
    questionText: 'Are you the imposter?',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!wrongTurnQ.success, 'Inactive player cannot ask question');
  assert(wrongTurnQ.code === 'NOT_YOUR_TURN', 'Returns NOT_YOUR_TURN error code');

  // Self interrogation attempt
  const selfTargetQ = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode,
    playerId: turn1AskerId,
    sessionToken: turn1AskerToken,
    targetPlayerId: turn1AskerId,
    questionText: 'Can I interrogate myself?',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!selfTargetQ.success, 'Player cannot interrogate themselves');
  assert(selfTargetQ.code === 'CANNOT_TARGET_SELF', 'Returns CANNOT_TARGET_SELF error code');

  // Target not in room
  const fakeTargetQ = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode,
    playerId: turn1AskerId,
    sessionToken: turn1AskerToken,
    targetPlayerId: 'bogus_id_9999',
    questionText: 'Where are you stationed?',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!fakeTargetQ.success, 'Cannot interrogate non-existent target');
  assert(fakeTargetQ.code === 'TARGET_NOT_IN_ROOM', 'Returns TARGET_NOT_IN_ROOM error code');

  // Empty question validation
  const emptyQ = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode,
    playerId: turn1AskerId,
    sessionToken: turn1AskerToken,
    targetPlayerId: inactiveId,
    questionText: '   ',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!emptyQ.success, 'Empty question rejected');
  assert(emptyQ.code === 'EMPTY_QUESTION', 'Returns EMPTY_QUESTION error code');

  // Question too long (>200 chars)
  const longQ = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode,
    playerId: turn1AskerId,
    sessionToken: turn1AskerToken,
    targetPlayerId: inactiveId,
    questionText: 'A'.repeat(201),
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!longQ.success, 'Question exceeding 200 chars rejected');
  assert(longQ.code === 'QUESTION_TOO_LONG', 'Returns QUESTION_TOO_LONG error code');

  // Valid question submission
  const target1Id = turn1AskerId === hostId ? p2Id : (turn1AskerId === p2Id ? p3Id : hostId);
  const validQ1 = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode,
    playerId: turn1AskerId,
    sessionToken: turn1AskerToken,
    targetPlayerId: target1Id,
    questionText: 'Where were you stationed at 22:00 hours?',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(validQ1.success, 'Turn 1 question submitted successfully');
  const afterQ1Disc = validQ1.data!.discussion;
  assert(afterQ1Disc.currentPhase === 'ANSWERING', 'Phase transitioned to ANSWERING');
  assert(afterQ1Disc.targetPlayerId === target1Id, 'Target player recorded correctly');
  assert(afterQ1Disc.questions.length === 1, 'Question stored in question history');
  assert(afterQ1Disc.questions[0].targetPlayerId === target1Id, 'Question target ID matches');

  // --- SECTION 4: TURN 1 ANSWER SUBMISSION & ROTATION ---
  console.log('\n--- TEST 4: Turn 1 Answer Submission & Rotation ---');
  const target1Token = target1Id === hostId ? hostToken : (target1Id === p2Id ? p2Token : p3Token);

  // Asker tries to answer
  const wrongAns = (await RoomManager.handleRequest({
    action: 'SUBMIT_ANSWER',
    roomCode,
    playerId: turn1AskerId,
    sessionToken: turn1AskerToken,
    answerText: 'I will answer for you!',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!wrongAns.success, 'Asker cannot answer their own question');
  assert(wrongAns.code === 'NOT_YOUR_TURN', 'Returns NOT_YOUR_TURN for non-target answerer');

  // Empty answer
  const emptyAns = (await RoomManager.handleRequest({
    action: 'SUBMIT_ANSWER',
    roomCode,
    playerId: target1Id,
    sessionToken: target1Token,
    answerText: '   ',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!emptyAns.success, 'Empty answer rejected');
  assert(emptyAns.code === 'EMPTY_ANSWER', 'Returns EMPTY_ANSWER error code');

  // Answer too long (>300 chars)
  const longAns = (await RoomManager.handleRequest({
    action: 'SUBMIT_ANSWER',
    roomCode,
    playerId: target1Id,
    sessionToken: target1Token,
    answerText: 'B'.repeat(301),
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!longAns.success, 'Answer exceeding 300 chars rejected');
  assert(longAns.code === 'ANSWER_TOO_LONG', 'Returns ANSWER_TOO_LONG error code');

  // Valid answer submission
  const validAns1 = (await RoomManager.handleRequest({
    action: 'SUBMIT_ANSWER',
    roomCode,
    playerId: target1Id,
    sessionToken: target1Token,
    answerText: 'I was reviewing satellite diagnostics in the communication hub.',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(validAns1.success, 'Turn 1 answer submitted successfully');
  const afterAns1Disc = validAns1.data!.discussion;
  assert(afterAns1Disc.currentTurnIndex === 1, 'Turn index advanced to 1');
  assert(afterAns1Disc.currentPhase === 'ASKING', 'Phase reset to ASKING for next operative');
  assert(afterAns1Disc.activePlayerId === afterAns1Disc.playerOrder[1], 'Active player is operative 2 in order');
  assert(afterAns1Disc.targetPlayerId === null, 'Target player reset to null');
  assert(afterAns1Disc.answers.length === 1, 'Answer recorded in history');
  assert(afterAns1Disc.answers[0].questionId === afterAns1Disc.questions[0].id, 'Answer linked to question ID');

  // --- SECTION 5: LIVE DISCUSSION CHAT & RATE LIMITING ---
  console.log('\n--- TEST 5: Live Discussion Chat & Rate Limiting ---');
  const chat1 = (await RoomManager.handleRequest({
    action: 'SEND_CHAT_MESSAGE',
    roomCode,
    playerId: hostId,
    sessionToken: hostToken,
    text: 'Operative Viper seemed guarded during their response.',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(chat1.success, 'Host sent chat message');
  assert(chat1.data!.discussion.messages.length === 1, 'Chat message stored in discussion');

  // Script injection sanitization test
  const scriptChat = (await RoomManager.handleRequest({
    action: 'SEND_CHAT_MESSAGE',
    roomCode,
    playerId: p2Id,
    sessionToken: p2Token,
    text: '<script>alert("HACK")</script> Test injection & "quotes"',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(scriptChat.success, 'Script chat message accepted');
  const lastMsg = scriptChat.data!.discussion.messages[1];
  assert(!lastMsg.text.includes('<script>'), 'Script tag escaped/sanitized');
  assert(lastMsg.text.includes('&lt;script&gt;'), 'HTML entities properly encoded');

  // Rate limit test: player attempts to send 6 rapid messages
  let rateLimitTriggered = false;
  for (let i = 0; i < 6; i++) {
    const res = (await RoomManager.handleRequest({
      action: 'SEND_CHAT_MESSAGE',
      roomCode,
      playerId: hostId,
      sessionToken: hostToken,
      text: `Spam burst transmission ${i}`,
    })) as ApiResponse<{ discussion: DiscussionState }>;
    if (!res.success && res.code === 'RATE_LIMITED') {
      rateLimitTriggered = true;
      break;
    }
  }
  assert(rateLimitTriggered, 'Chat rate limiter prevents spam (>5 msgs in 10s)');

  // --- SECTION 6: COMPLETE ALL TURNS TO REACH COMPLETED ---
  console.log('\n--- TEST 6: Complete Turns to Discussion COMPLETED ---');
  // Turn 2
  const turn2AskerId = afterAns1Disc.activePlayerId;
  const turn2AskerToken = turn2AskerId === hostId ? hostToken : (turn2AskerId === p2Id ? p2Token : p3Token);
  const target2Id = turn2AskerId === hostId ? p3Id : hostId;
  const target2Token = target2Id === hostId ? hostToken : (target2Id === p2Id ? p2Token : p3Token);

  const q2Res = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode,
    playerId: turn2AskerId,
    sessionToken: turn2AskerToken,
    targetPlayerId: target2Id,
    questionText: 'What protocol governs satellite uplink?',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(q2Res.success, 'Turn 2 question submitted');

  const ans2Res = (await RoomManager.handleRequest({
    action: 'SUBMIT_ANSWER',
    roomCode,
    playerId: target2Id,
    sessionToken: target2Token,
    answerText: 'Cipher protocol 9-Alpha.',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(ans2Res.success, 'Turn 2 answer submitted');
  assert(ans2Res.data!.discussion.currentTurnIndex === 2, 'Turn index advanced to 2');

  // Turn 3 (Final turn in 3-player game)
  const turn3AskerId = ans2Res.data!.discussion.activePlayerId;
  const turn3AskerToken = turn3AskerId === hostId ? hostToken : (turn3AskerId === p2Id ? p2Token : p3Token);
  const target3Id = turn3AskerId === hostId ? p2Id : hostId;
  const target3Token = target3Id === hostId ? hostToken : (target3Id === p2Id ? p2Token : p3Token);

  const q3Res = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode,
    playerId: turn3AskerId,
    sessionToken: turn3AskerToken,
    targetPlayerId: target3Id,
    questionText: 'Do you confirm operative Ghost is cleared?',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(q3Res.success, 'Turn 3 (final) question submitted');

  const ans3Res = (await RoomManager.handleRequest({
    action: 'SUBMIT_ANSWER',
    roomCode,
    playerId: target3Id,
    sessionToken: target3Token,
    answerText: 'I confirm their identity and security clearance.',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(ans3Res.success, 'Turn 3 (final) answer submitted');
  const completedDisc = ans3Res.data!.discussion;
  assert(completedDisc.currentTurnIndex === 3, 'Turn index reached total player count (3)');
  assert(completedDisc.currentPhase === 'COMPLETED', 'Discussion phase transitioned to COMPLETED');
  assert(completedDisc.status === 'COMPLETED', 'Discussion status transitioned to COMPLETED');

  // Subsequent questions rejected
  const postCompleteQ = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode,
    playerId: hostId,
    sessionToken: hostToken,
    targetPlayerId: p2Id,
    questionText: 'Can I interrogate someone else now?',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!postCompleteQ.success, 'Submitting questions rejected after discussion is COMPLETED');
  assert(postCompleteQ.code === 'DISCUSSION_NOT_ACTIVE', 'Returns DISCUSSION_NOT_ACTIVE error code');

  // --- SECTION 7: DUEL MODE (2 PLAYERS) DISCUSSION ---
  console.log('\n--- TEST 7: Duel Mode (2 Players) Discussion Execution ---');
  const duelHost = (await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'DUEL_COMMANDER',
    avatarId: 'agent-4',
    gameMode: 'duel',
  })) as ApiResponse<RoomSessionResult>;
  const duelCode = duelHost.data!.room.roomCode;
  const duelHostToken = duelHost.data!.sessionToken;
  const duelHostId = duelHost.data!.player.playerId;

  const duelP2 = (await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: duelCode,
    displayName: 'DUEL_RIVAL',
    avatarId: 'agent-5',
  })) as ApiResponse<RoomSessionResult>;
  const duelP2Token = duelP2.data!.sessionToken;
  const duelP2Id = duelP2.data!.player.playerId;

  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: duelCode,
    playerId: duelHostId,
    sessionToken: duelHostToken,
    isReady: true,
  });
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: duelCode,
    playerId: duelP2Id,
    sessionToken: duelP2Token,
    isReady: true,
  });
  await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: duelCode,
    playerId: duelHostId,
    sessionToken: duelHostToken,
  });

  // Start discussion in duel room
  const duelStart = (await RoomManager.handleRequest({
    action: 'START_DISCUSSION',
    roomCode: duelCode,
    playerId: duelHostId,
    sessionToken: duelHostToken,
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(duelStart.success, 'Duel discussion started');
  assert(duelStart.data!.discussion.playerOrder.length === 2, 'Duel discussion player order has length 2');

  // Duel Turn 1: Host interrogates P2
  const duelQ1 = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode: duelCode,
    playerId: duelHostId,
    sessionToken: duelHostToken,
    targetPlayerId: duelP2Id,
    questionText: 'What is your assigned drop zone?',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(duelQ1.success, 'Duel turn 1 question submitted');

  const duelAns1 = (await RoomManager.handleRequest({
    action: 'SUBMIT_ANSWER',
    roomCode: duelCode,
    playerId: duelP2Id,
    sessionToken: duelP2Token,
    answerText: 'Sector 7 Landing Strip.',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(duelAns1.success, 'Duel turn 1 answer submitted');
  assert(duelAns1.data!.discussion.currentTurnIndex === 1, 'Duel turn advanced to 1');
  assert(duelAns1.data!.discussion.activePlayerId === duelP2Id, 'Duel turn 2 active player is P2');

  // Duel Turn 2: P2 interrogates Host
  const duelQ2 = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode: duelCode,
    playerId: duelP2Id,
    sessionToken: duelP2Token,
    targetPlayerId: duelHostId,
    questionText: 'What was your callsign in Berlin?',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(duelQ2.success, 'Duel turn 2 question submitted');

  const duelAns2 = (await RoomManager.handleRequest({
    action: 'SUBMIT_ANSWER',
    roomCode: duelCode,
    playerId: duelHostId,
    sessionToken: duelHostToken,
    answerText: 'Shadow Falcon.',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(duelAns2.success, 'Duel turn 2 answer submitted');
  assert(duelAns2.data!.discussion.status === 'COMPLETED', 'Duel discussion reached COMPLETED');

  // --- SECTION 8: 90-SECOND TIMER EXPIRY ENFORCEMENT ---
  console.log('\n--- TEST 8: Server-Authoritative Timer Expiry Lockout ---');
  const expireHost = (await RoomManager.handleRequest({
    action: 'CREATE_ROOM',
    displayName: 'TIMER_HOST',
    avatarId: 'agent-6',
    gameMode: 'duel',
  })) as ApiResponse<RoomSessionResult>;
  const expireCode = expireHost.data!.room.roomCode;
  const expireHostToken = expireHost.data!.sessionToken;
  const expireHostId = expireHost.data!.player.playerId;

  const expireGuest = (await RoomManager.handleRequest({
    action: 'JOIN_ROOM',
    roomCode: expireCode,
    displayName: 'TIMER_GUEST',
    avatarId: 'agent-7',
  })) as ApiResponse<RoomSessionResult>;
  const expireGuestToken = expireGuest.data!.sessionToken;
  const expireGuestId = expireGuest.data!.player.playerId;

  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: expireCode,
    playerId: expireHostId,
    sessionToken: expireHostToken,
    isReady: true,
  });
  await RoomManager.handleRequest({
    action: 'SET_READY',
    roomCode: expireCode,
    playerId: expireGuestId,
    sessionToken: expireGuestToken,
    isReady: true,
  });
  await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: expireCode,
    playerId: expireHostId,
    sessionToken: expireHostToken,
  });
  await RoomManager.handleRequest({
    action: 'START_DISCUSSION',
    roomCode: expireCode,
    playerId: expireHostId,
    sessionToken: expireHostToken,
  });

  // Force timer expiry in storage by setting endTime 5 seconds in the past
  const { room: storedRoom } = await RoomStorage.getRoom(expireCode);
  assert(storedRoom !== null && storedRoom.currentDiscussion !== undefined, 'Discussion retrieved from storage');
  storedRoom!.currentDiscussion!.endTime = new Date(Date.now() - 5000).toISOString();
  await RoomStorage.saveRoom(storedRoom!);

  // Attempt to submit question after expiry
  const expiredQ = (await RoomManager.handleRequest({
    action: 'SUBMIT_QUESTION',
    roomCode: expireCode,
    playerId: expireHostId,
    sessionToken: expireHostToken,
    targetPlayerId: expireGuestId,
    questionText: 'Can I interrogate after expiry?',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!expiredQ.success, 'Question rejected after discussion timer expired');
  assert(expiredQ.code === 'DISCUSSION_EXPIRED', 'Returns DISCUSSION_EXPIRED code');

  // Verify GET_DISCUSSION marks status EXPIRED authoritatively
  const getDiscRes = (await RoomManager.handleRequest({
    action: 'GET_DISCUSSION',
    roomCode: expireCode,
    playerId: expireHostId,
    sessionToken: expireHostToken,
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(getDiscRes.success, 'Retrieved discussion after expiry');
  assert(getDiscRes.data!.discussion.status === 'EXPIRED', 'Discussion state status updated to EXPIRED');

  // --- SECTION 9: ROLE PRIVACY & PUBLIC ZERO-LEAK CHECK ---
  console.log('\n--- TEST 9: Role Privacy & Public Zero-Leak Verification ---');
  const pubRoomRes = (await RoomManager.handleRequest({
    action: 'GET_ROOM',
    roomCode,
  })) as ApiResponse<{ room: Room }>;
  assert(pubRoomRes.success, 'Public room retrieved');
  const pubRoom = pubRoomRes.data!.room;
  assert(pubRoom.currentDiscussion !== undefined, 'Public room contains safe currentDiscussion');

  const pubDiscString = JSON.stringify(pubRoom.currentDiscussion);
  assert(!pubDiscString.includes('secretWord'), 'Public discussion state contains ZERO references to secretWord');
  assert(!pubDiscString.includes('imposterPlayerId'), 'Public discussion state contains ZERO references to imposterPlayerId');
  assert(!pubDiscString.includes('playerRoles'), 'Public discussion state contains ZERO references to playerRoles');
  assert(!pubDiscString.includes('sessionToken'), 'Public discussion state contains ZERO references to sessionToken');

  // Unauthenticated GET_DISCUSSION check
  const unauthGetDisc = (await RoomManager.handleRequest({
    action: 'GET_DISCUSSION',
    roomCode,
    playerId: 'forged_intruder',
    sessionToken: 'forged_session_token',
  })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(!unauthGetDisc.success, 'Unauthorized agent rejected from GET_DISCUSSION');
  assert(unauthGetDisc.code === 'UNAUTHORIZED', 'Returns UNAUTHORIZED code');

  console.log('\n=============================================');
  console.log(` ALL ${passed}/${total} PHASE 6 VERIFICATION TESTS PASSED! `);
  console.log('=============================================\n');
}

runPhase6Tests().catch((err) => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});
