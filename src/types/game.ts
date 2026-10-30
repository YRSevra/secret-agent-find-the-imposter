/**
 * Secret Agent – Multiplayer Game Type Definitions
 * Phase 6: Real-Time Question Turns, Answers & Live Discussion System
 */

export type GameMode = 'classic' | 'duel';

export type RoomStatus =
  | 'WAITING'
  | 'STARTING'
  | 'ROLE_REVEAL'
  | 'DISCUSSION'
  | 'VOTING'
  | 'ROUND_SUMMARY'
  | 'MATCH_COMPLETED'
  | 'REMATCH_PENDING'
  | 'REMATCH_READY'
  | 'CLOSED'
  | 'EXPIRED';

export type PlayerRole = 'AGENT' | 'IMPOSTER';

export type DiscussionStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export type TurnPhase = 'ASKING' | 'ANSWERING' | 'COMPLETED';

export type PlayerActivityStatus = 'ASKING' | 'ANSWERING' | 'WAITING' | 'COMPLETED';

export type VotingStatus = 'ACTIVE' | 'CLOSED' | 'TIE_DISCUSSION' | 'REVOTE' | 'COMPLETED';

export type VotingOutcomeStatus = 'AGENTS_WIN' | 'IMPOSTER_WIN' | 'TIE';

export type RoundOutcome = 'AGENTS_WIN' | 'IMPOSTER_WIN';

export type MatchStatus = 'MATCH_CREATED' | 'ROUND_ACTIVE' | 'ROUND_SUMMARY' | 'MATCH_COMPLETED';

export interface AvatarItem {
  id: string;
  name: string;
  codename: string;
  symbol: string; // Emoji or visual glyph
  badgeColor: string; // Accent styling
}

export interface Player {
  playerId: string;
  displayName: string;
  avatarId: string;
  isHost: boolean;
  isReady: boolean;
  joinedAt: string; // ISO 8601 UTC
}

export interface InternalPlayer extends Player {
  sessionToken: string; // Kept private on the server
}

export interface PublicRound {
  roundId: string;
  roundNumber: number;
  status: 'ROLE_REVEAL' | 'DISCUSSION' | 'VOTING' | 'COMPLETED';
}

export interface InternalRound {
  roundId: string;
  roundNumber: number;
  status: 'ROLE_REVEAL' | 'DISCUSSION' | 'VOTING' | 'COMPLETED';
  selectedCategory: string;
  secretWord: string;
  imposterPlayerId: string;
  playerRoles: Record<string, PlayerRole>;
  createdAt: string;
}

export interface QuestionItem {
  id: string;
  authorPlayerId: string;
  authorDisplayName: string;
  authorAvatarId: string;
  targetPlayerId: string;
  targetDisplayName: string;
  targetAvatarId: string;
  questionText: string;
  timestamp: string;
}

export interface AnswerItem {
  id: string;
  questionId: string;
  authorPlayerId: string;
  authorDisplayName: string;
  authorAvatarId: string;
  answerText: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  senderPlayerId: string;
  displayName: string;
  avatarId: string;
  text: string;
  timestamp: string;
}

export interface DiscussionState {
  discussionId: string;
  roundId: string;
  roundNumber: number;
  status: DiscussionStatus;
  playerOrder: string[];
  currentTurnIndex: number;
  currentPhase: TurnPhase;
  activePlayerId: string;
  targetPlayerId: string | null;
  startTime: string; // ISO 8601 UTC
  endTime: string; // ISO 8601 UTC (authoritative countdown end)
  durationSeconds: number; // 90
  questions: QuestionItem[];
  answers: AnswerItem[];
  messages: ChatMessage[];
  version: number;
}

export interface PrivateVote {
  voterPlayerId: string;
  targetPlayerId: string;
  submittedAt: string; // ISO 8601 UTC
}

export interface VotingResult {
  votingId: string;
  roundId: string;
  totalEligiblePlayers: number;
  totalVotesSubmitted: number;
  abstentions: number;
  voteCounts: Record<string, number>; // targetPlayerId -> total votes received
  highestVoteCount: number;
  tiedPlayerIds: string[];
  selectedPlayerId: string | null;
  resultStatus: VotingOutcomeStatus; // 'AGENTS_WIN' | 'IMPOSTER_WIN' | 'TIE'
  revealedRole?: PlayerRole;
  actualImposterId?: string;
  eliminatedPlayerId?: string | null;
}

export interface PublicVotingState {
  votingId: string;
  roundId: string;
  roundNumber: number;
  status: VotingStatus;
  isRevote: boolean;
  eligibleVoterIds: string[];
  eligibleTargetIds: string[];
  votedPlayerIds: string[]; // List of voter player IDs who have submitted their vote
  totalVotesSubmitted: number;
  totalEligibleVoters: number;
  startTime: string; // ISO 8601 UTC
  endTime: string; // ISO 8601 UTC
  durationSeconds: number; // 60 for standard voting, 30 for tie discussion
  version: number;
  result?: VotingResult; // Available only once voting is closed or tie discussion begins
}

export interface InternalVotingState extends PublicVotingState {
  privateVotes: PrivateVote[]; // Authoritative votes kept strictly secret on server
  tieBreakCount: number; // 0 for initial vote, 1 for revote
}

export interface RoundResult {
  roundId: string;
  roundNumber: number;
  imposterPlayerId: string; // Revealed after round concludes
  secretWord: string; // Revealed after round concludes
  category: string;
  outcome: RoundOutcome;
  selectedPlayerId: string | null;
  playerRoundPoints: Record<string, number>; // playerId -> points earned in this round (+1 for agents, +2 for imposter)
  votingResult: VotingResult;
  scoringApplied: boolean;
  completedAt: string;
  votes?: PrivateVote[];
}

export interface MatchState {
  matchId: string;
  roomId: string;
  status: MatchStatus;
  currentRoundNumber: number;
  totalRounds: number; // 3
  playerIds: string[];
  cumulativeScores: Record<string, number>; // playerId -> total cumulative score
  roundHistory: RoundResult[];
  createdAt: string;
  completedAt?: string;
  version: number;
  finalResults?: FinalMatchResults;
}

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  avatarId: string;
  codename: string;
  rank: number;
  totalScore: number;
  roundScores: Record<number, number>; // roundNumber -> score
  agentWins: number;
  imposterWins: number;
  isChampion: boolean;
}

export interface PlayerStatistic {
  playerId: string;
  displayName: string;
  avatarId: string;
  codename: string;
  totalPoints: number;
  agentWins: number;
  imposterWins: number;
  timesSuspected: number;
  imposterSurvived: number;
  correctVotes: number;
  totalVotes: number;
}

export type SpecialAwardType =
  | 'MASTER_DETECTIVE'
  | 'MASTER_OF_DECEPTION'
  | 'SHARP_SHOOTER'
  | 'SURVIVOR';

export interface SpecialAward {
  id: SpecialAwardType;
  title: string;
  description: string;
  icon: string;
  winnerPlayerIds: string[];
  winnerNames: string[];
  metricValue: number;
  metricLabel: string;
}

export interface FinalMatchResults {
  matchId: string;
  roomId: string;
  completedAt: string;
  totalRounds: number;
  champions: LeaderboardEntry[];
  isTie: boolean;
  leaderboard: LeaderboardEntry[];
  statistics: Record<string, PlayerStatistic>;
  specialAwards: SpecialAward[];
  roundHistory: RoundResult[];
}

export interface ScoreboardEntry {
  playerId: string;
  displayName: string;
  avatarId: string;
  cumulativeScore: number;
  roundScores: Record<number, number>; // roundNumber -> score in round
}

export type RematchResponse = 'READY' | 'DECLINE';

export interface RematchState {
  rematchId: string;
  requestedByPlayerId: string;
  status: 'PENDING' | 'READY' | 'CANCELLED' | 'EXPIRED';
  readyPlayerIds: string[];
  declinedPlayerIds: string[];
  expiresAt: string; // ISO 8601 UTC
  createdAt: string; // ISO 8601 UTC
}

export interface ArchivedMatch {
  matchId: string;
  roomId: string;
  matchNumber: number; // 1, 2, 3...
  players: Player[];
  totalRounds: number;
  roundHistory: RoundResult[];
  finalScores: Record<string, number>;
  finalLeaderboard: LeaderboardEntry[];
  champions: LeaderboardEntry[];
  completedAt: string;
}

export interface Room {
  roomCode: string;
  roomId: string;
  hostPlayerId: string;
  gameMode: GameMode;
  status: RoomStatus;
  players: Player[];
  minPlayers: number;
  maxPlayers: number;
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
  version: number;
  currentRound?: PublicRound;
  currentDiscussion?: DiscussionState;
  currentVoting?: PublicVotingState;
  currentMatch?: MatchState;
  currentRematch?: RematchState;
  matchHistoryArchive?: ArchivedMatch[];
}

export interface InternalRoom extends Omit<Room, 'players' | 'currentRound' | 'currentVoting'> {
  players: InternalPlayer[];
  currentRound?: InternalRound;
  currentDiscussion?: DiscussionState;
  currentVoting?: InternalVotingState;
  currentMatch?: MatchState;
  currentRematch?: RematchState;
  matchHistoryArchive?: ArchivedMatch[];
  previousSecretWords?: string[];
}

export interface PlayerSession {
  playerId: string;
  sessionToken: string;
  roomCode: string;
  displayName: string;
  avatarId: string;
  isHost: boolean;
}

/* API Request Definitions */

export interface CreateRoomPayload {
  action: 'CREATE_ROOM';
  displayName: string;
  avatarId: string;
  gameMode: GameMode;
}

export interface JoinRoomPayload {
  action: 'JOIN_ROOM';
  roomCode: string;
  displayName: string;
  avatarId: string;
}

export interface GetRoomPayload {
  action: 'GET_ROOM';
  roomCode: string;
  playerId?: string;
  sessionToken?: string;
}

export interface LeaveRoomPayload {
  action: 'LEAVE_ROOM';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface SetReadyPayload {
  action: 'SET_READY';
  roomCode: string;
  playerId: string;
  sessionToken: string;
  isReady: boolean;
}

export interface StartGamePayload {
  action: 'START_GAME';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface GetMyRolePayload {
  action: 'GET_MY_ROLE';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface StartDiscussionPayload {
  action: 'START_DISCUSSION';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface SubmitQuestionPayload {
  action: 'SUBMIT_QUESTION';
  roomCode: string;
  playerId: string;
  sessionToken: string;
  targetPlayerId: string;
  questionText: string;
}

export interface SubmitAnswerPayload {
  action: 'SUBMIT_ANSWER';
  roomCode: string;
  playerId: string;
  sessionToken: string;
  questionId?: string;
  answerText: string;
}

export interface SendChatMessagePayload {
  action: 'SEND_CHAT_MESSAGE';
  roomCode: string;
  playerId: string;
  sessionToken: string;
  text: string;
}

export interface GetDiscussionPayload {
  action: 'GET_DISCUSSION';
  roomCode: string;
  playerId?: string;
  sessionToken?: string;
}

export interface StartVotingPayload {
  action: 'START_VOTING';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface SubmitVotePayload {
  action: 'SUBMIT_VOTE';
  roomCode: string;
  playerId: string;
  sessionToken: string;
  targetPlayerId: string;
}

export interface GetVotingPayload {
  action: 'GET_VOTING';
  roomCode: string;
  playerId?: string;
  sessionToken?: string;
}

export interface CloseVotingPayload {
  action: 'CLOSE_VOTING';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface GetMatchPayload {
  action: 'GET_MATCH';
  roomCode: string;
}

export interface GetScoreboardPayload {
  action: 'GET_SCOREBOARD';
  roomCode: string;
}

export interface ApplyRoundScoringPayload {
  action: 'APPLY_ROUND_SCORING';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface StartNextRoundPayload {
  action: 'START_NEXT_ROUND';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface CompleteMatchPayload {
  action: 'COMPLETE_MATCH';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface GetFinalResultsPayload {
  action: 'GET_FINAL_RESULTS';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface GetPlayerStatisticsPayload {
  action: 'GET_PLAYER_STATISTICS';
  roomCode: string;
  playerId: string;
  sessionToken: string;
  targetPlayerId?: string;
}

export interface GetMatchHistoryPayload {
  action: 'GET_MATCH_HISTORY';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface RequestRematchPayload {
  action: 'REQUEST_REMATCH';
  roomCode: string;
  playerId: string;
  sessionToken: string;
  durationSeconds?: number;
}

export interface GetRematchStatusPayload {
  action: 'GET_REMATCH_STATUS';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface RespondRematchPayload {
  action: 'RESPOND_REMATCH';
  roomCode: string;
  playerId: string;
  sessionToken: string;
  response: RematchResponse;
}

export interface StartRematchPayload {
  action: 'START_REMATCH';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface CancelRematchPayload {
  action: 'CANCEL_REMATCH';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface TransferHostPayload {
  action: 'TRANSFER_HOST';
  roomCode: string;
  playerId: string;
  sessionToken: string;
  targetPlayerId: string;
}

export interface CloseRoomPayload {
  action: 'CLOSE_ROOM';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export interface ExpireRoomPayload {
  action: 'EXPIRE_ROOM';
  roomCode: string;
  inactivityThresholdHours?: number;
}

export interface GetMatchArchivePayload {
  action: 'GET_MATCH_ARCHIVE';
  roomCode: string;
  playerId: string;
  sessionToken: string;
}

export type GameApiRequest =
  | CreateRoomPayload
  | JoinRoomPayload
  | GetRoomPayload
  | LeaveRoomPayload
  | SetReadyPayload
  | StartGamePayload
  | GetMyRolePayload
  | StartDiscussionPayload
  | SubmitQuestionPayload
  | SubmitAnswerPayload
  | SendChatMessagePayload
  | GetDiscussionPayload
  | StartVotingPayload
  | SubmitVotePayload
  | GetVotingPayload
  | CloseVotingPayload
  | GetMatchPayload
  | GetScoreboardPayload
  | ApplyRoundScoringPayload
  | StartNextRoundPayload
  | CompleteMatchPayload
  | GetFinalResultsPayload
  | GetPlayerStatisticsPayload
  | GetMatchHistoryPayload
  | RequestRematchPayload
  | GetRematchStatusPayload
  | RespondRematchPayload
  | StartRematchPayload
  | CancelRematchPayload
  | TransferHostPayload
  | CloseRoomPayload
  | ExpireRoomPayload
  | GetMatchArchivePayload;

/* API Response Definitions */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface RoomSessionResult {
  room: Room;
  player: Player;
  sessionToken: string;
}

export interface RoleRevealData {
  role: PlayerRole;
  roundNumber: number;
  secretWord: string | null;
  category: string | null;
  warning?: string;
}
