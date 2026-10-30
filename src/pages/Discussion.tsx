import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Room, Player, DiscussionState, RoleRevealData } from '../types/game';
import { GameApiService } from '../services/gameApi';
import { getAvatarById } from '../constants/avatars';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Shield,
  Clock,
  Send,
  MessageSquare,
  Users,
  Radio,
  ArrowLeft,
  Wifi,
  WifiOff,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  HelpCircle,
  Sparkles,
  Vote,
} from 'lucide-react';

export const Discussion: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [discussion, setDiscussion] = useState<DiscussionState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [roleData, setRoleData] = useState<RoleRevealData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [networkStatus, setNetworkStatus] = useState<'connected' | 'reconnecting' | 'error'>('connected');
  const [actionError, setActionError] = useState<string | null>(null);

  // Form states
  const [targetPlayerId, setTargetPlayerId] = useState<string>('');
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingVoting, setIsStartingVoting] = useState(false);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);

  // Authoritative countdown timer state
  const [remainingSeconds, setRemainingSeconds] = useState<number>(90);

  // Chat auto-scroll anchor ref
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const lastDiscVersionRef = useRef<number>(-1);
  const consecutiveFailuresRef = useRef<number>(0);

  const fetchDiscussionState = useCallback(async () => {
    if (!code) return;
    try {
      const res = await GameApiService.getRoom(code);
      if (!res.success || !res.data) {
        consecutiveFailuresRef.current++;
        if (consecutiveFailuresRef.current >= 3) {
          setNetworkStatus('error');
        } else {
          setNetworkStatus('reconnecting');
        }
        return;
      }

      consecutiveFailuresRef.current = 0;
      setNetworkStatus('connected');
      const latestRoom = res.data.room;
      setRoom(latestRoom);

      // Synchronize current local player
      const local = GameApiService.getLocalPlayerFromRoom(latestRoom);
      if (local) {
        setCurrentPlayer(local);
      } else {
        const session = GameApiService.getSession();
        if (session && session.roomCode === code.toUpperCase()) {
          const found = latestRoom.players.find((p) => p.playerId === session.playerId);
          if (found) setCurrentPlayer(found);
        }
      }

      // If room transitioned past discussion, route immediately
      if (latestRoom.status === 'VOTING') {
        navigate(`/room/${code}/voting`);
        return;
      }
      if (latestRoom.status === 'ROUND_SUMMARY') {
        navigate(`/room/${code}/round-summary`);
        return;
      }
      if (latestRoom.status === 'MATCH_COMPLETED') {
        navigate(`/room/${code}/final-results`);
        return;
      }

      // Synchronize discussion state
      if (latestRoom.currentDiscussion) {
        const disc = latestRoom.currentDiscussion;
        if (disc.version !== lastDiscVersionRef.current) {
          lastDiscVersionRef.current = disc.version;
          setDiscussion(disc);
        }
      } else if (latestRoom.status === 'ROLE_REVEAL') {
        // If room is still in role reveal, route back
        navigate(`/room/${code}/role-reveal`);
        return;
      }

      setIsLoading(false);
    } catch {
      consecutiveFailuresRef.current++;
      setNetworkStatus(consecutiveFailuresRef.current >= 3 ? 'error' : 'reconnecting');
    }
  }, [code, navigate]);

  // Initial load: fetch role & discussion
  useEffect(() => {
    const init = async () => {
      if (!code) return;
      try {
        const rRes = await GameApiService.getMyRole(code);
        if (rRes.success && rRes.data) {
          setRoleData(rRes.data);
        }
      } catch {
        // Continue even if role retrieval is pending
      }
      await fetchDiscussionState();
    };
    init();

    // 2-second polling loop
    const interval = setInterval(fetchDiscussionState, 2000);
    return () => clearInterval(interval);
  }, [code, fetchDiscussionState]);

  // Synchronized countdown ticker based on server endTime
  useEffect(() => {
    if (!discussion) return;

    const updateTimer = () => {
      const endMs = new Date(discussion.endTime).getTime();
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.ceil((endMs - nowMs) / 1000));
      setRemainingSeconds(diffSec);
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 500);
    return () => clearInterval(timerInterval);
  }, [discussion]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discussion?.messages]);

  // Handlers
  const handleStartDiscussion = async () => {
    if (!code) return;
    setActionError(null);
    setIsSubmitting(true);
    const res = await GameApiService.startDiscussion(code);
    setIsSubmitting(false);

    if (!res.success || !res.data) {
      setActionError(res.error || 'Failed to start discussion arena.');
      return;
    }
    setRoom(res.data.room);
    setDiscussion(res.data.discussion);
    lastDiscVersionRef.current = res.data.discussion.version;
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !targetPlayerId || !questionText.trim()) return;
    setActionError(null);
    setIsSubmitting(true);

    const res = await GameApiService.submitQuestion(code, targetPlayerId, questionText.trim());
    setIsSubmitting(false);

    if (!res.success || !res.data) {
      setActionError(res.error || 'Failed to submit question.');
      return;
    }
    setDiscussion(res.data.discussion);
    lastDiscVersionRef.current = res.data.discussion.version;
    setQuestionText('');
    setTargetPlayerId('');
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !discussion?.questions.length || !answerText.trim()) return;
    setActionError(null);
    setIsSubmitting(true);

    const currentQuestion = discussion.questions[discussion.questions.length - 1];
    const res = await GameApiService.submitAnswer(code, currentQuestion.id, answerText.trim());
    setIsSubmitting(false);

    if (!res.success || !res.data) {
      setActionError(res.error || 'Failed to submit answer.');
      return;
    }
    setDiscussion(res.data.discussion);
    lastDiscVersionRef.current = res.data.discussion.version;
    setAnswerText('');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput('');

    const res = await GameApiService.sendChatMessage(code, msg);
    if (!res.success || !res.data) {
      setActionError(res.error || 'Message transmission failed.');
      return;
    }
    setDiscussion(res.data.discussion);
    lastDiscVersionRef.current = res.data.discussion.version;
  };

  const handleStartVoting = async () => {
    if (!code || isStartingVoting) return;
    setIsStartingVoting(true);
    setActionError(null);
    try {
      const res = await GameApiService.startVoting(code);
      if (res.success) {
        navigate(`/room/${code}/voting`);
      } else {
        setActionError(res.error || 'Failed to initiate voting arena.');
      }
    } catch {
      setActionError('Network failure initiating voting protocol.');
    } finally {
      setIsStartingVoting(false);
    }
  };

  const handleLeave = async () => {
    if (code) {
      await GameApiService.leaveRoom(code);
    }
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <LoadingSpinner size="lg" label="CONNECTING TO SECURE DISPATCH COMM CHANNEL..." />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <Card variant="default" className="p-6 text-center space-y-4">
          <Badge variant="danger" size="md">
            CONNECTION TERMINATED
          </Badge>
          <h2 className="text-xl font-bold text-white">Discussion Link Lost</h2>
          <div className="pt-2">
            <Link to="/">
              <Button variant="secondary" size="md" fullWidth leftIcon={<ArrowLeft className="w-4 h-4" />}>
                RETURN TO BRIEFING
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Timer visual thresholds
  const isTimeExpired = remainingSeconds <= 0;
  const isCritical = remainingSeconds <= 10 && remainingSeconds > 0;
  const isWarning = remainingSeconds <= 30 && remainingSeconds > 10;
  const timerPercent = Math.max(0, Math.min(100, (remainingSeconds / 90) * 100));

  // Turn status calculations
  const isMyTurnToAsk = Boolean(
    discussion &&
      discussion.status === 'ACTIVE' &&
      discussion.currentPhase === 'ASKING' &&
      discussion.activePlayerId === currentPlayer?.playerId
  );

  const isMyTurnToAnswer = Boolean(
    discussion &&
      discussion.status === 'ACTIVE' &&
      discussion.currentPhase === 'ANSWERING' &&
      discussion.targetPlayerId === currentPlayer?.playerId
  );

  const activeQuestioner = room.players.find((p) => p.playerId === discussion?.activePlayerId);
  const targetAnswerer = room.players.find((p) => p.playerId === discussion?.targetPlayerId);
  const currentActiveQuestion = discussion?.questions.length
    ? discussion.questions[discussion.questions.length - 1]
    : null;

  // Potential targets for question: anyone except yourself
  const eligibleTargets = room.players.filter((p) => p.playerId !== currentPlayer?.playerId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-agency-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-agency-surface border border-agency-border flex items-center justify-center">
            <Shield className="w-5 h-5 text-agency-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-extrabold tracking-widest text-white">
                SECRET AGENT
              </span>
              <Badge variant="classified" size="sm" withDot>
                ROUND {discussion?.roundNumber || 1} // DISCUSSION ARENA
              </Badge>
            </div>
            <span className="text-[10px] font-mono text-agency-muted">
              CODE: {room.roomCode} • 90S INTERROGATION WINDOW
            </span>
          </div>
        </div>

        {/* Sync & Private Briefing Recall Button */}
        <div className="flex items-center gap-3">
          {roleData && (
            <button
              onClick={() => setIsBriefingModalOpen(!isBriefingModalOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-agency-surface border border-agency-border text-xs font-mono text-agency-accent hover:border-agency-accent transition-colors"
              title="Review your private assignment"
            >
              {isBriefingModalOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isBriefingModalOpen ? 'HIDE INTEL' : 'MY DOSSIER'}</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-xs font-mono text-agency-muted">
            {networkStatus === 'connected' ? (
              <span className="flex items-center gap-1 text-agency-accent">
                <Wifi className="w-3.5 h-3.5" />
                LIVE
              </span>
            ) : (
              <span className="flex items-center gap-1 text-agency-warning">
                <WifiOff className="w-3.5 h-3.5" />
                RETRYING
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Private Intel Pop-out (Collapsible for safety) */}
      {isBriefingModalOpen && roleData && (
        <div className="p-4 rounded-xl bg-agency-card border border-agency-accent/60 shadow-glow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in zoom-in-95">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-agency-surface border border-agency-border text-agency-accent">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-agency-muted">
                CONFIDENTIAL INTEL RECALL
              </span>
              <div className="font-mono text-sm font-bold text-white flex items-center gap-2">
                <span>ROLE: {roleData.role}</span>
                {roleData.role === 'AGENT' && (
                  <span className="text-agency-accent bg-agency-accent/10 px-2 py-0.5 rounded border border-agency-accent/30">
                    SECRET WORD: {roleData.secretWord} ({roleData.category})
                  </span>
                )}
                {roleData.role === 'IMPOSTER' && (
                  <span className="text-agency-warning bg-agency-warning/10 px-2 py-0.5 rounded border border-agency-warning/30">
                    IMPOSTER (WORD REDACTED)
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-agency-muted">EYES ONLY // PRIVATE</span>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-3 bg-agency-warning/10 border border-agency-warning/40 rounded-lg flex items-start gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-agency-warning shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-agency-warning leading-relaxed">{actionError}</p>
        </div>
      )}

      {/* Start Discussion Prompt (If entered but not yet started) */}
      {(!discussion || discussion.status !== 'ACTIVE') && room.status === 'ROLE_REVEAL' && (
        <Card variant="elevated" className="p-6 text-center space-y-4">
          <Badge variant="classified" size="md">
            ARENA INITIALIZATION
          </Badge>
          <h3 className="text-xl font-bold text-white">Enter Interrogation Chamber</h3>
          <p className="text-xs text-agency-muted max-w-md mx-auto">
            All operatives have inspected their classified dossiers. Initiate the 90-second interrogation clock to cross-examine suspects.
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={handleStartDiscussion}
              isLoading={isSubmitting}
              leftIcon={<Radio className="w-4 h-4" />}
            >
              COMMENCE 90-SECOND ARENA
            </Button>
          </div>
        </Card>
      )}

      {/* Main Discussion Layout */}
      {discussion && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Timer, Current Turn & Q&A Arena */}
          <div className="lg:col-span-2 space-y-6">
            {/* 90-Second Server-Authoritative Timer Panel */}
            <Card
              variant="elevated"
              className={`p-5 border transition-all ${
                isTimeExpired
                  ? 'border-agency-border bg-agency-card/50'
                  : isCritical
                  ? 'border-agency-warning/80 bg-agency-warning/10 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse'
                  : isWarning
                  ? 'border-agency-amber/60 bg-agency-amber/5'
                  : 'border-agency-accent/40 bg-agency-surface/60 shadow-glow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${isCritical ? 'text-agency-warning' : isWarning ? 'text-agency-amber' : 'text-agency-accent'}`} />
                  <span className="font-mono text-xs font-bold uppercase text-white tracking-wider">
                    {isTimeExpired
                      ? 'INTERROGATION CLOCK EXPIRED'
                      : 'OFFICIAL DISCUSSION COUNTDOWN'}
                  </span>
                </div>
                <Badge
                  variant={isTimeExpired ? 'neutral' : isCritical ? 'danger' : isWarning ? 'warning' : 'classified'}
                  size="sm"
                >
                  {isTimeExpired
                    ? 'LOCKED'
                    : discussion.status === 'COMPLETED'
                    ? 'TURNS FINISHED'
                    : `${remainingSeconds}S REMAINING`}
                </Badge>
              </div>

              {/* Large Timer Display & Progress Bar */}
              <div className="flex items-baseline justify-between mb-3">
                <div className="font-mono text-3xl sm:text-5xl font-black tracking-widest text-white">
                  00:{remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds}
                </div>
                <span className="text-[10px] font-mono text-agency-muted">
                  AUTHORITATIVE SERVER CLOCK (90S DURATION)
                </span>
              </div>

              <div className="w-full bg-agency-dark h-2 rounded-full overflow-hidden border border-agency-border/60">
                <div
                  className={`h-full transition-all duration-500 ${
                    isCritical
                      ? 'bg-agency-warning'
                      : isWarning
                      ? 'bg-agency-amber'
                      : 'bg-agency-accent shadow-glow-sm'
                  }`}
                  style={{ width: `${timerPercent}%` }}
                />
              </div>
            </Card>

            {/* Current Turn Panel */}
            <Card variant="default" className="p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-agency-border pb-2.5">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-agency-accent" />
                  <span className="font-mono text-xs font-bold text-white">
                    TURN {discussion.currentTurnIndex + 1} OF {discussion.playerOrder.length}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-agency-muted uppercase">
                  PHASE: {discussion.currentPhase}
                </span>
              </div>

              {/* Turn Participant Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Questioner */}
                <div className="p-3 bg-agency-surface rounded-lg border border-agency-border flex items-center gap-3">
                  <span className="text-2xl select-none">
                    {getAvatarById(activeQuestioner?.avatarId || 'falcon').symbol}
                  </span>
                  <div className="overflow-hidden">
                    <span className="text-[10px] font-mono text-agency-muted uppercase block">
                      INTERROGATING OPERATIVE
                    </span>
                    <div className="font-mono text-xs font-bold text-white truncate">
                      {activeQuestioner?.displayName || 'COMPLETED'}
                    </div>
                  </div>
                </div>

                {/* Target Answerer */}
                <div className="p-3 bg-agency-surface rounded-lg border border-agency-border flex items-center gap-3">
                  <span className="text-2xl select-none">
                    {getAvatarById(targetAnswerer?.avatarId || 'ghost').symbol}
                  </span>
                  <div className="overflow-hidden">
                    <span className="text-[10px] font-mono text-agency-muted uppercase block">
                      TARGETED RESPONDENT
                    </span>
                    <div className="font-mono text-xs font-bold text-white truncate">
                      {targetAnswerer?.displayName || (discussion.currentPhase === 'ASKING' ? 'SELECTING TARGET...' : 'NONE')}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Interactive Turn Action Arena */}
            {discussion.status === 'ACTIVE' && !isTimeExpired && (
              <Card variant="interactive" withReticle className="p-5 sm:p-6 space-y-4">
                {/* STATE 1: My turn to ask */}
                {isMyTurnToAsk ? (
                  <form onSubmit={handleSubmitQuestion} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-agency-accent uppercase flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        YOUR TURN TO INTERROGATE
                      </span>
                      <span className="text-[10px] font-mono text-agency-muted">MAX 200 CHARS</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-agency-muted uppercase">
                        SELECT SUSPECT TO QUESTION:
                      </label>
                      <select
                        value={targetPlayerId}
                        onChange={(e) => setTargetPlayerId(e.target.value)}
                        className="w-full bg-agency-surface border border-agency-border text-white text-xs font-mono rounded-lg p-2.5 focus:border-agency-accent focus:outline-none"
                        required
                      >
                        <option value="">-- Choose Operative --</option>
                        {eligibleTargets.map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {p.displayName} ({getAvatarById(p.avatarId).codename})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-agency-muted uppercase">
                        CLASSIFIED QUESTION PROMPT:
                      </label>
                      <textarea
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        placeholder="e.g. Is this location somewhere you would need a badge or special security clearance to access?"
                        maxLength={200}
                        rows={2}
                        className="w-full bg-agency-surface border border-agency-border text-white text-xs font-sans rounded-lg p-3 focus:border-agency-accent focus:outline-none"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      fullWidth
                      isLoading={isSubmitting}
                      disabled={!targetPlayerId || !questionText.trim()}
                    >
                      SUBMIT OFFICIAL INTERROGATION QUESTION
                    </Button>
                  </form>
                ) : isMyTurnToAnswer ? (
                  /* STATE 2: My turn to answer */
                  <form onSubmit={handleSubmitAnswer} className="space-y-4">
                    <div className="p-3 bg-agency-surface rounded-lg border border-agency-border space-y-1">
                      <span className="text-[10px] font-mono text-agency-accent uppercase">
                        DIRECT QUESTION FROM {currentActiveQuestion?.authorDisplayName}:
                      </span>
                      <p className="text-xs font-medium text-white italic">
                        "{currentActiveQuestion?.questionText}"
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-agency-muted uppercase">
                        YOUR CLASSIFIED RESPONSE:
                      </label>
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="Provide a subtle answer that proves your innocence without giving away the secret word..."
                        maxLength={250}
                        rows={2}
                        className="w-full bg-agency-surface border border-agency-border text-white text-xs font-sans rounded-lg p-3 focus:border-agency-accent focus:outline-none"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      fullWidth
                      isLoading={isSubmitting}
                      disabled={!answerText.trim()}
                    >
                      TRANSMIT OFFICIAL ANSWER
                    </Button>
                  </form>
                ) : (
                  /* STATE 3: Waiting for other operatives to complete turn */
                  <div className="p-6 text-center space-y-2">
                    <Radio className="w-6 h-6 text-agency-muted/60 mx-auto animate-pulse" />
                    <div className="font-mono text-xs font-bold text-white">
                      {discussion.currentPhase === 'ASKING'
                        ? `AWAITING QUESTION FROM ${activeQuestioner?.displayName || 'OPERATIVE'}...`
                        : `AWAITING RESPONSE FROM ${targetAnswerer?.displayName || 'RESPONDENT'}...`}
                    </div>
                    {currentActiveQuestion && (
                      <p className="text-xs text-agency-muted italic max-w-md mx-auto">
                        "{currentActiveQuestion.questionText}"
                      </p>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* Expired / Completed Status Banner & Transition to Voting */}
            {(isTimeExpired || discussion.status === 'COMPLETED' || discussion.status === 'EXPIRED') && (
              <div className="p-5 bg-agency-card border border-agency-accent/40 rounded-xl space-y-3 text-center">
                <Badge variant="classified" size="sm">
                  {discussion.status === 'COMPLETED' ? 'ALL TURNS CONCLUDED' : 'INTERROGATION TIMER EXPIRED'}
                </Badge>
                <h4 className="font-mono text-sm font-bold text-white">
                  Interrogation Session Finalized
                </h4>
                <p className="text-xs text-agency-muted max-w-md mx-auto">
                  Testimonies have been entered into agency records. Cast your secret ballot to identify the suspected Imposter.
                </p>

                <div className="pt-2 flex justify-center">
                  {currentPlayer?.isHost ? (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleStartVoting}
                      isLoading={isStartingVoting}
                      leftIcon={<Vote className="w-4 h-4" />}
                    >
                      COMMENCE CLASSIFIED VOTING
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => navigate(`/room/${code}/voting`)}
                      leftIcon={<Vote className="w-4 h-4" />}
                    >
                      ENTER VOTING ARENA
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Official Question & Answer History Log */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-agency-muted px-1">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-agency-accent" />
                  INTERROGATION ARCHIVE ({discussion.questions.length})
                </span>
                <span>IMMUTABLE RECORD</span>
              </div>

              {discussion.questions.length === 0 ? (
                <div className="p-6 bg-agency-card/50 rounded-xl border border-dashed border-agency-border text-center text-xs text-agency-muted">
                  No interrogation questions recorded yet. Turn rotation active.
                </div>
              ) : (
                <div className="space-y-3">
                  {discussion.questions.map((q) => {
                    const ans = discussion.answers.find((a) => a.questionId === q.id);

                    return (
                      <div
                        key={q.id}
                        className="p-4 rounded-xl bg-agency-surface/70 border border-agency-border space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-agency-muted border-b border-agency-border/60 pb-1.5">
                          <span className="text-agency-accent font-bold">
                            {q.authorDisplayName} ➔ {q.targetDisplayName}
                          </span>
                          <span>{new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                        <p className="text-xs text-white font-medium italic">
                          "{q.questionText}"
                        </p>
                        {ans ? (
                          <div className="pt-1.5 border-t border-agency-border/40 text-xs text-slate-300 flex items-start gap-2">
                            <span className="font-mono font-bold text-agency-accent shrink-0">ANSWER:</span>
                            <span>{ans.answerText}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] font-mono text-agency-amber animate-pulse">
                            AWAITING OFFICIAL ANSWER...
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Operative Roster & Shared Live Chat */}
          <div className="space-y-6">
            {/* Operative Activity Status Roster */}
            <Card variant="default" className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-agency-muted border-b border-agency-border pb-2">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-agency-accent" />
                  OPERATIVE STATUS
                </span>
                <span>{room.players.length} AGENTS</span>
              </div>

              <div className="space-y-2">
                {room.players.map((p) => {
                  const pAvatar = getAvatarById(p.avatarId);
                  const isCurrent = p.playerId === currentPlayer?.playerId;
                  const isAsking = discussion.currentPhase === 'ASKING' && discussion.activePlayerId === p.playerId;
                  const isAnswering = discussion.currentPhase === 'ANSWERING' && discussion.targetPlayerId === p.playerId;
                  const hasCompleted = discussion.questions.some((q) => q.authorPlayerId === p.playerId);

                  return (
                    <div
                      key={p.playerId}
                      className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between ${
                        isCurrent
                          ? 'bg-agency-surface border-agency-accent/60 shadow-glow-sm'
                          : 'bg-agency-card border-agency-border/80'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-lg select-none">{pAvatar.symbol}</span>
                        <div className="truncate">
                          <span className="text-white font-bold truncate block">{p.displayName}</span>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isAsking
                            ? 'bg-agency-accent/20 text-agency-accent border border-agency-accent/40 animate-pulse'
                            : isAnswering
                            ? 'bg-agency-amber/20 text-agency-amber border border-agency-amber/40 animate-pulse'
                            : hasCompleted
                            ? 'bg-agency-surface text-slate-400'
                            : 'bg-agency-card text-agency-muted'
                        }`}
                      >
                        {isAsking ? 'ASKING' : isAnswering ? 'ANSWERING' : hasCompleted ? 'DONE' : 'WAITING'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Live Shared Comms Chat */}
            <Card variant="default" className="p-4 flex flex-col h-[480px]">
              <div className="flex items-center justify-between border-b border-agency-border pb-2.5 mb-3">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
                  <MessageSquare className="w-3.5 h-3.5 text-agency-accent" />
                  <span>SHARED RADIO COMMS</span>
                </div>
                <span className="text-[9px] font-mono text-agency-muted">SECURE FEED</span>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                {discussion.messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-agency-muted text-[11px] font-mono text-center p-4">
                    Radio frequencies quiet. Broadcast your thoughts or call out suspect answers below.
                  </div>
                ) : (
                  discussion.messages.map((m) => {
                    const isSelf = m.senderPlayerId === currentPlayer?.playerId;

                    return (
                      <div
                        key={m.id}
                        className={`p-2.5 rounded-lg border leading-relaxed ${
                          isSelf
                            ? 'bg-agency-surface border-agency-accent/40 ml-4'
                            : 'bg-agency-card border-agency-border mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-agency-muted mb-1">
                          <span className={isSelf ? 'text-agency-accent font-bold' : 'text-slate-300 font-bold'}>
                            {m.displayName}
                          </span>
                          <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-white text-xs break-words">{m.text}</p>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Message Input */}
              <form onSubmit={handleSendMessage} className="pt-3 border-t border-agency-border flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={isTimeExpired ? 'Radio closed (Time expired)' : 'Broadcast message (300 chars)...'}
                  maxLength={300}
                  disabled={isTimeExpired || discussion.status !== 'ACTIVE'}
                  className="flex-1 bg-agency-surface border border-agency-border text-white text-xs rounded-lg px-3 py-2 focus:border-agency-accent focus:outline-none disabled:opacity-50"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isTimeExpired || discussion.status !== 'ACTIVE' || !chatInput.trim()}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </Card>

            {/* Safe Disconnect */}
            <div className="text-right">
              <Button variant="ghost" size="sm" onClick={handleLeave} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                DISCONNECT FROM ROOM
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Discussion;
