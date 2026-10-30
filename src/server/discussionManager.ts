import crypto from 'crypto';
import {
  InternalRoom,
  DiscussionState,
  QuestionItem,
  AnswerItem,
  ChatMessage,
  ApiResponse,
  StartDiscussionPayload,
  SubmitQuestionPayload,
  SubmitAnswerPayload,
  SendChatMessagePayload,
  GetDiscussionPayload,
  Room,
} from '../types/game';
import { RoomStorage } from './storage';
import { sanitizeRoomForPublic } from './security';

const DISCUSSION_DURATION_SECONDS = 90;

export class DiscussionManager {
  /**
   * Check if discussion has expired based on authoritative server timestamp.
   */
  static checkExpiry(discussion: DiscussionState, nowMs: number = Date.now()): boolean {
    if (discussion.status === 'ACTIVE') {
      const endMs = new Date(discussion.endTime).getTime();
      if (nowMs >= endMs) {
        discussion.status = 'EXPIRED';
        discussion.currentPhase = 'COMPLETED';
        return true;
      }
    }
    return false;
  }

  /**
   * Escape and sanitize user chat and question text against HTML injection.
   */
  static sanitizeText(input: unknown): string {
    if (typeof input !== 'string') return '';
    return input
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Initialize and start the live 90-second discussion arena.
   */
  static async startDiscussion(
    payload: StartDiscussionPayload
  ): Promise<ApiResponse<{ room: Room; discussion: DiscussionState }>> {
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

      // Authenticate caller is in room
      const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!player || player.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }

      // Only host can start discussion
      if (!player.isHost) {
        return {
          success: false,
          error: 'Only the mission leader (host) can initiate discussion arena',
          code: 'HOST_ONLY',
        };
      }

      // Check room status
      if (currentRoom.status !== 'ROLE_REVEAL' && currentRoom.status !== 'DISCUSSION') {
        return {
          success: false,
          error: 'Room must be in role reveal phase to commence discussion arena',
          code: 'INVALID_ROOM_STATUS',
        };
      }

      // If discussion already exists and is active, reject duplicate start
      if (currentRoom.currentDiscussion && currentRoom.currentDiscussion.status === 'ACTIVE') {
        return {
          success: false,
          error: 'Discussion is already active for this room',
          code: 'DISCUSSION_ALREADY_ACTIVE',
        };
      }

      // Create new Discussion State
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + DISCUSSION_DURATION_SECONDS * 1000);

      // Player turn order: host first, then remaining players in joined order
      const hostId = currentRoom.hostPlayerId;
      const nonHostIds = currentRoom.players
        .filter((p) => p.playerId !== hostId)
        .map((p) => p.playerId);
      const playerOrder = [hostId, ...nonHostIds];

      const discussionId = `disc_${crypto.randomBytes(8).toString('hex')}`;

      const newDiscussion: DiscussionState = {
        discussionId,
        roundId: currentRoom.currentRound?.roundId || `rnd_${Date.now()}`,
        roundNumber: currentRoom.currentRound?.roundNumber || 1,
        status: 'ACTIVE',
        playerOrder,
        currentTurnIndex: 0,
        currentPhase: 'ASKING',
        activePlayerId: playerOrder[0],
        targetPlayerId: null,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationSeconds: DISCUSSION_DURATION_SECONDS,
        questions: [],
        answers: [],
        messages: [],
        version: 1,
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        status: 'DISCUSSION',
        currentDiscussion: newDiscussion,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return {
          success: true,
          data: {
            room: sanitizeRoomForPublic(updatedRoom),
            discussion: newDiscussion,
          },
        };
      }
    }

    return {
      success: false,
      error: 'Concurrency conflict initializing discussion arena. Please retry.',
      code: 'CONCURRENT_CONFLICT',
    };
  }

  /**
   * Submit a structured interrogation question.
   */
  static async submitQuestion(
    payload: SubmitQuestionPayload
  ): Promise<ApiResponse<{ discussion: DiscussionState }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const cleanQuestion = this.sanitizeText(payload.questionText);
    if (!cleanQuestion || cleanQuestion.length < 2) {
      return { success: false, error: 'Question must be at least 2 characters', code: 'EMPTY_QUESTION' };
    }
    if (cleanQuestion.length > 200) {
      return { success: false, error: 'Question cannot exceed 200 characters', code: 'QUESTION_TOO_LONG' };
    }

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom || !currentRoom.currentDiscussion) {
        return { success: false, error: 'Active discussion not found', code: 'DISCUSSION_NOT_FOUND' };
      }

      const disc = currentRoom.currentDiscussion;
      const expired = this.checkExpiry(disc);
      if (expired) {
        await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
        return { success: false, error: 'Discussion timer has expired. Interrogation closed.', code: 'DISCUSSION_EXPIRED' };
      }
      if (disc.status !== 'ACTIVE') {
        return { success: false, error: 'Discussion has concluded. No further interrogation allowed.', code: 'DISCUSSION_NOT_ACTIVE' };
      }

      // Authenticate author
      const author = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!author || author.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }

      // Check turn phase
      if (disc.currentPhase !== 'ASKING') {
        return {
          success: false,
          error: 'Current phase is not asking. Awaiting answer or next turn.',
          code: 'INVALID_TURN_PHASE',
        };
      }

      // Check active player authority
      if (disc.activePlayerId !== payload.playerId) {
        return {
          success: false,
          error: 'It is not your turn to interrogate an operative.',
          code: 'NOT_YOUR_TURN',
        };
      }

      // Validate target player
      if (payload.targetPlayerId === payload.playerId) {
        return {
          success: false,
          error: 'Operatives cannot interrogate themselves. Direct your inquiry to another operative.',
          code: 'CANNOT_TARGET_SELF',
        };
      }

      const target = currentRoom.players.find((p) => p.playerId === payload.targetPlayerId);
      if (!target) {
        return { success: false, error: 'Specified target operative not found in room', code: 'TARGET_NOT_IN_ROOM' };
      }

      const questionItem: QuestionItem = {
        id: `q_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        authorPlayerId: author.playerId,
        authorDisplayName: author.displayName,
        authorAvatarId: author.avatarId,
        targetPlayerId: target.playerId,
        targetDisplayName: target.displayName,
        targetAvatarId: target.avatarId,
        questionText: cleanQuestion,
        timestamp: new Date().toISOString(),
      };

      const updatedDiscussion: DiscussionState = {
        ...disc,
        currentPhase: 'ANSWERING',
        targetPlayerId: target.playerId,
        questions: [...disc.questions, questionItem],
        version: disc.version + 1,
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        currentDiscussion: updatedDiscussion,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return { success: true, data: { discussion: updatedDiscussion } };
      }
    }

    return { success: false, error: 'Concurrency conflict submitting question. Please retry.', code: 'CONCURRENT_CONFLICT' };
  }

  /**
   * Submit an answer to the active question.
   */
  static async submitAnswer(
    payload: SubmitAnswerPayload
  ): Promise<ApiResponse<{ discussion: DiscussionState }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const cleanAnswer = this.sanitizeText(payload.answerText);
    if (!cleanAnswer || cleanAnswer.length < 1) {
      return { success: false, error: 'Answer cannot be empty', code: 'EMPTY_ANSWER' };
    }
    if (cleanAnswer.length > 300) {
      return { success: false, error: 'Answer cannot exceed 300 characters', code: 'ANSWER_TOO_LONG' };
    }

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom || !currentRoom.currentDiscussion) {
        return { success: false, error: 'Active discussion not found', code: 'DISCUSSION_NOT_FOUND' };
      }

      const disc = currentRoom.currentDiscussion;
      const expired = this.checkExpiry(disc);
      if (expired) {
        await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
        return { success: false, error: 'Discussion timer has expired. Interrogation closed.', code: 'DISCUSSION_EXPIRED' };
      }
      if (disc.status !== 'ACTIVE') {
        return { success: false, error: 'Discussion has concluded. No further responses allowed.', code: 'DISCUSSION_NOT_ACTIVE' };
      }

      // Authenticate answerer
      const answerer = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!answerer || answerer.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }

      // Check turn phase
      if (disc.currentPhase !== 'ANSWERING') {
        return {
          success: false,
          error: 'Current phase is not answering. No active question awaits response.',
          code: 'INVALID_TURN_PHASE',
        };
      }

      // Check targeted answerer authority
      if (disc.targetPlayerId !== payload.playerId) {
        return {
          success: false,
          error: 'Only the targeted operative can submit an answer to this question.',
          code: 'NOT_YOUR_TURN',
        };
      }

      const lastQuestion = disc.questions[disc.questions.length - 1];
      if (!lastQuestion || (payload.questionId && lastQuestion.id !== payload.questionId)) {
        return { success: false, error: 'Mismatched interrogation question ID', code: 'INVALID_QUESTION_ID' };
      }

      // Check duplicate answer
      const alreadyAnswered = disc.answers.some((a) => a.questionId === lastQuestion.id);
      if (alreadyAnswered) {
        return { success: false, error: 'An answer has already been submitted for this question', code: 'DUPLICATE_ANSWER' };
      }

      const answerItem: AnswerItem = {
        id: `ans_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        questionId: lastQuestion.id,
        authorPlayerId: answerer.playerId,
        authorDisplayName: answerer.displayName,
        authorAvatarId: answerer.avatarId,
        answerText: cleanAnswer,
        timestamp: new Date().toISOString(),
      };

      // Progress turn index
      const nextTurnIndex = disc.currentTurnIndex + 1;
      let nextPhase: DiscussionState['currentPhase'] = 'ASKING';
      let nextActivePlayerId = '';
      let nextStatus: DiscussionState['status'] = disc.status;

      if (nextTurnIndex >= disc.playerOrder.length) {
        // All players in rotation have asked and answered!
        nextPhase = 'COMPLETED';
        nextStatus = 'COMPLETED';
        nextActivePlayerId = '';
      } else {
        nextActivePlayerId = disc.playerOrder[nextTurnIndex];
        nextPhase = 'ASKING';
      }

      const updatedDiscussion: DiscussionState = {
        ...disc,
        status: nextStatus,
        currentTurnIndex: nextTurnIndex,
        currentPhase: nextPhase,
        activePlayerId: nextActivePlayerId,
        targetPlayerId: null,
        answers: [...disc.answers, answerItem],
        version: disc.version + 1,
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        currentDiscussion: updatedDiscussion,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return { success: true, data: { discussion: updatedDiscussion } };
      }
    }

    return { success: false, error: 'Concurrency conflict submitting answer. Please retry.', code: 'CONCURRENT_CONFLICT' };
  }

  /**
   * Broadcast a classified live chat message.
   */
  static async sendChatMessage(
    payload: SendChatMessagePayload
  ): Promise<ApiResponse<{ discussion: DiscussionState }>> {
    if (!payload.roomCode || !payload.playerId || !payload.sessionToken) {
      return { success: false, error: 'Invalid parameters', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const rawText = payload.text || (payload as unknown as { messageText?: string }).messageText || '';
    const cleanText = this.sanitizeText(rawText);
    if (!cleanText || cleanText.length < 1) {
      return { success: false, error: 'Chat message cannot be empty', code: 'EMPTY_MESSAGE' };
    }
    if (cleanText.length > 300) {
      return { success: false, error: 'Chat message cannot exceed 300 characters', code: 'MESSAGE_TOO_LONG' };
    }

    let retries = 0;
    while (retries < 3) {
      retries++;
      const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
      if (!currentRoom || !currentRoom.currentDiscussion) {
        return { success: false, error: 'Active discussion not found', code: 'DISCUSSION_NOT_FOUND' };
      }

      const disc = currentRoom.currentDiscussion;
      const expired = this.checkExpiry(disc);
      if (expired || disc.status !== 'ACTIVE') {
        if (expired) await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
        return { success: false, error: 'Discussion has ended. Radio communications are closed.', code: 'DISCUSSION_EXPIRED' };
      }

      // Authenticate sender
      const sender = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!sender || sender.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Unauthorized operative credentials', code: 'UNAUTHORIZED' };
      }

      // Rate limiting: max 5 messages per 10 seconds per player
      const tenSecondsAgo = Date.now() - 10000;
      const recentCount = disc.messages.filter(
        (m) => m.senderPlayerId === sender.playerId && new Date(m.timestamp).getTime() >= tenSecondsAgo
      ).length;

      if (recentCount >= 5) {
        return {
          success: false,
          error: 'Rate limit exceeded: maximum 5 transmissions per 10 seconds',
          code: 'RATE_LIMITED',
        };
      }

      const msg: ChatMessage = {
        id: `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        senderPlayerId: sender.playerId,
        displayName: sender.displayName,
        avatarId: sender.avatarId,
        text: cleanText,
        timestamp: new Date().toISOString(),
      };

      const updatedDiscussion: DiscussionState = {
        ...disc,
        messages: [...disc.messages, msg].slice(-100),
        version: disc.version + 1,
      };

      const updatedRoom: InternalRoom = {
        ...currentRoom,
        currentDiscussion: updatedDiscussion,
      };

      const saveResult = await RoomStorage.saveRoom(updatedRoom, { expectedVersion: version });
      if (saveResult.success) {
        return { success: true, data: { discussion: updatedDiscussion } };
      }
    }

    return { success: false, error: 'Concurrency conflict transmitting radio message. Please retry.', code: 'CONCURRENT_CONFLICT' };
  }

  /**
   * Fetch current discussion state with authoritative expiry validation.
   */
  static async getDiscussion(
    payload: GetDiscussionPayload
  ): Promise<ApiResponse<{ discussion: DiscussionState }>> {
    if (!payload.roomCode) {
      return { success: false, error: 'Room code is required', code: 'INVALID_PARAMETERS' };
    }
    const cleanCode = payload.roomCode.trim().toUpperCase();

    const { room: currentRoom, version } = await RoomStorage.getRoom(cleanCode);
    if (!currentRoom || !currentRoom.currentDiscussion) {
      return { success: false, error: 'Discussion state not found', code: 'DISCUSSION_NOT_FOUND' };
    }

    // Authenticate caller if credentials provided
    if (payload.playerId || payload.sessionToken) {
      const player = currentRoom.players.find((p) => p.playerId === payload.playerId);
      if (!player || player.sessionToken !== payload.sessionToken) {
        return { success: false, error: 'Player session not found in room', code: 'UNAUTHORIZED' };
      }
    }

    const disc = currentRoom.currentDiscussion;
    const expired = this.checkExpiry(disc);
    if (expired) {
      await RoomStorage.saveRoom(currentRoom, { expectedVersion: version });
    }

    return { success: true, data: { discussion: disc } };
  }
}
