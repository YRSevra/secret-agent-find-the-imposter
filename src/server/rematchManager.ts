/**
 * Phase 10: Rematch & Complete Room Lifecycle Management Engine
 * Server-authoritative rematch coordination, player readiness synchronization,
 * fresh match initialization, host transfer, and room lifecycle control.
 */

import crypto from 'crypto';
import {
  InternalRoom,
  RematchState,
  MatchState,
  RequestRematchPayload,
  GetRematchStatusPayload,
  RespondRematchPayload,
  StartRematchPayload,
  CancelRematchPayload,
  TransferHostPayload,
  CloseRoomPayload,
  ExpireRoomPayload,
  ApiResponse,
  Room,
} from '../types/game';
import { RoomStorage } from './storage';
import { MatchHistoryManager } from './matchHistoryManager';
import { createNewRound } from './roleAssignment';
import { sanitizeRoomForPublic } from './security';

const DEFAULT_REMATCH_DURATION_SECONDS = 120;
const DEFAULT_INACTIVITY_EXPIRATION_HOURS = 24;

export class RematchManager {
  /**
   * Request a rematch (Host only).
   * Transitions room from MATCH_COMPLETED to REMATCH_PENDING / REMATCH_READY.
   */
  static async requestRematch(
    payload: RequestRematchPayload
  ): Promise<ApiResponse<{ room: Room; rematch: RematchState }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom) {
        return { success: false, error: `Room ${cleanCode} not found`, code: 'ROOM_NOT_FOUND' };
      }

      // Authenticate caller
      const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!player || player.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }

      // Only host can initiate a rematch
      if (!player.isHost || currentRoom.hostPlayerId !== payload.playerId) {
        return { success: false, error: 'Only the mission leader (host) can request a rematch', code: 'HOST_ONLY' };
      }

      // Check current room state: Must be in MATCH_COMPLETED
      if (currentRoom.status !== 'MATCH_COMPLETED') {
        if (currentRoom.status === 'REMATCH_PENDING' || currentRoom.status === 'REMATCH_READY') {
          // Idempotent return if already requested
          return {
            success: true,
            data: {
              room: sanitizeRoomForPublic(currentRoom),
              rematch: currentRoom.currentRematch!,
            },
          };
        }
        return {
          success: false,
          error: 'A rematch can only be requested once the current match is completed',
          code: 'MATCH_NOT_COMPLETED',
        };
      }

      const duration = payload.durationSeconds || DEFAULT_REMATCH_DURATION_SECONDS;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + duration * 1000).toISOString();

      // Host is ready by default
      const readyPlayerIds = [player.playerId];
      const allReady = currentRoom.players.every((p) => readyPlayerIds.includes(p.playerId));

      const rematchState: RematchState = {
        rematchId: `rematch_${crypto.randomBytes(6).toString('hex')}`,
        requestedByPlayerId: player.playerId,
        status: allReady ? 'READY' : 'PENDING',
        readyPlayerIds,
        declinedPlayerIds: [],
        expiresAt,
        createdAt: now.toISOString(),
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        status: allReady ? 'REMATCH_READY' : 'REMATCH_PENDING',
        currentRematch: rematchState,
        version: currentRoom.version + 1,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: {
            room: sanitizeRoomForPublic(updatedRoom),
            rematch: rematchState,
          },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict requesting rematch. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Get rematch status and handle automatic expiration.
   */
  static async getRematchStatus(
    payload: GetRematchStatusPayload
  ): Promise<ApiResponse<{ rematch: RematchState | null; roomStatus: InternalRoom['status'] }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom) {
      return { success: false, error: `Room ${cleanCode} not found`, code: 'ROOM_NOT_FOUND' };
    }

    const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
    if (!player || player.sessionToken !== payload.sessionToken) {
      return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
    }

    if (!currentRoom.currentRematch) {
      return {
        success: true,
        data: {
          rematch: null,
          roomStatus: currentRoom.status,
        },
      };
    }

    const rematch = currentRoom.currentRematch;

    // Check expiration if still pending
    if (rematch.status === 'PENDING' && new Date(rematch.expiresAt).getTime() <= Date.now()) {
      rematch.status = 'EXPIRED';
      currentRoom.status = 'MATCH_COMPLETED';
      await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
    }

    return {
      success: true,
      data: {
        rematch: currentRoom.currentRematch,
        roomStatus: currentRoom.status,
      },
    };
  }

  /**
   * Respond to rematch invitation (READY or DECLINE).
   * Synchronizes readiness across all connected players.
   */
  static async respondRematch(
    payload: RespondRematchPayload
  ): Promise<ApiResponse<{ rematch: RematchState; roomStatus: InternalRoom['status'] }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken || !payload.response) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom) {
        return { success: false, error: `Room ${cleanCode} not found`, code: 'ROOM_NOT_FOUND' };
      }

      const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!player || player.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }

      if (!currentRoom.currentRematch) {
        return { success: false, error: 'No active rematch invitation for this room', code: 'NO_ACTIVE_REMATCH' };
      }

      const rematch = currentRoom.currentRematch;

      // Check expiration
      if (new Date(rematch.expiresAt).getTime() <= Date.now()) {
        rematch.status = 'EXPIRED';
        currentRoom.status = 'MATCH_COMPLETED';
        await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
        return {
          success: false,
          error: 'Rematch invitation has expired',
          code: 'REMATCH_EXPIRED',
        };
      }

      let ready = [...rematch.readyPlayerIds];
      let declined = [...rematch.declinedPlayerIds];

      if (payload.response === 'READY') {
        declined = declined.filter((id) => id !== payload.playerId);
        if (!ready.includes(payload.playerId)) {
          ready.push(payload.playerId);
        }
      } else {
        // DECLINE
        ready = ready.filter((id) => id !== payload.playerId);
        if (!declined.includes(payload.playerId)) {
          declined.push(payload.playerId);
        }
      }

      // Check readiness against all room players
      const allReady = currentRoom.players.every((p) => ready.includes(p.playerId));
      const nextStatus: RematchState['status'] = allReady ? 'READY' : 'PENDING';
      const nextRoomStatus = allReady ? 'REMATCH_READY' : 'REMATCH_PENDING';

      const updatedRematch: RematchState = {
        ...rematch,
        readyPlayerIds: ready,
        declinedPlayerIds: declined,
        status: nextStatus,
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        status: nextRoomStatus,
        currentRematch: updatedRematch,
        version: currentRoom.version + 1,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: {
            rematch: updatedRematch,
            roomStatus: nextRoomStatus,
          },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict updating rematch readiness. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Start Rematch (Host only, all eligible players ready).
   * Archives previous match to MatchHistoryManager and creates fresh MatchState.
   */
  static async startRematch(
    payload: StartRematchPayload
  ): Promise<ApiResponse<{ room: Room; match: MatchState }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom) {
        return { success: false, error: `Room ${cleanCode} not found`, code: 'ROOM_NOT_FOUND' };
      }

      // Authenticate caller (Host only)
      const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!player || player.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }
      if (!player.isHost || currentRoom.hostPlayerId !== payload.playerId) {
        return { success: false, error: 'Only the mission leader (host) can start the rematch', code: 'HOST_ONLY' };
      }

      if (!currentRoom.currentRematch) {
        return { success: false, error: 'No active rematch invitation found', code: 'NO_ACTIVE_REMATCH' };
      }

      const rematch = currentRoom.currentRematch;

      // Verify all players are ready
      const allReady = currentRoom.players.every((p) => rematch.readyPlayerIds.includes(p.playerId));
      if (!allReady) {
        return {
          success: false,
          error: 'Cannot initialize rematch before all operatives have confirmed readiness',
          code: 'PLAYERS_NOT_READY',
        };
      }

      // Verify minimum capacity
      const minPlayers = currentRoom.gameMode === 'duel' ? 2 : 3;
      if (currentRoom.players.length < minPlayers) {
        return {
          success: false,
          error: `Insufficient operatives for rematch. Minimum required: ${minPlayers}.`,
          code: 'INSUFFICIENT_PLAYERS',
        };
      }

      // 1. ARCHIVE PREVIOUS COMPLETED MATCH
      if (currentRoom.currentMatch) {
        MatchHistoryManager.archiveMatch(currentRoom);
      }

      // 2. INITIALIZE BRAND NEW MATCH (Zero scores, Round 1, fresh imposter)
      const newMatchId = `match_${crypto.randomBytes(8).toString('hex')}`;
      const cumulativeScores: Record<string, number> = {};
      for (const p of currentRoom.players) {
        cumulativeScores[p.playerId] = 0;
        p.isReady = false; // Reset lobby readiness for future
      }

      const newMatch: MatchState = {
        matchId: newMatchId,
        roomId: currentRoom.roomId,
        status: 'ROUND_ACTIVE',
        currentRoundNumber: 1,
        totalRounds: 3,
        playerIds: currentRoom.players.map((p) => p.playerId),
        cumulativeScores,
        roundHistory: [],
        createdAt: new Date().toISOString(),
        version: 0,
      };

      // 3. GENERATE FRESH ROUND 1 (New random Imposter and new secret word)
      const newRound = createNewRound(currentRoom.players, [], 1);

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        status: 'ROLE_REVEAL',
        currentRound: newRound,
        currentDiscussion: undefined,
        currentVoting: undefined,
        currentMatch: newMatch,
        currentRematch: undefined, // Clear rematch state
        previousSecretWords: [],
        version: currentRoom.version + 1,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: {
            room: sanitizeRoomForPublic(updatedRoom),
            match: newMatch,
          },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict initializing rematch. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Cancel Rematch (Host only).
   */
  static async cancelRematch(
    payload: CancelRematchPayload
  ): Promise<ApiResponse<{ room: Room }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom) {
        return { success: false, error: `Room ${cleanCode} not found`, code: 'ROOM_NOT_FOUND' };
      }

      const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!player || player.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }
      if (!player.isHost || currentRoom.hostPlayerId !== payload.playerId) {
        return { success: false, error: 'Only the mission leader can cancel rematch', code: 'HOST_ONLY' };
      }

      if (currentRoom.currentRematch) {
        currentRoom.currentRematch.status = 'CANCELLED';
      }
      currentRoom.status = 'MATCH_COMPLETED';

      const saveResult = await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: { room: sanitizeRoomForPublic(currentRoom) },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict cancelling rematch. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Transfer host role securely.
   */
  static async transferHost(
    payload: TransferHostPayload
  ): Promise<ApiResponse<{ room: Room }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken || !payload.targetPlayerId) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom) {
        return { success: false, error: `Room ${cleanCode} not found`, code: 'ROOM_NOT_FOUND' };
      }

      const host = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!host || host.sessionToken !== payload.sessionToken || !host.isHost) {
        return { success: false, error: 'Only the current host can transfer leadership', code: 'HOST_ONLY' };
      }

      const target = currentRoom.players.find((p) => p.playerId === payload.targetPlayerId);
      if (!target) {
        return { success: false, error: 'Target player not found in room', code: 'TARGET_NOT_FOUND' };
      }

      // Reassign host
      for (const p of currentRoom.players) {
        p.isHost = p.playerId === payload.targetPlayerId;
      }
      currentRoom.hostPlayerId = payload.targetPlayerId;

      const saveResult = await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: { room: sanitizeRoomForPublic(currentRoom) },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict transferring host role. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Close a room explicitly (Host only).
   */
  static async closeRoom(
    payload: CloseRoomPayload
  ): Promise<ApiResponse<{ room: Room }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom) {
      return { success: false, error: `Room ${cleanCode} not found`, code: 'ROOM_NOT_FOUND' };
    }

    const host = currentRoom.players.find((p) => p.playerId === payload.playerId);
    if (!host || host.sessionToken !== payload.sessionToken || !host.isHost) {
      return { success: false, error: 'Only the host can close the mission room', code: 'HOST_ONLY' };
    }

    currentRoom.status = 'CLOSED';
    await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });

    return {
      success: true,
      data: { room: sanitizeRoomForPublic(currentRoom) },
    };
  }

  /**
   * Automatic inactive-room expiration policy.
   * Protects active matches from premature expiration.
   */
  static async expireRoom(
    payload: ExpireRoomPayload
  ): Promise<ApiResponse<{ expired: boolean; room?: Room }>> {
    if (!payload.roomCode) {
      return { success: false, error: 'Room code required', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom) {
      return { success: false, error: `Room ${cleanCode} not found`, code: 'ROOM_NOT_FOUND' };
    }

    // Active matches must NEVER be expired solely due to timer tick
    const activeStatuses: InternalRoom['status'][] = [
      'ROLE_REVEAL',
      'DISCUSSION',
      'VOTING',
      'ROUND_SUMMARY',
    ];
    if (activeStatuses.includes(currentRoom.status)) {
      return {
        success: false,
        error: 'Active operational missions cannot be marked expired',
        code: 'ACTIVE_MISSION_PROTECTED',
      };
    }

    const thresholdHours = payload.inactivityThresholdHours || DEFAULT_INACTIVITY_EXPIRATION_HOURS;
    const thresholdMs = thresholdHours * 60 * 60 * 1000;
    const updatedTime = new Date(currentRoom.updatedAt).getTime();
    const now = Date.now();

    if (now - updatedTime >= thresholdMs) {
      // Archive match if completed and not yet archived
      if (currentRoom.currentMatch && currentRoom.status === 'MATCH_COMPLETED') {
        MatchHistoryManager.archiveMatch(currentRoom);
      }

      currentRoom.status = 'EXPIRED';
      await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });

      return {
        success: true,
        data: {
          expired: true,
          room: sanitizeRoomForPublic(currentRoom),
        },
      };
    }

    return {
      success: true,
      data: {
        expired: false,
        room: sanitizeRoomForPublic(currentRoom),
      },
    };
  }
}
