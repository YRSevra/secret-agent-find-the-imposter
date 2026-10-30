/**
 * Phase 10: Match History Archive Engine
 * Preserves completed match records, scores, and leaderboards across rematches.
 * Ensures historic matches are immutable and permanently retrievable.
 */

import {
  InternalRoom,
  ArchivedMatch,
  GetMatchArchivePayload,
  ApiResponse,
} from '../types/game';
import { RoomStorage } from './storage';
import { FinalResultsManager } from './finalResultsManager';

export class MatchHistoryManager {
  /**
   * Safely archive a completed match into the room's persistent archive.
   * Idempotent: Never duplicates an archive for the same matchId.
   */
  static archiveMatch(room: InternalRoom): ArchivedMatch {
    const match = room.currentMatch;
    if (!match) {
      throw new Error('No match state found to archive');
    }

    if (!room.matchHistoryArchive) {
      room.matchHistoryArchive = [];
    }

    // Idempotency: Return existing archived match if already archived
    const existing = room.matchHistoryArchive.find((m) => m.matchId === match.matchId);
    if (existing) {
      return existing;
    }

    // Ensure finalResults are computed
    let finalResults = match.finalResults;
    if (!finalResults && match.roundHistory.length >= 3) {
      finalResults = FinalResultsManager.computeFinalResults(room);
      match.finalResults = finalResults;
    }

    const matchNumber = room.matchHistoryArchive.length + 1;
    const archived: ArchivedMatch = {
      matchId: match.matchId,
      roomId: room.roomId,
      matchNumber,
      players: room.players.map((p) => ({
        playerId: p.playerId,
        displayName: p.displayName,
        avatarId: p.avatarId,
        isHost: p.isHost,
        isReady: p.isReady,
        joinedAt: p.joinedAt,
      })),
      totalRounds: match.totalRounds,
      roundHistory: [...match.roundHistory],
      finalScores: { ...match.cumulativeScores },
      finalLeaderboard: finalResults ? [...finalResults.leaderboard] : [],
      champions: finalResults ? [...finalResults.champions] : [],
      completedAt: match.completedAt || new Date().toISOString(),
    };

    room.matchHistoryArchive.push(archived);
    return archived;
  }

  /**
   * Fetch complete match history archive for a room.
   */
  static async getMatchArchive(
    payload: GetMatchArchivePayload
  ): Promise<ApiResponse<{ archive: ArchivedMatch[] }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid archive query parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom) {
      return { success: false, error: `Room ${cleanCode} not found`, code: 'ROOM_NOT_FOUND' };
    }

    // Authenticate caller membership
    const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
    if (!player || player.sessionToken !== payload.sessionToken) {
      return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
    }

    return {
      success: true,
      data: {
        archive: currentRoom.matchHistoryArchive || [],
      },
    };
  }
}
