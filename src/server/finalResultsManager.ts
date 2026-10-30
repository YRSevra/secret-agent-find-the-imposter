/**
 * Phase 9: Final Match Leaderboard, Overall Champion & Match Celebration
 * Server-authoritative final results calculation, multi-round rankings,
 * derived player statistics, and performance awards engine.
 */

import {
  InternalRoom,
  FinalMatchResults,
  LeaderboardEntry,
  PlayerStatistic,
  SpecialAward,
  GetFinalResultsPayload,
  GetPlayerStatisticsPayload,
  GetMatchHistoryPayload,
  ApiResponse,
  RoundResult,
} from '../types/game';
import { RoomStorage } from './storage';
import { getAvatarById } from '../constants/avatars';

export class FinalResultsManager {
  /**
   * Calculate final match results idempotently.
   * Pure calculation based strictly on recorded match state and round history.
   */
  static computeFinalResults(room: InternalRoom): FinalMatchResults {
    const match = room.currentMatch;
    if (!match) {
      throw new Error('Cannot compute final results without match state');
    }

    const roundHistory = match.roundHistory;
    const statistics: Record<string, PlayerStatistic> = {};
    const unrankedEntries: Omit<LeaderboardEntry, 'rank' | 'isChampion'>[] = [];

    // 1. Compute per-player statistics and leaderboard data
    for (const player of room.players) {
      const avatar = getAvatarById(player.avatarId);
      const codename = avatar.codename || player.displayName.toUpperCase();
      const totalPoints = match.cumulativeScores[player.playerId] || 0;

      const roundScores: Record<number, number> = {};
      let agentWins = 0;
      let imposterWins = 0;
      let timesSuspected = 0;
      let imposterSurvived = 0;
      let correctVotes = 0;
      let totalVotes = 0;

      for (const round of roundHistory) {
        const roundPts = round.playerRoundPoints[player.playerId] || 0;
        roundScores[round.roundNumber] = roundPts;

        const isImposterInRound = round.imposterPlayerId === player.playerId;

        if (isImposterInRound) {
          if (round.outcome === 'IMPOSTER_WIN') {
            imposterWins++;
          }
          if (round.selectedPlayerId !== player.playerId) {
            imposterSurvived++;
          }
        } else {
          if (round.outcome === 'AGENTS_WIN') {
            agentWins++;
          }
        }

        if (round.selectedPlayerId === player.playerId) {
          timesSuspected++;
        }

        // Check voting accuracy
        if (round.votes) {
          const userVote = round.votes.find((v) => v.voterPlayerId === player.playerId);
          if (userVote) {
            totalVotes++;
            if (userVote.targetPlayerId === round.imposterPlayerId) {
              correctVotes++;
            }
          }
        } else if (round.votingResult) {
          // If individual votes weren't saved, fall back to outcome correlation
          if (!isImposterInRound && round.outcome === 'AGENTS_WIN') {
            correctVotes++;
            totalVotes++;
          }
        }
      }

      statistics[player.playerId] = {
        playerId: player.playerId,
        displayName: player.displayName,
        avatarId: player.avatarId,
        codename,
        totalPoints,
        agentWins,
        imposterWins,
        timesSuspected,
        imposterSurvived,
        correctVotes,
        totalVotes,
      };

      unrankedEntries.push({
        playerId: player.playerId,
        displayName: player.displayName,
        avatarId: player.avatarId,
        codename,
        totalScore: totalPoints,
        roundScores,
        agentWins,
        imposterWins,
      });
    }

    // 2. Sort descending by total cumulative score (secondary sort by name for stability)
    unrankedEntries.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    // 3. Assign standard competition ranking (1, 1, 3 etc.)
    const leaderboard: LeaderboardEntry[] = [];
    for (let i = 0; i < unrankedEntries.length; i++) {
      const entry = unrankedEntries[i];
      let rank = i + 1;
      if (i > 0 && entry.totalScore === unrankedEntries[i - 1].totalScore) {
        rank = leaderboard[i - 1].rank;
      }

      leaderboard.push({
        ...entry,
        rank,
        isChampion: rank === 1,
      });
    }

    // 4. Identify champions & tie status
    const champions = leaderboard.filter((entry) => entry.rank === 1);
    const isTie = champions.length > 1;

    // 5. Compute Special Awards based on real records
    const specialAwards: SpecialAward[] = [];

    // Award A: MASTER DETECTIVE (Most Agent Victories)
    const maxAgentWins = Math.max(...Object.values(statistics).map((s) => s.agentWins), 0);
    if (maxAgentWins > 0) {
      const winners = Object.values(statistics).filter((s) => s.agentWins === maxAgentWins);
      specialAwards.push({
        id: 'MASTER_DETECTIVE',
        title: 'Master Detective',
        description: 'Demonstrated superior deduction and led the intelligence agency to victory',
        icon: '🔍',
        winnerPlayerIds: winners.map((w) => w.playerId),
        winnerNames: winners.map((w) => w.displayName),
        metricValue: maxAgentWins,
        metricLabel: `${maxAgentWins} Agent ${maxAgentWins === 1 ? 'Victory' : 'Victories'}`,
      });
    }

    // Award B: MASTER OF DECEPTION (Most Imposter Victories)
    const maxImposterWins = Math.max(...Object.values(statistics).map((s) => s.imposterWins), 0);
    if (maxImposterWins > 0) {
      const winners = Object.values(statistics).filter((s) => s.imposterWins === maxImposterWins);
      specialAwards.push({
        id: 'MASTER_OF_DECEPTION',
        title: 'Master of Deception',
        description: 'Successfully misled operative investigations and evaded identification',
        icon: '🎭',
        winnerPlayerIds: winners.map((w) => w.playerId),
        winnerNames: winners.map((w) => w.displayName),
        metricValue: maxImposterWins,
        metricLabel: `${maxImposterWins} Imposter ${maxImposterWins === 1 ? 'Victory' : 'Victories'}`,
      });
    }

    // Award C: SURVIVOR (Most Rounds Survived as Imposter)
    const maxSurvived = Math.max(...Object.values(statistics).map((s) => s.imposterSurvived), 0);
    if (maxSurvived > 0) {
      const winners = Object.values(statistics).filter((s) => s.imposterSurvived === maxSurvived);
      specialAwards.push({
        id: 'SURVIVOR',
        title: 'Survivor',
        description: 'Infiltrated deep into enemy territory without being eliminated in voting',
        icon: '🛡️',
        winnerPlayerIds: winners.map((w) => w.playerId),
        winnerNames: winners.map((w) => w.displayName),
        metricValue: maxSurvived,
        metricLabel: `${maxSurvived} Rounds Survived`,
      });
    }

    // Award D: SHARP SHOOTER (Most Accurate Accusations)
    const maxCorrectVotes = Math.max(...Object.values(statistics).map((s) => s.correctVotes), 0);
    if (maxCorrectVotes > 0) {
      const winners = Object.values(statistics).filter((s) => s.correctVotes === maxCorrectVotes);
      specialAwards.push({
        id: 'SHARP_SHOOTER',
        title: 'Sharp Shooter',
        description: 'Consistently identified and targeted the true enemy infiltrator',
        icon: '🎯',
        winnerPlayerIds: winners.map((w) => w.playerId),
        winnerNames: winners.map((w) => w.displayName),
        metricValue: maxCorrectVotes,
        metricLabel: `${maxCorrectVotes} Accurate ${maxCorrectVotes === 1 ? 'Vote' : 'Votes'}`,
      });
    }

    const finalResults: FinalMatchResults = {
      matchId: match.matchId,
      roomId: room.roomId,
      completedAt: match.completedAt || new Date().toISOString(),
      totalRounds: match.totalRounds,
      champions,
      isTie,
      leaderboard,
      statistics,
      specialAwards,
      roundHistory: [...roundHistory],
    };

    return finalResults;
  }

  /**
   * Retrieve or calculate final match results.
   * Requires match to have completed all 3 rounds.
   */
  static async getFinalResults(
    payload: GetFinalResultsPayload
  ): Promise<ApiResponse<{ finalResults: FinalMatchResults }>> {
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

      // Authenticate operative
      const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!player || player.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }

      const match = currentRoom.currentMatch;
      if (!match) {
        return { success: false, error: 'Match state not found', code: 'MATCH_NOT_FOUND' };
      }

      // Validate all 3 rounds are finalized
      if (match.roundHistory.length < 3) {
        return {
          success: false,
          error: `Match has only completed ${match.roundHistory.length} of 3 rounds`,
          code: 'MATCH_INCOMPLETE',
        };
      }

      // Idempotency: Return cached final results if already generated
      if (match.finalResults) {
        return {
          success: true,
          data: { finalResults: match.finalResults },
        };
      }

      // Calculate final results
      const finalResults = this.computeFinalResults(currentRoom);

      // Persist immutable final results into room match state
      const updatedMatch = {
        ...match,
        status: 'MATCH_COMPLETED' as const,
        completedAt: match.completedAt || new Date().toISOString(),
        finalResults,
        version: match.version + 1,
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        status: 'MATCH_COMPLETED',
        currentMatch: updatedMatch,
        version: currentRoom.version + 1,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: { finalResults },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict finalizing match results. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Retrieve player statistics.
   */
  static async getPlayerStatistics(
    payload: GetPlayerStatisticsPayload
  ): Promise<ApiResponse<{ statistics: Record<string, PlayerStatistic> }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom) {
      return { success: false, error: `Room ${cleanCode} not found`, code: 'ROOM_NOT_FOUND' };
    }

    // Authenticate operative
    const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
    if (!player || player.sessionToken !== payload.sessionToken) {
      return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
    }

    const match = currentRoom.currentMatch;
    if (!match || match.roundHistory.length < 3) {
      return {
        success: false,
        error: 'Statistics are only available once match completes all 3 rounds',
        code: 'MATCH_INCOMPLETE',
      };
    }

    const results = match.finalResults || this.computeFinalResults(currentRoom);
    let stats = results.statistics;

    if (payload.targetPlayerId) {
      const targetStats = stats[payload.targetPlayerId];
      if (!targetStats) {
        return { success: false, error: 'Target player not found', code: 'PLAYER_NOT_FOUND' };
      }
      stats = { [payload.targetPlayerId]: targetStats };
    }

    return {
      success: true,
      data: { statistics: stats },
    };
  }

  /**
   * Retrieve match round-by-round history.
   */
  static async getMatchHistory(
    payload: GetMatchHistoryPayload
  ): Promise<ApiResponse<{ roundHistory: RoundResult[] }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom) {
      return { success: false, error: `Room ${cleanCode} not found`, code: 'ROOM_NOT_FOUND' };
    }

    // Authenticate operative
    const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
    if (!player || player.sessionToken !== payload.sessionToken) {
      return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
    }

    const match = currentRoom.currentMatch;
    if (!match || match.roundHistory.length < 3) {
      return {
        success: false,
        error: 'Match history is only available once match completes all 3 rounds',
        code: 'MATCH_INCOMPLETE',
      };
    }

    return {
      success: true,
      data: { roundHistory: match.roundHistory },
    };
  }
}
