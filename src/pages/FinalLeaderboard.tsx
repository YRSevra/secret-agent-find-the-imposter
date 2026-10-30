import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Room,
  Player,
  FinalMatchResults,
  LeaderboardEntry,
} from '../types/game';
import { GameApiService } from '../services/gameApi';
import { getAvatarById } from '../constants/avatars';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Trophy,
  Crown,
  Award,
  Sparkles,
  Radio,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  RotateCcw,
  LogOut,
} from 'lucide-react';

export const FinalLeaderboard: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [finalResults, setFinalResults] = useState<FinalMatchResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  const [isRequestingRematch, setIsRequestingRematch] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const fetchResults = useCallback(async () => {
    if (!code) return;
    try {
      const roomRes = await GameApiService.getRoom(code);
      if (!roomRes.success || !roomRes.data) {
        setError(roomRes.error || 'Failed to connect to room server.');
        setIsLoading(false);
        return;
      }

      const latestRoom = roomRes.data.room;
      setRoom(latestRoom);

      // Auto-navigate if a rematch is in progress or started
      if (latestRoom.status === 'ROLE_REVEAL') {
        navigate(`/room/${code}/role-reveal`);
        return;
      }

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

      // Fetch final match results
      const resultsRes = await GameApiService.getFinalResults(code);
      if (resultsRes.success && resultsRes.data) {
        setFinalResults(resultsRes.data.finalResults);
      } else {
        // If not completed yet or scoring still finalizing, try completing match
        if (resultsRes.code === 'MATCH_INCOMPLETE') {
          setError('Match is still in progress. Return to Round Summary to conclude Round 3.');
        } else {
          setError(resultsRes.error || 'Unable to retrieve finalized match leaderboard.');
        }
      }
      setIsLoading(false);
    } catch {
      setError('Network communication failure while retrieving final dossier.');
      setIsLoading(false);
    }
  }, [code, navigate]);

  useEffect(() => {
    fetchResults();
    const interval = setInterval(fetchResults, 2000);
    return () => clearInterval(interval);
  }, [fetchResults]);

  const handleRequestRematch = async () => {
    if (!code || isRequestingRematch) return;
    setIsRequestingRematch(true);
    const res = await GameApiService.requestRematch(code);
    setIsRequestingRematch(false);

    if (res.success) {
      navigate(`/room/${code}/rematch`);
    } else {
      setError(res.error || 'Failed to initiate rematch invitation.');
    }
  };

  const handleLeave = async () => {
    if (code) {
      await GameApiService.leaveRoom(code);
    }
    navigate('/');
  };

  // Podium sorting logic
  const podiumEntries = useMemo(() => {
    if (!finalResults) return [];
    const entries = [...finalResults.leaderboard];
    if (entries.length < 2) return entries;
    return entries.slice(0, 3);
  }, [finalResults]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <LoadingSpinner size="lg" label="DECRYPTING CLASSIFIED MATCH DOSSIER & FINAL RANKINGS..." />
      </div>
    );
  }

  if (error || !finalResults || !room || !currentPlayer) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <Card variant="interactive" className="p-6 space-y-4 border-agency-danger/40">
          <AlertTriangle className="w-10 h-10 text-agency-danger mx-auto" />
          <h2 className="text-xl font-bold text-white">Final Dossier Unavailable</h2>
          <p className="text-xs text-agency-muted">
            {error || 'Unable to retrieve authenticated match final rankings.'}
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate(code ? `/room/${code}/round-summary` : '/')}
            >
              BACK TO ROUND SUMMARY
            </Button>
            <Button variant="primary" size="md" onClick={handleLeave}>
              RETURN TO BASE
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const champions = finalResults.champions;
  const isTie = finalResults.isTie;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Top Classified Mission Dossier Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-agency-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-agency-accent/10 border border-agency-accent/30 flex items-center justify-center text-agency-accent">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-agency-accent uppercase">
                OPERATION CONCLUSION // FINAL DOSSIER
              </span>
              <span className="text-xs text-agency-muted">•</span>
              <span className="text-[10px] font-mono text-agency-muted">
                3 ROUNDS COMPLETED
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
              Mission Debrief & Final Standings
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="md">
            ROOM // {code?.toUpperCase()}
          </Badge>
          <Badge variant="classified" size="md">
            CLASSIFIED RECORD
          </Badge>
        </div>
      </div>

      {/* Hero Victory Banner / Overall Champion Showcase */}
      <Card
        variant="interactive"
        className="relative overflow-hidden p-6 sm:p-8 border-agency-accent/40 bg-gradient-to-b from-agency-surface/90 via-agency-surface/60 to-agency-bg text-center space-y-4"
      >
        {/* Subtle Ambient Radar Glow (respects prefers-reduced-motion) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-agency-accent/10 rounded-full blur-3xl opacity-60 motion-safe:animate-pulse"
        />

        <div className="relative z-10 flex flex-col items-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-agency-accent/15 border border-agency-accent/40 text-agency-accent text-xs font-mono font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            {isTie ? 'MISSION CO-CHAMPIONS DECLARED' : 'OVERALL MISSION CHAMPION'}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            {champions.map((champ) => {
              const avatar = getAvatarById(champ.avatarId);
              return (
                <div key={champ.playerId} className="flex flex-col items-center space-y-2">
                  <div className="relative">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-agency-surface border-2 border-amber-400/80 shadow-[0_0_25px_rgba(251,191,36,0.25)] flex items-center justify-center text-4xl sm:text-5xl">
                      {avatar.symbol}
                    </div>
                    <div className="absolute -top-3 -right-2 bg-amber-400 text-agency-bg p-1 rounded-full shadow-lg border border-agency-bg">
                      <Crown className="w-4 h-4 fill-agency-bg" />
                    </div>
                  </div>

                  <div>
                    <div className="text-lg sm:text-xl font-black text-white tracking-wide uppercase flex items-center justify-center gap-2">
                      {champ.displayName}
                      {champ.playerId === currentPlayer.playerId && (
                        <span className="text-[10px] bg-agency-accent/20 text-agency-accent px-1.5 py-0.5 rounded border border-agency-accent/40">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-amber-400 font-bold tracking-widest">
                      {champ.codename}
                    </div>
                    <div className="text-sm font-mono text-white/90 font-black mt-1">
                      {champ.totalScore} TOTAL POINTS
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-agency-muted max-w-md mx-auto pt-2">
            {isTie
              ? 'Shared supreme honors! Multiple operatives accumulated identical top scores across all intelligence operations.'
              : 'Superior tradecraft, razor-sharp deduction, and relentless tactical mastery crowned the top operative.'}
          </p>
        </div>
      </Card>

      {/* Visual Podium Showcase */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-agency-accent" />
          <h2 className="text-sm font-mono font-bold text-white tracking-widest uppercase">
            Top Operatives Podium
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-4">
          {/* In 3+ player games: 2nd place on left, 1st place center, 3rd place on right */}
          {podiumEntries.length >= 3 ? (
            <>
              {/* 2nd Place (Silver) */}
              <PodiumCard
                entry={podiumEntries[1]}
                position="2nd"
                rankLabel="#2"
                borderColor="border-slate-300/50"
                glowColor="shadow-[0_0_15px_rgba(203,213,225,0.15)]"
                badgeBg="bg-slate-300 text-agency-bg"
                isCurrentPlayer={podiumEntries[1].playerId === currentPlayer.playerId}
                heightClass="h-44 sm:h-52"
              />

              {/* 1st Place (Gold - Elevated) */}
              <PodiumCard
                entry={podiumEntries[0]}
                position="1st"
                rankLabel="#1"
                borderColor="border-amber-400/80"
                glowColor="shadow-[0_0_20px_rgba(251,191,36,0.25)]"
                badgeBg="bg-amber-400 text-agency-bg"
                isCurrentPlayer={podiumEntries[0].playerId === currentPlayer.playerId}
                heightClass="h-52 sm:h-64"
                isGold
              />

              {/* 3rd Place (Bronze) */}
              <PodiumCard
                entry={podiumEntries[2]}
                position="3rd"
                rankLabel="#3"
                borderColor="border-amber-700/50"
                glowColor="shadow-[0_0_15px_rgba(180,83,9,0.15)]"
                badgeBg="bg-amber-700 text-white"
                isCurrentPlayer={podiumEntries[2].playerId === currentPlayer.playerId}
                heightClass="h-40 sm:h-48"
              />
            </>
          ) : (
            // For 2-player duel mode: Side-by-side podium
            <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
              {podiumEntries.map((entry, idx) => (
                <PodiumCard
                  key={entry.playerId}
                  entry={entry}
                  position={idx === 0 ? '1st' : '2nd'}
                  rankLabel={`#${entry.rank}`}
                  borderColor={idx === 0 ? 'border-amber-400/80' : 'border-slate-300/50'}
                  glowColor={
                    idx === 0
                      ? 'shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                      : 'shadow-[0_0_15px_rgba(203,213,225,0.15)]'
                  }
                  badgeBg={idx === 0 ? 'bg-amber-400 text-agency-bg' : 'bg-slate-300 text-agency-bg'}
                  isCurrentPlayer={entry.playerId === currentPlayer.playerId}
                  heightClass="h-48 sm:h-56"
                  isGold={idx === 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Complete Final Leaderboard Table */}
      <Card variant="interactive" className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-agency-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-agency-accent" />
            <h2 className="text-sm font-mono font-bold text-white tracking-widest uppercase">
              Official Match Leaderboard ({finalResults.leaderboard.length} Operatives)
            </h2>
          </div>
          <span className="text-[10px] font-mono text-agency-muted">
            STANDARD COMPETITION SCORING
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-agency-border text-agency-muted text-[10px] uppercase">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Operative</th>
                <th className="py-2.5 px-3">Codename</th>
                <th className="py-2.5 px-2 text-center">R1</th>
                <th className="py-2.5 px-2 text-center">R2</th>
                <th className="py-2.5 px-2 text-center">R3</th>
                <th className="py-2.5 px-3 text-center">Agent Wins</th>
                <th className="py-2.5 px-3 text-center">Imposter Wins</th>
                <th className="py-2.5 px-3 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-agency-border/40">
              {finalResults.leaderboard.map((entry) => {
                const avatar = getAvatarById(entry.avatarId);
                const isLocal = entry.playerId === currentPlayer.playerId;
                const isHost = room.hostPlayerId === entry.playerId;

                return (
                  <tr
                    key={entry.playerId}
                    className={`transition-colors ${
                      isLocal
                        ? 'bg-agency-accent/10 hover:bg-agency-accent/15 font-bold'
                        : 'hover:bg-agency-surface/50'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-black text-xs ${
                          entry.rank === 1
                            ? 'bg-amber-400 text-agency-bg font-black shadow-sm'
                            : entry.rank === 2
                              ? 'bg-slate-300 text-agency-bg font-black'
                              : entry.rank === 3
                                ? 'bg-amber-700 text-white font-black'
                                : 'bg-agency-surface border border-agency-border text-agency-muted'
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{avatar.symbol}</span>
                        <span className="font-sans font-bold text-white flex items-center gap-1.5">
                          {entry.displayName}
                          {isLocal && (
                            <span className="text-[10px] font-mono text-agency-accent bg-agency-accent/20 px-1 py-0.2 rounded border border-agency-accent/40">
                              YOU
                            </span>
                          )}
                          {isHost && (
                            <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded border border-amber-400/30">
                              HOST
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-agency-muted text-[11px]">
                      {entry.codename}
                    </td>
                    <td className="py-3 px-2 text-center text-white/90">
                      {entry.roundScores[1] !== undefined ? `+${entry.roundScores[1]}` : '-'}
                    </td>
                    <td className="py-3 px-2 text-center text-white/90">
                      {entry.roundScores[2] !== undefined ? `+${entry.roundScores[2]}` : '-'}
                    </td>
                    <td className="py-3 px-2 text-center text-white/90">
                      {entry.roundScores[3] !== undefined ? `+${entry.roundScores[3]}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-center text-white/80">
                      {entry.agentWins}
                    </td>
                    <td className="py-3 px-3 text-center text-white/80">
                      {entry.imposterWins}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-agency-accent text-sm">
                      {entry.totalScore} PTS
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Special Performance Awards Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-agency-accent" />
          <h2 className="text-sm font-mono font-bold text-white tracking-widest uppercase">
            Intelligence Agency Merits & Special Awards
          </h2>
        </div>

        {finalResults.specialAwards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {finalResults.specialAwards.map((award) => (
              <Card
                key={award.id}
                variant="interactive"
                className="p-5 flex flex-col justify-between space-y-4 border-agency-border/60 hover:border-agency-accent/40 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{award.icon}</span>
                    <Badge variant="neutral" size="sm">
                      {award.metricLabel}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                    {award.title}
                  </h3>
                  <p className="text-[11px] text-agency-muted line-clamp-2">
                    {award.description}
                  </p>
                </div>

                <div className="border-t border-agency-border/40 pt-3">
                  <div className="text-[10px] font-mono text-agency-muted uppercase">
                    Awarded To:
                  </div>
                  <div className="text-xs font-bold text-agency-accent mt-0.5">
                    {award.winnerNames.join(', ')}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card variant="interactive" className="p-6 text-center text-agency-muted text-xs font-mono">
            No operatives met the performance thresholds for specialized merits this mission.
          </Card>
        )}
      </div>

      {/* Round-by-Round Match History Timeline */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-agency-accent" />
          <h2 className="text-sm font-mono font-bold text-white tracking-widest uppercase">
            Mission Timeline // Round History
          </h2>
        </div>

        <div className="space-y-3">
          {finalResults.roundHistory.map((round) => {
            const isExpanded = expandedRound === round.roundNumber;
            const imposterPlayer = room.players.find((p) => p.playerId === round.imposterPlayerId);
            const imposterAvatar = imposterPlayer ? getAvatarById(imposterPlayer.avatarId) : null;
            const selectedPlayer = room.players.find((p) => p.playerId === round.selectedPlayerId);
            const isAgentsWin = round.outcome === 'AGENTS_WIN';

            return (
              <Card
                key={round.roundNumber}
                variant="interactive"
                className="border-agency-border/70 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedRound(isExpanded ? null : round.roundNumber)}
                  className="w-full p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left hover:bg-agency-surface/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs font-mono ${
                        isAgentsWin
                          ? 'bg-agency-accent/15 text-agency-accent border border-agency-accent/30'
                          : 'bg-agency-danger/15 text-agency-danger border border-agency-danger/30'
                      }`}
                    >
                      R{round.roundNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Round {round.roundNumber} Outcome:
                        </span>
                        <Badge
                          variant={isAgentsWin ? 'classified' : 'danger'}
                          size="sm"
                        >
                          {isAgentsWin ? 'AGENTS DISCOVERED INFILTRATOR' : 'IMPOSTER EVADED CAPTURE'}
                        </Badge>
                      </div>
                      <div className="text-[11px] font-mono text-agency-muted mt-0.5">
                        Location: <span className="text-white font-bold">{round.secretWord}</span> ({round.category})
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <span className="text-xs font-mono text-agency-accent">
                      {isAgentsWin ? '+1 PTS (Agents)' : '+2 PTS (Imposter)'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-agency-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-agency-muted" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 border-t border-agency-border/40 bg-agency-bg/50 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                      <div className="p-3 rounded-lg bg-agency-surface border border-agency-border/40">
                        <div className="text-[10px] text-agency-muted uppercase">Enemy Infiltrator:</div>
                        <div className="text-white font-bold flex items-center gap-2 mt-1">
                          {imposterAvatar?.symbol} {imposterPlayer?.displayName || 'Unknown'}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-agency-surface border border-agency-border/40">
                        <div className="text-[10px] text-agency-muted uppercase">Voting Accusation:</div>
                        <div className="text-white font-bold mt-1">
                          {selectedPlayer ? selectedPlayer.displayName : 'Deadlock / No Consensus'}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-agency-surface border border-agency-border/40">
                        <div className="text-[10px] text-agency-muted uppercase">Round Conclusion:</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {isAgentsWin ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-agency-accent" />
                              <span className="text-agency-accent font-bold">Imposter Caught</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-agency-danger" />
                              <span className="text-agency-danger font-bold">Infiltration Successful</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-mono text-agency-muted uppercase mb-2">
                        Round Points Distribution:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {room.players.map((p) => {
                          const pts = round.playerRoundPoints[p.playerId] || 0;
                          return (
                            <span
                              key={p.playerId}
                              className={`px-2.5 py-1 rounded text-xs font-mono border ${
                                pts > 0
                                  ? 'bg-agency-accent/10 border-agency-accent/30 text-agency-accent'
                                  : 'bg-agency-surface border-agency-border/40 text-agency-muted'
                              }`}
                            >
                              {p.displayName}: +{pts}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Live Rematch Alert Banner if Rematch Pending */}
      {(room?.status === 'REMATCH_PENDING' || room?.status === 'REMATCH_READY') && (
        <Card variant="interactive" className="p-5 border-agency-accent/50 bg-agency-accent/10 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-agency-accent/20 border border-agency-accent/40 flex items-center justify-center text-agency-accent">
              <RotateCcw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-white uppercase">
                REMATCH INVITATION ACTIVE // JOIN LOBBY
              </div>
              <span className="text-[10px] font-mono text-agency-muted">
                Mission leader has requested a 3-round rematch. Confirm your readiness in the lobby.
              </span>
            </div>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate(`/room/${code}/rematch`)}
            rightIcon={<RotateCcw className="w-4 h-4" />}
          >
            ENTER REMATCH LOBBY
          </Button>
        </Card>
      )}

      {/* Action Footer */}
      <Card variant="interactive" className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-agency-surface border border-agency-border flex items-center justify-center text-agency-accent">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-white">
              MISSION STATUS // CONCLUDED
            </div>
            <span className="text-[10px] font-mono text-agency-muted">
              All intelligence cycles complete. Match records officially archived.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {showLeaveConfirm ? (
            <div className="flex items-center gap-2 p-1 bg-agency-danger/10 border border-agency-danger/30 rounded-lg">
              <span className="text-[11px] font-mono text-agency-danger px-2">Leave mission?</span>
              <Button variant="danger" size="sm" onClick={handleLeave}>
                CONFIRM LEAVE
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowLeaveConfirm(false)}>
                CANCEL
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowLeaveConfirm(true)}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              LEAVE ROOM
            </Button>
          )}

          {room?.status === 'REMATCH_PENDING' || room?.status === 'REMATCH_READY' ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate(`/room/${code}/rematch`)}
              rightIcon={<RotateCcw className="w-4 h-4" />}
            >
              REMATCH LOBBY
            </Button>
          ) : currentPlayer?.isHost ? (
            <Button
              variant="primary"
              size="md"
              onClick={handleRequestRematch}
              isLoading={isRequestingRematch}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              PLAY AGAIN (REQUEST REMATCH)
            </Button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-agency-surface border border-agency-border text-xs font-mono text-agency-muted">
              <span className="w-2 h-2 rounded-full bg-agency-muted animate-pulse" />
              <span>AWAITING HOST FOR REMATCH...</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

interface PodiumCardProps {
  entry: LeaderboardEntry;
  position: string;
  rankLabel: string;
  borderColor: string;
  glowColor: string;
  badgeBg: string;
  isCurrentPlayer: boolean;
  heightClass: string;
  isGold?: boolean;
}

const PodiumCard: React.FC<PodiumCardProps> = ({
  entry,
  rankLabel,
  borderColor,
  glowColor,
  badgeBg,
  isCurrentPlayer,
  heightClass,
  isGold,
}) => {
  const avatar = getAvatarById(entry.avatarId);

  return (
    <Card
      variant="interactive"
      className={`p-5 flex flex-col items-center justify-between border-2 ${borderColor} ${glowColor} ${heightClass} transition-all duration-300 relative`}
    >
      <div className="flex items-center justify-between w-full">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${badgeBg}`}
        >
          {rankLabel}
        </span>
        {isGold && <Crown className="w-4 h-4 text-amber-400" />}
      </div>

      <div className="flex flex-col items-center text-center space-y-1">
        <div className="text-3xl sm:text-4xl">{avatar.symbol}</div>
        <div className="text-sm font-bold text-white flex items-center gap-1">
          {entry.displayName}
          {isCurrentPlayer && (
            <span className="text-[9px] bg-agency-accent/20 text-agency-accent px-1 rounded font-mono">
              YOU
            </span>
          )}
        </div>
        <div className="text-[10px] font-mono text-agency-muted">{entry.codename}</div>
      </div>

      <div className="w-full text-center border-t border-agency-border/40 pt-2">
        <span className="text-xs font-mono font-black text-agency-accent">
          {entry.totalScore} PTS
        </span>
      </div>
    </Card>
  );
};

export default FinalLeaderboard;
