import {
  GameMode,
  Room,
  Player,
  PlayerSession,
  ApiResponse,
  RoomSessionResult,
  RoleRevealData,
  DiscussionState,
  PublicVotingState,
  MatchState,
  RoundResult,
  ScoreboardEntry,
  FinalMatchResults,
  PlayerStatistic,
  RematchState,
  RematchResponse,
  ArchivedMatch,
} from '../types/game';

const API_ENDPOINT = '/.netlify/functions/game';
const SESSION_STORAGE_KEY = 'secret_agent_session';

export class GameApiService {
  /**
   * Universal fetch helper calling /.netlify/functions/game.
   */
  private static async request<T>(payload: unknown): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as ApiResponse<T>;
      return data;
    } catch (err) {
      console.error('GameApi network error:', err);
      return {
        success: false,
        error: 'Unable to reach the agency server. Please verify your connection.',
        code: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Create a private game room.
   */
  static async createRoom(params: {
    displayName: string;
    avatarId: string;
    gameMode: GameMode;
  }): Promise<ApiResponse<RoomSessionResult>> {
    const res = await this.request<RoomSessionResult>({
      action: 'CREATE_ROOM',
      ...params,
    });

    if (res.success && res.data) {
      this.saveSession({
        playerId: res.data.player.playerId,
        sessionToken: res.data.sessionToken,
        roomCode: res.data.room.roomCode,
        displayName: res.data.player.displayName,
        avatarId: res.data.player.avatarId,
        isHost: true,
      });
    }

    return res;
  }

  /**
   * Join an existing game room.
   */
  static async joinRoom(params: {
    roomCode: string;
    displayName: string;
    avatarId: string;
  }): Promise<ApiResponse<RoomSessionResult>> {
    const res = await this.request<RoomSessionResult>({
      action: 'JOIN_ROOM',
      roomCode: params.roomCode.trim().toUpperCase(),
      displayName: params.displayName.trim(),
      avatarId: params.avatarId,
    });

    if (res.success && res.data) {
      this.saveSession({
        playerId: res.data.player.playerId,
        sessionToken: res.data.sessionToken,
        roomCode: res.data.room.roomCode,
        displayName: res.data.player.displayName,
        avatarId: res.data.player.avatarId,
        isHost: false,
      });
    }

    return res;
  }

  /**
   * Fetch current room state (safe public data).
   */
  static async getRoom(roomCode: string): Promise<ApiResponse<{ room: Room }>> {
    const session = this.getSession();
    const payload: {
      action: 'GET_ROOM';
      roomCode: string;
      playerId?: string;
      sessionToken?: string;
    } = {
      action: 'GET_ROOM',
      roomCode: roomCode.trim().toUpperCase(),
    };

    if (session && session.roomCode === roomCode.trim().toUpperCase()) {
      payload.playerId = session.playerId;
      payload.sessionToken = session.sessionToken;
    }

    return await this.request<{ room: Room }>(payload);
  }

  /**
   * Leave the current room.
   */
  static async leaveRoom(roomCode: string): Promise<ApiResponse<{ success: boolean }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      this.clearSession();
      return { success: true, data: { success: true } };
    }

    const res = await this.request<{ success: boolean }>({
      action: 'LEAVE_ROOM',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });

    this.clearSession();
    return res;
  }

  /**
   * Set player readiness (Ready / Not Ready).
   */
  static async setReady(
    roomCode: string,
    isReady: boolean
  ): Promise<ApiResponse<{ room: Room }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return {
        success: false,
        error: 'No active session credentials for this room',
        code: 'UNAUTHORIZED',
      };
    }

    return await this.request<{ room: Room }>({
      action: 'SET_READY',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      isReady,
    });
  }

  /**
   * Start Mission (Host only, capacity satisfied, all players ready).
   */
  static async startGame(roomCode: string): Promise<ApiResponse<{ room: Room }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return {
        success: false,
        error: 'No active session credentials for this room',
        code: 'UNAUTHORIZED',
      };
    }

    return await this.request<{ room: Room }>({
      action: 'START_GAME',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Securely retrieve the current player's private assigned role.
   */
  static async getMyRole(roomCode: string): Promise<ApiResponse<RoleRevealData>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return {
        success: false,
        error: 'No active session credentials for this room',
        code: 'UNAUTHORIZED',
      };
    }

    return await this.request<RoleRevealData>({
      action: 'GET_MY_ROLE',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Start the live 90-second interrogation discussion arena.
   */
  static async startDiscussion(
    roomCode: string
  ): Promise<ApiResponse<{ room: Room; discussion: DiscussionState }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ room: Room; discussion: DiscussionState }>({
      action: 'START_DISCUSSION',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Submit an interrogation question to a targeted operative.
   */
  static async submitQuestion(
    roomCode: string,
    targetPlayerId: string,
    questionText: string
  ): Promise<ApiResponse<{ discussion: DiscussionState }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ discussion: DiscussionState }>({
      action: 'SUBMIT_QUESTION',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      targetPlayerId,
      questionText,
    });
  }

  /**
   * Submit an answer to the active interrogation question.
   */
  static async submitAnswer(
    roomCode: string,
    questionId: string,
    answerText: string
  ): Promise<ApiResponse<{ discussion: DiscussionState }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ discussion: DiscussionState }>({
      action: 'SUBMIT_ANSWER',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      questionId,
      answerText,
    });
  }

  /**
   * Broadcast a classified live chat message.
   */
  static async sendChatMessage(
    roomCode: string,
    text: string
  ): Promise<ApiResponse<{ discussion: DiscussionState }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ discussion: DiscussionState }>({
      action: 'SEND_CHAT_MESSAGE',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      text,
    });
  }

  /**
   * Retrieve current discussion arena state.
   */
  static async getDiscussion(
    roomCode: string
  ): Promise<ApiResponse<{ discussion: DiscussionState }>> {
    const session = this.getSession();
    const payload: {
      action: 'GET_DISCUSSION';
      roomCode: string;
      playerId?: string;
      sessionToken?: string;
    } = {
      action: 'GET_DISCUSSION',
      roomCode: roomCode.trim().toUpperCase(),
    };

    if (session && session.roomCode === roomCode.trim().toUpperCase()) {
      payload.playerId = session.playerId;
      payload.sessionToken = session.sessionToken;
    }

    return await this.request<{ discussion: DiscussionState }>(payload);
  }

  /**
   * Start the secure voting session (Host only or automated transition).
   */
  static async startVoting(
    roomCode: string
  ): Promise<ApiResponse<{ voting: PublicVotingState }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ voting: PublicVotingState }>({
      action: 'START_VOTING',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Submit an immutable secret ballot vote for a suspect.
   */
  static async submitVote(
    roomCode: string,
    targetPlayerId: string
  ): Promise<ApiResponse<{ voting: PublicVotingState }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ voting: PublicVotingState }>({
      action: 'SUBMIT_VOTE',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      targetPlayerId,
    });
  }

  /**
   * Retrieve current public voting state (with automatic server-side expiry handling).
   */
  static async getVoting(
    roomCode: string
  ): Promise<ApiResponse<{ voting: PublicVotingState }>> {
    const session = this.getSession();
    const payload: {
      action: 'GET_VOTING';
      roomCode: string;
      playerId?: string;
      sessionToken?: string;
    } = {
      action: 'GET_VOTING',
      roomCode: roomCode.trim().toUpperCase(),
    };

    if (session && session.roomCode === roomCode.trim().toUpperCase()) {
      payload.playerId = session.playerId;
      payload.sessionToken = session.sessionToken;
    }

    return await this.request<{ voting: PublicVotingState }>(payload);
  }

  /**
   * Close voting manually (Host only).
   */
  static async closeVoting(
    roomCode: string
  ): Promise<ApiResponse<{ voting: PublicVotingState }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ voting: PublicVotingState }>({
      action: 'CLOSE_VOTING',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Fetch current 3-round match state.
   */
  static async getMatch(
    roomCode: string
  ): Promise<ApiResponse<{ match: MatchState }>> {
    return await this.request<{ match: MatchState }>({
      action: 'GET_MATCH',
      roomCode: roomCode.trim().toUpperCase(),
    });
  }

  /**
   * Fetch sanitized scoreboard with cumulative totals.
   */
  static async getScoreboard(
    roomCode: string
  ): Promise<ApiResponse<{ scoreboard: ScoreboardEntry[] }>> {
    return await this.request<{ scoreboard: ScoreboardEntry[] }>({
      action: 'GET_SCOREBOARD',
      roomCode: roomCode.trim().toUpperCase(),
    });
  }

  /**
   * Apply official round scoring idempotently.
   */
  static async applyRoundScoring(
    roomCode: string
  ): Promise<ApiResponse<{ match: MatchState; roundResult: RoundResult }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ match: MatchState; roundResult: RoundResult }>({
      action: 'APPLY_ROUND_SCORING',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Start next round (Round 2 or Round 3) with a new random Imposter and secret word.
   */
  static async startNextRound(
    roomCode: string
  ): Promise<ApiResponse<{ room: Room; match: MatchState }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ room: Room; match: MatchState }>({
      action: 'START_NEXT_ROUND',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
    * Mark match completed once Round 3 concludes.
    */
  static async completeMatch(
    roomCode: string
  ): Promise<ApiResponse<{ match: MatchState }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ match: MatchState }>({
      action: 'COMPLETE_MATCH',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Fetch immutable final match results (Leaderboard, Champions, Special Awards, Statistics).
   */
  static async getFinalResults(
    roomCode: string
  ): Promise<ApiResponse<{ finalResults: FinalMatchResults }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ finalResults: FinalMatchResults }>({
      action: 'GET_FINAL_RESULTS',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Fetch derived player performance statistics across all 3 rounds.
   */
  static async getPlayerStatistics(
    roomCode: string,
    targetPlayerId?: string
  ): Promise<ApiResponse<{ statistics: Record<string, PlayerStatistic> }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ statistics: Record<string, PlayerStatistic> }>({
      action: 'GET_PLAYER_STATISTICS',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      targetPlayerId,
    });
  }

  /**
   * Fetch round-by-round match history for all 3 rounds.
   */
  static async getMatchHistory(
    roomCode: string
  ): Promise<ApiResponse<{ roundHistory: RoundResult[] }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ roundHistory: RoundResult[] }>({
      action: 'GET_MATCH_HISTORY',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Request a rematch (Host only).
   */
  static async requestRematch(
    roomCode: string,
    durationSeconds?: number
  ): Promise<ApiResponse<{ room: Room; rematch: RematchState }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ room: Room; rematch: RematchState }>({
      action: 'REQUEST_REMATCH',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      durationSeconds,
    });
  }

  /**
   * Get rematch status and countdown.
   */
  static async getRematchStatus(
    roomCode: string
  ): Promise<ApiResponse<{ rematch: RematchState | null; roomStatus: Room['status'] }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ rematch: RematchState | null; roomStatus: Room['status'] }>({
      action: 'GET_REMATCH_STATUS',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Respond to rematch invitation (READY or DECLINE).
   */
  static async respondRematch(
    roomCode: string,
    response: RematchResponse
  ): Promise<ApiResponse<{ rematch: RematchState; roomStatus: Room['status'] }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ rematch: RematchState; roomStatus: Room['status'] }>({
      action: 'RESPOND_REMATCH',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      response,
    });
  }

  /**
   * Start Rematch (Host only, all eligible operatives ready).
   */
  static async startRematch(
    roomCode: string
  ): Promise<ApiResponse<{ room: Room; match: MatchState }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ room: Room; match: MatchState }>({
      action: 'START_REMATCH',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Cancel Rematch (Host only).
   */
  static async cancelRematch(
    roomCode: string
  ): Promise<ApiResponse<{ room: Room }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ room: Room }>({
      action: 'CANCEL_REMATCH',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Transfer host permissions to another player.
   */
  static async transferHost(
    roomCode: string,
    targetPlayerId: string
  ): Promise<ApiResponse<{ room: Room }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ room: Room }>({
      action: 'TRANSFER_HOST',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
      targetPlayerId,
    });
  }

  /**
   * Explicitly close room (Host only).
   */
  static async closeRoom(
    roomCode: string
  ): Promise<ApiResponse<{ room: Room }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ room: Room }>({
      action: 'CLOSE_ROOM',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /**
   * Expire room if inactive past threshold.
   */
  static async expireRoom(
    roomCode: string,
    inactivityThresholdHours?: number
  ): Promise<ApiResponse<{ expired: boolean; room?: Room }>> {
    return await this.request<{ expired: boolean; room?: Room }>({
      action: 'EXPIRE_ROOM',
      roomCode: roomCode.trim().toUpperCase(),
      inactivityThresholdHours,
    });
  }

  /**
   * Fetch historical match archive.
   */
  static async getMatchArchive(
    roomCode: string
  ): Promise<ApiResponse<{ archive: ArchivedMatch[] }>> {
    const session = this.getSession();
    if (!session || session.roomCode !== roomCode.trim().toUpperCase()) {
      return { success: false, error: 'No active session credentials', code: 'UNAUTHORIZED' };
    }

    return await this.request<{ archive: ArchivedMatch[] }>({
      action: 'GET_MATCH_ARCHIVE',
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  }

  /* Player Session Management (localStorage - browser specific only) */

  static saveSession(session: PlayerSession): void {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn('Failed to persist session to localStorage:', err);
    }
  }

  static getSession(): PlayerSession | null {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PlayerSession;
    } catch {
      return null;
    }
  }

  static clearSession(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear session from localStorage:', err);
    }
  }

  static getLocalPlayerFromRoom(room: Room): Player | null {
    const session = this.getSession();
    if (!session) return null;
    return room.players.find((p) => p.playerId === session.playerId) || null;
  }
}
