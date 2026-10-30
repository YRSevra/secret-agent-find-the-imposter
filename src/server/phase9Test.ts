/**
 * Phase 9/12 Verification Test Suite
 * Final Match Leaderboard, Overall Champion & Match Celebration
 */

import { RoomManager } from './roomManager';
import { RoomStorage } from './storage';
import {
  RoomSessionResult,
  FinalMatchResults,
  PlayerStatistic,
  RoundResult,
  ApiResponse,
} from '../types/game';

async function runPhase9Tests() {
  console.log('\n======================================================');
  console.log(' SECRET AGENT PHASE 9/12 VERIFICATION TEST SUITE     ');
  console.log(' Final Match Leaderboard, Champion & Awards Engine    ');
  console.log('======================================================\n');

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

  // --- HELPER: Setup 3-player classic room ---
  async function setup3PlayerRoom() {
    const hostRes = (await RoomManager.handleRequest({
      action: 'CREATE_ROOM',
      displayName: 'ALPHA_HOST',
      avatarId: 'falcon',
      gameMode: 'classic',
    })) as ApiResponse<RoomSessionResult>;
    const code = hostRes.data!.room.roomCode;
    const hToken = hostRes.data!.sessionToken;
    const hId = hostRes.data!.player.playerId;

    const p2Res = (await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: code,
      displayName: 'BRAVO_VIPER',
      avatarId: 'viper',
    })) as ApiResponse<RoomSessionResult>;
    const p2Token = p2Res.data!.sessionToken;
    const p2Id = p2Res.data!.player.playerId;

    const p3Res = (await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: code,
      displayName: 'CHARLIE_GHOST',
      avatarId: 'ghost',
    })) as ApiResponse<RoomSessionResult>;
    const p3Token = p3Res.data!.sessionToken;
    const p3Id = p3Res.data!.player.playerId;

    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: hId, sessionToken: hToken, isReady: true });
    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: p2Id, sessionToken: p2Token, isReady: true });
    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: p3Id, sessionToken: p3Token, isReady: true });

    return {
      code,
      players: [
        { id: hId, token: hToken, name: 'ALPHA_HOST', isHost: true },
        { id: p2Id, token: p2Token, name: 'BRAVO_VIPER', isHost: false },
        { id: p3Id, token: p3Token, name: 'CHARLIE_GHOST', isHost: false },
      ],
    };
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Rejection on Non-Existent Room Code
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Room Validation & Authentication Security ---');
    const fakeRes = (await RoomManager.handleRequest({
      action: 'GET_FINAL_RESULTS',
      roomCode: 'NONEX9',
      playerId: 'any_id',
      sessionToken: 'any_token',
    })) as ApiResponse<unknown>;
    assert(fakeRes.success === false && fakeRes.code === 'ROOM_NOT_FOUND', 'Rejects non-existent room code');

    // -------------------------------------------------------------------------
    // TEST 2: Incomplete Match Rejection (Round 0 / Waiting Lobby)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Incomplete Match Gatekeeping ---');
    const fixture = await setup3PlayerRoom();
    const prematureRes = (await RoomManager.handleRequest({
      action: 'GET_FINAL_RESULTS',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    })) as ApiResponse<unknown>;
    assert(prematureRes.success === false && prematureRes.code === 'MATCH_NOT_FOUND', 'Rejects final results before match is initialized');

    // Start game to initialize match
    await RoomManager.handleRequest({
      action: 'START_GAME',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    const round1Res = (await RoomManager.handleRequest({
      action: 'GET_FINAL_RESULTS',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    })) as ApiResponse<unknown>;
    assert(round1Res.success === false && round1Res.code === 'MATCH_INCOMPLETE', 'Rejects final results during Round 1 (0 of 3 rounds completed)');

    // -------------------------------------------------------------------------
    // TEST 3: Unauthorized Credential Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Unauthorized Session Credential Rejection ---');
    const unauthRes = (await RoomManager.handleRequest({
      action: 'GET_FINAL_RESULTS',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: 'corrupted_token_xxx',
    })) as ApiResponse<unknown>;
    assert(unauthRes.success === false && unauthRes.code === 'UNAUTHORIZED', 'Rejects spoofed session credentials');

    // -------------------------------------------------------------------------
    // SIMULATE 3 ROUNDS TO TEST COMPLETE LEADERBOARD & AWARDS
    // -------------------------------------------------------------------------
    console.log('\n--- EXECUTING 3-ROUND MATCH FLOW ---');

    // ROUND 1: Agents eliminate Imposter -> Agents Win (+1 to agents, 0 to imposter)
    const { room: r1Room } = await RoomStorage.getRoom(fixture.code);
    const r1Imposter = r1Room!.currentRound!.imposterPlayerId;
    const r1Agents = fixture.players.filter((p) => p.id !== r1Imposter);

    await RoomManager.handleRequest({
      action: 'START_VOTING',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    // Agents vote for imposter
    for (const a of r1Agents) {
      await RoomManager.handleRequest({
        action: 'SUBMIT_VOTE',
        roomCode: fixture.code,
        playerId: a.id,
        sessionToken: a.token,
        targetPlayerId: r1Imposter,
      });
    }
    // Imposter votes for an agent
    await RoomManager.handleRequest({
      action: 'SUBMIT_VOTE',
      roomCode: fixture.code,
      playerId: r1Imposter,
      sessionToken: fixture.players.find((p) => p.id === r1Imposter)!.token,
      targetPlayerId: r1Agents[0].id,
    });

    await RoomManager.handleRequest({
      action: 'CLOSE_VOTING',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    // Apply scoring for Round 1
    await RoomManager.handleRequest({
      action: 'APPLY_ROUND_SCORING',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    // Verify final results still rejected after round 1
    const r1Premature = (await RoomManager.handleRequest({
      action: 'GET_FINAL_RESULTS',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    })) as ApiResponse<unknown>;
    assert(r1Premature.success === false && r1Premature.code === 'MATCH_INCOMPLETE', 'Rejects final results after Round 1 (1 of 3 complete)');

    // ADVANCE TO ROUND 2
    await RoomManager.handleRequest({
      action: 'START_NEXT_ROUND',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    // ROUND 2: Imposter evades capture -> Imposter Win (+2 to imposter, 0 to agents)
    const { room: r2Room } = await RoomStorage.getRoom(fixture.code);
    const r2Imposter = r2Room!.currentRound!.imposterPlayerId;
    const r2Agents = fixture.players.filter((p) => p.id !== r2Imposter);

    await RoomManager.handleRequest({
      action: 'START_VOTING',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    // Agents mistakenly vote for innocent agent r2Agents[0]
    for (const a of r2Agents) {
      await RoomManager.handleRequest({
        action: 'SUBMIT_VOTE',
        roomCode: fixture.code,
        playerId: a.id,
        sessionToken: a.token,
        targetPlayerId: r2Agents[0].id === a.id ? r2Agents[1].id : r2Agents[0].id,
      });
    }
    await RoomManager.handleRequest({
      action: 'SUBMIT_VOTE',
      roomCode: fixture.code,
      playerId: r2Imposter,
      sessionToken: fixture.players.find((p) => p.id === r2Imposter)!.token,
      targetPlayerId: r2Agents[0].id,
    });

    await RoomManager.handleRequest({
      action: 'CLOSE_VOTING',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    await RoomManager.handleRequest({
      action: 'APPLY_ROUND_SCORING',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    // ADVANCE TO ROUND 3
    await RoomManager.handleRequest({
      action: 'START_NEXT_ROUND',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    // ROUND 3: Agents eliminate Imposter -> Agents Win (+1 to agents, 0 to imposter)
    const { room: r3Room } = await RoomStorage.getRoom(fixture.code);
    const r3Imposter = r3Room!.currentRound!.imposterPlayerId;
    const r3Agents = fixture.players.filter((p) => p.id !== r3Imposter);

    await RoomManager.handleRequest({
      action: 'START_VOTING',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    for (const a of r3Agents) {
      await RoomManager.handleRequest({
        action: 'SUBMIT_VOTE',
        roomCode: fixture.code,
        playerId: a.id,
        sessionToken: a.token,
        targetPlayerId: r3Imposter,
      });
    }
    await RoomManager.handleRequest({
      action: 'SUBMIT_VOTE',
      roomCode: fixture.code,
      playerId: r3Imposter,
      sessionToken: fixture.players.find((p) => p.id === r3Imposter)!.token,
      targetPlayerId: r3Agents[0].id,
    });

    await RoomManager.handleRequest({
      action: 'CLOSE_VOTING',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    await RoomManager.handleRequest({
      action: 'APPLY_ROUND_SCORING',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    // -------------------------------------------------------------------------
    // TEST 4: GET_FINAL_RESULTS Success after Round 3
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Successful Final Match Results Retrieval ---');
    const finalRes = (await RoomManager.handleRequest({
      action: 'GET_FINAL_RESULTS',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    })) as ApiResponse<{ finalResults: FinalMatchResults }>;

    assert(finalRes.success === true && !!finalRes.data?.finalResults, 'Final results successfully calculated and returned');
    const results = finalRes.data!.finalResults;

    // -------------------------------------------------------------------------
    // TEST 5: Leaderboard Completeness & Player Inclusion
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Complete Leaderboard Player Inclusion ---');
    assert(results.leaderboard.length === 3, 'All 3 room operatives are present in final leaderboard');
    const allPlayerIds = fixture.players.map((p) => p.id);
    for (const pid of allPlayerIds) {
      assert(results.leaderboard.some((entry) => entry.playerId === pid), `Player ${pid} included in leaderboard`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Ranking Integrity & Descending Score Sort
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Ranking Integrity & Descending Score Sort ---');
    for (let i = 0; i < results.leaderboard.length - 1; i++) {
      assert(
        results.leaderboard[i].totalScore >= results.leaderboard[i + 1].totalScore,
        `Score ordering: Rank ${results.leaderboard[i].rank} (${results.leaderboard[i].totalScore} pts) >= Rank ${results.leaderboard[i + 1].rank} (${results.leaderboard[i + 1].totalScore} pts)`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 7: Round Score Sum Consistency
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Round Score Sum Consistency ---');
    for (const entry of results.leaderboard) {
      const sum = (entry.roundScores[1] || 0) + (entry.roundScores[2] || 0) + (entry.roundScores[3] || 0);
      assert(sum === entry.totalScore, `Player ${entry.displayName}: Round sum (${sum}) equals totalScore (${entry.totalScore})`);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Overall Champion & Tie Handling
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Champion Identification & Tie Rules ---');
    assert(results.champions.length >= 1, 'At least 1 champion identified');
    for (const champ of results.champions) {
      assert(champ.rank === 1 && champ.isChampion === true, `Champion ${champ.displayName} has rank 1 and isChampion=true`);
    }
    if (results.champions.length > 1) {
      assert(results.isTie === true, 'isTie is true when multiple champions share 1st place');
    } else {
      assert(results.isTie === false, 'isTie is false for singular champion');
    }

    // -------------------------------------------------------------------------
    // TEST 9: Derived Player Statistics Accuracy
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Derived Statistics Verification ---');
    for (const pid of allPlayerIds) {
      const stat = results.statistics[pid];
      assert(!!stat, `Statistics generated for player ${pid}`);
      assert(stat.totalPoints === results.leaderboard.find((l) => l.playerId === pid)!.totalScore, 'Stat totalPoints matches leaderboard');
      assert(stat.agentWins >= 0 && stat.imposterWins >= 0, 'Win counts are non-negative integers');
      assert(stat.timesSuspected >= 0, 'timesSuspected is non-negative');
    }

    // -------------------------------------------------------------------------
    // TEST 10: Special Awards Verification
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Special Awards Verification ---');
    assert(Array.isArray(results.specialAwards), 'specialAwards returned as array');
    for (const award of results.specialAwards) {
      assert(award.winnerPlayerIds.length > 0, `Award ${award.id} has winners`);
      assert(award.metricValue > 0, `Award ${award.id} metric value is strictly positive (>0)`);
      assert(typeof award.title === 'string' && award.title.length > 0, `Award ${award.id} has valid title`);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Match History Integration
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11: Match History Verification ---');
    assert(results.roundHistory.length === 3, 'Round history contains exactly 3 rounds');
    for (let r = 1; r <= 3; r++) {
      const rh = results.roundHistory.find((item) => item.roundNumber === r);
      assert(!!rh, `Round ${r} present in history`);
      assert(typeof rh!.secretWord === 'string' && rh!.secretWord.length > 0, `Round ${r} secret word revealed`);
      assert(typeof rh!.imposterPlayerId === 'string' && rh!.imposterPlayerId.length > 0, `Round ${r} imposter revealed`);
    }

    // -------------------------------------------------------------------------
    // TEST 12: GET_PLAYER_STATISTICS Endpoint
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 12: GET_PLAYER_STATISTICS Endpoint ---');
    const allStatsRes = (await RoomManager.handleRequest({
      action: 'GET_PLAYER_STATISTICS',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    })) as ApiResponse<{ statistics: Record<string, PlayerStatistic> }>;
    assert(allStatsRes.success === true && Object.keys(allStatsRes.data!.statistics).length === 3, 'GET_PLAYER_STATISTICS returns all 3 operatives');

    // Single target player query
    const singleStatRes = (await RoomManager.handleRequest({
      action: 'GET_PLAYER_STATISTICS',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
      targetPlayerId: fixture.players[1].id,
    })) as ApiResponse<{ statistics: Record<string, PlayerStatistic> }>;
    assert(
      singleStatRes.success === true &&
      Object.keys(singleStatRes.data!.statistics).length === 1 &&
      singleStatRes.data!.statistics[fixture.players[1].id] !== undefined,
      'GET_PLAYER_STATISTICS with targetPlayerId returns targeted operative'
    );

    // -------------------------------------------------------------------------
    // TEST 13: GET_MATCH_HISTORY Endpoint
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 13: GET_MATCH_HISTORY Endpoint ---');
    const histRes = (await RoomManager.handleRequest({
      action: 'GET_MATCH_HISTORY',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    })) as ApiResponse<{ roundHistory: RoundResult[] }>;
    assert(histRes.success === true && histRes.data!.roundHistory.length === 3, 'GET_MATCH_HISTORY returns 3 rounds');

    // -------------------------------------------------------------------------
    // TEST 14: Server-Side Immutability & Caching
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 14: Server-Side Immutability & Caching ---');
    const secondCallRes = (await RoomManager.handleRequest({
      action: 'GET_FINAL_RESULTS',
      roomCode: fixture.code,
      playerId: fixture.players[1].id,
      sessionToken: fixture.players[1].token,
    })) as ApiResponse<{ finalResults: FinalMatchResults }>;
    assert(secondCallRes.success === true, 'Repeated call to GET_FINAL_RESULTS succeeds');
    assert(
      secondCallRes.data!.finalResults.completedAt === results.completedAt,
      'Results are immutable and cached on match.finalResults'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Duel Mode (2-Player) Final Results
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 15: Duel Mode (2-Player) Final Results ---');
    const dHostRes = (await RoomManager.handleRequest({
      action: 'CREATE_ROOM',
      displayName: 'DUEL_HOST',
      avatarId: 'cipher',
      gameMode: 'duel',
    })) as ApiResponse<RoomSessionResult>;
    const duelCode = dHostRes.data!.room.roomCode;
    const dHToken = dHostRes.data!.sessionToken;
    const dHId = dHostRes.data!.player.playerId;

    const dP2Res = (await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: duelCode,
      displayName: 'DUEL_CHALLENGER',
      avatarId: 'shadow',
    })) as ApiResponse<RoomSessionResult>;
    const dP2Token = dP2Res.data!.sessionToken;
    const dP2Id = dP2Res.data!.player.playerId;

    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: duelCode, playerId: dHId, sessionToken: dHToken, isReady: true });
    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: duelCode, playerId: dP2Id, sessionToken: dP2Token, isReady: true });

    await RoomManager.handleRequest({ action: 'START_GAME', roomCode: duelCode, playerId: dHId, sessionToken: dHToken });

    // Play 3 duel rounds
    for (let r = 1; r <= 3; r++) {
      if (r > 1) {
        await RoomManager.handleRequest({ action: 'START_NEXT_ROUND', roomCode: duelCode, playerId: dHId, sessionToken: dHToken });
      }
      await RoomManager.handleRequest({ action: 'START_VOTING', roomCode: duelCode, playerId: dHId, sessionToken: dHToken });
      await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: duelCode, playerId: dHId, sessionToken: dHToken, targetPlayerId: dP2Id });
      await RoomManager.handleRequest({ action: 'SUBMIT_VOTE', roomCode: duelCode, playerId: dP2Id, sessionToken: dP2Token, targetPlayerId: dHId });
      await RoomManager.handleRequest({ action: 'CLOSE_VOTING', roomCode: duelCode, playerId: dHId, sessionToken: dHToken });
      await RoomManager.handleRequest({ action: 'APPLY_ROUND_SCORING', roomCode: duelCode, playerId: dHId, sessionToken: dHToken });
    }

    const duelResultsRes = (await RoomManager.handleRequest({
      action: 'GET_FINAL_RESULTS',
      roomCode: duelCode,
      playerId: dHId,
      sessionToken: dHToken,
    })) as ApiResponse<{ finalResults: FinalMatchResults }>;
    assert(duelResultsRes.success === true, 'Duel Mode final results generated without error');
    assert(duelResultsRes.data!.finalResults.leaderboard.length === 2, 'Duel Mode leaderboard has exactly 2 operatives');

    // -------------------------------------------------------------------------
    // TEST 16: 8-Player Room Scale Test
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 16: 8-Player Scale Verification ---');
    const octoHost = (await RoomManager.handleRequest({
      action: 'CREATE_ROOM',
      displayName: 'OCTO_LEAD',
      avatarId: 'falcon',
      gameMode: 'classic',
    })) as ApiResponse<RoomSessionResult>;
    const octoCode = octoHost.data!.room.roomCode;
    const octoPlayers = [{ id: octoHost.data!.player.playerId, token: octoHost.data!.sessionToken, isHost: true }];

    for (let i = 2; i <= 8; i++) {
      const joinRes = (await RoomManager.handleRequest({
        action: 'JOIN_ROOM',
        roomCode: octoCode,
        displayName: `AGENT_${i}`,
        avatarId: 'ghost',
      })) as ApiResponse<RoomSessionResult>;
      octoPlayers.push({ id: joinRes.data!.player.playerId, token: joinRes.data!.sessionToken, isHost: false });
    }

    // Set all ready
    for (const p of octoPlayers) {
      await RoomManager.handleRequest({ action: 'SET_READY', roomCode: octoCode, playerId: p.id, sessionToken: p.token, isReady: true });
    }

    await RoomManager.handleRequest({ action: 'START_GAME', roomCode: octoCode, playerId: octoPlayers[0].id, sessionToken: octoPlayers[0].token });

    // Play 3 rounds for 8 players
    for (let r = 1; r <= 3; r++) {
      if (r > 1) {
        await RoomManager.handleRequest({ action: 'START_NEXT_ROUND', roomCode: octoCode, playerId: octoPlayers[0].id, sessionToken: octoPlayers[0].token });
      }
      await RoomManager.handleRequest({ action: 'START_VOTING', roomCode: octoCode, playerId: octoPlayers[0].id, sessionToken: octoPlayers[0].token });

      const { room: octoRoom } = await RoomStorage.getRoom(octoCode);
      const imposterId = octoRoom!.currentRound!.imposterPlayerId;
      const targetAgent = octoPlayers.find((p) => p.id !== imposterId)!.id;

      for (const p of octoPlayers) {
        const target = p.id === imposterId ? targetAgent : imposterId;
        await RoomManager.handleRequest({
          action: 'SUBMIT_VOTE',
          roomCode: octoCode,
          playerId: p.id,
          sessionToken: p.token,
          targetPlayerId: target,
        });
      }

      await RoomManager.handleRequest({ action: 'CLOSE_VOTING', roomCode: octoCode, playerId: octoPlayers[0].id, sessionToken: octoPlayers[0].token });
      await RoomManager.handleRequest({ action: 'APPLY_ROUND_SCORING', roomCode: octoCode, playerId: octoPlayers[0].id, sessionToken: octoPlayers[0].token });
    }

    const octoFinalRes = (await RoomManager.handleRequest({
      action: 'GET_FINAL_RESULTS',
      roomCode: octoCode,
      playerId: octoPlayers[0].id,
      sessionToken: octoPlayers[0].token,
    })) as ApiResponse<{ finalResults: FinalMatchResults }>;

    assert(octoFinalRes.success === true, '8-Player match final results generated');
    assert(octoFinalRes.data!.finalResults.leaderboard.length === 8, '8-Player leaderboard contains all 8 operatives');

    console.log(`\n======================================================`);
    console.log(` PHASE 9 TEST SUITE SUMMARY: ${passed}/${total} TESTS PASSED `);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Phase 9 Test Execution Error:', err);
    process.exitCode = 1;
  }
}

runPhase9Tests();
