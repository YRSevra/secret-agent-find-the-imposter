import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Room, Player } from '../types/game';
import { GameApiService } from '../services/gameApi';
import { getAvatarById } from '../constants/avatars';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Copy,
  Check,
  Share2,
  Users,
  Radio,
  ArrowLeft,
  Wifi,
  WifiOff,
  Clock,
  Swords,
  Crown,
  CheckCircle2,
  XCircle,
  Play,
  AlertTriangle,
  Info,
  Shield,
  Sparkles,
} from 'lucide-react';

export const RoomConnection: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingReady, setIsUpdatingReady] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'connected' | 'reconnecting' | 'error'>('connected');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Ref to track last seen version to prevent redundant state thrashing
  const lastVersionRef = useRef<number>(-1);
  const consecutiveFailuresRef = useRef<number>(0);

  const fetchRoomState = useCallback(async () => {
    if (!code) return;
    try {
      const res = await GameApiService.getRoom(code);
      if (!res.success || !res.data) {
        consecutiveFailuresRef.current++;
        if (consecutiveFailuresRef.current >= 3) {
          setNetworkStatus('error');
          setActionError(res.error || 'Connection to agency server lost.');
        } else {
          setNetworkStatus('reconnecting');
        }
        return;
      }

      consecutiveFailuresRef.current = 0;
      setNetworkStatus('connected');
      const latestRoom = res.data.room;

      // When room transitions out of waiting lobby, automatically route operatives to the active phase
      if (latestRoom.status === 'ROLE_REVEAL') {
        navigate(`/room/${code}/role-reveal`);
        return;
      }
      if (latestRoom.status === 'DISCUSSION') {
        navigate(`/room/${code}/discussion`);
        return;
      }
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
      if (latestRoom.status === 'REMATCH_PENDING' || latestRoom.status === 'REMATCH_READY') {
        navigate(`/room/${code}/rematch`);
        return;
      }

      // Only update room state if version changed or initial load
      if (latestRoom.version !== lastVersionRef.current || !room) {
        lastVersionRef.current = latestRoom.version;
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
      }

      setLastSyncTime(new Date());
      setIsLoading(false);
    } catch {
      consecutiveFailuresRef.current++;
      setNetworkStatus(consecutiveFailuresRef.current >= 3 ? 'error' : 'reconnecting');
    }
  }, [code, room, navigate]);

  useEffect(() => {
    fetchRoomState();
    // 2-second real-time polling synchronization
    const interval = setInterval(fetchRoomState, 2000);
    return () => clearInterval(interval);
  }, [fetchRoomState]);

  // Copy Room Code action
  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code.toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Web Share invitation action with clipboard fallback
  const handleShare = async () => {
    if (!room) return;
    const shareData = {
      title: 'Secret Agent – Multiplayer Mission Room',
      text: `Operative alert: Infiltrate our private room! Enter Room Code: ${room.roomCode}`,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyCode();
        }
      }
    } else {
      handleCopyCode();
    }
  };

  // Toggle Ready Status
  const handleToggleReady = async () => {
    if (!room || !currentPlayer || isUpdatingReady) return;
    setActionError(null);
    setIsUpdatingReady(true);

    const nextReady = !currentPlayer.isReady;
    const res = await GameApiService.setReady(room.roomCode, nextReady);
    setIsUpdatingReady(false);

    if (!res.success || !res.data) {
      setActionError(res.error || 'Failed to update readiness status.');
      return;
    }

    setRoom(res.data.room);
    lastVersionRef.current = res.data.room.version;
    const updatedLocal = res.data.room.players.find((p) => p.playerId === currentPlayer.playerId);
    if (updatedLocal) setCurrentPlayer(updatedLocal);
  };

  // Start Game Action (Host only)
  const handleStartGame = async () => {
    if (!room || !currentPlayer?.isHost || isStartingGame) return;
    setActionError(null);
    setIsStartingGame(true);

    const res = await GameApiService.startGame(room.roomCode);
    setIsStartingGame(false);

    if (!res.success || !res.data) {
      setActionError(res.error || 'Failed to initialize mission launch sequence.');
      return;
    }

    setRoom(res.data.room);
    lastVersionRef.current = res.data.room.version;
  };

  // Disconnect / Leave Room
  const handleLeaveRoom = async () => {
    if (code) {
      await GameApiService.leaveRoom(code);
    }
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <LoadingSpinner size="lg" label="ESTABLISHING ENCRYPTED MISSION LOBBY..." />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <Card variant="default" className="p-6 text-center space-y-4">
          <Badge variant="danger" size="md">
            CONNECTION ABORTED
          </Badge>
          <h2 className="text-xl font-bold text-white">Room Transmission Terminated</h2>
          <p className="text-xs text-agency-muted leading-relaxed">
            {actionError || 'Unable to locate specified mission room in agency records.'}
          </p>
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

  // Capacity & Readiness calculations
  const totalPlayers = room.players.length;
  const readyPlayers = room.players.filter((p) => p.isReady).length;
  const allReady = totalPlayers > 0 && readyPlayers === totalPlayers;
  const isDuel = room.gameMode === 'duel';
  const minRequired = room.minPlayers;
  const hasMinCapacity = isDuel ? totalPlayers === 2 : totalPlayers >= 3;
  const canStart = Boolean(currentPlayer?.isHost && hasMinCapacity && allReady && room.status === 'WAITING');

  // Reason message for start condition
  const getStartBlockerReason = (): string => {
    if (room.status === 'STARTING') return 'Mission launch sequence already active.';
    if (isDuel && totalPlayers < 2) return 'Awaiting 2nd operative to enter Duel Mode.';
    if (!isDuel && totalPlayers < 3) return `Need ${3 - totalPlayers} more operative(s) to reach minimum 3 players.`;
    if (!allReady) {
      const unreadyCount = totalPlayers - readyPlayers;
      return `Waiting for ${unreadyCount} operative(s) to confirm READY.`;
    }
    return 'All requirements satisfied. Launch ready.';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
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
                CLASSIFIED LOBBY
              </Badge>
            </div>
            <span className="text-[10px] font-mono text-agency-muted">
              CODE: {room.roomCode} • PHASE 4 MULTIPLAYER
            </span>
          </div>
        </div>

        {/* Network & Synchronized Clock */}
        <div className="flex items-center gap-3 text-xs font-mono text-agency-muted">
          {networkStatus === 'connected' ? (
            <span className="flex items-center gap-1.5 text-agency-accent">
              <Wifi className="w-3.5 h-3.5" />
              LIVE SYNC
            </span>
          ) : networkStatus === 'reconnecting' ? (
            <span className="flex items-center gap-1.5 text-agency-amber animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              RECONNECTING...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-agency-warning">
              <WifiOff className="w-3.5 h-3.5" />
              OFFLINE
            </span>
          )}
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {lastSyncTime.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-3 bg-agency-warning/10 border border-agency-warning/40 rounded-lg flex items-start gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-agency-warning shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-agency-warning leading-relaxed">{actionError}</p>
        </div>
      )}

      {/* STARTING STATE TRANSITION BANNER */}
      {room.status === 'STARTING' && (
        <div className="p-5 bg-agency-accent/15 border-2 border-agency-accent rounded-xl shadow-glow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-in zoom-in-95">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="p-2.5 rounded-lg bg-agency-accent text-agency-dark">
              <Sparkles className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="font-mono text-sm font-black text-agency-accent uppercase tracking-wider">
                  MISSION LAUNCH INITIATED
                </span>
                <Badge variant="classified" size="sm">
                  PHASE 4 COMPLETE
                </Badge>
              </div>
              <p className="text-xs text-slate-200 mt-1">
                All operatives authenticated and ready. Transmission advancing to Phase 5 (Secret Role & Word Distribution Engine).
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-agency-accent bg-agency-dark px-3 py-1.5 rounded border border-agency-accent/40 font-bold shrink-0">
            DISPATCH QUEUED
          </span>
        </div>
      )}

      {/* Room Information & Share Panel */}
      <Card variant="elevated" withReticle className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-agency-border">
          <div>
            <span className="text-[10px] font-mono text-agency-muted uppercase tracking-widest block">
              SECURE ROOM ACCESS CODE
            </span>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-3xl sm:text-4xl font-mono font-black text-agency-accent tracking-[0.25em] text-glow select-all">
                {room.roomCode}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyCode}
                  title="Copy 6-character code"
                  className="p-2 rounded-lg bg-agency-surface border border-agency-border hover:border-agency-accent/50 text-agency-muted hover:text-agency-accent transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-agency-accent" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleShare}
                  title="Share invitation link"
                  className="p-2 rounded-lg bg-agency-surface border border-agency-border hover:border-agency-accent/50 text-agency-muted hover:text-agency-accent transition-colors"
                >
                  {shared ? <Check className="w-4 h-4 text-agency-accent" /> : <Share2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 text-left w-full sm:w-auto">
            <div className="p-3 bg-agency-surface rounded-lg border border-agency-border flex-1 sm:flex-initial">
              <span className="text-[10px] font-mono text-agency-muted block">GAME MODE</span>
              <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                <Swords className="w-3.5 h-3.5 text-agency-accent" />
                {room.gameMode.toUpperCase()}
              </span>
            </div>

            <div className="p-3 bg-agency-surface rounded-lg border border-agency-border flex-1 sm:flex-initial">
              <span className="text-[10px] font-mono text-agency-muted block">CAPACITY</span>
              <span className="font-mono text-xs font-bold text-agency-accent flex items-center gap-1.5 mt-0.5">
                <Users className="w-3.5 h-3.5" />
                {totalPlayers} / {room.maxPlayers}
              </span>
            </div>

            <div className="p-3 bg-agency-surface rounded-lg border border-agency-border flex-1 sm:flex-initial">
              <span className="text-[10px] font-mono text-agency-muted block">READY STATE</span>
              <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className={`w-3.5 h-3.5 ${allReady ? 'text-agency-accent' : 'text-agency-amber'}`} />
                {readyPlayers} / {totalPlayers}
              </span>
            </div>
          </div>
        </div>

        {/* Invitation & Status Prompt */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs font-mono text-agency-muted gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-agency-accent shrink-0" />
            <span>
              {totalPlayers < minRequired
                ? `Need at least ${minRequired} operatives. Invite friends using Room Code: ${room.roomCode}`
                : allReady
                ? 'All operatives ready for deployment.'
                : 'Waiting for all joined operatives to confirm READY status.'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              leftIcon={<Share2 className="w-3.5 h-3.5" />}
            >
              INVITE OPERATIVES
            </Button>
          </div>
        </div>
      </Card>

      {/* Current Player Readiness Controls Panel */}
      {currentPlayer && (
        <Card variant="interactive" className="p-5 border-agency-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl p-2 rounded-lg bg-agency-surface border border-agency-border">
                {getAvatarById(currentPlayer.avatarId).symbol}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-white">
                    {currentPlayer.displayName}
                  </span>
                  <Badge variant="classified" size="sm">
                    YOU
                  </Badge>
                  {currentPlayer.isHost && (
                    <span className="text-[10px] font-mono font-bold text-agency-amber flex items-center gap-1 bg-agency-amber/10 px-2 py-0.5 rounded border border-agency-amber/30">
                      <Crown className="w-3 h-3" /> HOST
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono text-agency-muted mt-0.5 flex items-center gap-2">
                  <span>Current Status:</span>
                  <span
                    className={`font-bold uppercase ${
                      currentPlayer.isReady ? 'text-agency-accent' : 'text-agency-warning'
                    }`}
                  >
                    {currentPlayer.isReady ? '● CONFIRMED READY' : '○ NOT READY'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ready / Not Ready Toggle Button */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant={currentPlayer.isReady ? 'secondary' : 'primary'}
                size="md"
                onClick={handleToggleReady}
                isLoading={isUpdatingReady}
                disabled={room.status === 'STARTING'}
                leftIcon={
                  currentPlayer.isReady ? (
                    <XCircle className="w-4 h-4 text-agency-warning" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-agency-dark" />
                  )
                }
                className="w-full sm:w-auto"
              >
                {currentPlayer.isReady ? 'SET NOT READY' : 'CONFIRM READY'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Host Mission Control Panel (Rendered only for Host) */}
      {currentPlayer?.isHost && (
        <Card variant="elevated" className="p-5 sm:p-6 border-agency-accent/40 shadow-glow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-agency-border pb-3">
            <div className="flex items-center gap-2 text-agency-accent font-mono text-xs font-bold">
              <Crown className="w-4 h-4 text-agency-amber" />
              <span>MISSION HOST DISPATCH CONSOLE</span>
            </div>
            <span className="text-[10px] font-mono text-agency-muted">AUTHORITATIVE DISPATCH</span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-mono text-sm font-bold text-white">
                Launch Mission Deployment
              </h4>
              <p className="text-xs text-agency-muted leading-relaxed">
                {getStartBlockerReason()}
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={handleStartGame}
              disabled={!canStart || isStartingGame}
              isLoading={isStartingGame}
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              className="w-full sm:w-auto shadow-glow-md"
            >
              START MISSION
            </Button>
          </div>
        </Card>
      )}

      {/* Connected Operatives Roster */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-agency-muted px-1">
          <span className="flex items-center gap-1.5 text-white font-bold">
            <Radio className="w-3.5 h-3.5 text-agency-accent animate-pulse" />
            OPERATIVE ROSTER ({totalPlayers}/{room.maxPlayers})
          </span>
          <span>AUTONOMOUS SYNC</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {room.players.map((p) => {
            const pAvatar = getAvatarById(p.avatarId);
            const isUser = p.playerId === currentPlayer?.playerId;

            return (
              <div
                key={p.playerId}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isUser
                    ? 'bg-agency-surface border-agency-accent/60 shadow-glow-sm'
                    : 'bg-agency-card border-agency-border hover:border-agency-borderLight'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-3xl select-none">{pAvatar.symbol}</span>
                    <div className="overflow-hidden">
                      <div className="font-mono text-sm font-bold text-white truncate flex items-center gap-1.5">
                        <span>{p.displayName}</span>
                        {p.isHost && (
                          <span title="Mission Host">
                            <Crown className="w-3.5 h-3.5 text-agency-amber shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-agency-muted truncate">
                        {pAvatar.codename}
                      </div>
                    </div>
                  </div>

                  {/* Ready Status Badge */}
                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${
                      p.isReady
                        ? 'bg-agency-accent/15 text-agency-accent border-agency-accent/40 shadow-glow-sm'
                        : 'bg-agency-surface text-agency-muted border-agency-border'
                    }`}
                  >
                    {p.isReady ? 'READY' : 'STANDBY'}
                  </span>
                </div>

                <div className="pt-2 border-t border-agency-border/60 flex items-center justify-between text-[10px] font-mono text-agency-muted">
                  <span>{isUser ? 'SELF' : 'OPERATIVE'}</span>
                  <span>JOINED {new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            );
          })}

          {/* Empty slot placeholders up to min required */}
          {totalPlayers < minRequired && (
            <div className="p-4 rounded-xl border border-dashed border-agency-border/60 bg-agency-card/40 flex flex-col items-center justify-center text-center text-agency-muted py-6">
              <Users className="w-6 h-6 text-agency-muted/40 mb-1" />
              <span className="text-xs font-mono">AWAITING OPERATIVE...</span>
              <span className="text-[10px] font-mono text-agency-muted/60 mt-0.5">
                Share code {room.roomCode}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer Actions */}
      <div className="pt-4 border-t border-agency-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-agency-muted">
        <div>
          <span className="text-agency-accent font-bold">LOBBY STATUS: </span>
          <span>{room.status === 'STARTING' ? 'TRANSITIONING TO ACTIVE COMBAT' : 'AWAITING DISPATCH AUTHORIZATION'}</span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleLeaveRoom}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          DISCONNECT & RETURN HOME
        </Button>
      </div>
    </div>
  );
};

export default RoomConnection;
