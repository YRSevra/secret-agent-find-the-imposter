import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Room, Player, RematchState } from '../types/game';
import { GameApiService } from '../services/gameApi';
import { getAvatarById } from '../constants/avatars';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  ArrowLeft,
  X,
  AlertTriangle,
  Crown,
} from 'lucide-react';

export const RematchLobby: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [rematch, setRematch] = useState<RematchState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);

  const fetchLobbyState = useCallback(async () => {
    if (!code) return;
    try {
      const roomRes = await GameApiService.getRoom(code);
      if (!roomRes.success || !roomRes.data) {
        setErrorMessage(roomRes.error || 'Failed to sync with mission server.');
        return;
      }

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

      // Check if new match has already started
      if (latestRoom.status === 'ROLE_REVEAL') {
        navigate(`/room/${code}/role-reveal`);
        return;
      }

      // If rematch was cancelled or room returned to completed
      if (latestRoom.status === 'MATCH_COMPLETED') {
        navigate(`/room/${code}/final-results`);
        return;
      }

      // Sync rematch state
      if (latestRoom.currentRematch) {
        setRematch(latestRoom.currentRematch);

        const expMs = new Date(latestRoom.currentRematch.expiresAt).getTime();
        const now = Date.now();
        const diffSec = Math.max(0, Math.floor((expMs - now) / 1000));
        setSecondsRemaining(diffSec);

        if (diffSec === 0 && latestRoom.currentRematch.status === 'PENDING') {
          await GameApiService.getRematchStatus(code);
        }
      } else {
        // No rematch active
        navigate(`/room/${code}/final-results`);
        return;
      }

      setIsLoading(false);
    } catch {
      setErrorMessage('Network error synchronizing rematch lobby.');
    }
  }, [code, navigate]);

  useEffect(() => {
    fetchLobbyState();
    const interval = setInterval(fetchLobbyState, 1500);
    return () => clearInterval(interval);
  }, [fetchLobbyState]);

  // Countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRespond = async (response: 'READY' | 'DECLINE') => {
    if (!code || isActionLoading) return;
    setIsActionLoading(true);
    setErrorMessage(null);

    const res = await GameApiService.respondRematch(code, response);
    setIsActionLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to update readiness.');
      return;
    }

    if (res.data) {
      setRematch(res.data.rematch);
    }
  };

  const handleStartRematch = async () => {
    if (!code || isActionLoading) return;
    setIsActionLoading(true);
    setErrorMessage(null);

    const res = await GameApiService.startRematch(code);
    setIsActionLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to initialize rematch.');
      return;
    }

    navigate(`/room/${code}/role-reveal`);
  };

  const handleCancelRematch = async () => {
    if (!code || isActionLoading) return;
    setIsActionLoading(true);
    await GameApiService.cancelRematch(code);
    setIsActionLoading(false);
    navigate(`/room/${code}/final-results`);
  };

  const handleLeave = async () => {
    if (code) {
      await GameApiService.leaveRoom(code);
    }
    navigate('/');
  };

  const isAllReady = useMemo(() => {
    if (!room || !rematch) return false;
    return room.players.every((p) => rematch.readyPlayerIds.includes(p.playerId));
  }, [room, rematch]);

  const readyCount = rematch?.readyPlayerIds.length || 0;
  const totalCount = room?.players.length || 0;
  const isLocalReady = currentPlayer ? rematch?.readyPlayerIds.includes(currentPlayer.playerId) : false;
  const isLocalDeclined = currentPlayer ? rematch?.declinedPlayerIds.includes(currentPlayer.playerId) : false;

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <LoadingSpinner size="lg" label="CONNECTING TO SECURE REMATCH LOBBY..." />
      </div>
    );
  }

  if (!room || !currentPlayer || !rematch) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <Card variant="interactive" className="p-6 space-y-4 border-agency-danger/40">
          <AlertTriangle className="w-10 h-10 text-agency-danger mx-auto" />
          <h2 className="text-xl font-bold text-white">Rematch Invitation Expired</h2>
          <p className="text-xs text-agency-muted">
            {errorMessage || 'This rematch session is no longer active.'}
          </p>
          <Button variant="primary" size="md" onClick={() => navigate(code ? `/room/${code}/final-results` : '/')}>
            RETURN TO DOSSIER
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-agency-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-agency-accent/10 border border-agency-accent/30 flex items-center justify-center text-agency-accent">
            <RotateCcw className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-agency-accent uppercase">
                OPERATION REMATCH // REPEAT MISSION
              </span>
              <span className="text-xs text-agency-muted">•</span>
              <span className="text-[10px] font-mono text-agency-muted">
                3-ROUND REMATCH CYCLE
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
              Classified Rematch Lobby
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="md">
            ROOM // {code?.toUpperCase()}
          </Badge>
          <Badge variant={isAllReady ? 'classified' : 'warning'} size="md">
            {isAllReady ? 'ALL OPERATIVES READY' : `${readyCount} / ${totalCount} READY`}
          </Badge>
        </div>
      </div>

      {/* Expiration Countdown Bar */}
      <Card variant="interactive" className="p-4 flex items-center justify-between bg-agency-surface/80">
        <div className="flex items-center gap-2 text-xs font-mono text-white/90">
          <Clock className="w-4 h-4 text-agency-accent animate-pulse" />
          <span>REMATCH INVITATION EXPIRATION:</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-mono font-black text-sm ${
              secondsRemaining <= 20 ? 'text-agency-danger animate-pulse' : 'text-agency-accent'
            }`}
          >
            {Math.floor(secondsRemaining / 60)}:
            {(secondsRemaining % 60).toString().padStart(2, '0')}
          </span>
          <span className="text-[10px] font-mono text-agency-muted">REMAINING</span>
        </div>
      </Card>

      {/* Previous Match Briefing Card */}
      {room.currentMatch?.finalResults && (
        <Card variant="interactive" className="p-5 border-amber-400/30 bg-gradient-to-r from-agency-surface via-agency-surface/80 to-agency-bg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase">
              <Crown className="w-4 h-4" />
              <span>PREVIOUS MISSION CHAMPION(S)</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/room/${code}/final-results`)}
            >
              VIEW FULL DOSSIER
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            {room.currentMatch.finalResults.champions.map((champ) => {
              const av = getAvatarById(champ.avatarId);
              return (
                <div key={champ.playerId} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-agency-bg/60 border border-agency-border">
                  <span className="text-xl">{av.symbol}</span>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      {champ.displayName}
                      <span className="text-[10px] text-amber-400 font-mono font-black">
                        ({champ.totalScore} PTS)
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-agency-muted">
                      {champ.codename}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Operative Readiness List */}
      <Card variant="interactive" className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-agency-border/60 pb-3">
          <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Operative Confirmation Status ({readyCount}/{totalCount} Confirmed)
          </div>
          <span className="text-[10px] font-mono text-agency-muted">
            ALL OPERATIVES MUST CONFIRM
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {room.players.map((p) => {
            const avatar = getAvatarById(p.avatarId);
            const isReady = rematch.readyPlayerIds.includes(p.playerId);
            const isDeclined = rematch.declinedPlayerIds.includes(p.playerId);
            const isLocal = p.playerId === currentPlayer.playerId;

            return (
              <div
                key={p.playerId}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                  isReady
                    ? 'bg-agency-accent/5 border-agency-accent/40'
                    : isDeclined
                      ? 'bg-agency-danger/5 border-agency-danger/40'
                      : 'bg-agency-surface border-agency-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-agency-bg border border-agency-border flex items-center justify-center text-xl">
                    {avatar.symbol}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      {p.displayName}
                      {isLocal && (
                        <span className="text-[9px] font-mono text-agency-accent bg-agency-accent/20 px-1 py-0.2 rounded border border-agency-accent/30">
                          YOU
                        </span>
                      )}
                      {p.isHost && (
                        <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded border border-amber-400/30">
                          HOST
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-agency-muted">
                      {avatar.codename}
                    </div>
                  </div>
                </div>

                <div>
                  {isReady ? (
                    <Badge variant="classified" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      READY
                    </Badge>
                  ) : isDeclined ? (
                    <Badge variant="danger" size="sm">
                      <XCircle className="w-3 h-3 mr-1" />
                      DECLINED
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      AWAITING
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Local Operative Controls */}
      <Card variant="interactive" className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono font-bold text-white uppercase">
            YOUR READINESS STATUS
          </div>
          <span className="text-[10px] font-mono text-agency-muted">
            {isLocalReady
              ? 'You are locked in and ready for the next 3-round operation.'
              : isLocalDeclined
                ? 'You have declined this rematch. Change to READY if you wish to rejoin.'
                : 'Confirm your readiness to authorize mission deployment.'}
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isLocalReady ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => handleRespond('READY')}
              isLoading={isActionLoading}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              CONFIRM READY
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="md"
              onClick={() => handleRespond('DECLINE')}
              isLoading={isActionLoading}
              leftIcon={<X className="w-4 h-4" />}
            >
              STAND DOWN (DECLINE)
            </Button>
          )}

          <Button
            variant="secondary"
            size="md"
            onClick={handleLeave}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            LEAVE ROOM
          </Button>
        </div>
      </Card>

      {/* Host Mission Launch Bar */}
      {currentPlayer.isHost && (
        <Card variant="interactive" className="p-5 border-agency-accent/40 bg-agency-accent/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono font-bold text-white uppercase">
              MISSION LEADER AUTHORIZATION // COMMENCE REMATCH
            </div>
            <span className="text-[10px] font-mono text-agency-muted">
              {isAllReady
                ? 'All operatives have confirmed. You may launch the next 3-round match now.'
                : 'Awaiting remaining operatives to confirm readiness before launch.'}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="md"
              onClick={handleCancelRematch}
              isLoading={isActionLoading}
            >
              CANCEL REMATCH
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={handleStartRematch}
              isLoading={isActionLoading}
              disabled={!isAllReady}
              rightIcon={<Play className="w-4 h-4" />}
            >
              COMMENCE REMATCH
            </Button>
          </div>
        </Card>
      )}

      {errorMessage && (
        <div className="p-3 rounded-lg bg-agency-danger/10 border border-agency-danger/40 text-xs font-mono text-agency-danger text-center">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default RematchLobby;
