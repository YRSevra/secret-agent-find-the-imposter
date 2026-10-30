import {
  GameApiRequest,
  ApiResponse,
  InternalRoom,
  InternalPlayer,
  RoomSessionResult,
  Room,
  RoleRevealData,
} from '../types/game';
import {
  generateRoomCode,
  generatePlayerId,
  generateSessionToken,
  sanitizeDisplayName,
  sanitizeRoomForPublic,
} from './security';
import { RoomStorage } from './storage';
import { createNewRound } from './roleAssignment';
import { DiscussionManager } from './discussionManager';
import { VotingManager } from './votingManager';
import { ScoreManager } from './scoreManager';
import { FinalResultsManager } from './finalResultsManager';
import { RematchManager } from './rematchManager';
import { MatchHistoryManager } from './matchHistoryManager';
import { DEFAULT_AVATAR_ID, getAvatarById } from '../constants/avatars';

export class RoomManager {
  /**
   * Handle incoming API requests and route authoritatively.
   */
  static async handleRequest(req: GameApiRequest): Promise<ApiResponse<unknown>> {
    try {
      switch (req.action) {
        case 'CREATE_ROOM':
          return await this.createRoom(req);
        case 'JOIN_ROOM':
          return await this.joinRoom(req);
        case 'GET_ROOM':
          return await this.getRoom(req);
        case 'LEAVE_ROOM':
          return await this.leaveRoom(req);
        case 'SET_READY':
          return await this.setReady(req);
        case 'START_GAME':
          return await this.startGame(req);
        case 'GET_MY_ROLE':
          return await this.getMyRole(req);
        case 'START_DISCUSSION':
          return await DiscussionManager.startDiscussion(req);
        case 'SUBMIT_QUESTION':
          return await DiscussionManager.submitQuestion(req);
        case 'SUBMIT_ANSWER':
          return await DiscussionManager.submitAnswer(req);
        case 'SEND_CHAT_MESSAGE':
          return await DiscussionManager.sendChatMessage(req);
        case 'GET_DISCUSSION':
          return await DiscussionManager.getDiscussion(req);
        case 'START_VOTING':
          return await VotingManager.startVoting(req);
        case 'SUBMIT_VOTE':
          return await VotingManager.submitVote(req);
        case 'GET_VOTING':
          return await VotingManager.getVoting(req);
        case 'CLOSE_VOTING':
          return await VotingManager.closeVoting(req);
        case 'GET_MATCH':
          return await ScoreManager.getMatch(req);
        case 'GET_SCOREBOARD':
          return await ScoreManager.getScoreboard(req);
        case 'APPLY_ROUND_SCORING':
          return await ScoreManager.applyRoundScoring(req);
        case 'START_NEXT_ROUND':
          return await ScoreManager.startNextRound(req);
        case 'COMPLETE_MATCH':
          return await ScoreManager.completeMatch(req);
        case 'GET_FINAL_RESULTS':
          return await FinalResultsManager.getFinalResults(req);
        case 'GET_PLAYER_STATISTICS':
          return await FinalResultsManager.getPlayerStatistics(req);
        case 'GET_MATCH_HISTORY':
          return await FinalResultsManager.getMatchHistory(req);
        case 'REQUEST_REMATCH':
          return await RematchManager.requestRematch(req);
        case 'GET_REMATCH_STATUS':
          return await RematchManager.getRematchStatus(req);
        case 'RESPOND_REMATCH':
          return await RematchManager.respondRematch(req);
        case 'START_REMATCH':
          return await RematchManager.startRematch(req);
        case 'CANCEL_REMATCH':
          return await RematchManager.cancelRematch(req);
        case 'TRANSFER_HOST':
          return await RematchManager.transferHost(req);
        case 'CLOSE_ROOM':
          return await RematchManager.closeRoom(req);
        case 'EXPIRE_ROOM':
          return await RematchManager.expireRoom(req);
        case 'GET_MATCH_ARCHIVE':
          return await MatchHistoryManager.getMatchArchive(req);
        default:
          return { success: false, error: 'Unknown action requested', code: 'INVALID_ACTION' };
      }
    } catch (err) {
      console.error('Unhandled RoomManager error:', err);
      return { success: false, error: 'Internal intelligence agency server error', code: 'INTERNAL_ERROR' };
    }
  }

  /**
   * Create a new room with collision protection.
   */
  private static async createRoom(
    payload: Extract<GameApiRequest, { action: 'CREATE_ROOM' }>
  ): Promise<ApiResponse<RoomSessionResult>> {
    // 1. Validate display name
    const nameCheck = sanitizeDisplayName(payload.displayName);
    if (!nameCheck.valid) {
      return { success: false, error: nameCheck.error, code: 'INVALID_DISPLAY_NAME' };
    }

    // 2. Validate game mode
    const gameMode = payload.gameMode === 'duel' ? 'duel' : 'classic';
    const minPlayers = gameMode === 'duel' ? 2 : 3;
    const maxPlayers = gameMode === 'duel' ? 2 : 8;

    // 3. Validate avatar
    const avatar = getAvatarById(payload.avatarId || DEFAULT_AVATAR_ID);

    // 4. Generate Host credentials
    const hostPlayerId = generatePlayerId();
    const sessionToken = generateSessionToken();
    const now = new Date().toISOString();

    const hostPlayer: InternalPlayer = {
      playerId: hostPlayerId,
      displayName: nameCheck.value,
      avatarId: avatar.id,
      isHost: true,
      isReady: false, // Hosts start as not ready until confirmed
      joinedAt: now,
      sessionToken,
    };

    // 5. Generate collision-resistant 6-char room code with retry loop
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;
      const roomCode = generateRoomCode();
      const roomId = `room_${roomCode}_${Date.now()}`;

      const internalRoom: InternalRoom = {
        roomCode,
        roomId,
        hostPlayerId,
        gameMode,
        status: 'WAITING',
        players: [hostPlayer],
        minPlayers,
        maxPlayers,
        createdAt: now,
        updatedAt: now,
        version: 0,
      };

      const result = await RoomStorage.saveRoom(internalRoom, { onlyIfNew: true });
      if (result.success) {
        return {
          success: true,
          data: {
            room: sanitizeRoomForPublic(internalRoom),
            player: {
              playerId: hostPlayer.playerId,
              displayName: hostPlayer.displayName,
              avatarId: hostPlayer.avatarId,
              isHost: hostPlayer.isHost,
              isReady: hostPlayer.isReady,
              joinedAt: hostPlayer.joinedAt,
            },
            sessionToken,
          },
        };
      }
    }

    return {
      success: false,
      error: 'Unable to allocate a unique room code. Please retry transmission.',
      code: 'COLLISION_OVERFLOW',
    };
  }

  /**
   * Join an existing room with capacity and concurrency validation.
   */
  private static async joinRoom(
    payload: Extract<GameApiRequest, { action: 'JOIN_ROOM' }>
  ): Promise<ApiResponse<RoomSessionResult>> {
    // 1. Validate room code
    if (!payload.roomCode || typeof payload.roomCode !== 'string') {
      return { success: false, error: 'Room code is required', code: 'INVALID_ROOM_CODE' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      return { success: false, error: 'Room code must be exactly 6 characters', code: 'INVALID_ROOM_CODE_LENGTH' };
    }

    // 2. Validate display name
    const nameCheck = sanitizeDisplayName(payload.displayName);
    if (!nameCheck.valid) {
      return { success: false, error: nameCheck.error, code: 'INVALID_DISPLAY_NAME' };
    }

    // 3. Avatar
    const avatar = getAvatarById(payload.avatarId || DEFAULT_AVATAR_ID);

    // 4. Fetch room with optimistic concurrency retry (up to 3 retries)
    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);

      if (!currentRoom) {
        return {
          success: false,
          error: `Room ${cleanCode} was not found. Please confirm the code with your mission host.`,
          code: 'ROOM_NOT_FOUND',
        };
      }

      if (currentRoom.status !== 'WAITING') {
        return {
          success: false,
          error: 'This operation room is currently closed or already in active combat.',
          code: 'ROOM_CLOSED',
        };
      }

      if (currentRoom.players.length >= currentRoom.maxPlayers) {
        return {
          success: false,
          error: `Room ${cleanCode} is full (Maximum capacity of ${currentRoom.maxPlayers} reached).`,
          code: 'ROOM_FULL',
        };
      }

      // Check for duplicate name
      const duplicateName = currentRoom.players.some(
        (p) => p.displayName.toLowerCase() === nameCheck.value.toLowerCase()
      );
      if (duplicateName) {
        return {
          success: false,
          error: `The codename "${nameCheck.value}" is already active in this room. Please choose another.`,
          code: 'DUPLICATE_NAME',
        };
      }

      // Generate credentials
      const newPlayerId = generatePlayerId();
      const sessionToken = generateSessionToken();
      const now = new Date().toISOString();

      const newPlayer: InternalPlayer = {
        playerId: newPlayerId,
        displayName: nameCheck.value,
        avatarId: avatar.id,
        isHost: false,
        isReady: false, // New players start as not ready
        joinedAt: now,
        sessionToken,
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        players: [...currentRoom.players, newPlayer],
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: {
            room: sanitizeRoomForPublic(updatedRoom),
            player: {
              playerId: newPlayer.playerId,
              displayName: newPlayer.displayName,
              avatarId: newPlayer.avatarId,
              isHost: newPlayer.isHost,
              isReady: newPlayer.isReady,
              joinedAt: newPlayer.joinedAt,
            },
            sessionToken,
          },
        };
      }
      // If version mismatch occurred due to concurrent join, loop will retry
    }

    return {
      success: false,
      error: 'Room state updated concurrently. Please try joining again.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Fetch room data (sanitized for public safety).
   */
  private static async getRoom(
    payload: Extract<GameApiRequest, { action: 'GET_ROOM' }>
  ): Promise<ApiResponse<{ room: Room }>> {
    if (!payload.roomCode || typeof payload.roomCode !== 'string') {
      return { success: false, error: 'Room code is required', code: 'INVALID_ROOM_CODE' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room } = await RoomStorage.getRoom(cleanCode);
    if (!room) {
      return { success: false, error: `Room ${cleanCode} does not exist`, code: 'ROOM_NOT_FOUND' };
    }

    return {
      success: true,
      data: {
        room: sanitizeRoomForPublic(room),
      },
    };
  }

  /**
   * Set Player Ready Status.
   */
  private static async setReady(
    payload: Extract<GameApiRequest, { action: 'SET_READY' }>
  ): Promise<ApiResponse<{ room: Room }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken || typeof payload.isReady !== 'boolean') {
      return { success: false, error: 'Invalid ready request parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom) {
        return { success: false, error: `Room ${cleanCode} does not exist`, code: 'ROOM_NOT_FOUND' };
      }

      if (currentRoom.status !== 'WAITING') {
        return {
          success: false,
          error: 'Readiness cannot be modified after mission has commenced.',
          code: 'ROOM_ALREADY_STARTING',
        };
      }

      // Verify player authentication
      const playerIndex = currentRoom.players.findIndex((p) => p.playerId === payload.playerId);
      if (playerIndex === -1) {
        return { success: false, error: 'Operative is not registered in this room', code: 'NOT_FOUND' };
      }

      const targetPlayer = currentRoom.players[playerIndex];
      if (targetPlayer.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }

      // Update readiness
      const updatedPlayers = [...currentRoom.players];
      updatedPlayers[playerIndex] = {
        ...targetPlayer,
        isReady: payload.isReady,
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        players: updatedPlayers,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: {
            room: sanitizeRoomForPublic(updatedRoom),
          },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict updating readiness. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Start Game (Host only, capacity met, all ready).
   */
  private static async startGame(
    payload: Extract<GameApiRequest, { action: 'START_GAME' }>
  ): Promise<ApiResponse<{ room: Room }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid start game parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom) {
        return { success: false, error: `Room ${cleanCode} does not exist`, code: 'ROOM_NOT_FOUND' };
      }

      if (currentRoom.status !== 'WAITING') {
        return {
          success: false,
          error: 'Mission has already started or room is no longer open.',
          code: 'ROOM_NOT_WAITING',
        };
      }

      // Verify Host credentials
      const callingPlayer = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!callingPlayer || callingPlayer.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized session token', code: 'UNAUTHORIZED' };
      }

      if (currentRoom.hostPlayerId !== payload.playerId || !callingPlayer.isHost) {
        return { success: false, error: 'Only the mission host can start the operation', code: 'HOST_ONLY' };
      }

      // Validate capacity requirements
      if (currentRoom.gameMode === 'duel') {
        if (currentRoom.players.length !== 2) {
          return {
            success: false,
            error: `Duel Mode requires exactly 2 operatives to start. Current count: ${currentRoom.players.length}.`,
            code: 'INSUFFICIENT_PLAYERS',
          };
        }
      } else {
        // Classic mode
        if (currentRoom.players.length < 3) {
          return {
            success: false,
            error: `Classic Mode requires at least 3 operatives to start. Current count: ${currentRoom.players.length}.`,
            code: 'INSUFFICIENT_PLAYERS',
          };
        }
      }

      // Validate all players ready
      const unreadyPlayers = currentRoom.players.filter((p) => !p.isReady);
      if (unreadyPlayers.length > 0) {
        const unreadyNames = unreadyPlayers.map((p) => p.displayName).join(', ');
        return {
          success: false,
          error: `All operatives must confirm READY before launch (${unreadyPlayers.length} unready: ${unreadyNames}).`,
          code: 'PLAYERS_NOT_READY',
        };
      }

      // Initialize secure Round 1 with cryptographically random Imposter and secret word
      const newRound = createNewRound(
        currentRoom.players,
        currentRoom.previousSecretWords || [],
        1
      );

      const initialMatch = ScoreManager.initMatch(currentRoom);

      // Atomically transition status to ROLE_REVEAL with new round state
      const updatedRoom: InternalRoom = {
        ...currentRoom,
        status: 'ROLE_REVEAL',
        currentRound: newRound,
        currentMatch: initialMatch,
        previousSecretWords: [
          ...(currentRoom.previousSecretWords || []),
          newRound.secretWord,
        ],
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: {
            room: sanitizeRoomForPublic(updatedRoom),
          },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict starting mission. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Get Private Player Role (Only the requesting player's role, never leaks imposter or secret word to unauthorized eyes).
   */
  private static async getMyRole(
    payload: Extract<GameApiRequest, { action: 'GET_MY_ROLE' }>
  ): Promise<ApiResponse<RoleRevealData>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid role request parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom) {
      return { success: false, error: `Room ${cleanCode} does not exist`, code: 'ROOM_NOT_FOUND' };
    }

    if (currentRoom.status !== 'ROLE_REVEAL' || !currentRoom.currentRound) {
      return {
        success: false,
        error: 'Roles have not been assigned yet for this mission.',
        code: 'ROUND_NOT_INITIALIZED',
      };
    }

    // Authenticate player session
    const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
    if (!player || player.sessionToken !== payload.sessionToken) {
      return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
    }

    const assignedRole = currentRoom.currentRound.playerRoles[payload.playerId];
    if (!assignedRole) {
      return { success: false, error: 'No role assigned to this operative', code: 'NO_ROLE_ASSIGNED' };
    }

    if (assignedRole === 'AGENT') {
      return {
        success: true,
        data: {
          role: 'AGENT',
          roundNumber: currentRoom.currentRound.roundNumber,
          secretWord: currentRoom.currentRound.secretWord,
          category: currentRoom.currentRound.selectedCategory,
        },
      };
    } else {
      // IMPOSTER
      return {
        success: true,
        data: {
          role: 'IMPOSTER',
          roundNumber: currentRoom.currentRound.roundNumber,
          secretWord: null,
          category: null,
          warning: 'CLASSIFIED: YOU ARE THE IMPOSTER. BLEND IN AND DISCOVER THE SECRET.',
        },
      };
    }
  }

  /**
   * Leave a room.
   */
  private static async leaveRoom(
    payload: Extract<GameApiRequest, { action: 'LEAVE_ROOM' }>
  ): Promise<ApiResponse<{ success: boolean; closed?: boolean }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Missing leave credentials', code: 'INVALID_CREDENTIALS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room, version } = await RoomStorage.getRoom(cleanCode);
    if (!room) {
      return { success: true, data: { success: true } }; // Already left / gone
    }

    // Verify sessionToken matches the internal player
    const leavingPlayer = room.players.find((p) => p.playerId === payload.playerId);
    if (!leavingPlayer || leavingPlayer.sessionToken !== payload.sessionToken) {
      return { success: false, error: 'Invalid operative session', code: 'UNAUTHORIZED' };
    }

    const remainingPlayers = room.players.filter((p) => p.playerId !== payload.playerId);

    if (remainingPlayers.length === 0) {
      // If matches were archived or completed, preserve the room as CLOSED to retain historical dossiers
      if (room.matchHistoryArchive?.length || room.currentMatch) {
        const closedRoom: InternalRoom = {
          ...room,
          status: 'CLOSED',
          players: [],
          updatedAt: new Date().toISOString(),
        };
        await RoomStorage.saveRoom(closedRoom, { expectedVersion: version });
        return { success: true, data: { success: true, closed: true } };
      }

      // Empty unplayed room, delete
      await RoomStorage.deleteRoom(cleanCode);
      return { success: true, data: { success: true, closed: true } };
    }

    // If host left, assign host status to the oldest remaining player
    let newHostId = room.hostPlayerId;
    if (leavingPlayer.isHost) {
      remainingPlayers[0].isHost = true;
      newHostId = remainingPlayers[0].playerId;
    }

    // Update rematch state if active
    let updatedRematch = room.currentRematch;
    let nextStatus = room.status;

    if (updatedRematch) {
      const ready = updatedRematch.readyPlayerIds.filter((id) => id !== payload.playerId);
      const declined = updatedRematch.declinedPlayerIds.filter((id) => id !== payload.playerId);
      const allReady = remainingPlayers.length > 0 && remainingPlayers.every((p) => ready.includes(p.playerId));

      updatedRematch = {
        ...updatedRematch,
        readyPlayerIds: ready,
        declinedPlayerIds: declined,
        status: allReady ? 'READY' : 'PENDING',
        requestedByPlayerId: leavingPlayer.isHost ? newHostId : updatedRematch.requestedByPlayerId,
      };

      if (room.status === 'REMATCH_PENDING' || room.status === 'REMATCH_READY') {
        nextStatus = allReady ? 'REMATCH_READY' : 'REMATCH_PENDING';
      }
    }

    const updatedRoom: InternalRoom = {
      ...room,
      status: nextStatus,
      hostPlayerId: newHostId,
      players: remainingPlayers,
      currentRematch: updatedRematch,
    };

    await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
    return { success: true, data: { success: true } };
  }
}
