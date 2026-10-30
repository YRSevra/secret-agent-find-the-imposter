/**
 * Phase 11/12 Verification Test Suite
 * Full End-to-End Testing, Cross-Device Polish & Production Readiness
 */

import { RoomManager } from './roomManager';
import { RoomStorage } from './storage';
import {
  RoomSessionResult,
  MatchState,
  RematchState,
  ArchivedMatch,
  FinalMatchResults,
  RoleRevealData,
  PublicVotingState,
  DiscussionState,
  ApiResponse,
} from '../types/game';

async function runPhase11Tests() {
  console.log('\n================================================================');
  console.log(' SECRET AGENT PHASE 11/12 VERIFICATION TEST SUITE               ');
  console.log(' Full End-to-End Testing, Cross-Device Polish & Security Audit  ');
  console.log('================================================================\n');

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

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: FULL 3-PLAYER, 3-ROUND REALISTIC MULTIPLAYER MATCH
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: ROOM CREATION & MULTI-DEVICE SIMULATION ---');

    // 1. Client A creates private room
    const hostRes = (await RoomManager.handleRequest({
      action: 'CREATE_ROOM',
      displayName: 'COMMANDER_BOND',
      avatarId: 'falcon',
      gameMode: 'classic',
    })) as ApiResponse<RoomSessionResult>;
    assert(hostRes.success === true && !!hostRes.data, 'Host successfully created private room');

    const code = hostRes.data!.room.roomCode;
    const clientA = {
      id: hostRes.data!.player.playerId,
      token: hostRes.data!.sessionToken,
      name: 'COMMANDER_BOND',
      isHost: true,
    };

    assert(code.length === 6, 'Generated room code is exactly 6 characters');
    assert(/^[A-Z0-9]+$/.test(code), 'Room code contains only valid uppercase alphanumeric chars');

    // 2. Client B joins using code
    const clientBRes = (await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: code,
      displayName: 'AGENT_SCARLET',
      avatarId: 'viper',
    })) as ApiResponse<RoomSessionResult>;
    assert(clientBRes.success === true && !!clientBRes.data, 'Client B joined private room');
    const clientB = {
      id: clientBRes.data!.player.playerId,
      token: clientBRes.data!.sessionToken,
      name: 'AGENT_SCARLET',
      isHost: false,
    };

    // 3. Client C joins using code
    const clientCRes = (await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: code,
      displayName: 'CIPHER_NINE',
      avatarId: 'cipher',
    })) as ApiResponse<RoomSessionResult>;
    assert(clientCRes.success === true && !!clientCRes.data, 'Client C joined private room');
    const clientC = {
      id: clientCRes.data!.player.playerId,
      token: clientCRes.data!.sessionToken,
      name: 'CIPHER_NINE',
      isHost: false,
    };

    assert(clientA.token !== clientB.token && clientB.token !== clientC.token, 'Independent session tokens generated');

    // 4. Lobby Readiness Synchronization
    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: clientA.id, sessionToken: clientA.token, isReady: true });
    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: clientB.id, sessionToken: clientB.token, isReady: true });
    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: clientC.id, sessionToken: clientC.token, isReady: true });

    const lobbyRoomRes = (await RoomManager.handleRequest({ action: 'GET_ROOM', roomCode: code })) as ApiResponse<{ room: ReturnType<typeof Object> }>;
    assert(lobbyRoomRes.success === true, 'Waiting lobby room state retrieved');

    // 5. Host Starts Mission
    console.log('\n--- SCENARIO 2: MISSION START & PRIVATE ROLE VERIFICATION ---');
    const startRes = (await RoomManager.handleRequest({
      action: 'START_GAME',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ room: { status: string } }>;
    assert(startRes.success === true && startRes.data!.room.status === 'ROLE_REVEAL', 'Mission successfully launched into ROLE_REVEAL');

    // 6. Security Audit: Private Role Distribution
    const roleARes = (await RoomManager.handleRequest({ action: 'GET_MY_ROLE', roomCode: code, playerId: clientA.id, sessionToken: clientA.token })) as ApiResponse<RoleRevealData>;
    const roleBRes = (await RoomManager.handleRequest({ action: 'GET_MY_ROLE', roomCode: code, playerId: clientB.id, sessionToken: clientB.token })) as ApiResponse<RoleRevealData>;
    const roleCRes = (await RoomManager.handleRequest({ action: 'GET_MY_ROLE', roomCode: code, playerId: clientC.id, sessionToken: clientC.token })) as ApiResponse<RoleRevealData>;

    const roles = [roleARes.data!, roleBRes.data!, roleCRes.data!];
    const imposterRole = roles.find((r) => r.role === 'IMPOSTER');
    const agentRoles = roles.filter((r) => r.role === 'AGENT');

    assert(imposterRole !== undefined, 'Exactly 1 Imposter role assigned');
    assert(agentRoles.length === 2, 'Exactly 2 Agent roles assigned');
    assert(imposterRole!.secretWord === null, 'CRITICAL: Imposter secretWord is strictly NULL');
    assert(agentRoles[0].secretWord !== null && agentRoles[0].secretWord === agentRoles[1].secretWord, 'All Agents share the exact same secret word');

    // Security: Unauthenticated operative cannot read roles
    const unauthRoleRes = (await RoomManager.handleRequest({ action: 'GET_MY_ROLE', roomCode: code, playerId: clientA.id, sessionToken: 'spoofed_token' })) as ApiResponse<unknown>;
    assert(unauthRoleRes.success === false && unauthRoleRes.code === 'UNAUTHORIZED', 'Spoofed session token rejected from role reveal');

    // 7. ROUND 1: Interrogation & Discussion Arena
    console.log('\n--- SCENARIO 3: ROUND 1 DISCUSSION, CHAT & VOTING ---');
    const startDiscRes = (await RoomManager.handleRequest({
      action: 'START_DISCUSSION',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ discussion: DiscussionState }>;
    assert(startDiscRes.success === true && startDiscRes.data!.discussion.status === 'ACTIVE', 'Discussion arena successfully activated');

    // Interrogation: Turn 1 (Question & Answer)
    const activeQ1 = startDiscRes.data!.discussion.activePlayerId;
    const targetA1 = [clientA.id, clientB.id, clientC.id].find((id) => id !== activeQ1)!;
    const tokenQ1 = [clientA, clientB, clientC].find((c) => c.id === activeQ1)!.token;
    const tokenA1 = [clientA, clientB, clientC].find((c) => c.id === targetA1)!.token;

    const q1Res = (await RoomManager.handleRequest({
      action: 'SUBMIT_QUESTION',
      roomCode: code,
      playerId: activeQ1,
      sessionToken: tokenQ1,
      questionText: 'What is the security classification level of our destination?',
      targetPlayerId: targetA1,
    })) as ApiResponse<{ discussion: DiscussionState }>;
    assert(q1Res.success === true && q1Res.data!.discussion.currentPhase === 'ANSWERING', 'Interrogation question 1 recorded, phase is ANSWERING');

    const ans1Res = (await RoomManager.handleRequest({
      action: 'SUBMIT_ANSWER',
      roomCode: code,
      playerId: targetA1,
      sessionToken: tokenA1,
      answerText: 'Top Secret Level 5 facility.',
    })) as ApiResponse<{ discussion: DiscussionState }>;
    assert(ans1Res.success === true, 'Interrogation answer 1 recorded');

    // Live Secure Chat Message during active discussion
    const chatRes = (await RoomManager.handleRequest({
      action: 'SEND_CHAT_MESSAGE',
      roomCode: code,
      playerId: clientB.id,
      sessionToken: clientB.token,
      text: 'Their response appears consistent with the operational brief.',
    })) as ApiResponse<{ discussion: DiscussionState }>;
    assert(chatRes.success === true && chatRes.data!.discussion.messages.length >= 1, 'Encrypted chat message synchronized');

    // Security check: Voting cannot initialize while discussion turns remain
    const prematureVoteRes = (await RoomManager.handleRequest({
      action: 'START_VOTING',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<unknown>;
    assert(prematureVoteRes.success === false && prematureVoteRes.code === 'DISCUSSION_STILL_ACTIVE', 'Premature voting rejected during active interrogation turns');

    // Turn 2
    const activeQ2 = ans1Res.data!.discussion.activePlayerId;
    const targetA2 = [clientA.id, clientB.id, clientC.id].find((id) => id !== activeQ2)!;
    const tokenQ2 = [clientA, clientB, clientC].find((c) => c.id === activeQ2)!.token;
    const tokenA2 = [clientA, clientB, clientC].find((c) => c.id === targetA2)!.token;

    await RoomManager.handleRequest({
      action: 'SUBMIT_QUESTION',
      roomCode: code,
      playerId: activeQ2,
      sessionToken: tokenQ2,
      questionText: 'Can you confirm what equipment was issued at debrief?',
      targetPlayerId: targetA2,
    });
    const ans2Res = (await RoomManager.handleRequest({
      action: 'SUBMIT_ANSWER',
      roomCode: code,
      playerId: targetA2,
      sessionToken: tokenA2,
      answerText: 'Thermal cloaking and encrypted signal transmitters.',
    })) as ApiResponse<{ discussion: DiscussionState }>;

    // Turn 3 (Final turn to complete discussion)
    const activeQ3 = ans2Res.data!.discussion.activePlayerId;
    const targetA3 = [clientA.id, clientB.id, clientC.id].find((id) => id !== activeQ3)!;
    const tokenQ3 = [clientA, clientB, clientC].find((c) => c.id === activeQ3)!.token;
    const tokenA3 = [clientA, clientB, clientC].find((c) => c.id === targetA3)!.token;

    await RoomManager.handleRequest({
      action: 'SUBMIT_QUESTION',
      roomCode: code,
      playerId: activeQ3,
      sessionToken: tokenQ3,
      questionText: 'Who authorized your mission pass?',
      targetPlayerId: targetA3,
    });
    const ans3Res = (await RoomManager.handleRequest({
      action: 'SUBMIT_ANSWER',
      roomCode: code,
      playerId: targetA3,
      sessionToken: tokenA3,
      answerText: 'Director of Central Intelligence.',
    })) as ApiResponse<{ discussion: DiscussionState }>;
    assert(ans3Res.data!.discussion.status === 'COMPLETED', 'All turns completed: discussion status transitioned to COMPLETED');

    // 8. ROUND 1: Voting Phase
    const startVoteRes = (await RoomManager.handleRequest({
      action: 'START_VOTING',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ voting: PublicVotingState }>;
    assert(startVoteRes.success === true && startVoteRes.data!.voting.status === 'ACTIVE', 'Voting arena activated');

    // Find who was imposter in round 1
    const { room: r1InternalRoom } = await RoomStorage.getRoom(code);
    const r1ImposterId = r1InternalRoom!.currentRound!.imposterPlayerId;
    const r1Agents = [clientA, clientB, clientC].filter((c) => c.id !== r1ImposterId);
    const r1ImposterClient = [clientA, clientB, clientC].find((c) => c.id === r1ImposterId)!;

    // Security: Self-voting prohibition
    const selfVoteRes = (await RoomManager.handleRequest({
      action: 'SUBMIT_VOTE',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
      targetPlayerId: clientA.id,
    })) as ApiResponse<unknown>;
    assert(selfVoteRes.success === false && selfVoteRes.code === 'CANNOT_VOTE_FOR_SELF', 'Self-voting strictly prohibited');

    // Agents correctly vote for the Imposter
    for (const agent of r1Agents) {
      await RoomManager.handleRequest({
        action: 'SUBMIT_VOTE',
        roomCode: code,
        playerId: agent.id,
        sessionToken: agent.token,
        targetPlayerId: r1ImposterId,
      });
    }
    // Imposter votes for an agent
    await RoomManager.handleRequest({
      action: 'SUBMIT_VOTE',
      roomCode: code,
      playerId: r1ImposterClient.id,
      sessionToken: r1ImposterClient.token,
      targetPlayerId: r1Agents[0].id,
    });

    // Security: Public voting state does NOT expose private ballots
    const publicVotingRes = (await RoomManager.handleRequest({
      action: 'GET_VOTING',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ voting: PublicVotingState & { privateVotes?: unknown } }>;
    assert(publicVotingRes.data!.voting.privateVotes === undefined, 'Public voting state never exposes privateVotes');

    // Close voting
    const closeVoteRes = (await RoomManager.handleRequest({
      action: 'CLOSE_VOTING',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ voting: PublicVotingState }>;
    assert(closeVoteRes.data!.voting.result?.resultStatus === 'AGENTS_WIN', 'Round 1 outcome is AGENTS_WIN');

    // Apply Round 1 Scoring (+1 to Agents, 0 to Imposter)
    const score1Res = (await RoomManager.handleRequest({
      action: 'APPLY_ROUND_SCORING',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ match: MatchState }>;
    assert(score1Res.success === true, 'Round 1 scoring applied idempotently');
    for (const agent of r1Agents) {
      assert(score1Res.data!.match.cumulativeScores[agent.id] === 1, `Agent ${agent.name} awarded +1 point`);
    }
    assert(score1Res.data!.match.cumulativeScores[r1ImposterId] === 0, 'Imposter awarded 0 points in defeat');

    // -------------------------------------------------------------------------
    // SCENARIO 4: ROUND 2 WITH TIE DELIBERATION & SECOND TIE RULE (+2 IMPOSTER)
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: ROUND 2 WITH TIE-BREAK & SECOND TIE RULE ---');
    await RoomManager.handleRequest({
      action: 'START_NEXT_ROUND',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    });

    const { room: r2InternalRoom } = await RoomStorage.getRoom(code);
    assert(r2InternalRoom!.currentRound!.roundNumber === 2, 'Round 2 successfully initialized');
    const r2ImposterId = r2InternalRoom!.currentRound!.imposterPlayerId;
    const r2Agents = [clientA, clientB, clientC].filter((c) => c.id !== r2ImposterId);
    const r2ImposterClient = [clientA, clientB, clientC].find((c) => c.id === r2ImposterId)!;

    // Start voting for Round 2
    await RoomManager.handleRequest({ action: 'START_VOTING', roomCode: code, playerId: clientA.id, sessionToken: clientA.token });

    // Simulate 3-way tie (each votes for someone different)
    await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: code, playerId: r2Agents[0].id, sessionToken: r2Agents[0].token, targetPlayerId: r2Agents[1].id });
    await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: code, playerId: r2Agents[1].id, sessionToken: r2Agents[1].token, targetPlayerId: r2ImposterId });
    await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: code, playerId: r2ImposterClient.id, sessionToken: r2ImposterClient.token, targetPlayerId: r2Agents[0].id });

    // Close vote -> First Tie triggers TIE_DISCUSSION
    const tie1Res = (await RoomManager.handleRequest({
      action: 'CLOSE_VOTING',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ voting: PublicVotingState }>;
    assert(tie1Res.data!.voting.status === 'TIE_DISCUSSION', 'First tie triggers TIE_DISCUSSION');

    // Expire tie discussion to enter REVOTE
    const { room: tieRoom } = await RoomStorage.getRoom(code);
    tieRoom!.currentVoting!.endTime = new Date(Date.now() - 1000).toISOString();
    await RoomStorage.saveRoom(tieRoom!);
    const revoteStateRes = (await RoomManager.handleRequest({
      action: 'GET_VOTING',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ voting: PublicVotingState }>;
    assert(revoteStateRes.data!.voting.status === 'REVOTE', 'Tie discussion expiration triggered REVOTE arena');

    // Revote with 2nd tie (1-1-1 vote distribution)
    await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: code, playerId: r2Agents[0].id, sessionToken: r2Agents[0].token, targetPlayerId: r2Agents[1].id });
    await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: code, playerId: r2Agents[1].id, sessionToken: r2Agents[1].token, targetPlayerId: r2ImposterId });
    await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: code, playerId: r2ImposterClient.id, sessionToken: r2ImposterClient.token, targetPlayerId: r2Agents[0].id });

    // Second tie results in IMPOSTER_WIN
    const tie2Res = (await RoomManager.handleRequest({
      action: 'CLOSE_VOTING',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ voting: PublicVotingState }>;
    assert(tie2Res.data!.voting.result?.resultStatus === 'IMPOSTER_WIN', 'Second tie results in IMPOSTER_WIN per official game rules');

    // Apply Round 2 Scoring (+2 to Imposter, 0 to Agents)
    const score2Res = (await RoomManager.handleRequest({
      action: 'APPLY_ROUND_SCORING',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ match: MatchState }>;
    assert(score2Res.data!.match.cumulativeScores[r2ImposterId] >= 2, 'Imposter receives +2 points from evasive victory');

    // -------------------------------------------------------------------------
    // SCENARIO 5: ROUND 3 & FINAL LEADERBOARD
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 5: ROUND 3 & FINAL MATCH LEADERBOARD ---');
    await RoomManager.handleRequest({ action: 'START_NEXT_ROUND', roomCode: code, playerId: clientA.id, sessionToken: clientA.token });
    const { room: r3InternalRoom } = await RoomStorage.getRoom(code);
    assert(r3InternalRoom!.currentRound!.roundNumber === 3, 'Round 3 initialized');
    const r3ImposterId = r3InternalRoom!.currentRound!.imposterPlayerId;
    const r3Agents = [clientA, clientB, clientC].filter((c) => c.id !== r3ImposterId);
    const r3ImposterClient = [clientA, clientB, clientC].find((c) => c.id === r3ImposterId)!;

    await RoomManager.handleRequest({ action: 'START_VOTING', roomCode: code, playerId: clientA.id, sessionToken: clientA.token });
    for (const a of r3Agents) {
      await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: code, playerId: a.id, sessionToken: a.token, targetPlayerId: r3ImposterId });
    }
    await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: code, playerId: r3ImposterClient.id, sessionToken: r3ImposterClient.token, targetPlayerId: r3Agents[0].id });
    await RoomManager.handleRequest({ action: 'CLOSE_VOTING', roomCode: code, playerId: clientA.id, sessionToken: clientA.token });
    await RoomManager.handleRequest({ action: 'APPLY_ROUND_SCORING', roomCode: code, playerId: clientA.id, sessionToken: clientA.token });

    // Retrieve Final Results
    const finalResultsRes = (await RoomManager.handleRequest({
      action: 'GET_FINAL_RESULTS',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ finalResults: FinalMatchResults }>;
    assert(finalResultsRes.success === true, 'Final match results dossier generated');
    const results = finalResultsRes.data!.finalResults;
    assert(results.leaderboard.length === 3, 'All 3 operatives present in final leaderboard');
    assert(results.champions.length >= 1, 'Overall Champion(s) declared');
    assert(results.roundHistory.length === 3, 'Full 3-round history preserved');

    // -------------------------------------------------------------------------
    // SCENARIO 6: COMPLETE REMATCH & ARCHIVE LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 6: REMATCH WORKFLOW & MATCH ARCHIVING ---');
    const rematchReqRes = (await RoomManager.handleRequest({
      action: 'REQUEST_REMATCH',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ room: ReturnType<typeof Object>; rematch: RematchState }>;
    assert(rematchReqRes.success === true, 'Host initiated rematch request');

    // Clients confirm readiness
    await RoomManager.handleRequest({ action: 'RESPOND_REMATCH', roomCode: code, playerId: clientB.id, sessionToken: clientB.token, response: 'READY' });
    const p3Ready = (await RoomManager.handleRequest({
      action: 'RESPOND_REMATCH',
      roomCode: code,
      playerId: clientC.id,
      sessionToken: clientC.token,
      response: 'READY',
    })) as ApiResponse<{ roomStatus: string }>;
    assert(p3Ready.data!.roomStatus === 'REMATCH_READY', 'All operatives ready, status is REMATCH_READY');

    // Start rematch
    const launchRematchRes = (await RoomManager.handleRequest({
      action: 'START_REMATCH',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ match: MatchState }>;
    assert(launchRematchRes.success === true, 'Rematch launched successfully');
    assert(launchRematchRes.data!.match.matchId !== results.matchId, 'New match receives brand-new matchId');
    assert(launchRematchRes.data!.match.currentRoundNumber === 1, 'Match 2 resets to Round 1');

    // Check archive
    const archiveRes = (await RoomManager.handleRequest({
      action: 'GET_MATCH_ARCHIVE',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
    })) as ApiResponse<{ archive: ArchivedMatch[] }>;
    assert(archiveRes.data!.archive.length === 1, 'Historical Match 1 archived permanently');
    assert(archiveRes.data!.archive[0].matchId === results.matchId, 'Archived matchId matches completed Match 1');

    // -------------------------------------------------------------------------
    // SCENARIO 7: HOST TRANSFER & SAFE DEPARTURE
    // -------------------------------------------------------------------------
    console.log('\n--- SCENARIO 7: HOST TRANSFER & SAFE DEPARTURE ---');
    // Manual host transfer
    const transferRes = (await RoomManager.handleRequest({
      action: 'TRANSFER_HOST',
      roomCode: code,
      playerId: clientA.id,
      sessionToken: clientA.token,
      targetPlayerId: clientB.id,
    })) as ApiResponse<{ room: { hostPlayerId: string } }>;
    assert(transferRes.success === true && transferRes.data!.room.hostPlayerId === clientB.id, 'Host leadership transferred to Client B');

    // Automatic transfer on leave
    const leaveRes = (await RoomManager.handleRequest({
      action: 'LEAVE_ROOM',
      roomCode: code,
      playerId: clientB.id,
      sessionToken: clientB.token,
    })) as ApiResponse<{ success: boolean }>;
    assert(leaveRes.success === true, 'Active host successfully departed room');

    const { room: postLeaveRoom } = await RoomStorage.getRoom(code);
    assert(postLeaveRoom!.hostPlayerId === clientA.id || postLeaveRoom!.hostPlayerId === clientC.id, 'Remaining operative automatically promoted to host');

    console.log(`\n================================================================`);
    console.log(` PHASE 11 VERIFICATION SUMMARY: ${passed}/${total} TESTS PASSED `);
    console.log(`================================================================\n`);
  } catch (err) {
    console.error('Phase 11 Test Execution Error:', err);
    process.exitCode = 1;
  }
}

runPhase11Tests();
