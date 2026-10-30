/**
 * Phase 8: Scoring System, Three-Round Match Architecture & Automatic Transitions
 * Server-authoritative cumulative score tracker, idempotent scoring, and round progression.
 */

import crypto from 'crypto';
import {
  InternalRoom,
  MatchState,
  RoundResult,
  ScoreboardEntry,
  ApplyRoundScoringPayload,
  StartNextRoundPayload,
  GetMatchPayload,
  GetScoreboardPayload,
  CompleteMatchPayload,
  ApiResponse,
} from '../types/game';
import { RoomStorage } from './storage';
import { createNewRound } from './roleAssignment';
import { sanitizeRoomForPublic } from './security';

export class ScoreManager {
  /**
   * Initialize a new 3-round match state for a room.
   */
  static initMatch(room: InternalRoom): MatchState {
    const playerIds = room.players.map((p) => p.playerId);
    const cumulativeScores: Record<string, number> = {};
    for (const id of playerIds) {
      cumulativeScores[id] = 0;
    }

    const match: MatchState = {
      matchId: `match_${crypto.randomBytes(8).toString('hex')}`,
      roomId: room.roomId,
      status: 'ROUND_ACTIVE',
      currentRoundNumber: 1,
      totalRounds: 3,
      playerIds,
      cumulativeScores,
      roundHistory: [],
      createdAt: new Date().toISOString(),
      version: 0,
    };

    return match;
  }

  /**
   * Apply official round scoring idempotently.
   * Rules:
   * - AGENTS WIN: Every Agent receives +1 point. Imposter receives 0 points.
   * - IMPOSTER WINS (or 2nd tie): Imposter receives +2 points. All Agents receive 0 points.
   */
  static async applyRoundScoring(
    payload: ApplyRoundScoringPayload
  ): Promise<ApiResponse<{ match: MatchState; roundResult: RoundResult }>> {
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

      // Check voting conclusion
      if (!currentRoom.currentVoting || !currentRoom.currentVoting.result) {
        return {
          success: false,
          error: 'Cannot calculate round points before voting concludes',
          code: 'VOTING_NOT_CONCLUDED',
        };
      }

      const currentRound = currentRoom.currentRound;
      if (!currentRound) {
        return { success: false, error: 'No active round found for scoring', code: 'ROUND_NOT_FOUND' };
      }

      // Initialize match state if not yet attached
      if (!currentRoom.currentMatch) {
        currentRoom.currentMatch = this.initMatch(currentRoom);
      }

      const match = currentRoom.currentMatch;

      // Idempotency check: Has this round already been scored?
      const existingResult = match.roundHistory.find((r) => r.roundId === currentRound.roundId);
      if (existingResult) {
        return {
          success: true,
          data: {
            match,
            roundResult: existingResult,
          },
        };
      }

      // Calculate round points according to official rules
      const imposterId = currentRound.imposterPlayerId;
      const votingRes = currentRoom.currentVoting.result;
      const isAgentsWin = votingRes.resultStatus === 'AGENTS_WIN';

      const playerRoundPoints: Record<string, number> = {};
      const updatedCumulative = { ...match.cumulativeScores };

      for (const p of currentRoom.players) {
        let pts = 0;
        if (isAgentsWin) {
          // Agents win: Agents get +1, Imposter gets 0
          pts = p.playerId === imposterId ? 0 : 1;
        } else {
          // Imposter wins (or 2nd tie): Imposter gets +2, Agents get 0
          pts = p.playerId === imposterId ? 2 : 0;
        }
        playerRoundPoints[p.playerId] = pts;
        updatedCumulative[p.playerId] = (updatedCumulative[p.playerId] || 0) + pts;
      }

      const roundResult: RoundResult = {
        roundId: currentRound.roundId,
        roundNumber: currentRound.roundNumber,
        imposterPlayerId: imposterId,
        secretWord: currentRound.secretWord,
        category: currentRound.selectedCategory,
        outcome: isAgentsWin ? 'AGENTS_WIN' : 'IMPOSTER_WIN',
        selectedPlayerId: votingRes.selectedPlayerId,
        playerRoundPoints,
        votingResult: votingRes,
        scoringApplied: true,
        completedAt: new Date().toISOString(),
        votes: currentRoom.currentVoting?.privateVotes
          ? [...currentRoom.currentVoting.privateVotes]
          : undefined,
      };

      const updatedHistory = [...match.roundHistory, roundResult];
      const isMatchComplete = currentRound.roundNumber >= 3;

      const updatedMatch: MatchState = {
        ...match,
        status: isMatchComplete ? 'MATCH_COMPLETED' : 'ROUND_SUMMARY',
        cumulativeScores: updatedCumulative,
        roundHistory: updatedHistory,
        completedAt: isMatchComplete ? new Date().toISOString() : undefined,
        version: match.version + 1,
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        status: isMatchComplete ? 'MATCH_COMPLETED' : 'ROUND_SUMMARY',
        currentMatch: updatedMatch,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: {
            match: updatedMatch,
            roundResult,
          },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict applying round scoring. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Progress match to the next round with a new random Imposter and new secret word.
   */
  static async startNextRound(
    payload: StartNextRoundPayload
  ): Promise<ApiResponse<{ room: ReturnType<typeof sanitizeRoomForPublic>; match: MatchState }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom || !currentRoom.currentMatch) {
        return { success: false, error: 'Active match not found', code: 'MATCH_NOT_FOUND' };
      }

      // Authenticate caller (Host only)
      const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!player || player.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }
      if (!player.isHost) {
        return {
          success: false,
          error: 'Only the mission leader (host) can initiate the next round',
          code: 'HOST_ONLY',
        };
      }

      const match = currentRoom.currentMatch;
      const currentRoundNum = match.currentRoundNumber;

      // Reject progression beyond 3 rounds
      if (currentRoundNum >= 3 || match.status === 'MATCH_COMPLETED') {
        return {
          success: false,
          error: 'Match has concluded all 3 rounds. No subsequent rounds can be initialized.',
          code: 'MATCH_ALREADY_COMPLETED',
        };
      }

      // Verify current round has been scored before advancing
      const isCurrentScored = match.roundHistory.some((r) => r.roundNumber === currentRoundNum);
      if (!isCurrentScored) {
        return {
          success: false,
          error: 'Current round scoring must be recorded before advancing to next round',
          code: 'ROUND_NOT_SCORED',
        };
      }

      const nextRoundNumber = currentRoundNum + 1;
      const prevWords = [
        ...(currentRoom.previousSecretWords || []),
        ...(currentRoom.currentRound?.secretWord ? [currentRoom.currentRound.secretWord] : []),
      ];

      // Cryptographically assign new Imposter and new secret word
      const nextInternalRound = createNewRound(currentRoom.players, prevWords, nextRoundNumber);

      const updatedMatch: MatchState = {
        ...match,
        status: 'ROUND_ACTIVE',
        currentRoundNumber: nextRoundNumber,
        version: match.version + 1,
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        status: 'ROLE_REVEAL',
        currentRound: nextInternalRound,
        currentDiscussion: undefined, // Reset discussion for new round
        currentVoting: undefined,     // Reset voting for new round
        currentMatch: updatedMatch,
        previousSecretWords: prevWords,
        version: currentRoom.version + 1,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: {
            room: sanitizeRoomForPublic(updatedRoom),
            match: updatedMatch,
          },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict advancing to next round. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Fetch current match state.
   */
  static async getMatch(
    payload: GetMatchPayload
  ): Promise<ApiResponse<{ match: MatchState }>> {
    if (!payload.roomCode) {
      return { success: false, error: 'Room code is required', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom || !currentRoom.currentMatch) {
      return { success: false, error: 'Match state not found', code: 'MATCH_NOT_FOUND' };
    }

    return {
      success: true,
      data: { match: currentRoom.currentMatch },
    };
  }

  /**
   * Fetch sanitized scoreboard with cumulative totals and per-round score history.
   */
  static async getScoreboard(
    payload: GetScoreboardPayload
  ): Promise<ApiResponse<{ scoreboard: ScoreboardEntry[] }>> {
    if (!payload.roomCode) {
      return { success: false, error: 'Room code is required', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom || !currentRoom.currentMatch) {
      return { success: false, error: 'Match state not found', code: 'MATCH_NOT_FOUND' };
    }

    const match = currentRoom.currentMatch;
    const scoreboard: ScoreboardEntry[] = currentRoom.players.map((p) => {
      const roundScores: Record<number, number> = {};
      for (const r of match.roundHistory) {
        roundScores[r.roundNumber] = r.playerRoundPoints[p.playerId] || 0;
      }

      return {
        playerId: p.playerId,
        displayName: p.displayName,
        avatarId: p.avatarId,
        cumulativeScore: match.cumulativeScores[p.playerId] || 0,
        roundScores,
      };
    });

    // Sort descending by cumulative score
    scoreboard.sort((a, b) => b.cumulativeScore - a.cumulativeScore);

    return {
      success: true,
      data: { scoreboard },
    };
  }

  /**
   * Mark match completed once Round 3 is finalized.
   */
  static async completeMatch(
    payload: CompleteMatchPayload
  ): Promise<ApiResponse<{ match: MatchState }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom || !currentRoom.currentMatch) {
      return { success: false, error: 'Match state not found', code: 'MATCH_NOT_FOUND' };
    }

    const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
    if (!player || player.sessionToken !== payload.sessionToken) {
      return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
    }

    const match = currentRoom.currentMatch;
    if (match.roundHistory.length < 3) {
      return {
        success: false,
        error: 'Cannot complete match before all 3 rounds are finalized',
        code: 'MATCH_INCOMPLETE',
      };
    }

    match.status = 'MATCH_COMPLETED';
    match.completedAt = match.completedAt || new Date().toISOString();
    currentRoom.status = 'MATCH_COMPLETED';

    await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
    return { success: true, data: { match } };
  }
}
