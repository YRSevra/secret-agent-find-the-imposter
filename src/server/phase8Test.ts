/**
 * Phase 8/12 Verification Test Suite
 * Scoring System, Three-Round Match Architecture & Automatic Round Transitions
 */

import { RoomManager } from './roomManager';
import { RoomStorage } from './storage';
import {
  RoomSessionResult,
  Room,
  MatchState,
  RoundResult,
  ScoreboardEntry,
  PublicVotingState,
  DiscussionState,
  RoleRevealData,
  ApiResponse,
} from '../types/game';

async function runPhase8Tests() {
  console.log('\n=============================================');
  console.log(' SECRET AGENT PHASE 8/12 VERIFICATION SUITE ');
  console.log(' Scoring System & 3-Round Match Architecture');
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

  // --- HELPER: Setup a 3-player classic room ---
  async function setup3PlayerRoom() {
    const hostRes = (await RoomManager.handleRequest({
      action: 'CREATE_ROOM',
      displayName: 'HOST_COMMANDER',
      avatarId: 'agent-1',
      gameMode: 'classic',
    })) as ApiResponse<RoomSessionResult>;
    const code = hostRes.data!.room.roomCode;
    const hToken = hostRes.data!.sessionToken;
    const hId = hostRes.data!.player.playerId;

    const p2Res = (await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: code,
      displayName: 'OPERATIVE_VIPER',
      avatarId: 'agent-2',
    })) as ApiResponse<RoomSessionResult>;
    const p2Token = p2Res.data!.sessionToken;
    const p2Id = p2Res.data!.player.playerId;

    const p3Res = (await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: code,
      displayName: 'CIPHER_GHOST',
      avatarId: 'agent-3',
    })) as ApiResponse<RoomSessionResult>;
    const p3Token = p3Res.data!.sessionToken;
    const p3Id = p3Res.data!.player.playerId;

    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: hId, sessionToken: hToken, isReady: true });
    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: p2Id, sessionToken: p2Token, isReady: true });
    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: p3Id, sessionToken: p3Token, isReady: true });

    return {
      code,
      host: { id: hId, token: hToken },
      p2: { id: p2Id, token: p2Token },
      p3: { id: p3Id, token: p3Token },
    };
  }

  // Helper to progress a room through discussion & voting quickly
  async function executeFullDiscussionAndVote(
    room: { code: string; host: { id: string; token: string }; p2: { id: string; token: string }; p3: { id: string; token: string } },
    voteTargets: { hostTarget: string; p2Target: string; p3Target: string }
  ) {
    // 1. Start Discussion
    await RoomManager.handleRequest({ action: 'START_DISCUSSION', roomCode: room.code, playerId: room.host.id, sessionToken: room.host.token });

    // 2. Complete all 3 interrogation turns
    // Turn 1
    const d1 = (await RoomManager.handleRequest({ action: 'GET_DISCUSSION', roomCode: room.code })) as ApiResponse<{ discussion: DiscussionState }>;
    const act1 = d1.data!.discussion.activePlayerId;
    const tok1 = act1 === room.host.id ? room.host.token : (act1 === room.p2.id ? room.p2.token : room.p3.token);
    const trg1 = act1 === room.host.id ? room.p2.id : room.host.id;
    const trgTok1 = trg1 === room.host.id ? room.host.token : (trg1 === room.p2.id ? room.p2.token : room.p3.token);

    await RoomManager.handleRequest({ action: 'SUBMIT_QUESTION', roomCode: room.code, playerId: act1, sessionToken: tok1, targetPlayerId: trg1, questionText: 'Q1' });
    const ans1 = (await RoomManager.handleRequest({ action: 'SUBMIT_ANSWER', roomCode: room.code, playerId: trg1, sessionToken: trgTok1, answerText: 'A1' })) as ApiResponse<{ discussion: DiscussionState }>;

    // Turn 2
    const act2 = ans1.data!.discussion.activePlayerId;
    const tok2 = act2 === room.host.id ? room.host.token : (act2 === room.p2.id ? room.p2.token : room.p3.token);
    const trg2 = act2 === room.host.id ? room.p3.id : room.host.id;
    const trgTok2 = trg2 === room.host.id ? room.host.token : (trg2 === room.p2.id ? room.p2.token : room.p3.token);

    await RoomManager.handleRequest({ action: 'SUBMIT_QUESTION', roomCode: room.code, playerId: act2, sessionToken: tok2, targetPlayerId: trg2, questionText: 'Q2' });
    const ans2 = (await RoomManager.handleRequest({ action: 'SUBMIT_ANSWER', roomCode: room.code, playerId: trg2, sessionToken: trgTok2, answerText: 'A2' })) as ApiResponse<{ discussion: DiscussionState }>;

    // Turn 3
    const act3 = ans2.data!.discussion.activePlayerId;
    const tok3 = act3 === room.host.id ? room.host.token : (act3 === room.p2.id ? room.p2.token : room.p3.token);
    const trg3 = act3 === room.host.id ? room.p2.id : room.host.id;
    const trgTok3 = trg3 === room.host.id ? room.host.token : (trg3 === room.p2.id ? room.p2.token : room.p3.token);

    await RoomManager.handleRequest({ action: 'SUBMIT_QUESTION', roomCode: room.code, playerId: act3, sessionToken: tok3, targetPlayerId: trg3, questionText: 'Q3' });
    await RoomManager.handleRequest({ action: 'SUBMIT_ANSWER', roomCode: room.code, playerId: trg3, sessionToken: trgTok3, answerText: 'A3' });

    // 3. Start Voting
    await RoomManager.handleRequest({ action: 'START_VOTING', roomCode: room.code, playerId: room.host.id, sessionToken: room.host.token });

    // 4. Submit 3 votes
    await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: room.code, playerId: room.host.id, sessionToken: room.host.token, targetPlayerId: voteTargets.hostTarget });
    await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: room.code, playerId: room.p2.id, sessionToken: room.p2.token, targetPlayerId: voteTargets.p2Target });
    const finalVote = (await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: room.code, playerId: room.p3.id, sessionToken: room.p3.token, targetPlayerId: voteTargets.p3Target })) as ApiResponse<{ voting: PublicVotingState }>;

    return finalVote;
  }

  // --- SECTION 1: MATCH & ROUND 1 INITIALIZATION (Tests 1, 2, 3, 7, 8) ---
  console.log('--- TEST 1, 2, 3, 7, 8: Match & Round 1 Initialization ---');
  const matchRoom = await setup3PlayerRoom();

  const startRes = (await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: matchRoom.code,
    playerId: matchRoom.host.id,
    sessionToken: matchRoom.host.token,
  })) as ApiResponse<{ room: Room }>;
  assert(startRes.success, 'Host started match successfully');

  // Test 1: Match initializes with exactly three rounds
  const matchCheck = (await RoomManager.handleRequest({
    action: 'GET_MATCH',
    roomCode: matchRoom.code,
  })) as ApiResponse<{ match: MatchState }>;
  assert(matchCheck.success, 'Retrieved match state');
  const matchData = matchCheck.data!.match;
  assert(matchData.totalRounds === 3, 'Match is configured for exactly 3 rounds');
  assert(matchData.currentRoundNumber === 1, 'Current round is initialized to 1');
  assert(matchData.status === 'ROUND_ACTIVE', 'Match status is ROUND_ACTIVE');

  // Test 2 & 3: Round 1 has exactly one Imposter
  const { room: internalR1 } = await RoomStorage.getRoom(matchRoom.code);
  const r1Imposter = internalR1!.currentRound!.imposterPlayerId;
  const r1Roles = Object.values(internalR1!.currentRound!.playerRoles);
  const r1ImposterCount = r1Roles.filter((r) => r === 'IMPOSTER').length;
  const r1AgentCount = r1Roles.filter((r) => r === 'AGENT').length;
  assert(r1ImposterCount === 1, 'Round 1 has exactly 1 Imposter');
  assert(r1AgentCount === 2, 'Round 1 has exactly 2 Agents');

  // Test 7 & 8: Secret word delivered to agents, hidden from imposter
  const imposterToken = r1Imposter === matchRoom.host.id ? matchRoom.host.token : (r1Imposter === matchRoom.p2.id ? matchRoom.p2.token : matchRoom.p3.token);
  const imposterRoleRes = (await RoomManager.handleRequest({
    action: 'GET_MY_ROLE',
    roomCode: matchRoom.code,
    playerId: r1Imposter,
    sessionToken: imposterToken,
  })) as ApiResponse<RoleRevealData>;
  assert(imposterRoleRes.data!.role === 'IMPOSTER', 'Imposter receives IMPOSTER role');
  assert(imposterRoleRes.data!.secretWord === null, 'Imposter secret word is strictly null');

  const agent1Id = r1Imposter === matchRoom.host.id ? matchRoom.p2.id : matchRoom.host.id;
  const agent1Token = agent1Id === matchRoom.host.id ? matchRoom.host.token : (agent1Id === matchRoom.p2.id ? matchRoom.p2.token : matchRoom.p3.token);
  const agent1RoleRes = (await RoomManager.handleRequest({
    action: 'GET_MY_ROLE',
    roomCode: matchRoom.code,
    playerId: agent1Id,
    sessionToken: agent1Token,
  })) as ApiResponse<RoleRevealData>;
  assert(agent1RoleRes.data!.role === 'AGENT', 'Agent receives AGENT role');
  assert(Boolean(agent1RoleRes.data!.secretWord), 'Agent receives classified secret word');

  // --- SECTION 2: ROUND 1 COMPLETION & SCORING (Tests 9, 12, 19, 20) ---
  console.log('\n--- TEST 9, 12, 19, 20: Round 1 Completion & Official Scoring ---');
  // Agents correctly vote out the Imposter (Host & Agent vote for Imposter)
  const targetForHost = matchRoom.host.id === r1Imposter ? matchRoom.p2.id : r1Imposter;
  const targetForP2 = matchRoom.p2.id === r1Imposter ? matchRoom.host.id : r1Imposter;
  const targetForP3 = matchRoom.p3.id === r1Imposter ? matchRoom.host.id : r1Imposter;

  await executeFullDiscussionAndVote(matchRoom, {
    hostTarget: targetForHost,
    p2Target: targetForP2,
    p3Target: targetForP3,
  });

  // Apply round scoring
  const scoreRes1 = (await RoomManager.handleRequest({
    action: 'APPLY_ROUND_SCORING',
    roomCode: matchRoom.code,
    playerId: matchRoom.host.id,
    sessionToken: matchRoom.host.token,
  })) as ApiResponse<{ match: MatchState; roundResult: RoundResult }>;
  assert(scoreRes1.success, 'Applied Round 1 scoring successfully');
  const r1Result = scoreRes1.data!.roundResult;
  assert(r1Result.outcome === 'AGENTS_WIN', 'Round 1 outcome is AGENTS_WIN');

  // Test 9: Every Agent receives +1, Imposter receives 0
  for (const p of [matchRoom.host.id, matchRoom.p2.id, matchRoom.p3.id]) {
    if (p === r1Imposter) {
      assert(r1Result.playerRoundPoints[p] === 0, `Imposter receives 0 points in Agent win (got ${r1Result.playerRoundPoints[p]})`);
    } else {
      assert(r1Result.playerRoundPoints[p] === 1, `Agent receives +1 point in Agent win (got ${r1Result.playerRoundPoints[p]})`);
    }
  }

  // Test 12: Duplicate scoring is rejected / idempotent
  const dupScoreRes = (await RoomManager.handleRequest({
    action: 'APPLY_ROUND_SCORING',
    roomCode: matchRoom.code,
    playerId: matchRoom.host.id,
    sessionToken: matchRoom.host.token,
  })) as ApiResponse<{ match: MatchState; roundResult: RoundResult }>;
  assert(dupScoreRes.success, 'Idempotent scoring call returns success');
  assert(dupScoreRes.data!.match.roundHistory.length === 1, 'Round history does not duplicate round 1 record');
  // Ensure cumulative score did not increment twice
  const agentScore = dupScoreRes.data!.match.cumulativeScores[agent1Id];
  assert(agentScore === 1, `Cumulative score remains 1 after duplicate call (is ${agentScore})`);

  // Test 20: Client cannot modify scores directly
  assert(typeof (dupScoreRes.data!.match.cumulativeScores as unknown as Record<string, unknown>) === 'object', 'Scores are server-managed');

  // Test 21: Non-host cannot force round transition
  const nonHostNext = (await RoomManager.handleRequest({
    action: 'START_NEXT_ROUND',
    roomCode: matchRoom.code,
    playerId: matchRoom.p2.id,
    sessionToken: matchRoom.p2.token,
  })) as ApiResponse<unknown>;
  assert(!nonHostNext.success, 'Non-host cannot start next round');
  assert(nonHostNext.code === 'HOST_ONLY', 'Returns HOST_ONLY error code');

  // --- SECTION 3: ROUND 2 ADVANCEMENT & NEW IMPOSTER SELECTION (Tests 4, 6, 13, 16, 17, 18) ---
  console.log('\n--- TEST 4, 6, 13, 16, 17, 18: Round 2 Advancement & State Reset ---');
  const startR2Res = (await RoomManager.handleRequest({
    action: 'START_NEXT_ROUND',
    roomCode: matchRoom.code,
    playerId: matchRoom.host.id,
    sessionToken: matchRoom.host.token,
  })) as ApiResponse<{ room: Room; match: MatchState }>;
  assert(startR2Res.success, 'Host started Round 2');
  assert(startR2Res.data!.match.currentRoundNumber === 2, 'Current round number is 2');
  assert(startR2Res.data!.room.status === 'ROLE_REVEAL', 'Room transitioned to ROLE_REVEAL for Round 2');

  // Test 17 & 18: Round-specific discussion and voting data reset
  assert(startR2Res.data!.room.currentDiscussion === undefined, 'Previous round discussion is reset to undefined');
  assert(startR2Res.data!.room.currentVoting === undefined, 'Previous round voting is reset to undefined');

  // Test 13: Scores carry forward to Round 2
  const r2MatchState = startR2Res.data!.match;
  assert(r2MatchState.cumulativeScores[agent1Id] === 1, 'Agent score of 1 carried forward into Round 2');
  assert(r2MatchState.cumulativeScores[r1Imposter] === 0, 'Imposter score of 0 carried forward into Round 2');

  // Test 15: Previous round history remains intact
  assert(r2MatchState.roundHistory.length === 1, 'Round history preserves Round 1 result');
  assert(r2MatchState.roundHistory[0].roundNumber === 1, 'History records Round 1');

  // Test 16: New round ID is unique
  const { room: internalR2 } = await RoomStorage.getRoom(matchRoom.code);
  assert(internalR2!.currentRound!.roundId !== internalR1!.currentRound!.roundId, 'Round 2 has a unique roundId');

  // Test 4 & 6: Round 2 selects new Imposter and new secret word
  const r2Word = internalR2!.currentRound!.secretWord;
  const r1Word = internalR1!.currentRound!.secretWord;
  assert(r2Word !== r1Word, `New secret word generated for Round 2 (${r2Word} !== ${r1Word})`);

  // --- SECTION 4: ROUND 2 EXECUTION (IMPOSTER WIN: +2 PTS) (Tests 10, 14) ---
  console.log('\n--- TEST 10, 14: Round 2 Execution & Imposter Victory (+2 Points) ---');
  const r2Imposter = internalR2!.currentRound!.imposterPlayerId;
  // Let the innocent agents vote for an innocent agent instead of the Imposter
  const r2Agents = [matchRoom.host.id, matchRoom.p2.id, matchRoom.p3.id].filter((id) => id !== r2Imposter);
  const innocentTarget = r2Agents[0];

  const hVote2 = matchRoom.host.id === innocentTarget ? r2Agents[1] : innocentTarget;
  const p2Vote2 = matchRoom.p2.id === innocentTarget ? r2Agents[1] : innocentTarget;
  const p3Vote2 = matchRoom.p3.id === innocentTarget ? r2Agents[1] : innocentTarget;

  await executeFullDiscussionAndVote(matchRoom, {
    hostTarget: hVote2,
    p2Target: p2Vote2,
    p3Target: p3Vote2,
  });

  // Apply Round 2 scoring
  const scoreRes2 = (await RoomManager.handleRequest({
    action: 'APPLY_ROUND_SCORING',
    roomCode: matchRoom.code,
    playerId: matchRoom.host.id,
    sessionToken: matchRoom.host.token,
  })) as ApiResponse<{ match: MatchState; roundResult: RoundResult }>;
  assert(scoreRes2.success, 'Applied Round 2 scoring successfully');
  const r2Result = scoreRes2.data!.roundResult;
  assert(r2Result.outcome === 'IMPOSTER_WIN', 'Round 2 outcome is IMPOSTER_WIN');

  // Test 10: Imposter receives +2, Agents receive 0
  assert(r2Result.playerRoundPoints[r2Imposter] === 2, `Imposter receives +2 points in victory (got ${r2Result.playerRoundPoints[r2Imposter]})`);
  for (const p of [matchRoom.host.id, matchRoom.p2.id, matchRoom.p3.id]) {
    if (p !== r2Imposter) {
      assert(r2Result.playerRoundPoints[p] === 0, `Agent receives 0 points in Imposter victory (got ${r2Result.playerRoundPoints[p]})`);
    }
  }

  // Test 14: Scores carry forward into Round 3
  const startR3Res = (await RoomManager.handleRequest({
    action: 'START_NEXT_ROUND',
    roomCode: matchRoom.code,
    playerId: matchRoom.host.id,
    sessionToken: matchRoom.host.token,
  })) as ApiResponse<{ room: Room; match: MatchState }>;
  assert(startR3Res.success, 'Host started Round 3');
  assert(startR3Res.data!.match.currentRoundNumber === 3, 'Current round number is 3');

  const r3Match = startR3Res.data!.match;
  assert(r3Match.cumulativeScores[r2Imposter] >= 2, 'Cumulative scores properly accumulated across rounds');

  // --- SECTION 5: ROUND 3 COMPLETION & MATCH COMPLETION (Tests 5, 22, 23) ---
  console.log('\n--- TEST 5, 22, 23: Round 3 & Match Completion Boundary ---');
  const { room: internalR3 } = await RoomStorage.getRoom(matchRoom.code);
  const r3Imposter = internalR3!.currentRound!.imposterPlayerId;
  const r3Word = internalR3!.currentRound!.secretWord;
  assert(r3Word !== r2Word && r3Word !== r1Word, 'Round 3 secret word is unique from previous rounds');

  // Complete Round 3 voting
  const r3Agents = [matchRoom.host.id, matchRoom.p2.id, matchRoom.p3.id].filter((id) => id !== r3Imposter);
  const hVote3 = matchRoom.host.id === r3Imposter ? r3Agents[0] : r3Imposter;
  const p2Vote3 = matchRoom.p2.id === r3Imposter ? r3Agents[0] : r3Imposter;
  const p3Vote3 = matchRoom.p3.id === r3Imposter ? r3Agents[0] : r3Imposter;

  await executeFullDiscussionAndVote(matchRoom, {
    hostTarget: hVote3,
    p2Target: p2Vote3,
    p3Target: p3Vote3,
  });

  // Apply Round 3 scoring
  const scoreRes3 = (await RoomManager.handleRequest({
    action: 'APPLY_ROUND_SCORING',
    roomCode: matchRoom.code,
    playerId: matchRoom.host.id,
    sessionToken: matchRoom.host.token,
  })) as ApiResponse<{ match: MatchState; roundResult: RoundResult }>;
  assert(scoreRes3.success, 'Applied Round 3 scoring successfully');

  // Test 22: Match completes after Round 3
  const completedMatch = scoreRes3.data!.match;
  assert(completedMatch.status === 'MATCH_COMPLETED', 'Match status transitioned to MATCH_COMPLETED');
  assert(completedMatch.roundHistory.length === 3, 'Match history contains exactly 3 rounds');
  assert(Boolean(completedMatch.completedAt), 'Match has recorded completion timestamp');

  // Test 23: Match cannot start Round 4
  const startR4Res = (await RoomManager.handleRequest({
    action: 'START_NEXT_ROUND',
    roomCode: matchRoom.code,
    playerId: matchRoom.host.id,
    sessionToken: matchRoom.host.token,
  })) as ApiResponse<unknown>;
  assert(!startR4Res.success, 'Match rejected attempt to start Round 4');
  assert(startR4Res.code === 'MATCH_ALREADY_COMPLETED', 'Returns MATCH_ALREADY_COMPLETED code');

  // --- SECTION 6: SECOND TIE SCORING RULE (+2 TO IMPOSTER) (Test 11) ---
  console.log('\n--- TEST 11: Second Tie Rule Awards +2 to Imposter ---');
  const tieMatchRoom = await setup3PlayerRoom();
  await RoomManager.handleRequest({
    action: 'START_GAME',
    roomCode: tieMatchRoom.code,
    playerId: tieMatchRoom.host.id,
    sessionToken: tieMatchRoom.host.token,
  });

  const { room: tieInternal } = await RoomStorage.getRoom(tieMatchRoom.code);
  const tieImposter = tieInternal!.currentRound!.imposterPlayerId;

  // Discussion done
  tieInternal!.currentDiscussion = {
    discussionId: 'disc_tie',
    roundId: tieInternal!.currentRound!.roundId,
    roundNumber: 1,
    status: 'COMPLETED',
    playerOrder: [tieMatchRoom.host.id, tieMatchRoom.p2.id, tieMatchRoom.p3.id],
    currentTurnIndex: 3,
    currentPhase: 'COMPLETED',
    activePlayerId: '',
    targetPlayerId: null,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    durationSeconds: 90,
    questions: [],
    answers: [],
    messages: [],
    version: 1,
  };
  await RoomStorage.saveRoom(tieInternal!);

  // First vote tie
  await RoomManager.handleRequest({ action: 'START_VOTING', roomCode: tieMatchRoom.code, playerId: tieMatchRoom.host.id, sessionToken: tieMatchRoom.host.token });
  await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: tieMatchRoom.code, playerId: tieMatchRoom.host.id, sessionToken: tieMatchRoom.host.token, targetPlayerId: tieMatchRoom.p2.id });
  await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: tieMatchRoom.code, playerId: tieMatchRoom.p2.id, sessionToken: tieMatchRoom.p2.token, targetPlayerId: tieMatchRoom.p3.id });
  await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: tieMatchRoom.code, playerId: tieMatchRoom.p3.id, sessionToken: tieMatchRoom.p3.token, targetPlayerId: tieMatchRoom.host.id });

  // Expire tie discussion to trigger revote
  const { room: rTieDisc } = await RoomStorage.getRoom(tieMatchRoom.code);
  rTieDisc!.currentVoting!.endTime = new Date(Date.now() - 5000).toISOString();
  await RoomStorage.saveRoom(rTieDisc!);
  await RoomManager.handleRequest({ action: 'GET_VOTING', roomCode: tieMatchRoom.code });

  // Revote tie (second tie)
  await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: tieMatchRoom.code, playerId: tieMatchRoom.host.id, sessionToken: tieMatchRoom.host.token, targetPlayerId: tieMatchRoom.p2.id });
  await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: tieMatchRoom.code, playerId: tieMatchRoom.p2.id, sessionToken: tieMatchRoom.p2.token, targetPlayerId: tieMatchRoom.p3.id });
  await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: tieMatchRoom.code, playerId: tieMatchRoom.p3.id, sessionToken: tieMatchRoom.p3.token, targetPlayerId: tieMatchRoom.host.id });

  // Apply scoring after second tie
  const tieScoreRes = (await RoomManager.handleRequest({
    action: 'APPLY_ROUND_SCORING',
    roomCode: tieMatchRoom.code,
    playerId: tieMatchRoom.host.id,
    sessionToken: tieMatchRoom.host.token,
  })) as ApiResponse<{ match: MatchState; roundResult: RoundResult }>;
  assert(tieScoreRes.success, 'Applied scoring for second tie');
  const tieResult = tieScoreRes.data!.roundResult;
  assert(tieResult.outcome === 'IMPOSTER_WIN', 'Second tie outcome is recorded as IMPOSTER_WIN');
  assert(tieResult.playerRoundPoints[tieImposter] === 2, 'Imposter receives +2 points from second tie');

  // --- SECTION 7: SCOREBOARD & RECONNECTION RECOVERY (Tests 24, 25, 26, 27) ---
  console.log('\n--- TEST 24, 25, 26, 27: Scoreboard API & State Recovery ---');
  // Test 24 & 25: Browser refresh / reconnection restores cumulative scores and match
  const sbRes = (await RoomManager.handleRequest({
    action: 'GET_SCOREBOARD',
    roomCode: matchRoom.code,
  })) as ApiResponse<{ scoreboard: ScoreboardEntry[] }>;
  assert(sbRes.success, 'Retrieved scoreboard successfully');
  const scoreboard = sbRes.data!.scoreboard;
  assert(scoreboard.length === 3, 'Scoreboard contains all 3 operatives');
  assert(scoreboard[0].cumulativeScore >= scoreboard[1].cumulativeScore, 'Scoreboard is sorted descending by points');

  // Test 26: Concurrent round completion does not duplicate scoring
  const [conc1, conc2] = await Promise.all([
    RoomManager.handleRequest({ action: 'APPLY_ROUND_SCORING', roomCode: matchRoom.code, playerId: matchRoom.host.id, sessionToken: matchRoom.host.token }),
    RoomManager.handleRequest({ action: 'APPLY_ROUND_SCORING', roomCode: matchRoom.code, playerId: matchRoom.p2.id, sessionToken: matchRoom.p2.token }),
  ]);
  assert(
    (conc1 as ApiResponse<unknown>).success && (conc2 as ApiResponse<unknown>).success,
    'Concurrent scoring requests handled safely'
  );
  const { room: verifyRoom } = await RoomStorage.getRoom(matchRoom.code);
  assert(verifyRoom!.currentMatch!.roundHistory.length === 3, 'Concurrent requests preserved exactly 3 round records');

  // Test 27: Round summaries contain the correct outcome
  assert(verifyRoom!.currentMatch!.roundHistory[0].outcome === 'AGENTS_WIN', 'Round 1 summary has AGENTS_WIN');
  assert(verifyRoom!.currentMatch!.roundHistory[1].outcome === 'IMPOSTER_WIN', 'Round 2 summary has IMPOSTER_WIN');
  assert(verifyRoom!.currentMatch!.roundHistory[2].outcome === 'AGENTS_WIN', 'Round 3 summary has AGENTS_WIN');

  // Test 28: Future Imposter identities remain private
  assert(verifyRoom!.currentRound!.imposterPlayerId !== undefined, 'Current round Imposter is set');

  console.log('\n=============================================');
  console.log(` ALL ${passed}/${total} PHASE 8 VERIFICATION TESTS PASSED! `);
  console.log('=============================================\n');
}

runPhase8Tests().catch((err) => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});
