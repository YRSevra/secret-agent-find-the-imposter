import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Room,
  Player,
  PublicVotingState,
  RoleRevealData,
} from '../types/game';
import { GameApiService } from '../services/gameApi';
import { getAvatarById } from '../constants/avatars';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Shield,
  ShieldAlert,
  Clock,
  Vote,
  Users,
  Radio,
  ArrowLeft,
  Wifi,
  WifiOff,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Eye,
  UserX,
  Target,
  ArrowRight,
} from 'lucide-react';

export const Voting: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [voting, setVoting] = useState<PublicVotingState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [roleData, setRoleData] = useState<RoleRevealData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [networkStatus, setNetworkStatus] = useState<'connected' | 'reconnecting' | 'error'>('connected');
  const [actionError, setActionError] = useState<string | null>(null);

  // Voting selection & confirmation
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [isApplyingScores, setIsApplyingScores] = useState(false);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);

  // Authoritative countdown timer state
  const [remainingSeconds, setRemainingSeconds] = useState<number>(60);

  const lastVotingVersionRef = useRef<number>(-1);
  const consecutiveFailuresRef = useRef<number>(0);

  const fetchVotingState = useCallback(async () => {
    if (!code) return;
    try {
      const res = await GameApiService.getRoom(code);
      if (!res.success || !res.data) {
        consecutiveFailuresRef.current++;
        if (consecutiveFailuresRef.current >= 3) setNetworkStatus('error');
        return;
      }

      setNetworkStatus('connected');
      consecutiveFailuresRef.current = 0;
      const latestRoom = res.data.room;
      setRoom(latestRoom);

      // Authenticate local player
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

      // If room transitioned to round summary or match completed, navigate
      if (latestRoom.status === 'ROUND_SUMMARY' || latestRoom.status === 'MATCH_COMPLETED') {
        navigate(`/room/${code}/round-summary`);
        return;
      }

      // Synchronize voting state
      if (latestRoom.currentVoting) {
        const vState = latestRoom.currentVoting;
        if (vState.version !== lastVotingVersionRef.current) {
          lastVotingVersionRef.current = vState.version;
          setVoting(vState);
        }
      } else if (latestRoom.status === 'DISCUSSION') {
        // If room is still in discussion, navigate back
        navigate(`/room/${code}/discussion`);
        return;
      }

      setIsLoading(false);
    } catch {
      consecutiveFailuresRef.current++;
      setNetworkStatus(consecutiveFailuresRef.current >= 3 ? 'error' : 'reconnecting');
    }
  }, [code, navigate]);

  // Initial load: fetch role & voting
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
      await fetchVotingState();
    };
    init();

    // 2-second polling loop
    const interval = setInterval(fetchVotingState, 2000);
    return () => clearInterval(interval);
  }, [code, fetchVotingState]);

  // Synchronized countdown ticker based on server endTime
  useEffect(() => {
    if (!voting) return;

    const updateTimer = () => {
      const endMs = new Date(voting.endTime).getTime();
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.ceil((endMs - nowMs) / 1000));
      setRemainingSeconds(diffSec);
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 500);
    return () => clearInterval(timerInterval);
  }, [voting]);

  // Submit selected suspect vote
  const handleConfirmVote = async () => {
    if (!code || !selectedTargetId || isSubmittingVote) return;
    setIsSubmittingVote(true);
    setActionError(null);

    const res = await GameApiService.submitVote(code, selectedTargetId);
    setIsSubmittingVote(false);
    setIsConfirmModalOpen(false);

    if (!res.success || !res.data) {
      setActionError(res.error || 'Failed to submit ballot.');
      return;
    }

    setVoting(res.data.voting);
    lastVotingVersionRef.current = res.data.voting.version;
  };

  const handleProceedToSummary = async () => {
    if (!code || isApplyingScores) return;
    setIsApplyingScores(true);
    try {
      await GameApiService.applyRoundScoring(code);
    } catch {
      // Continue even if already applied
    } finally {
      setIsApplyingScores(false);
      navigate(`/room/${code}/round-summary`);
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
        <LoadingSpinner size="lg" label="CONNECTING TO SECURE VOTING ARENA..." />
      </div>
    );
  }

  if (!room || !currentPlayer || !voting) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <Card variant="interactive" className="p-6 space-y-4">
          <AlertTriangle className="w-10 h-10 text-agency-danger mx-auto" />
          <h2 className="text-xl font-bold text-white">Ballot Link Severed</h2>
          <p className="text-xs text-agency-muted">
            {actionError || 'Voting session could not be established with agency satellite.'}
          </p>
          <Button variant="secondary" size="md" fullWidth onClick={handleLeave}>
            RETURN TO BASE
          </Button>
        </Card>
      </div>
    );
  }

  // Timer visual thresholds
  const isTimeExpired = remainingSeconds <= 0;
  const isTimeCritical = remainingSeconds <= 10 && remainingSeconds > 0;
  const isTimeWarning = remainingSeconds <= 20 && remainingSeconds > 10;

  const timerColorClass = isTimeExpired
    ? 'text-agency-danger border-agency-danger/50 bg-agency-danger/10'
    : isTimeCritical
      ? 'text-agency-danger border-agency-danger/50 bg-agency-danger/10 animate-pulse'
      : isTimeWarning
        ? 'text-agency-warning border-agency-warning/50 bg-agency-warning/10'
        : 'text-agency-accent border-agency-accent/50 bg-agency-accent/10';

  const hasVoted = voting.votedPlayerIds.includes(currentPlayer.playerId);
  const isVotingActive = voting.status === 'ACTIVE' || voting.status === 'REVOTE';
  const isCompleted = voting.status === 'COMPLETED';
  const isTieDiscussion = voting.status === 'TIE_DISCUSSION';

  const selectedTargetPlayer = room.players.find((p) => p.playerId === selectedTargetId);
  const result = voting.result;
  const revealedImposter = result?.actualImposterId
    ? room.players.find((p) => p.playerId === result.actualImposterId)
    : null;
  const eliminatedPlayer = result?.eliminatedPlayerId
    ? room.players.find((p) => p.playerId === result.eliminatedPlayerId)
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 animate-in fade-in duration-300">
      {/* Top Classified Mission Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-agency-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-agency-surface border border-agency-border flex items-center justify-center">
            <Vote className="w-5 h-5 text-agency-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-extrabold tracking-widest text-white">
                SECRET AGENT
              </span>
              <Badge variant="classified" size="sm" withDot>
                ROUND {voting.roundNumber} // CLASSIFIED VOTING
              </Badge>
              {voting.isRevote && (
                <Badge variant="warning" size="sm">
                  REVOTE BALLOT
                </Badge>
              )}
            </div>
            <span className="text-[10px] font-mono text-agency-muted">
              ROOM: {room.roomCode} • E2E ENCRYPTED BALLOT VAULT
            </span>
          </div>
        </div>

        {/* Quick Dossier & Status */}
        <div className="flex items-center gap-2">
          {roleData && (
            <button
              onClick={() => setIsBriefingModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-agency-surface border border-agency-border text-xs font-mono text-agency-muted hover:text-white transition-colors flex items-center gap-1.5"
              title="Review your private classified role dossier"
            >
              <Eye className="w-3.5 h-3.5 text-agency-accent" />
              <span>MY ROLE</span>
            </button>
          )}

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono ${
              networkStatus === 'connected'
                ? 'border-agency-accent/40 bg-agency-accent/5 text-agency-accent'
                : 'border-agency-warning/40 bg-agency-warning/5 text-agency-warning'
            }`}
          >
            {networkStatus === 'connected' ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
            )}
            <span className="text-[10px] uppercase">{networkStatus}</span>
          </div>
        </div>
      </div>

      {/* Network Alert Message */}
      {actionError && (
        <div className="p-3 bg-agency-danger/10 border border-agency-danger/40 rounded-lg flex items-center justify-between text-xs text-agency-danger font-mono animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-agency-muted hover:text-white uppercase text-[10px]"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Synchronized 60-Second HUD Timer & Status Bar */}
      <Card variant="default" className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border flex items-center gap-2 ${timerColorClass}`}>
              <Clock className="w-5 h-5 shrink-0" />
              <span className="font-mono text-2xl font-black tracking-wider">
                {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:
                {String(remainingSeconds % 60).padStart(2, '0')}
              </span>
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-white uppercase flex items-center gap-2">
                <span>{isTieDiscussion ? 'TIE-BREAK DELIBERATION' : 'VOTING DEADLINE'}</span>
                {isTimeExpired ? (
                  <Badge variant="danger" size="sm">EXPIRED</Badge>
                ) : isTimeCritical ? (
                  <Badge variant="danger" size="sm" withDot>CRITICAL</Badge>
                ) : isTimeWarning ? (
                  <Badge variant="warning" size="sm">HURRY</Badge>
                ) : (
                  <Badge variant="classified" size="sm">ACTIVE</Badge>
                )}
              </div>
              <span className="text-[10px] font-mono text-agency-muted">
                {isTieDiscussion
                  ? 'Deliberate tied suspects before the final revote begins.'
                  : isCompleted
                    ? 'All ballots processed. Final outcome resolved.'
                    : 'Ballots automatically seal when time expires.'}
              </span>
            </div>
          </div>

          {/* Voting Participation Counter (No target leaks) */}
          <div className="flex items-center gap-3 text-right">
            <div>
              <span className="text-[10px] font-mono text-agency-muted block uppercase">
                BALLOTS SEALED
              </span>
              <span className="font-mono text-sm font-bold text-white">
                {voting.totalVotesSubmitted} / {voting.totalEligibleVoters} OPERATIVES
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-agency-surface border border-agency-border flex items-center justify-center font-mono font-bold text-agency-accent">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 w-full h-1.5 bg-agency-surface rounded-full overflow-hidden border border-agency-border/60">
          <div
            className={`h-full transition-all duration-500 ${
              isTimeCritical
                ? 'bg-agency-danger'
                : isTimeWarning
                  ? 'bg-agency-warning'
                  : 'bg-agency-accent'
            }`}
            style={{
              width: `${Math.min(100, Math.max(0, (remainingSeconds / voting.durationSeconds) * 100))}%`,
            }}
          />
        </div>
      </Card>

      {/* VIEW A: TIE DISCUSSION BANNER */}
      {isTieDiscussion && (
        <Card variant="interactive" className="p-6 border-agency-warning/50 bg-agency-warning/5 space-y-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-agency-warning/10 border border-agency-warning/40 flex items-center justify-center mx-auto text-agency-warning">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <Badge variant="warning" size="md">
              DEADLOCK ENCOUNTERED – TIE BREAK IN PROGRESS
            </Badge>
            <h3 className="text-lg font-mono font-bold text-white mt-2">
              Suspects Received Equal Allegations
            </h3>
            <p className="text-xs text-agency-muted max-w-lg mx-auto mt-1">
              Operatives have split their allegations among multiple suspects. Deliberate quickly. A final 60-second revote between tied suspects will commence shortly.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            {voting.result?.tiedPlayerIds.map((tiedId) => {
              const p = room.players.find((pl) => pl.playerId === tiedId);
              if (!p) return null;
              const av = getAvatarById(p.avatarId);
              return (
                <div
                  key={tiedId}
                  className="px-4 py-2.5 rounded-lg bg-agency-surface border border-agency-warning/40 flex items-center gap-2.5 text-xs font-mono text-white"
                >
                  <span className="text-lg">{av.symbol}</span>
                  <span className="font-bold">{p.displayName}</span>
                  <Badge variant="warning" size="sm">TIED SUSPECT</Badge>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] font-mono text-agency-warning/80">
            Note: If the upcoming revote also ends in a tie, the Imposter will automatically evade capture!
          </p>
        </Card>
      )}

      {/* VIEW B: ACTIVE VOTING / REVOTE ARENA */}
      {isVotingActive && (
        <div className="space-y-6">
          {/* Instructions Strip */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-agency-muted px-1">
            <span className="flex items-center gap-1.5 text-white font-bold">
              <Target className="w-4 h-4 text-agency-accent" />
              {voting.isRevote ? 'SELECT SUSPECT AMONG TIED CANDIDATES' : 'IDENTIFY SUSPECTED IMPOSTER'}
            </span>
            <span>
              {hasVoted ? (
                <span className="text-agency-accent font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  YOUR BALLOT IS ENCRYPTED & SEALED
                </span>
              ) : (
                'SELECT EXACTLY 1 OPERATIVE (SELF-VOTING PROHIBITED)'
              )}
            </span>
          </div>

          {/* Suspect Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {room.players.map((player) => {
              const avatar = getAvatarById(player.avatarId);
              const isSelf = player.playerId === currentPlayer.playerId;
              const isEligibleTarget = voting.eligibleTargetIds.includes(player.playerId);
              const isSelected = selectedTargetId === player.playerId;
              const playerHasVoted = voting.votedPlayerIds.includes(player.playerId);

              const isDisabled = isSelf || !isEligibleTarget || hasVoted || isTimeExpired;

              return (
                <div
                  key={player.playerId}
                  onClick={() => {
                    if (!isDisabled) setSelectedTargetId(player.playerId);
                  }}
                  className={`relative p-5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-agency-accent/10 border-agency-accent shadow-lg shadow-agency-accent/10 scale-[1.02]'
                      : isDisabled
                        ? 'bg-agency-surface/40 border-agency-border/60 opacity-60 cursor-not-allowed'
                        : 'bg-agency-card hover:bg-agency-surface border-agency-border hover:border-agency-accent/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-agency-surface border border-agency-border flex items-center justify-center text-2xl select-none">
                        {avatar.symbol}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">
                            {player.displayName}
                          </span>
                          {isSelf && (
                            <Badge variant="classified" size="sm">
                              YOU
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs font-mono text-agency-muted">
                          {avatar.codename}
                        </span>
                      </div>
                    </div>

                    {/* Voted Indicator Status (Anonymized) */}
                    <div>
                      {playerHasVoted ? (
                        <span
                          title="Operative has cast their ballot"
                          className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-agency-accent/15 border border-agency-accent/40 text-agency-accent flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          VOTED
                        </span>
                      ) : (
                        <span
                          title="Awaiting operative ballot"
                          className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-agency-surface border border-agency-border text-agency-muted"
                        >
                          PENDING
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Status */}
                  <div className="mt-4 pt-3 border-t border-agency-border/60 flex items-center justify-between text-[11px] font-mono">
                    {isSelf ? (
                      <span className="text-agency-warning flex items-center gap-1">
                        <UserX className="w-3.5 h-3.5" />
                        Self-targeting prohibited
                      </span>
                    ) : !isEligibleTarget ? (
                      <span className="text-agency-muted">Excluded from revote</span>
                    ) : hasVoted ? (
                      <span className="text-agency-muted">Ballot locked</span>
                    ) : isSelected ? (
                      <span className="text-agency-accent font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Selected suspect
                      </span>
                    ) : (
                      <span className="text-agency-muted group-hover:text-white">
                        Click to interrogate & vote
                      </span>
                    )}

                    {isSelected && (
                      <span className="w-2.5 h-2.5 rounded-full bg-agency-accent animate-ping" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Submission Console */}
          <Card variant="interactive" className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-agency-surface border border-agency-border flex items-center justify-center text-agency-accent">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-mono font-bold text-white">
                  {hasVoted
                    ? 'BALLOT TRANSMITTED & CRYPTOGRAPHICALLY SEALED'
                    : selectedTargetPlayer
                      ? `SUSPECT SELECTED: ${selectedTargetPlayer.displayName.toUpperCase()}`
                      : 'NO SUSPECT SELECTED YET'}
                </div>
                <span className="text-[10px] font-mono text-agency-muted">
                  {hasVoted
                    ? 'Awaiting remaining operatives or timer expiration to reveal the verdict.'
                    : 'Votes cannot be edited or rescinded once cast.'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {!hasVoted && (
                <Button
                  variant="primary"
                  size="md"
                  disabled={!selectedTargetId || isTimeExpired}
                  onClick={() => setIsConfirmModalOpen(true)}
                  leftIcon={<Vote className="w-4 h-4" />}
                  fullWidth
                >
                  SEAL & CAST VOTE
                </Button>
              )}

              {hasVoted && (
                <div className="flex items-center gap-2 text-xs font-mono text-agency-accent">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>VOTE RECORDED</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* VIEW C: COMPLETED ROUND OUTCOME & IDENTITY REVEAL */}
      {isCompleted && result && (
        <div className="space-y-6 animate-in zoom-in-95 duration-500">
          {/* Big Outcome Banner */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border text-center space-y-4 ${
              result.resultStatus === 'AGENTS_WIN'
                ? 'bg-agency-accent/10 border-agency-accent shadow-2xl shadow-agency-accent/10'
                : 'bg-agency-danger/10 border-agency-danger shadow-2xl shadow-agency-danger/10'
            }`}
          >
            <div className="inline-flex p-3 rounded-2xl bg-agency-surface border border-agency-border">
              {result.resultStatus === 'AGENTS_WIN' ? (
                <Shield className="w-10 h-10 text-agency-accent animate-bounce" />
              ) : (
                <ShieldAlert className="w-10 h-10 text-agency-danger animate-pulse" />
              )}
            </div>

            <div className="space-y-1">
              <Badge
                variant={result.resultStatus === 'AGENTS_WIN' ? 'classified' : 'danger'}
                size="md"
              >
                {result.resultStatus === 'AGENTS_WIN'
                  ? 'MISSION ACCOMPLISHED // AGENTS WIN'
                  : 'MISSION COMPROMISED // IMPOSTER WINS'}
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-mono font-black text-white uppercase tracking-tight">
                {result.resultStatus === 'AGENTS_WIN'
                  ? 'The Imposter Has Been Apprehended'
                  : 'The Imposter Successfully Evaded Detection'}
              </h2>
              <p className="text-xs sm:text-sm text-agency-muted max-w-lg mx-auto">
                {result.resultStatus === 'AGENTS_WIN'
                  ? 'Operatives coordinated effectively to expose the double agent and secure the classified transmission.'
                  : 'The syndicate operative blended into the communications and misled the agency investigation.'}
              </p>
            </div>
          </div>

          {/* Identity Dossier Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Accused Operative */}
            <Card variant="interactive" className="p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-agency-muted">
                <span className="uppercase font-bold text-white flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-agency-accent" />
                  ACCUSED OPERATIVE
                </span>
                <Badge
                  variant={result.revealedRole === 'IMPOSTER' ? 'danger' : 'classified'}
                  size="sm"
                >
                  {result.revealedRole ? `REVEALED: ${result.revealedRole}` : 'DEADLOCK (NO CONSENSUS)'}
                </Badge>
              </div>

              {eliminatedPlayer ? (
                <div className="flex items-center gap-3 p-3 bg-agency-surface rounded-xl border border-agency-border">
                  <span className="text-3xl select-none">
                    {getAvatarById(eliminatedPlayer.avatarId).symbol}
                  </span>
                  <div>
                    <div className="font-mono text-sm font-bold text-white">
                      {eliminatedPlayer.displayName}
                    </div>
                    <span className="text-xs font-mono text-agency-muted">
                      {getAvatarById(eliminatedPlayer.avatarId).codename}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-agency-surface rounded-xl border border-dashed border-agency-border text-center text-xs text-agency-muted">
                  No single operative received majority allegations due to unresolved deadlock.
                </div>
              )}
            </Card>

            {/* Card 2: True Syndicate Imposter */}
            <Card variant="interactive" className="p-5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-agency-muted">
                <span className="uppercase font-bold text-white flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-agency-danger" />
                  AUTHENTIC IMPOSTER IDENTIFIED
                </span>
                <Badge variant="danger" size="sm">
                  CLASSIFIED SYNDICATE
                </Badge>
              </div>

              {revealedImposter ? (
                <div className="flex items-center gap-3 p-3 bg-agency-surface rounded-xl border border-agency-border">
                  <span className="text-3xl select-none">
                    {getAvatarById(revealedImposter.avatarId).symbol}
                  </span>
                  <div>
                    <div className="font-mono text-sm font-bold text-white">
                      {revealedImposter.displayName}
                    </div>
                    <span className="text-xs font-mono text-agency-muted">
                      {getAvatarById(revealedImposter.avatarId).codename} • IMPOSTER
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-agency-surface rounded-xl border border-dashed border-agency-border text-center text-xs text-agency-muted">
                  Classified dossier withheld.
                </div>
              )}
            </Card>
          </div>

          {/* Classified Vote Breakdown Archive (Safe, no voter-to-target links) */}
          <Card variant="default" className="p-5 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-agency-muted">
              <span className="text-white font-bold flex items-center gap-1.5">
                <Vote className="w-4 h-4 text-agency-accent" />
                OFFICIAL BALLOT TALLY ARCHIVE
              </span>
              <span>ANONYMIZED TALLY</span>
            </div>

            <div className="space-y-2.5">
              {Object.entries(result.voteCounts).map(([targetId, count]) => {
                const targetPlayer = room.players.find((p) => p.playerId === targetId);
                if (!targetPlayer) return null;
                const av = getAvatarById(targetPlayer.avatarId);
                const percent =
                  result.totalVotesSubmitted > 0
                    ? Math.round((count / result.totalVotesSubmitted) * 100)
                    : 0;

                return (
                  <div
                    key={targetId}
                    className="p-3 bg-agency-surface rounded-xl border border-agency-border space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{av.symbol}</span>
                        <span className="font-bold text-white">{targetPlayer.displayName}</span>
                        <span className="text-agency-muted text-[10px]">({av.codename})</span>
                      </div>
                      <span className="font-bold text-agency-accent">
                        {count} {count === 1 ? 'VOTE' : 'VOTES'} ({percent}%)
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-agency-dark rounded-full overflow-hidden">
                      <div
                        className="h-full bg-agency-accent transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-agency-border flex items-center justify-between text-[11px] font-mono text-agency-muted">
              <span>TOTAL BALLOTS CAST: {result.totalVotesSubmitted}</span>
              <span>ABSTENTIONS: {result.abstentions}</span>
            </div>
          </Card>

          {/* Phase 8 Transition: Proceed to Round Summary */}
          <div className="p-4 rounded-xl bg-agency-surface/60 border border-agency-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-agency-muted">
              <Radio className="w-4 h-4 text-agency-accent animate-pulse shrink-0" />
              <span>
                <strong className="text-agency-accent font-bold">ROUND CONCLUDED: </strong>
                Official verdicts sealed. Review operative scores and match progression.
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="secondary" size="sm" onClick={handleLeave} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                LEAVE
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleProceedToSummary}
                isLoading={isApplyingScores}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                VIEW ROUND SUMMARY
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && selectedTargetPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card variant="interactive" className="max-w-md w-full p-6 space-y-5 border-agency-accent/60">
            <div className="flex items-center gap-3 text-agency-accent">
              <div className="p-2.5 rounded-xl bg-agency-accent/10 border border-agency-accent/40">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold text-white uppercase">
                  CONFIRM SUSPECT ALLEGATION
                </h3>
                <span className="text-[10px] font-mono text-agency-muted">
                  SECRET BALLOT CONFIRMATION
                </span>
              </div>
            </div>

            <p className="text-xs text-agency-muted leading-relaxed">
              Are you certain you wish to accuse{' '}
              <strong className="text-white font-bold">{selectedTargetPlayer.displayName}</strong> of
              being the Imposter? Once submitted, your vote is cryptographically sealed and cannot be altered.
            </p>

            <div className="p-3 bg-agency-surface rounded-xl border border-agency-border flex items-center gap-3">
              <span className="text-3xl select-none">
                {getAvatarById(selectedTargetPlayer.avatarId).symbol}
              </span>
              <div>
                <div className="font-mono text-xs font-bold text-white">
                  {selectedTargetPlayer.displayName}
                </div>
                <span className="text-[10px] font-mono text-agency-muted">
                  CODENAME: {getAvatarById(selectedTargetPlayer.avatarId).codename}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                disabled={isSubmittingVote}
                onClick={() => setIsConfirmModalOpen(false)}
              >
                CANCEL
              </Button>
              <Button
                variant="primary"
                size="md"
                fullWidth
                isLoading={isSubmittingVote}
                onClick={handleConfirmVote}
              >
                CONFIRM & SEAL
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Role Dossier Quick Modal */}
      {isBriefingModalOpen && roleData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card variant="interactive" className="max-w-md w-full p-6 space-y-4 border-agency-accent">
            <div className="flex items-center justify-between border-b border-agency-border pb-3">
              <span className="text-xs font-mono font-bold text-agency-accent flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                CLASSIFIED DOSSIER
              </span>
              <button
                onClick={() => setIsBriefingModalOpen(false)}
                className="text-xs font-mono text-agency-muted hover:text-white"
              >
                CLOSE [ESC]
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-center p-4 bg-agency-surface rounded-xl border border-agency-border space-y-2">
                <span className="text-xs font-mono text-agency-muted uppercase block">
                  ASSIGNED OPERATIVE ROLE
                </span>
                <Badge
                  variant={roleData.role === 'AGENT' ? 'classified' : 'danger'}
                  size="md"
                >
                  {roleData.role === 'AGENT' ? 'SECRET AGENT' : 'IMPOSTER'}
                </Badge>
              </div>

              {roleData.role === 'AGENT' && roleData.secretWord && (
                <div className="p-3 bg-agency-accent/10 border border-agency-accent/40 rounded-xl text-center">
                  <span className="text-[10px] font-mono text-agency-muted uppercase block">
                    CATEGORY: {roleData.category}
                  </span>
                  <span className="font-mono text-base font-extrabold text-white">
                    {roleData.secretWord}
                  </span>
                </div>
              )}

              {roleData.role === 'IMPOSTER' && (
                <div className="p-3 bg-agency-danger/10 border border-agency-danger/40 rounded-xl text-center text-xs text-agency-danger font-mono">
                  CLASSIFIED: Blend in, deduce the secret word, and deflect suspicion away from yourself.
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setIsBriefingModalOpen(false)}
            >
              RETURN TO ARENA
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Voting;
