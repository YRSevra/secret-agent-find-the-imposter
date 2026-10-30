/**
 * Phase 7: Secure Voting System & Imposter Elimination Engine
 * Authoritative voting lifecycle, hidden privacy, tie-break engine, and round outcomes.
 */

import crypto from 'crypto';
import {
  InternalRoom,
  InternalVotingState,
  PublicVotingState,
  PrivateVote,
  VotingResult,
  StartVotingPayload,
  SubmitVotePayload,
  GetVotingPayload,
  CloseVotingPayload,
  ApiResponse,
} from '../types/game';
import { RoomStorage } from './storage';

const VOTING_DURATION_SECONDS = 60;
const TIE_DISCUSSION_DURATION_SECONDS = 30;

export class VotingManager {
  /**
   * Initialize and start the secure voting arena.
   */
  static async startVoting(
    payload: StartVotingPayload
  ): Promise<ApiResponse<{ voting: PublicVotingState }>> {
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

      // Only host or authorized transition can start voting
      if (!player.isHost) {
        return {
          success: false,
          error: 'Only the mission leader (host) can initiate the voting arena',
          code: 'HOST_ONLY',
        };
      }

      // Validate discussion state: discussion must be completed or expired
      if (currentRoom.currentDiscussion) {
        const isDiscussionExpired =
          new Date(currentRoom.currentDiscussion.endTime).getTime() <= Date.now();
        const isDiscussionDone =
          currentRoom.currentDiscussion.status === 'COMPLETED' ||
          currentRoom.currentDiscussion.status === 'EXPIRED' ||
          isDiscussionExpired;

        if (!isDiscussionDone && currentRoom.status === 'DISCUSSION') {
          return {
            success: false,
            error: 'Discussion is still active. Voting can only commence once interrogation completes or timer expires.',
            code: 'DISCUSSION_STILL_ACTIVE',
          };
        }
      }

      // Reject duplicate voting start if voting is already active, in revote, or already completed
      if (currentRoom.currentVoting) {
        if (
          currentRoom.currentVoting.status === 'ACTIVE' ||
          currentRoom.currentVoting.status === 'REVOTE' ||
          currentRoom.currentVoting.status === 'TIE_DISCUSSION'
        ) {
          return {
            success: false,
            error: 'Voting session is already in progress for this round',
            code: 'VOTING_ALREADY_ACTIVE',
          };
        }
        if (currentRoom.currentVoting.status === 'COMPLETED') {
          return {
            success: false,
            error: 'Voting has already concluded for this round',
            code: 'VOTING_ALREADY_COMPLETED',
          };
        }
      }

      const allPlayerIds = currentRoom.players.map((p) => p.playerId);
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + VOTING_DURATION_SECONDS * 1000);
      const votingId = `vote_${crypto.randomBytes(8).toString('hex')}`;

      const newVoting: InternalVotingState = {
        votingId,
        roundId: currentRoom.currentRound?.roundId || `rnd_${Date.now()}`,
        roundNumber: currentRoom.currentRound?.roundNumber || 1,
        status: 'ACTIVE',
        isRevote: false,
        eligibleVoterIds: allPlayerIds,
        eligibleTargetIds: allPlayerIds,
        votedPlayerIds: [],
        totalVotesSubmitted: 0,
        totalEligibleVoters: allPlayerIds.length,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationSeconds: VOTING_DURATION_SECONDS,
        version: 0,
        privateVotes: [],
        tieBreakCount: 0,
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        status: 'VOTING',
        currentRound: currentRoom.currentRound
          ? {
              ...currentRoom.currentRound,
              status: 'VOTING',
            }
          : undefined,
        currentVoting: newVoting,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: {
            voting: this.sanitizeVotingState(newVoting),
          },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict initializing voting arena. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Submit an immutable, secret ballot vote.
   */
  static async submitVote(
    payload: SubmitVotePayload
  ): Promise<ApiResponse<{ voting: PublicVotingState }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken || !payload.targetPlayerId) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom || !currentRoom.currentVoting) {
        return { success: false, error: 'Active voting session not found', code: 'VOTING_NOT_FOUND' };
      }

      const voting = currentRoom.currentVoting;

      // Authoritative timer check: If deadline expired, auto-close and reject late submission
      if (
        (voting.status === 'ACTIVE' || voting.status === 'REVOTE') &&
        Date.now() >= new Date(voting.endTime).getTime()
      ) {
        this.tallyVotesAndConclude(currentRoom, voting);
        await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
        return {
          success: false,
          error: 'Voting deadline has expired. Ballots are locked.',
          code: 'VOTING_EXPIRED',
        };
      }

      // Check voting status
      if (voting.status !== 'ACTIVE' && voting.status !== 'REVOTE') {
        return {
          success: false,
          error: 'Voting is not currently accepting ballots',
          code: 'VOTING_NOT_ACTIVE',
        };
      }

      // Authenticate voter
      const voter = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!voter || voter.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }

      // Check voter eligibility
      if (!voting.eligibleVoterIds.includes(voter.playerId)) {
        return {
          success: false,
          error: 'Operative is not registered in the eligible voters roster',
          code: 'NOT_ELIGIBLE_VOTER',
        };
      }

      // Check duplicate vote (voter already submitted)
      if (
        voting.votedPlayerIds.includes(voter.playerId) ||
        voting.privateVotes.some((v) => v.voterPlayerId === voter.playerId)
      ) {
        return {
          success: false,
          error: 'Ballot already submitted and locked. Votes cannot be modified.',
          code: 'DUPLICATE_VOTE',
        };
      }

      // Check self-voting rule
      if (payload.targetPlayerId === voter.playerId) {
        return {
          success: false,
          error: 'Self-voting is strictly prohibited by agency protocol',
          code: 'CANNOT_VOTE_FOR_SELF',
        };
      }

      // Validate target is in the room
      const targetPlayer = currentRoom.players.find((p) => p.playerId === payload.targetPlayerId);
      if (!targetPlayer) {
        return {
          success: false,
          error: 'Target suspect is not a registered operative in this room',
          code: 'TARGET_NOT_IN_ROOM',
        };
      }

      // Validate target eligibility (must be in eligibleTargetIds, especially during revote)
      if (!voting.eligibleTargetIds.includes(payload.targetPlayerId)) {
        return {
          success: false,
          error: 'Target suspect is not eligible for elimination in this ballot',
          code: 'INVALID_VOTE_TARGET',
        };
      }

      // Record vote into private store
      const privateVote: PrivateVote = {
        voterPlayerId: voter.playerId,
        targetPlayerId: payload.targetPlayerId,
        submittedAt: new Date().toISOString(),
      };

      const updatedPrivateVotes = [...voting.privateVotes, privateVote];
      const updatedVotedPlayerIds = [...voting.votedPlayerIds, voter.playerId];
      const totalSubmitted = updatedVotedPlayerIds.length;

      const updatedVoting: InternalVotingState = {
        ...voting,
        privateVotes: updatedPrivateVotes,
        votedPlayerIds: updatedVotedPlayerIds,
        totalVotesSubmitted: totalSubmitted,
        version: voting.version + 1,
      };

      currentRoom.currentVoting = updatedVoting;

      // If all eligible voters have submitted their ballots, immediately tally & close!
      if (totalSubmitted >= voting.totalEligibleVoters) {
        this.tallyVotesAndConclude(currentRoom, updatedVoting);
      }

      const saveResult = await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: {
            voting: this.sanitizeVotingState(currentRoom.currentVoting!),
          },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict submitting ballot. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Fetch current public voting state, automatically handling server-side expiration.
   */
  static async getVoting(
    payload: GetVotingPayload
  ): Promise<ApiResponse<{ voting: PublicVotingState }>> {
    if (!payload.roomCode) {
      return { success: false, error: 'Room code is required', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom || !currentRoom.currentVoting) {
      return { success: false, error: 'Voting state not found', code: 'VOTING_NOT_FOUND' };
    }

    // Authenticate caller if credentials are provided
    if (payload.playerId || payload.sessionToken) {
      const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!player || player.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Operative session not authorized in room', code: 'UNAUTHORIZED' };
      }
    }

    const voting = currentRoom.currentVoting;
    let mutated = false;

    // 1. Authoritative check: Voting deadline expired
    if (
      (voting.status === 'ACTIVE' || voting.status === 'REVOTE') &&
      Date.now() >= new Date(voting.endTime).getTime()
    ) {
      this.tallyVotesAndConclude(currentRoom, voting);
      mutated = true;
    }

    // 2. Authoritative check: Tie discussion timer expired -> trigger revote
    if (
      voting.status === 'TIE_DISCUSSION' &&
      Date.now() >= new Date(voting.endTime).getTime()
    ) {
      this.startRevote(currentRoom, voting);
      mutated = true;
    }

    if (mutated) {
      await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
    }

    return {
      success: true,
      data: {
        voting: this.sanitizeVotingState(currentRoom.currentVoting!),
      },
    };
  }

  /**
   * Manually or authoritatively close voting.
   */
  static async closeVoting(
    payload: CloseVotingPayload
  ): Promise<ApiResponse<{ voting: PublicVotingState }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom || !currentRoom.currentVoting) {
        return { success: false, error: 'Voting session not found', code: 'VOTING_NOT_FOUND' };
      }

      // Authenticate caller
      const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!player || player.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }

      // Only host or automated deadline can force close
      if (!player.isHost) {
        return {
          success: false,
          error: 'Only the mission leader can close the voting session',
          code: 'HOST_ONLY',
        };
      }

      const voting = currentRoom.currentVoting;
      if (voting.status !== 'ACTIVE' && voting.status !== 'REVOTE') {
        return {
          success: true,
          data: { voting: this.sanitizeVotingState(voting) },
        };
      }

      this.tallyVotesAndConclude(currentRoom, voting);

      const saveResult = await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: { voting: this.sanitizeVotingState(currentRoom.currentVoting!) },
        };
      }
    }

    return { success: false, error: 'Concurrency conflict closing voting', code: 'CONCURRENT_CONFLICT' };
  }

  /**
   * Server-authoritative vote counting and outcome resolution.
   */
  private static tallyVotesAndConclude(
    room: InternalRoom,
    voting: InternalVotingState
  ): void {
    // 1. Initialize vote counts for eligible targets
    const voteCounts: Record<string, number> = {};
    for (const targetId of voting.eligibleTargetIds) {
      voteCounts[targetId] = 0;
    }

    // 2. Count votes from private store
    for (const vote of voting.privateVotes) {
      if (voting.eligibleTargetIds.includes(vote.targetPlayerId)) {
        voteCounts[vote.targetPlayerId] = (voteCounts[vote.targetPlayerId] || 0) + 1;
      }
    }

    const totalVotesSubmitted = voting.privateVotes.length;
    const abstentions = Math.max(0, voting.totalEligibleVoters - totalVotesSubmitted);

    // 3. Determine highest vote count
    const counts = Object.values(voteCounts);
    const highestVoteCount = counts.length > 0 ? Math.max(...counts) : 0;

    // 4. Identify suspects with the highest vote count
    let tiedPlayerIds: string[] = [];
    if (totalVotesSubmitted === 0) {
      // Zero valid votes: All eligible targets are tied
      tiedPlayerIds = [...voting.eligibleTargetIds];
    } else {
      tiedPlayerIds = Object.keys(voteCounts).filter(
        (targetId) => voteCounts[targetId] === highestVoteCount
      );
    }

    const isTie = tiedPlayerIds.length !== 1;
    const imposterId = room.currentRound?.imposterPlayerId;

    if (!isTie) {
      // --- UNIQUE WINNER IDENTIFIED ---
      const selectedPlayerId = tiedPlayerIds[0];
      const isImposter = selectedPlayerId === imposterId;
      const resultStatus = isImposter ? 'AGENTS_WIN' : 'IMPOSTER_WIN';
      const revealedRole = isImposter ? 'IMPOSTER' : 'AGENT';

      const result: VotingResult = {
        votingId: voting.votingId,
        roundId: voting.roundId,
        totalEligiblePlayers: voting.totalEligibleVoters,
        totalVotesSubmitted,
        abstentions,
        voteCounts,
        highestVoteCount,
        tiedPlayerIds: [],
        selectedPlayerId,
        resultStatus,
        revealedRole,
        actualImposterId: imposterId,
        eliminatedPlayerId: selectedPlayerId,
      };

      voting.status = 'COMPLETED';
      voting.result = result;
      voting.version += 1;
    } else {
      // --- TIE ENCOUNTERED ---
      if (voting.tieBreakCount === 0) {
        // --- FIRST TIE: Initiate 30s Tie Discussion & Prepare Revote ---
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + TIE_DISCUSSION_DURATION_SECONDS * 1000);

        const result: VotingResult = {
          votingId: voting.votingId,
          roundId: voting.roundId,
          totalEligiblePlayers: voting.totalEligibleVoters,
          totalVotesSubmitted,
          abstentions,
          voteCounts,
          highestVoteCount,
          tiedPlayerIds,
          selectedPlayerId: null,
          resultStatus: 'TIE',
          revealedRole: undefined,
          actualImposterId: undefined, // Role remains hidden during tie discussion!
          eliminatedPlayerId: null,
        };

        voting.status = 'TIE_DISCUSSION';
        voting.durationSeconds = TIE_DISCUSSION_DURATION_SECONDS;
        voting.startTime = startTime.toISOString();
        voting.endTime = endTime.toISOString();
        voting.result = result;
        voting.version += 1;
      } else {
        // --- SECOND TIE: Imposter Wins! ---
        const result: VotingResult = {
          votingId: voting.votingId,
          roundId: voting.roundId,
          totalEligiblePlayers: voting.totalEligibleVoters,
          totalVotesSubmitted,
          abstentions,
          voteCounts,
          highestVoteCount,
          tiedPlayerIds,
          selectedPlayerId: null,
          resultStatus: 'IMPOSTER_WIN',
          revealedRole: undefined,
          actualImposterId: imposterId,
          eliminatedPlayerId: null,
        };

        voting.status = 'COMPLETED';
        voting.result = result;
        voting.version += 1;
      }
    }
  }

  /**
   * Transition from tie discussion into the final revote.
   */
  private static startRevote(
    _room: InternalRoom,
    voting: InternalVotingState
  ): void {
    const tiedSuspects = voting.result?.tiedPlayerIds || voting.eligibleTargetIds;
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + VOTING_DURATION_SECONDS * 1000);

    voting.votingId = `revote_${crypto.randomBytes(8).toString('hex')}`;
    voting.status = 'REVOTE';
    voting.isRevote = true;
    voting.tieBreakCount = 1;
    voting.eligibleTargetIds = tiedSuspects;
    voting.votedPlayerIds = [];
    voting.totalVotesSubmitted = 0;
    voting.privateVotes = [];
    voting.startTime = startTime.toISOString();
    voting.endTime = endTime.toISOString();
    voting.durationSeconds = VOTING_DURATION_SECONDS;
    voting.result = undefined;
    voting.version += 1;
  }

  /**
   * Sanitize internal voting state into safe public payload.
   * Strips private individual ballots and unrevealed roles.
   */
  static sanitizeVotingState(internal: InternalVotingState): PublicVotingState {
    return {
      votingId: internal.votingId,
      roundId: internal.roundId,
      roundNumber: internal.roundNumber,
      status: internal.status,
      isRevote: internal.isRevote,
      eligibleVoterIds: internal.eligibleVoterIds,
      eligibleTargetIds: internal.eligibleTargetIds,
      votedPlayerIds: internal.votedPlayerIds,
      totalVotesSubmitted: internal.totalVotesSubmitted,
      totalEligibleVoters: internal.totalEligibleVoters,
      startTime: internal.startTime,
      endTime: internal.endTime,
      durationSeconds: internal.durationSeconds,
      version: internal.version,
      result: internal.result,
    };
  }
}
