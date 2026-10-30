/**
 * Phase 10/12 Verification Test Suite
 * Rematch, Play Again & Complete Room Lifecycle Management
 */

import { RoomManager } from './roomManager';
import { RoomStorage } from './storage';
import {
  RoomSessionResult,
  MatchState,
  RematchState,
  ArchivedMatch,
  ApiResponse,
  Room,
} from '../types/game';

async function runPhase10Tests() {
  console.log('\n==========================================================');
  console.log(' SECRET AGENT PHASE 10/12 VERIFICATION TEST SUITE         ');
  console.log(' Rematch, Play Again & Complete Room Lifecycle Management ');
  console.log('==========================================================\n');

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
      displayName: 'LEADER_OMEGA',
      avatarId: 'falcon',
      gameMode: 'classic',
    })) as ApiResponse<RoomSessionResult>;
    const code = hostRes.data!.room.roomCode;
    const hToken = hostRes.data!.sessionToken;
    const hId = hostRes.data!.player.playerId;

    const p2Res = (await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: code,
      displayName: 'AGENT_PHANTOM',
      avatarId: 'ghost',
    })) as ApiResponse<RoomSessionResult>;
    const p2Token = p2Res.data!.sessionToken;
    const p2Id = p2Res.data!.player.playerId;

    const p3Res = (await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: code,
      displayName: 'AGENT_VIPER',
      avatarId: 'viper',
    })) as ApiResponse<RoomSessionResult>;
    const p3Token = p3Res.data!.sessionToken;
    const p3Id = p3Res.data!.player.playerId;

    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: hId, sessionToken: hToken, isReady: true });
    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: p2Id, sessionToken: p2Token, isReady: true });
    await RoomManager.handleRequest({ action: 'SET_READY', roomCode: code, playerId: p3Id, sessionToken: p3Token, isReady: true });

    return {
      code,
      players: [
        { id: hId, token: hToken, name: 'LEADER_OMEGA', isHost: true },
        { id: p2Id, token: p2Token, name: 'AGENT_PHANTOM', isHost: false },
        { id: p3Id, token: p3Token, name: 'AGENT_VIPER', isHost: false },
      ],
    };
  }

  // --- HELPER: Play out 3 rounds to completion ---
  async function playOut3Rounds(roomFixture: Awaited<ReturnType<typeof setup3PlayerRoom>>) {
    const code = roomFixture.code;
    const host = roomFixture.players[0];

    const { room: initialRoom } = await RoomStorage.getRoom(code);
    if (initialRoom?.status === 'WAITING') {
      await RoomManager.handleRequest({
        action: 'START_GAME',
        roomCode: code,
        playerId: host.id,
        sessionToken: host.token,
      });
    }

    // Play 3 rounds
    for (let r = 1; r <= 3; r++) {
      if (r > 1) {
        await RoomManager.handleRequest({
          action: 'START_NEXT_ROUND',
          roomCode: code,
          playerId: host.id,
          sessionToken: host.token,
        });
      }

      const { room } = await RoomStorage.getRoom(code);
      const imposterId = room!.currentRound!.imposterPlayerId;
      const targetAgent = roomFixture.players.find((p) => p.id !== imposterId)!.id;

      await RoomManager.handleRequest({
        action: 'START_VOTING',
        roomCode: code,
        playerId: host.id,
        sessionToken: host.token,
      });

      for (const p of roomFixture.players) {
        const target = p.id === imposterId ? targetAgent : imposterId;
        await RoomManager.handleRequest({
          action: 'SUBMIT_VOTE',
          roomCode: code,
          playerId: p.id,
          sessionToken: p.token,
          targetPlayerId: target,
        });
      }

      await RoomManager.handleRequest({
        action: 'CLOSE_VOTING',
        roomCode: code,
        playerId: host.id,
        sessionToken: host.token,
      });

      await RoomManager.handleRequest({
        action: 'APPLY_ROUND_SCORING',
        roomCode: code,
        playerId: host.id,
        sessionToken: host.token,
      });
    }

    // Conclude match and compute final results
    await RoomManager.handleRequest({
      action: 'GET_FINAL_RESULTS',
      roomCode: code,
      playerId: host.id,
      sessionToken: host.token,
    });
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1 & 2: Active Match Cannot Request Rematch
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Rematch Gatekeeping on Active Match ---');
    const fixture = await setup3PlayerRoom();
    await RoomManager.handleRequest({
      action: 'START_GAME',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    });

    const activeRematchRes = (await RoomManager.handleRequest({
      action: 'REQUEST_REMATCH',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    })) as ApiResponse<unknown>;
    assert(
      activeRematchRes.success === false && activeRematchRes.code === 'MATCH_NOT_COMPLETED',
      'Active match cannot initiate a rematch before completing 3 rounds'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Active Match Protected from Expiration
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Active Match Expiration Protection ---');
    const expireActiveRes = (await RoomManager.handleRequest({
      action: 'EXPIRE_ROOM',
      roomCode: fixture.code,
      inactivityThresholdHours: 0, // Instant
    })) as ApiResponse<unknown>;
    assert(
      expireActiveRes.success === false && expireActiveRes.code === 'ACTIVE_MISSION_PROTECTED',
      'Active operational match is protected from timer expiration'
    );

    // Complete the 3 rounds
    console.log('\n--- PLAYING 3 ROUNDS TO COMPLETION ---');
    await playOut3Rounds(fixture);

    const { room: postMatchRoom } = await RoomStorage.getRoom(fixture.code);
    assert(postMatchRoom!.status === 'MATCH_COMPLETED', 'Room is in MATCH_COMPLETED status');
    const initialMatchId = postMatchRoom!.currentMatch!.matchId;

    // -------------------------------------------------------------------------
    // TEST 4: Only Host Can Initiate Rematch
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Host Authorization for Rematch Request ---');
    const nonHostRes = (await RoomManager.handleRequest({
      action: 'REQUEST_REMATCH',
      roomCode: fixture.code,
      playerId: fixture.players[1].id,
      sessionToken: fixture.players[1].token,
    })) as ApiResponse<unknown>;
    assert(
      nonHostRes.success === false && nonHostRes.code === 'HOST_ONLY',
      'Non-host operative cannot initiate a rematch'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Completed Match Can Request Rematch
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Host Successfully Initiates Rematch ---');
    const hostRematchRes = (await RoomManager.handleRequest({
      action: 'REQUEST_REMATCH',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
      durationSeconds: 120,
    })) as ApiResponse<{ room: Room; rematch: RematchState }>;
    assert(hostRematchRes.success === true, 'Host successfully initiated rematch request');
    assert(hostRematchRes.data!.room.status === 'REMATCH_PENDING', 'Room status transitioned to REMATCH_PENDING');
    assert(hostRematchRes.data!.rematch.readyPlayerIds.includes(fixture.players[0].id), 'Host is marked ready by default');

    // -------------------------------------------------------------------------
    // TEST 6: All Players Receive Rematch Invitation / Status
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Rematch Status Retrieval Across Operatives ---');
    const p2StatusRes = (await RoomManager.handleRequest({
      action: 'GET_REMATCH_STATUS',
      roomCode: fixture.code,
      playerId: fixture.players[1].id,
      sessionToken: fixture.players[1].token,
    })) as ApiResponse<{ rematch: RematchState; roomStatus: string }>;
    assert(p2StatusRes.success === true, 'Operative 2 retrieves rematch status');
    assert(p2StatusRes.data!.rematch.status === 'PENDING', 'Rematch status is PENDING');

    // -------------------------------------------------------------------------
    // TEST 7: Host Cannot Start Before All Players Are Ready
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Start Rematch Rejection When Operatives Not Ready ---');
    const prematureStartRes = (await RoomManager.handleRequest({
      action: 'START_REMATCH',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    })) as ApiResponse<unknown>;
    assert(
      prematureStartRes.success === false && prematureStartRes.code === 'PLAYERS_NOT_READY',
      'Rematch start rejected when operatives have not all confirmed readiness'
    );

    // -------------------------------------------------------------------------
    // TEST 8: Player Can Respond DECLINE and READY
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Operative Readiness & Decline Responses ---');
    // Player 2 declines
    const declineRes = (await RoomManager.handleRequest({
      action: 'RESPOND_REMATCH',
      roomCode: fixture.code,
      playerId: fixture.players[1].id,
      sessionToken: fixture.players[1].token,
      response: 'DECLINE',
    })) as ApiResponse<{ rematch: RematchState }>;
    assert(declineRes.success === true, 'Player 2 successfully submitted DECLINE');
    assert(declineRes.data!.rematch.declinedPlayerIds.includes(fixture.players[1].id), 'Player 2 recorded in declinedPlayerIds');

    // Player 2 changes mind to READY
    const readyRes = (await RoomManager.handleRequest({
      action: 'RESPOND_REMATCH',
      roomCode: fixture.code,
      playerId: fixture.players[1].id,
      sessionToken: fixture.players[1].token,
      response: 'READY',
    })) as ApiResponse<{ rematch: RematchState; roomStatus: string }>;
    assert(readyRes.success === true, 'Player 2 changed response to READY');
    assert(readyRes.data!.rematch.readyPlayerIds.includes(fixture.players[1].id), 'Player 2 recorded in readyPlayerIds');
    assert(!readyRes.data!.rematch.declinedPlayerIds.includes(fixture.players[1].id), 'Player 2 removed from declinedPlayerIds');

    // Duplicate readiness check (idempotency)
    const dupReadyRes = (await RoomManager.handleRequest({
      action: 'RESPOND_REMATCH',
      roomCode: fixture.code,
      playerId: fixture.players[1].id,
      sessionToken: fixture.players[1].token,
      response: 'READY',
    })) as ApiResponse<{ rematch: RematchState }>;
    assert(dupReadyRes.success === true, 'Duplicate readiness response is idempotent');
    assert(
      dupReadyRes.data!.rematch.readyPlayerIds.filter((id) => id === fixture.players[1].id).length === 1,
      'Duplicate readiness does not duplicate entries'
    );

    // -------------------------------------------------------------------------
    // TEST 9: Player 3 Confirms Ready -> Status Transitions to REMATCH_READY
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Full Operative Consensus Transitions to REMATCH_READY ---');
    const p3ReadyRes = (await RoomManager.handleRequest({
      action: 'RESPOND_REMATCH',
      roomCode: fixture.code,
      playerId: fixture.players[2].id,
      sessionToken: fixture.players[2].token,
      response: 'READY',
    })) as ApiResponse<{ rematch: RematchState; roomStatus: string }>;
    assert(p3ReadyRes.success === true, 'Player 3 confirmed READY');
    assert(p3ReadyRes.data!.rematch.status === 'READY', 'Rematch state transitioned to READY');
    assert(p3ReadyRes.data!.roomStatus === 'REMATCH_READY', 'Room status transitioned to REMATCH_READY');

    // -------------------------------------------------------------------------
    // TEST 10: Host Starts Rematch -> Fresh Match Initialization
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Host Starts Rematch & Fresh Match State ---');
    const startRematchRes = (await RoomManager.handleRequest({
      action: 'START_REMATCH',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    })) as ApiResponse<{ room: Room; match: MatchState }>;

    assert(startRematchRes.success === true, 'Host successfully started the rematch');
    const newRoom = startRematchRes.data!.room;
    const newMatch = startRematchRes.data!.match;

    assert(newRoom.status === 'ROLE_REVEAL', 'New match starts in ROLE_REVEAL');
    assert(newMatch.matchId !== initialMatchId, 'New match receives a brand-new unique matchId');
    assert(newRoom.roomCode === fixture.code, 'Original 6-char room code is preserved');
    assert(newMatch.currentRoundNumber === 1, 'New match starts at Round 1');
    assert(newMatch.roundHistory.length === 0, 'Round history reset for new match');

    // Verify all cumulative scores reset to 0
    for (const p of fixture.players) {
      assert(newMatch.cumulativeScores[p.id] === 0, `Player ${p.name} score reset to 0`);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Match History Archive Verification
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Match History Archive Integrity ---');
    const archiveRes = (await RoomManager.handleRequest({
      action: 'GET_MATCH_ARCHIVE',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
    })) as ApiResponse<{ archive: ArchivedMatch[] }>;

    assert(archiveRes.success === true, 'Retrieved match history archive');
    assert(archiveRes.data!.archive.length === 1, 'Match history archive contains 1 historical match');
    const archivedMatch = archiveRes.data!.archive[0];
    assert(archivedMatch.matchId === initialMatchId, 'Archived matchId matches initial match');
    assert(archivedMatch.matchNumber === 1, 'Archived matchNumber is 1');
    assert(archivedMatch.roundHistory.length === 3, 'Archived match preserves all 3 rounds');
    assert(archivedMatch.finalLeaderboard.length === 3, 'Archived match preserves final leaderboard');

    // -------------------------------------------------------------------------
    // TEST 12: Host Transfer (Manual & Automatic Departure)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11: Secure Host Transfer ---');
    const transferRes = (await RoomManager.handleRequest({
      action: 'TRANSFER_HOST',
      roomCode: fixture.code,
      playerId: fixture.players[0].id,
      sessionToken: fixture.players[0].token,
      targetPlayerId: fixture.players[1].id,
    })) as ApiResponse<{ room: Room }>;

    assert(transferRes.success === true, 'Host permissions manually transferred to Player 2');
    assert(transferRes.data!.room.hostPlayerId === fixture.players[1].id, 'New hostPlayerId is Player 2');
    const newHostPlayer = transferRes.data!.room.players.find((p) => p.playerId === fixture.players[1].id);
    assert(newHostPlayer!.isHost === true, 'Player 2 marked as isHost=true');
    const oldHostPlayer = transferRes.data!.room.players.find((p) => p.playerId === fixture.players[0].id);
    assert(oldHostPlayer!.isHost === false, 'Player 1 marked as isHost=false');

    // Non-host cannot transfer host
    const badTransfer = (await RoomManager.handleRequest({
      action: 'TRANSFER_HOST',
      roomCode: fixture.code,
      playerId: fixture.players[0].id, // Now non-host
      sessionToken: fixture.players[0].token,
      targetPlayerId: fixture.players[2].id,
    })) as ApiResponse<unknown>;
    assert(badTransfer.success === false && badTransfer.code === 'HOST_ONLY', 'Demoted host cannot transfer leadership');

    // -------------------------------------------------------------------------
    // TEST 13: Player Departure & Automatic Host Transfer on Leave
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 12: Host Departure Triggers Automatic Host Transfer ---');
    const hostLeaveRes = (await RoomManager.handleRequest({
      action: 'LEAVE_ROOM',
      roomCode: fixture.code,
      playerId: fixture.players[1].id, // Current host
      sessionToken: fixture.players[1].token,
    })) as ApiResponse<{ success: boolean }>;
    assert(hostLeaveRes.success === true, 'Current host safely departed');

    const { room: postHostLeaveRoom } = await RoomStorage.getRoom(fixture.code);
    assert(postHostLeaveRoom!.players.length === 2, 'Room now has 2 remaining operatives');
    assert(
      postHostLeaveRoom!.hostPlayerId === postHostLeaveRoom!.players[0].playerId,
      'Oldest remaining operative automatically promoted to host'
    );
    assert(postHostLeaveRoom!.players[0].isHost === true, 'Promoted operative has isHost=true');

    // -------------------------------------------------------------------------
    // TEST 14: Room Closure (Host Only)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 13: Host Closes Room & Prevents New Joins ---');
    const activeHostId = postHostLeaveRoom!.hostPlayerId;
    const activeHostToken = postHostLeaveRoom!.players.find((p) => p.playerId === activeHostId)!.sessionToken;

    const closeRes = (await RoomManager.handleRequest({
      action: 'CLOSE_ROOM',
      roomCode: fixture.code,
      playerId: activeHostId,
      sessionToken: activeHostToken,
    })) as ApiResponse<{ room: Room }>;
    assert(closeRes.success === true, 'Host successfully closed the room');
    assert(closeRes.data!.room.status === 'CLOSED', 'Room status is CLOSED');

    // Attempt to join closed room
    const joinClosedRes = (await RoomManager.handleRequest({
      action: 'JOIN_ROOM',
      roomCode: fixture.code,
      displayName: 'LATE_AGENT',
      avatarId: 'viper',
    })) as ApiResponse<unknown>;
    assert(
      joinClosedRes.success === false && joinClosedRes.code === 'ROOM_CLOSED',
      'Joining closed room is rejected'
    );

    // -------------------------------------------------------------------------
    // TEST 15: Rematch Expiration Handling
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 14: Rematch Expiration Verification ---');
    const expFixture = await setup3PlayerRoom();
    await playOut3Rounds(expFixture);

    // Host requests rematch with 0-second duration (already expired)
    await RoomManager.handleRequest({
      action: 'REQUEST_REMATCH',
      roomCode: expFixture.code,
      playerId: expFixture.players[0].id,
      sessionToken: expFixture.players[0].token,
      durationSeconds: -1, // Expired immediately
    });

    const expCheckRes = (await RoomManager.handleRequest({
      action: 'GET_REMATCH_STATUS',
      roomCode: expFixture.code,
      playerId: expFixture.players[0].id,
      sessionToken: expFixture.players[0].token,
    })) as ApiResponse<{ rematch: RematchState; roomStatus: string }>;
    assert(expCheckRes.data!.rematch.status === 'EXPIRED', 'Rematch status expired');
    assert(expCheckRes.data!.roomStatus === 'MATCH_COMPLETED', 'Room reverted to MATCH_COMPLETED');

    // -------------------------------------------------------------------------
    // TEST 16: Sequential Multiple Rematches
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 15: Sequential Multiple Rematches & Cumulative Archive ---');
    const seqFixture = await setup3PlayerRoom();
    // Match 1
    await playOut3Rounds(seqFixture);

    // Rematch 1 -> Match 2
    await RoomManager.handleRequest({ action: 'REQUEST_REMATCH', roomCode: seqFixture.code, playerId: seqFixture.players[0].id, sessionToken: seqFixture.players[0].token });
    await RoomManager.handleRequest({ action: 'RESPOND_REMATCH', roomCode: seqFixture.code, playerId: seqFixture.players[1].id, sessionToken: seqFixture.players[1].token, response: 'READY' });
    await RoomManager.handleRequest({ action: 'RESPOND_REMATCH', roomCode: seqFixture.code, playerId: seqFixture.players[2].id, sessionToken: seqFixture.players[2].token, response: 'READY' });
    await RoomManager.handleRequest({ action: 'START_REMATCH', roomCode: seqFixture.code, playerId: seqFixture.players[0].id, sessionToken: seqFixture.players[0].token });

    // Match 2 completes
    await playOut3Rounds(seqFixture);

    // Rematch 2 -> Match 3
    await RoomManager.handleRequest({ action: 'REQUEST_REMATCH', roomCode: seqFixture.code, playerId: seqFixture.players[0].id, sessionToken: seqFixture.players[0].token });
    await RoomManager.handleRequest({ action: 'RESPOND_REMATCH', roomCode: seqFixture.code, playerId: seqFixture.players[1].id, sessionToken: seqFixture.players[1].token, response: 'READY' });
    await RoomManager.handleRequest({ action: 'RESPOND_REMATCH', roomCode: seqFixture.code, playerId: seqFixture.players[2].id, sessionToken: seqFixture.players[2].token, response: 'READY' });
    await RoomManager.handleRequest({ action: 'START_REMATCH', roomCode: seqFixture.code, playerId: seqFixture.players[0].id, sessionToken: seqFixture.players[0].token });

    const seqArchiveRes = (await RoomManager.handleRequest({
      action: 'GET_MATCH_ARCHIVE',
      roomCode: seqFixture.code,
      playerId: seqFixture.players[0].id,
      sessionToken: seqFixture.players[0].token,
    })) as ApiResponse<{ archive: ArchivedMatch[] }>;

    assert(seqArchiveRes.data!.archive.length === 2, 'Archive correctly accumulated Match 1 and Match 2');
    assert(seqArchiveRes.data!.archive[0].matchNumber === 1, 'Match 1 preserved');
    assert(seqArchiveRes.data!.archive[1].matchNumber === 2, 'Match 2 preserved');

    console.log(`\n==========================================================`);
    console.log(` PHASE 10 TEST SUITE SUMMARY: ${passed}/${total} TESTS PASSED `);
    console.log(`==========================================================\n`);
  } catch (err) {
    console.error('Phase 10 Test Execution Error:', err);
    process.exitCode = 1;
  }
}

runPhase10Tests();
