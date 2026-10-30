/**
 * Phase 7/12 Verification Test Suite
 * Secure Voting System & Imposter Elimination Engine
 */

import { RoomManager } from './roomManager';
import { RoomStorage } from './storage';
import {
  RoomSessionResult,
  Room,
  PublicVotingState,
  DiscussionState,
  ApiResponse,
} from '../types/game';

async function runPhase7Tests() {
  console.log('\n=============================================');
  console.log(' SECRET AGENT PHASE 7/12 VERIFICATION SUITE ');
  console.log(' Voting System & Imposter Elimination Engine');
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

  // --- HELPER: Setup a 3-player classic room ready for discussion/voting ---
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

    await RoomManager.handleRequest({ action: 'START_GAME', roomCode: code, playerId: hId, sessionToken: hToken });
    await RoomManager.handleRequest({ action: 'START_DISCUSSION', roomCode: code, playerId: hId, sessionToken: hToken });

    return {
      code,
      host: { id: hId, token: hToken },
      p2: { id: p2Id, token: p2Token },
      p3: { id: p3Id, token: p3Token },
    };
  }

  // --- SECTION 1: VOTING INITIALIZATION & DISCUSSION BOUNDARIES (Tests 1, 2, 3, 4, 5) ---
  console.log('--- TEST 1, 2, 3, 4, 5: Voting Initialization & Status Rules ---');
  const roomA = await setup3PlayerRoom();

  // Test 3: Voting cannot initialize during active discussion
  const prematureVote = (await RoomManager.handleRequest({
    action: 'START_VOTING',
    roomCode: roomA.code,
    playerId: roomA.host.id,
    sessionToken: roomA.host.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(!prematureVote.success, 'Voting cannot initialize during active discussion');
  assert(prematureVote.code === 'DISCUSSION_STILL_ACTIVE', 'Returns DISCUSSION_STILL_ACTIVE code');

  // Complete discussion turns to mark discussion COMPLETED
  // Turn 1
  const disc1 = (await RoomManager.handleRequest({ action: 'GET_DISCUSSION', roomCode: roomA.code })) as ApiResponse<{ discussion: DiscussionState }>;
  const active1 = disc1.data!.discussion.activePlayerId;
  const token1 = active1 === roomA.host.id ? roomA.host.token : (active1 === roomA.p2.id ? roomA.p2.token : roomA.p3.token);
  const target1 = active1 === roomA.host.id ? roomA.p2.id : roomA.host.id;
  const targetToken1 = target1 === roomA.host.id ? roomA.host.token : (target1 === roomA.p2.id ? roomA.p2.token : roomA.p3.token);

  await RoomManager.handleRequest({ action: 'SUBMIT_QUESTION', roomCode: roomA.code, playerId: active1, sessionToken: token1, targetPlayerId: target1, questionText: 'Q1' });
  const ans1 = (await RoomManager.handleRequest({ action: 'SUBMIT_ANSWER', roomCode: roomA.code, playerId: target1, sessionToken: targetToken1, answerText: 'A1' })) as ApiResponse<{ discussion: DiscussionState }>;

  // Turn 2
  const active2 = ans1.data!.discussion.activePlayerId;
  const token2 = active2 === roomA.host.id ? roomA.host.token : (active2 === roomA.p2.id ? roomA.p2.token : roomA.p3.token);
  const target2 = active2 === roomA.host.id ? roomA.p3.id : roomA.host.id;
  const targetToken2 = target2 === roomA.host.id ? roomA.host.token : (target2 === roomA.p2.id ? roomA.p2.token : roomA.p3.token);

  await RoomManager.handleRequest({ action: 'SUBMIT_QUESTION', roomCode: roomA.code, playerId: active2, sessionToken: token2, targetPlayerId: target2, questionText: 'Q2' });
  const ans2 = (await RoomManager.handleRequest({ action: 'SUBMIT_ANSWER', roomCode: roomA.code, playerId: target2, sessionToken: targetToken2, answerText: 'A2' })) as ApiResponse<{ discussion: DiscussionState }>;

  // Turn 3
  const active3 = ans2.data!.discussion.activePlayerId;
  const token3 = active3 === roomA.host.id ? roomA.host.token : (active3 === roomA.p2.id ? roomA.p2.token : roomA.p3.token);
  const target3 = active3 === roomA.host.id ? roomA.p2.id : roomA.host.id;
  const targetToken3 = target3 === roomA.host.id ? roomA.host.token : (target3 === roomA.p2.id ? roomA.p2.token : roomA.p3.token);

  await RoomManager.handleRequest({ action: 'SUBMIT_QUESTION', roomCode: roomA.code, playerId: active3, sessionToken: token3, targetPlayerId: target3, questionText: 'Q3' });
  const ans3 = (await RoomManager.handleRequest({ action: 'SUBMIT_ANSWER', roomCode: roomA.code, playerId: target3, sessionToken: targetToken3, answerText: 'A3' })) as ApiResponse<{ discussion: DiscussionState }>;
  assert(ans3.data!.discussion.status === 'COMPLETED', 'Discussion completed after all player turns');

  // Test 1: Voting initializes after discussion completion
  const startVoteRes = (await RoomManager.handleRequest({
    action: 'START_VOTING',
    roomCode: roomA.code,
    playerId: roomA.host.id,
    sessionToken: roomA.host.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(startVoteRes.success, 'Voting initialized after discussion completion');
  const vState = startVoteRes.data!.voting;
  assert(vState.status === 'ACTIVE', 'Voting status is ACTIVE');

  // Test 5: Timer initializes to 60 seconds
  const startMs = new Date(vState.startTime).getTime();
  const endMs = new Date(vState.endTime).getTime();
  const durationSec = Math.round((endMs - startMs) / 1000);
  assert(durationSec === 60, `Voting timer duration is 60 seconds (measured: ${durationSec}s)`);

  // Test 4: All players receive the same voting session
  const p2GetVote = (await RoomManager.handleRequest({
    action: 'GET_VOTING',
    roomCode: roomA.code,
    playerId: roomA.p2.id,
    sessionToken: roomA.p2.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(p2GetVote.success, 'Player 2 retrieved voting state');
  assert(p2GetVote.data!.voting.votingId === vState.votingId, 'Player 2 sees the identical voting session ID');

  // Test 2: Voting initializes after discussion expiration
  const roomB = await setup3PlayerRoom();
  // Expire discussion manually in storage
  const { room: storedB } = await RoomStorage.getRoom(roomB.code);
  storedB!.currentDiscussion!.endTime = new Date(Date.now() - 5000).toISOString();
  await RoomStorage.saveRoom(storedB!);

  const expireVoteStart = (await RoomManager.handleRequest({
    action: 'START_VOTING',
    roomCode: roomB.code,
    playerId: roomB.host.id,
    sessionToken: roomB.host.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(expireVoteStart.success, 'Voting initialized after discussion expiration');

  // --- SECTION 2: VOTE SUBMISSION VALIDATIONS & SECURITY (Tests 6, 7, 8, 9, 10, 11) ---
  console.log('\n--- TEST 6, 7, 8, 9, 10, 11: Vote Submission Security & Immutability ---');

  // Test 7: Self-voting is rejected
  const selfVote = (await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomA.code,
    playerId: roomA.host.id,
    sessionToken: roomA.host.token,
    targetPlayerId: roomA.host.id,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(!selfVote.success, 'Self-voting is rejected');
  assert(selfVote.code === 'CANNOT_VOTE_FOR_SELF', 'Returns CANNOT_VOTE_FOR_SELF code');

  // Test 8: Non-member cannot vote
  const nonMemberVote = (await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomA.code,
    playerId: 'outsider_intruder',
    sessionToken: 'tampered_token',
    targetPlayerId: roomA.p2.id,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(!nonMemberVote.success, 'Non-member is rejected from voting');
  assert(nonMemberVote.code === 'UNAUTHORIZED', 'Returns UNAUTHORIZED code');

  // Test 9: Invalid session token is rejected
  const invalidSessionVote = (await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomA.code,
    playerId: roomA.host.id,
    sessionToken: 'wrong_session_token',
    targetPlayerId: roomA.p2.id,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(!invalidSessionVote.success, 'Invalid session token is rejected');
  assert(invalidSessionVote.code === 'UNAUTHORIZED', 'Returns UNAUTHORIZED code');

  // Test 6: Player can submit one valid vote
  const validVote1 = (await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomA.code,
    playerId: roomA.host.id,
    sessionToken: roomA.host.token,
    targetPlayerId: roomA.p2.id,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(validVote1.success, 'Host submitted valid vote');

  // Test 10 & 11: Duplicate vote is rejected and vote cannot be changed
  const dupVote = (await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomA.code,
    playerId: roomA.host.id,
    sessionToken: roomA.host.token,
    targetPlayerId: roomA.p3.id, // Trying to change vote to P3
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(!dupVote.success, 'Duplicate vote is rejected');
  assert(dupVote.code === 'DUPLICATE_VOTE', 'Returns DUPLICATE_VOTE code');

  // --- SECTION 3: HIDDEN VOTING PRIVACY & SYNCHRONIZATION (Tests 12, 13, 14, 15, 31, 32) ---
  console.log('\n--- TEST 12, 13, 14, 15, 31, 32: Hidden Voting Privacy & Leak Prevention ---');
  const pubVoteRes = (await RoomManager.handleRequest({
    action: 'GET_VOTING',
    roomCode: roomA.code,
    playerId: roomA.p2.id,
    sessionToken: roomA.p2.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  const pubVote = pubVoteRes.data!.voting;

  // Test 12 & 14: Votes & live counts remain hidden during ACTIVE voting
  assert(pubVote.status === 'ACTIVE', 'Voting is ACTIVE');
  assert(pubVote.result === undefined, 'No result object returned during ACTIVE voting');
  assert((pubVote as unknown as Record<string, unknown>).voteCounts === undefined, 'Vote count breakdown is hidden during ACTIVE voting');

  // Test 13: Individual voter-target mappings are never exposed
  assert((pubVote as unknown as Record<string, unknown>).privateVotes === undefined, 'Private votes array is completely hidden');
  const serialized = JSON.stringify(pubVote);
  assert(!serialized.includes(roomA.p2.id + '":"') && !serialized.includes('targetPlayerId'), 'Zero voter-to-target links leaked');

  // Test 15: Submitted status is synchronized
  assert(pubVote.votedPlayerIds.includes(roomA.host.id), 'Host appears in votedPlayerIds roster');
  assert(!pubVote.votedPlayerIds.includes(roomA.p2.id), 'Player 2 is pending in votedPlayerIds roster');
  assert(pubVote.totalVotesSubmitted === 1, 'Total votes submitted count is synchronized (1)');

  // Test 31: Player refresh restores their own voting status
  const hostRefresh = (await RoomManager.handleRequest({
    action: 'GET_VOTING',
    roomCode: roomA.code,
    playerId: roomA.host.id,
    sessionToken: roomA.host.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(hostRefresh.data!.voting.votedPlayerIds.includes(roomA.host.id), 'Host refresh confirms ballot already sealed');

  // Test 32: No secret role information leaks before results are finalized
  const roomSnap = (await RoomManager.handleRequest({ action: 'GET_ROOM', roomCode: roomA.code })) as ApiResponse<{ room: Room }>;
  const snapStr = JSON.stringify(roomSnap.data!.room);
  assert(!snapStr.includes('secretWord'), 'Secret word is NOT leaked in room snapshot during voting');
  assert(!snapStr.includes('imposterPlayerId'), 'Imposter ID is NOT leaked in room snapshot during voting');

  // --- SECTION 4: VOTING CONCLUSION & OUTCOME RESOLUTION (Tests 16, 17, 18, 19, 20, 28) ---
  console.log('\n--- TEST 16, 17, 18, 19, 20, 28: Voting Conclusion & Outcome Resolution ---');
  // Determine who the Imposter is in Room A by querying internal room
  const { room: internalA } = await RoomStorage.getRoom(roomA.code);
  const actualImposterId = internalA!.currentRound!.imposterPlayerId;
  const isP2Imposter = roomA.p2.id === actualImposterId;

  // Player 2 votes for Player 3
  await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomA.code,
    playerId: roomA.p2.id,
    sessionToken: roomA.p2.token,
    targetPlayerId: roomA.p3.id,
  });

  // Test 16: Voting closes when everyone has voted (3rd vote submitted)
  // Let P3 vote for P2, making P2 have 2 votes (Host and P3)
  const finalVoteA = (await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomA.code,
    playerId: roomA.p3.id,
    sessionToken: roomA.p3.token,
    targetPlayerId: roomA.p2.id,
  })) as ApiResponse<{ voting: PublicVotingState }>;

  assert(finalVoteA.success, 'Player 3 submitted final vote');
  const closedVoteA = finalVoteA.data!.voting;
  assert(closedVoteA.status === 'COMPLETED', 'Voting closed immediately upon final vote submission');
  assert(closedVoteA.result !== undefined, 'Result object populated after voting completed');
  assert(closedVoteA.result!.selectedPlayerId === roomA.p2.id, 'Player 2 selected by majority vote (2 votes)');

  // Test 19 / 20: Correct outcome resolution
  if (isP2Imposter) {
    // Selected Imposter -> AGENTS_WIN
    assert(closedVoteA.result!.resultStatus === 'AGENTS_WIN', 'Correct Imposter identification produces AGENTS_WIN');
    assert(closedVoteA.result!.revealedRole === 'IMPOSTER', 'Revealed role is IMPOSTER');
  } else {
    // Selected innocent Agent -> IMPOSTER_WIN
    assert(closedVoteA.result!.resultStatus === 'IMPOSTER_WIN', 'Wrong identification produces IMPOSTER_WIN');
    assert(closedVoteA.result!.revealedRole === 'AGENT', 'Revealed role is AGENT');
  }

  // Test 28: Public result excludes individual vote mappings
  assert((closedVoteA.result as unknown as Record<string, unknown>).privateVotes === undefined, 'Public result excludes private individual ballots');
  assert(closedVoteA.result!.voteCounts[roomA.p2.id] === 2, 'Vote counts show aggregate totals (2 votes for P2)');

  // Test 18: Late vote submission is rejected
  const lateVote = (await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomA.code,
    playerId: roomA.host.id,
    sessionToken: roomA.host.token,
    targetPlayerId: roomA.p2.id,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(!lateVote.success, 'Late vote submission rejected when voting is closed');

  // Test 17: Voting closes automatically at deadline (simulate deadline expiry)
  const roomC = await setup3PlayerRoom();
  const { room: internalC } = await RoomStorage.getRoom(roomC.code);
  internalC!.currentDiscussion!.status = 'COMPLETED';
  await RoomStorage.saveRoom(internalC!);

  await RoomManager.handleRequest({
    action: 'START_VOTING',
    roomCode: roomC.code,
    playerId: roomC.host.id,
    sessionToken: roomC.host.token,
  });

  // Only 1 player votes, then deadline expires
  await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomC.code,
    playerId: roomC.host.id,
    sessionToken: roomC.host.token,
    targetPlayerId: roomC.p2.id,
  });

  // Force deadline expiry in storage
  const { room: expireRoomC } = await RoomStorage.getRoom(roomC.code);
  expireRoomC!.currentVoting!.endTime = new Date(Date.now() - 5000).toISOString();
  await RoomStorage.saveRoom(expireRoomC!);

  // Trigger auto-closure via GET_VOTING
  const expireCheck = (await RoomManager.handleRequest({
    action: 'GET_VOTING',
    roomCode: roomC.code,
    playerId: roomC.host.id,
    sessionToken: roomC.host.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(expireCheck.data!.voting.status === 'COMPLETED', 'Voting closed automatically at deadline');
  assert(expireCheck.data!.voting.result!.abstentions === 2, 'Non-voting players recorded as abstentions (2)');

  // --- SECTION 5: TIE BREAK SYSTEM & FINAL REVOTE (Tests 21, 22, 23, 24, 25, 26, 27) ---
  console.log('\n--- TEST 21, 22, 23, 24, 25, 26, 27: Tie-Break System & Final Revote ---');
  // Setup room with a 3-way tie (P1 -> P2, P2 -> P3, P3 -> P1)
  const roomD = await setup3PlayerRoom();
  const { room: internalD } = await RoomStorage.getRoom(roomD.code);
  internalD!.currentDiscussion!.status = 'COMPLETED';
  await RoomStorage.saveRoom(internalD!);

  await RoomManager.handleRequest({ action: 'START_VOTING', roomCode: roomD.code, playerId: roomD.host.id, sessionToken: roomD.host.token });

  await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: roomD.code, playerId: roomD.host.id, sessionToken: roomD.host.token, targetPlayerId: roomD.p2.id });
  await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: roomD.code, playerId: roomD.p2.id, sessionToken: roomD.p2.token, targetPlayerId: roomD.p3.id });
  const tieVote = (await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomD.code,
    playerId: roomD.p3.id,
    sessionToken: roomD.p3.token,
    targetPlayerId: roomD.host.id,
  })) as ApiResponse<{ voting: PublicVotingState }>;

  // Test 21: First tie starts 30-second tie discussion
  const tieState = tieVote.data!.voting;
  assert(tieState.status === 'TIE_DISCUSSION', 'First tie initiates TIE_DISCUSSION status');
  assert(tieState.durationSeconds === 30, 'Tie discussion duration is 30 seconds');
  assert(tieState.result!.resultStatus === 'TIE', 'Result status is TIE');
  assert(tieState.result!.tiedPlayerIds.length === 3, 'All 3 suspects identified in tiedPlayerIds');

  // Expire tie discussion to trigger REVOTE
  const { room: storedTie } = await RoomStorage.getRoom(roomD.code);
  storedTie!.currentVoting!.endTime = new Date(Date.now() - 5000).toISOString();
  await RoomStorage.saveRoom(storedTie!);

  const revoteStateRes = (await RoomManager.handleRequest({
    action: 'GET_VOTING',
    roomCode: roomD.code,
    playerId: roomD.host.id,
    sessionToken: roomD.host.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  const revoteState = revoteStateRes.data!.voting;

  // Test 22: Revote restricts targets to tied suspects
  assert(revoteState.status === 'REVOTE', 'Status transitioned to REVOTE');
  assert(revoteState.isRevote === true, 'isRevote flag is true');
  assert(revoteState.eligibleTargetIds.length === 3, 'Targets restricted to tied suspects');

  // Test 23: Self-voting remains prohibited in revote
  const revoteSelf = (await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomD.code,
    playerId: roomD.host.id,
    sessionToken: roomD.host.token,
    targetPlayerId: roomD.host.id,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(!revoteSelf.success, 'Self-voting rejected during revote');
  assert(revoteSelf.code === 'CANNOT_VOTE_FOR_SELF', 'Returns CANNOT_VOTE_FOR_SELF in revote');

  // Produce a second tie in revote (P1 -> P2, P2 -> P3, P3 -> P1)
  await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: roomD.code, playerId: roomD.host.id, sessionToken: roomD.host.token, targetPlayerId: roomD.p2.id });
  await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: roomD.code, playerId: roomD.p2.id, sessionToken: roomD.p2.token, targetPlayerId: roomD.p3.id });
  const revoteSecondTie = (await RoomManager.handleRequest({
    action: 'SUBMIT_VOTE',
    roomCode: roomD.code,
    playerId: roomD.p3.id,
    sessionToken: roomD.p3.token,
    targetPlayerId: roomD.host.id,
  })) as ApiResponse<{ voting: PublicVotingState }>;

  // Test 24: Second tie produces IMPOSTER_WIN
  const secondTieState = revoteSecondTie.data!.voting;
  assert(secondTieState.status === 'COMPLETED', 'Second tie marks voting COMPLETED');
  assert(secondTieState.result!.resultStatus === 'IMPOSTER_WIN', 'Second tie produces IMPOSTER_WIN outcome');
  assert(secondTieState.result!.actualImposterId !== undefined, 'Actual Imposter identity revealed');

  // Test 27: Only one final revote is allowed (cannot start another revote)
  const thirdVoteAttempt = (await RoomManager.handleRequest({
    action: 'START_VOTING',
    roomCode: roomD.code,
    playerId: roomD.host.id,
    sessionToken: roomD.host.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(!thirdVoteAttempt.success, 'No third vote session allowed after completed revote');

  // Test 25 & 26: Zero votes tie-break handling & zero votes in revote produces IMPOSTER_WIN
  const roomE = await setup3PlayerRoom();
  const { room: internalE } = await RoomStorage.getRoom(roomE.code);
  internalE!.currentDiscussion!.status = 'COMPLETED';
  await RoomStorage.saveRoom(internalE!);

  await RoomManager.handleRequest({ action: 'START_VOTING', roomCode: roomE.code, playerId: roomE.host.id, sessionToken: roomE.host.token });

  // Expire voting with 0 votes cast
  const { room: zeroVoteRoom } = await RoomStorage.getRoom(roomE.code);
  zeroVoteRoom!.currentVoting!.endTime = new Date(Date.now() - 5000).toISOString();
  await RoomStorage.saveRoom(zeroVoteRoom!);

  const zeroVoteCheck = (await RoomManager.handleRequest({
    action: 'GET_VOTING',
    roomCode: roomE.code,
    playerId: roomE.host.id,
    sessionToken: roomE.host.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(zeroVoteCheck.data!.voting.status === 'TIE_DISCUSSION', 'Zero votes cast triggers tie-break discussion');

  // Expire tie discussion to enter revote
  const { room: zeroRevoteRoom } = await RoomStorage.getRoom(roomE.code);
  zeroRevoteRoom!.currentVoting!.endTime = new Date(Date.now() - 5000).toISOString();
  await RoomStorage.saveRoom(zeroRevoteRoom!);

  await RoomManager.handleRequest({ action: 'GET_VOTING', roomCode: roomE.code });

  // Expire revote with 0 votes cast
  const { room: zeroRevoteExpire } = await RoomStorage.getRoom(roomE.code);
  zeroRevoteExpire!.currentVoting!.endTime = new Date(Date.now() - 5000).toISOString();
  await RoomStorage.saveRoom(zeroRevoteExpire!);

  const finalZeroRes = (await RoomManager.handleRequest({
    action: 'GET_VOTING',
    roomCode: roomE.code,
    playerId: roomE.host.id,
    sessionToken: roomE.host.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(finalZeroRes.data!.voting.status === 'COMPLETED', 'Revote with zero votes concludes');
  assert(finalZeroRes.data!.voting.result!.resultStatus === 'IMPOSTER_WIN', 'Zero votes in final revote produces IMPOSTER_WIN');

  // --- SECTION 6: CONCURRENCY & ACCESS CONTROL (Tests 29, 30) ---
  console.log('\n--- TEST 29, 30: Concurrency & Access Control ---');
  // Test 30: Unauthorized users cannot close voting
  const unauthClose = (await RoomManager.handleRequest({
    action: 'CLOSE_VOTING',
    roomCode: roomA.code,
    playerId: roomA.p2.id,
    sessionToken: roomA.p2.token,
  })) as ApiResponse<{ voting: PublicVotingState }>;
  assert(!unauthClose.success, 'Non-host cannot close voting');
  assert(unauthClose.code === 'HOST_ONLY', 'Returns HOST_ONLY code');

  // Test 29: Concurrent submissions cannot overwrite existing votes
  const roomF = await setup3PlayerRoom();
  const { room: internalF } = await RoomStorage.getRoom(roomF.code);
  internalF!.currentDiscussion!.status = 'COMPLETED';
  await RoomStorage.saveRoom(internalF!);
  await RoomManager.handleRequest({ action: 'START_VOTING', roomCode: roomF.code, playerId: roomF.host.id, sessionToken: roomF.host.token });

  // Parallel vote submissions
  const [voteP1, voteP2] = await Promise.all([
    RoomManager.handleRequest({
      action: 'SUBMIT_VOTE',
      roomCode: roomF.code,
      playerId: roomF.host.id,
      sessionToken: roomF.host.token,
      targetPlayerId: roomF.p2.id,
    }),
    RoomManager.handleRequest({
      action: 'SUBMIT_VOTE',
      roomCode: roomF.code,
      playerId: roomF.p2.id,
      sessionToken: roomF.p2.token,
      targetPlayerId: roomF.host.id,
    }),
  ]);

  const p1Success = (voteP1 as ApiResponse<{ voting: PublicVotingState }>).success;
  const p2Success = (voteP2 as ApiResponse<{ voting: PublicVotingState }>).success;
  assert(p1Success && p2Success, 'Concurrent vote submissions both succeed without data loss');

  const { room: finalF } = await RoomStorage.getRoom(roomF.code);
  assert(finalF!.currentVoting!.totalVotesSubmitted === 2, 'Storage records exactly 2 submitted votes');
  assert(finalF!.currentVoting!.privateVotes.length === 2, 'Private votes store preserves both ballots');

  console.log('\n=============================================');
  console.log(` ALL ${passed}/${total} PHASE 7 VERIFICATION TESTS PASSED! `);
  console.log('=============================================\n');
}

runPhase7Tests().catch((err) => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});
