import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Room,
  Player,
  MatchState,
  ScoreboardEntry,
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
  Trophy,
  ArrowRight,
  ArrowLeft,
  Radio,
  Wifi,
  WifiOff,
  AlertTriangle,
  Play,
  Target,
} from 'lucide-react';

export const RoundSummary: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingNextRound, setIsStartingNextRound] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'connected' | 'reconnecting' | 'error'>('connected');
  const [actionError, setActionError] = useState<string | null>(null);

  const lastMatchVersionRef = useRef<number>(-1);

  const fetchSummaryData = useCallback(async () => {
    if (!code) return;
    try {
      const roomRes = await GameApiService.getRoom(code);
      if (!roomRes.success || !roomRes.data) {
        setNetworkStatus('reconnecting');
        return;
      }

      setNetworkStatus('connected');
      const latestRoom = roomRes.data.room;
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

      // If room transitioned back to role reveal for the next round, auto-navigate
      if (latestRoom.status === 'ROLE_REVEAL') {
        navigate(`/room/${code}/role-reveal`);
        return;
      }
      if (latestRoom.status === 'REMATCH_PENDING' || latestRoom.status === 'REMATCH_READY') {
        navigate(`/room/${code}/rematch`);
        return;
      }

      // Apply scoring if voting is concluded and scoring hasn't been saved yet
      if (
        latestRoom.currentVoting?.result &&
        (!latestRoom.currentMatch ||
          !latestRoom.currentMatch.roundHistory.some(
            (r) => r.roundId === latestRoom.currentRound?.roundId
          ))
      ) {
        await GameApiService.applyRoundScoring(code);
      }

      // Fetch updated match state
      const matchRes = await GameApiService.getMatch(code);
      if (matchRes.success && matchRes.data) {
        const m = matchRes.data.match;
        if (m.version !== lastMatchVersionRef.current) {
          lastMatchVersionRef.current = m.version;
          setMatch(m);
        }
      }

      // Fetch scoreboard
      const sbRes = await GameApiService.getScoreboard(code);
      if (sbRes.success && sbRes.data) {
        setScoreboard(sbRes.data.scoreboard);
      }

      setIsLoading(false);
    } catch {
      setNetworkStatus('reconnecting');
    }
  }, [code, navigate]);

  useEffect(() => {
    fetchSummaryData();
    const interval = setInterval(fetchSummaryData, 2000);
    return () => clearInterval(interval);
  }, [fetchSummaryData]);

  // Host action: advance match to next round
  const handleStartNextRound = async () => {
    if (!code || isStartingNextRound) return;
    setIsStartingNextRound(true);
    setActionError(null);

    const res = await GameApiService.startNextRound(code);
    setIsStartingNextRound(false);

    if (!res.success || !res.data) {
      setActionError(res.error || 'Failed to initialize next round.');
      return;
    }

    navigate(`/room/${code}/role-reveal`);
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
        <LoadingSpinner size="lg" label="CALCULATING OFFICIAL MISSION SCORES..." />
      </div>
    );
  }

  if (!room || !currentPlayer || !match) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <Card variant="interactive" className="p-6 space-y-4">
          <AlertTriangle className="w-10 h-10 text-agency-danger mx-auto" />
          <h2 className="text-xl font-bold text-white">Score Record Unavailable</h2>
          <p className="text-xs text-agency-muted">
            {actionError || 'Unable to retrieve authenticated match scores.'}
          </p>
          <Button variant="secondary" size="md" fullWidth onClick={handleLeave}>
            RETURN TO BASE
          </Button>
        </Card>
      </div>
    );
  }

  const latestRoundResult = match.roundHistory[match.roundHistory.length - 1];
  const roundNumber = latestRoundResult ? latestRoundResult.roundNumber : match.currentRoundNumber;
  const isMatchCompleted = match.status === 'MATCH_COMPLETED' || roundNumber >= 3;
  const isAgentsWin = latestRoundResult?.outcome === 'AGENTS_WIN';

  const revealedImposter = latestRoundResult
    ? room.players.find((p) => p.playerId === latestRoundResult.imposterPlayerId)
    : null;
  const accusedPlayer = latestRoundResult?.selectedPlayerId
    ? room.players.find((p) => p.playerId === latestRoundResult.selectedPlayerId)
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-agency-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-agency-surface border border-agency-border flex items-center justify-center">
            <Trophy className="w-5 h-5 text-agency-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-extrabold tracking-widest text-white">
                SECRET AGENT
              </span>
              <Badge variant={isMatchCompleted ? 'classified' : 'warning'} size="sm" withDot>
                {isMatchCompleted ? 'MATCH COMPLETED' : `ROUND ${roundNumber} / 3 DEBRIEF`}
              </Badge>
            </div>
            <span className="text-[10px] font-mono text-agency-muted">
              ROOM: {room.roomCode} • THREE-ROUND MATCH ARCHITECTURE
            </span>
          </div>
        </div>

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

      {/* Round Verdict Headline Card */}
      {latestRoundResult && (
        <div
          className={`p-6 sm:p-8 rounded-2xl border text-center space-y-3 ${
            isAgentsWin
              ? 'bg-agency-accent/10 border-agency-accent shadow-xl shadow-agency-accent/5'
              : 'bg-agency-danger/10 border-agency-danger shadow-xl shadow-agency-danger/5'
          }`}
        >
          <div className="inline-flex p-3 rounded-2xl bg-agency-surface border border-agency-border">
            {isAgentsWin ? (
              <Shield className="w-8 h-8 text-agency-accent" />
            ) : (
              <ShieldAlert className="w-8 h-8 text-agency-danger" />
            )}
          </div>

          <div className="space-y-1">
            <Badge variant={isAgentsWin ? 'classified' : 'danger'} size="md">
              ROUND {roundNumber} VERDICT: {isAgentsWin ? 'AGENTS WIN (+1 POINT EACH)' : 'IMPOSTER WINS (+2 POINTS)'}
            </Badge>
            <h2 className="text-xl sm:text-2xl font-mono font-black text-white uppercase tracking-tight">
              {isAgentsWin
                ? 'Imposter Apprehended by Consensus'
                : 'Imposter Evaded Consensus Detection'}
            </h2>
            <p className="text-xs text-agency-muted max-w-md mx-auto">
              Secret Word was: <strong className="text-white">"{latestRoundResult.secretWord}"</strong> ({latestRoundResult.category})
            </p>
          </div>
        </div>
      )}

      {/* Operative Identities Strip */}
      {latestRoundResult && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Authentic Imposter */}
          <Card variant="interactive" className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-agency-muted">
              <span className="text-agency-danger font-bold uppercase flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                ROUND {roundNumber} IMPOSTER
              </span>
              <Badge variant="danger" size="sm">
                {isAgentsWin ? '+0 PTS' : '+2 PTS'}
              </Badge>
            </div>
            {revealedImposter && (
              <div className="flex items-center gap-3 p-3 bg-agency-surface rounded-xl border border-agency-border">
                <span className="text-2xl select-none">
                  {getAvatarById(revealedImposter.avatarId).symbol}
                </span>
                <div>
                  <div className="font-mono text-xs font-bold text-white">
                    {revealedImposter.displayName}
                  </div>
                  <span className="text-[10px] font-mono text-agency-muted">
                    {getAvatarById(revealedImposter.avatarId).codename}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Accused Suspect */}
          <Card variant="interactive" className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-agency-muted">
              <span className="text-agency-accent font-bold uppercase flex items-center gap-1.5">
                <Target className="w-4 h-4" />
                ACCUSED BY BALLOT
              </span>
              <Badge variant="classified" size="sm">
                ELIMINATED
              </Badge>
            </div>
            {accusedPlayer ? (
              <div className="flex items-center gap-3 p-3 bg-agency-surface rounded-xl border border-agency-border">
                <span className="text-2xl select-none">
                  {getAvatarById(accusedPlayer.avatarId).symbol}
                </span>
                <div>
                  <div className="font-mono text-xs font-bold text-white">
                    {accusedPlayer.displayName}
                  </div>
                  <span className="text-[10px] font-mono text-agency-muted">
                    {getAvatarById(accusedPlayer.avatarId).codename}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-agency-surface rounded-xl border border-dashed border-agency-border text-center text-xs text-agency-muted">
                Deadlock (No suspect achieved majority consensus)
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Cumulative Scoreboard Table */}
      <Card variant="default" className="p-5 space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-agency-muted">
          <span className="text-white font-bold flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-agency-accent" />
            CUMULATIVE OPERATIVE SCOREBOARD ({scoreboard.length} OPERATIVES)
          </span>
          <span>ROUNDS 1–{roundNumber} TOTALS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-agency-border text-agency-muted uppercase text-[10px]">
                <th className="py-2.5 px-3">RANK</th>
                <th className="py-2.5 px-3">OPERATIVE</th>
                <th className="py-2.5 px-3 text-center">R1</th>
                <th className="py-2.5 px-3 text-center">R2</th>
                <th className="py-2.5 px-3 text-center">R3</th>
                <th className="py-2.5 px-3 text-right">TOTAL POINTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-agency-border/60">
              {scoreboard.map((entry, index) => {
                const av = getAvatarById(entry.avatarId);
                const isSelf = entry.playerId === currentPlayer.playerId;

                return (
                  <tr
                    key={entry.playerId}
                    className={`${isSelf ? 'bg-agency-accent/5 font-bold text-white' : 'text-slate-300 hover:bg-agency-surface/40'}`}
                  >
                    <td className="py-3 px-3 text-agency-muted text-[11px]">
                      #{index + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none">{av.symbol}</span>
                        <span className="truncate">{entry.displayName}</span>
                        {isSelf && (
                          <Badge variant="classified" size="sm">YOU</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {entry.roundScores[1] !== undefined ? `+${entry.roundScores[1]}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {entry.roundScores[2] !== undefined ? `+${entry.roundScores[2]}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {entry.roundScores[3] !== undefined ? `+${entry.roundScores[3]}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-agency-accent text-sm">
                      {entry.cumulativeScore} PTS
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Progression Action Bar */}
      <Card variant="interactive" className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-agency-surface border border-agency-border flex items-center justify-center text-agency-accent">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-white">
              {isMatchCompleted
                ? 'MATCH COMPLETE // ALL 3 ROUNDS FINALIZED'
                : `READY TO INITIALIZE ROUND ${roundNumber + 1} OF 3`}
            </div>
            <span className="text-[10px] font-mono text-agency-muted">
              {isMatchCompleted
                ? 'Three-round match architecture concluded. View final leaderboard and overall champion.'
                : currentPlayer.isHost
                  ? 'All scores recorded. Advance all operatives to the next round with a new Imposter.'
                  : 'Awaiting mission leader to commence next round.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="secondary" size="md" onClick={handleLeave} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            LEAVE
          </Button>

          {!isMatchCompleted && currentPlayer.isHost && (
            <Button
              variant="primary"
              size="md"
              onClick={handleStartNextRound}
              isLoading={isStartingNextRound}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              COMMENCE ROUND {roundNumber + 1}
            </Button>
          )}

          {!isMatchCompleted && !currentPlayer.isHost && (
            <div className="flex items-center gap-2 text-xs font-mono text-agency-muted">
              <Play className="w-3.5 h-3.5 text-agency-accent animate-pulse" />
              <span>AWAITING LEADER...</span>
            </div>
          )}

          {isMatchCompleted && (
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate(`/room/${code}/final-results`)}
              rightIcon={<Trophy className="w-4 h-4" />}
            >
              VIEW FINAL LEADERBOARD
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default RoundSummary;
