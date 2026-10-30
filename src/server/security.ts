import crypto from 'crypto';
import { InternalRoom, Room } from '../types/game';

// Alphanumeric charset excluding easily confused characters: 0, O, 1, I, L
const ROOM_CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generate a cryptographically secure 6-character room code.
 */
export function generateRoomCode(): string {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARSET[bytes[i] % ROOM_CODE_CHARSET.length];
  }
  return code;
}

/**
 * Generate a cryptographically secure unique player ID.
 */
export function generatePlayerId(): string {
  return `op_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate a cryptographically secure random session token.
 */
export function generateSessionToken(): string {
  return `sec_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Sanitize and validate display names.
 */
export function sanitizeDisplayName(name: unknown): { valid: boolean; value: string; error?: string } {
  if (typeof name !== 'string') {
    return { valid: false, value: '', error: 'Display name must be text' };
  }
  const clean = name.trim().replace(/[<>/"'&]/g, '');
  if (clean.length < 2) {
    return { valid: false, value: '', error: 'Display name must be at least 2 characters' };
  }
  if (clean.length > 16) {
    return { valid: false, value: '', error: 'Display name cannot exceed 16 characters' };
  }
  return { valid: true, value: clean };
}

/**
 * Strip private session tokens and internal security fields before returning room data to clients.
 */
export function sanitizeRoomForPublic(internalRoom: InternalRoom): Room {
  return {
    roomCode: internalRoom.roomCode,
    roomId: internalRoom.roomId,
    hostPlayerId: internalRoom.hostPlayerId,
    gameMode: internalRoom.gameMode,
    status: internalRoom.status,
    players: internalRoom.players.map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      avatarId: p.avatarId,
      isHost: p.isHost,
      isReady: p.isReady ?? false,
      joinedAt: p.joinedAt,
    })),
    minPlayers: internalRoom.minPlayers,
    maxPlayers: internalRoom.maxPlayers,
    currentRound: internalRoom.currentRound
      ? {
          roundId: internalRoom.currentRound.roundId,
          roundNumber: internalRoom.currentRound.roundNumber,
          status: internalRoom.currentRound.status,
        }
      : undefined,
    currentDiscussion: internalRoom.currentDiscussion,
    currentVoting: internalRoom.currentVoting
      ? {
          votingId: internalRoom.currentVoting.votingId,
          roundId: internalRoom.currentVoting.roundId,
          roundNumber: internalRoom.currentVoting.roundNumber,
          status: internalRoom.currentVoting.status,
          isRevote: internalRoom.currentVoting.isRevote,
          eligibleVoterIds: internalRoom.currentVoting.eligibleVoterIds,
          eligibleTargetIds: internalRoom.currentVoting.eligibleTargetIds,
          votedPlayerIds: internalRoom.currentVoting.votedPlayerIds,
          totalVotesSubmitted: internalRoom.currentVoting.totalVotesSubmitted,
          totalEligibleVoters: internalRoom.currentVoting.totalEligibleVoters,
          startTime: internalRoom.currentVoting.startTime,
          endTime: internalRoom.currentVoting.endTime,
          durationSeconds: internalRoom.currentVoting.durationSeconds,
          version: internalRoom.currentVoting.version,
          result: internalRoom.currentVoting.result,
        }
      : undefined,
    currentMatch: internalRoom.currentMatch,
    currentRematch: internalRoom.currentRematch,
    matchHistoryArchive: internalRoom.matchHistoryArchive,
    createdAt: internalRoom.createdAt,
    updatedAt: internalRoom.updatedAt,
    version: internalRoom.version,
  };
}
