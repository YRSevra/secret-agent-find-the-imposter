import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Room, Player, RoleRevealData } from '../types/game';
import { GameApiService } from '../services/gameApi';
import { getAvatarById } from '../constants/avatars';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import {
  Shield,
  ShieldAlert,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  ArrowLeft,
  Users,
  Radio,
  CheckCircle2,
  MessageSquare,
  Play,
} from 'lucide-react';

export const RoleReveal: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [roleData, setRoleData] = useState<RoleRevealData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBriefingHidden, setIsBriefingHidden] = useState(false);
  const [isStartingDiscussion, setIsStartingDiscussion] = useState(false);

  const fetchRoleAndRoom = useCallback(async () => {
    if (!code) return;
    try {
      // 1. Fetch safe room metadata
      const roomRes = await GameApiService.getRoom(code);
      if (!roomRes.success || !roomRes.data) {
        setError(roomRes.error || 'Failed to retrieve room briefing.');
        setIsLoading(false);
        return;
      }
      setRoom(roomRes.data.room);

      // If room has progressed past role reveal, route to the active arena
      if (roomRes.data.room.status === 'DISCUSSION') {
        navigate(`/room/${code}/discussion`);
        return;
      }
      if (roomRes.data.room.status === 'VOTING') {
        navigate(`/room/${code}/voting`);
        return;
      }
      if (roomRes.data.room.status === 'ROUND_SUMMARY') {
        navigate(`/room/${code}/round-summary`);
        return;
      }
      if (roomRes.data.room.status === 'MATCH_COMPLETED') {
        navigate(`/room/${code}/final-results`);
        return;
      }

      const local = GameApiService.getLocalPlayerFromRoom(roomRes.data.room);
      if (local) {
        setCurrentPlayer(local);
      } else {
        const session = GameApiService.getSession();
        if (session && session.roomCode === code.toUpperCase()) {
          const found = roomRes.data.room.players.find((p) => p.playerId === session.playerId);
          if (found) setCurrentPlayer(found);
        }
      }

      // 2. Fetch authenticated private role
      const roleRes = await GameApiService.getMyRole(code);
      if (!roleRes.success || !roleRes.data) {
        setError(roleRes.error || 'Failed to decrypt operative assignment.');
        setIsLoading(false);
        return;
      }

      setRoleData(roleRes.data);
      setIsLoading(false);
    } catch {
      setError('Encrypted communication failure with agency satellite.');
      setIsLoading(false);
    }
  }, [code, navigate]);

  useEffect(() => {
    fetchRoleAndRoom();
    const interval = setInterval(fetchRoleAndRoom, 2500);
    return () => clearInterval(interval);
  }, [fetchRoleAndRoom]);

  const handleStartDiscussion = async () => {
    if (!code || isStartingDiscussion) return;
    setIsStartingDiscussion(true);
    try {
      const res = await GameApiService.startDiscussion(code);
      if (res.success) {
        navigate(`/room/${code}/discussion`);
      } else {
        setError(res.error || 'Failed to initiate discussion arena.');
      }
    } catch {
      setError('Network exception initiating discussion protocol.');
    } finally {
      setIsStartingDiscussion(false);
    }
  };

  // Leave room action
  const handleLeave = async () => {
    if (code) {
      await GameApiService.leaveRoom(code);
    }
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <LoadingSpinner size="lg" label="DECRYPTING CLASSIFIED OPERATIVE DOSSIER..." />
      </div>
    );
  }

  if (error || !room || !roleData || !currentPlayer) {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <Card variant="default" className="p-6 text-center space-y-4">
          <Badge variant="danger" size="md">
            TRANSMISSION TERMINATED
          </Badge>
          <h2 className="text-xl font-bold text-white">Security Clearance Denied</h2>
          <p className="text-xs text-agency-muted leading-relaxed">
            {error || 'Unable to establish secure cryptographic handshake with agency records.'}
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

  const avatar = getAvatarById(currentPlayer.avatarId);
  const isAgent = roleData.role === 'AGENT';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 animate-in fade-in duration-300">
      {/* Top Header Clearance Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-agency-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-agency-surface border border-agency-border flex items-center justify-center">
            {isAgent ? (
              <Shield className="w-5 h-5 text-agency-accent" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-agency-warning" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-extrabold tracking-widest text-white">
                SECRET AGENT
              </span>
              <Badge variant={isAgent ? 'classified' : 'danger'} size="sm" withDot>
                ROUND {roleData.roundNumber} // {isAgent ? 'AGENT IDENTIFIED' : 'IMPOSTER WARNING'}
              </Badge>
            </div>
            <span className="text-[10px] font-mono text-agency-muted">
              ROOM: {room.roomCode} • PRIVATE E2E TRANSMISSION
            </span>
          </div>
        </div>

        {/* Anti-Peep Shield Toggle */}
        <button
          onClick={() => setIsBriefingHidden(!isBriefingHidden)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-agency-surface border border-agency-border text-xs font-mono text-agency-muted hover:text-white transition-colors"
          title="Conceal briefing from prying eyes nearby"
        >
          {isBriefingHidden ? (
            <>
              <Eye className="w-3.5 h-3.5 text-agency-accent" />
              <span>REVEAL BRIEFING</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5 text-agency-warning" />
              <span>CONCEAL DOSSIER</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dossier Card Container */}
      <Card
        variant="elevated"
        withReticle
        className={`p-6 sm:p-8 space-y-6 transition-all duration-300 ${
          isAgent
            ? 'border-agency-accent/50 shadow-glow-sm'
            : 'border-agency-warning/50 shadow-[0_0_25px_rgba(239,68,68,0.25)]'
        }`}
      >
        {/* Dossier Header Watermark */}
        <div className="flex items-center justify-between pb-4 border-b border-agency-border">
          <div className="flex items-center gap-2 font-mono text-xs font-bold">
            <Lock className={`w-4 h-4 ${isAgent ? 'text-agency-accent' : 'text-agency-warning'}`} />
            <span className="text-white">TOP SECRET // CLASSIFIED ASSIGNMENT</span>
          </div>
          <span className="text-[10px] font-mono tracking-widest text-agency-muted uppercase">
            EYES ONLY // NOFORN
          </span>
        </div>

        {/* Operative Identity Strip */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-agency-surface/80 border border-agency-border">
          <div className="text-4xl p-2 rounded-xl bg-agency-card border border-agency-border select-none">
            {avatar.symbol}
          </div>
          <div className="overflow-hidden">
            <span className="text-[10px] font-mono text-agency-muted uppercase block">
              OPERATIVE ON RECORD
            </span>
            <div className="font-mono text-lg font-black text-white truncate">
              {currentPlayer.displayName}
            </div>
            <div className="text-xs font-mono text-agency-accent">
              CODENAME: {avatar.codename}
            </div>
          </div>
        </div>

        {/* ROLE BRIEFING PRESENTATION */}
        {isBriefingHidden ? (
          /* Concealed Privacy State */
          <div className="p-8 rounded-xl bg-agency-card/70 border border-dashed border-agency-border text-center space-y-3">
            <EyeOff className="w-8 h-8 text-agency-muted/50 mx-auto" />
            <div className="font-mono text-sm font-bold text-white">
              DOSSIER TEMPORARILY CONCEALED
            </div>
            <p className="text-xs text-agency-muted max-w-sm mx-auto">
              Private briefing hidden from view. Click "Reveal Briefing" above when ready.
            </p>
          </div>
        ) : isAgent ? (
          /* AGENT DOSSIER */
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-agency-accent/10 border border-agency-accent/30 space-y-1">
              <span className="text-[10px] font-mono font-bold text-agency-accent uppercase tracking-widest block">
                CLASSIFIED STATUS CONFIRMED
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-agency-accent tracking-wide">
                YOU ARE A SECRET AGENT
              </h3>
              <p className="text-xs text-slate-300">
                You belong to the loyal intelligence network. You and all fellow agents share the exact same classified word.
              </p>
            </div>

            {/* Secret Word Box */}
            <div className="p-6 rounded-2xl bg-agency-dark border-2 border-agency-accent shadow-glow-md text-center space-y-2 relative overflow-hidden">
              <div className="absolute top-2 right-3 text-[9px] font-mono tracking-widest text-agency-accent/70 uppercase">
                CATEGORY: {roleData.category}
              </div>
              <span className="text-xs font-mono tracking-[0.2em] text-agency-muted uppercase block">
                THE SECRET WORD / LOCATION
              </span>
              <div className="text-3xl sm:text-5xl font-mono font-black text-white tracking-[0.15em] text-glow select-all py-2">
                {roleData.secretWord}
              </div>
              <span className="inline-block text-[11px] font-mono text-agency-accent bg-agency-surface px-3 py-1 rounded border border-agency-accent/40">
                CATEGORY DOSSIER: {roleData.category?.toUpperCase()}
              </span>
            </div>

            {/* Tactical Instructions */}
            <div className="p-4 rounded-xl bg-agency-surface border border-agency-border space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-white">
                <CheckCircle2 className="w-4 h-4 text-agency-accent" />
                <span>OPERATIVE DIRECTIVES:</span>
              </div>
              <ul className="text-xs text-agency-muted font-sans space-y-1.5 list-disc list-inside leading-relaxed">
                <li>
                  <strong className="text-slate-200">Keep it confidential:</strong> Never recite the secret word directly to any operative.
                </li>
                <li>
                  <strong className="text-slate-200">Drop subtle hints:</strong> Answer questions with enough specificity that fellow agents recognize you, but vague enough to starve the imposter of intel.
                </li>
                <li>
                  <strong className="text-slate-200">Identify the mole:</strong> Listen closely for players whose answers sound generic or contradictory.
                </li>
              </ul>
            </div>
          </div>
        ) : (
          /* IMPOSTER DOSSIER */
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-agency-warning/15 border border-agency-warning/40 space-y-1">
              <span className="text-[10px] font-mono font-bold text-agency-warning uppercase tracking-widest block">
                ALERT: REDACTED INTELLIGENCE
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-agency-warning tracking-wide">
                YOU ARE THE IMPOSTER
              </h3>
              <p className="text-xs text-slate-300">
                You have infiltrated the agency. You do not possess the classified secret word.
              </p>
            </div>

            {/* Imposter Warning Box */}
            <div className="p-6 rounded-2xl bg-agency-dark border-2 border-agency-warning shadow-[0_0_20px_rgba(239,68,68,0.3)] text-center space-y-2">
              <span className="text-xs font-mono tracking-[0.2em] text-agency-warning uppercase block">
                MISSION BRIEFING INTEL
              </span>
              <div className="text-2xl sm:text-4xl font-mono font-black text-agency-warning tracking-wider py-2">
                UNKNOWN // ACCESS DENIED
              </div>
              <p className="text-xs text-agency-muted max-w-md mx-auto">
                {roleData.warning || 'CLASSIFIED: YOU ARE THE IMPOSTER. BLEND IN AND DISCOVER THE SECRET.'}
              </p>
            </div>

            {/* Imposter Tactics */}
            <div className="p-4 rounded-xl bg-agency-surface border border-agency-border space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-agency-warning">
                <AlertTriangle className="w-4 h-4 text-agency-warning" />
                <span>INFILTRATION DIRECTIVES:</span>
              </div>
              <ul className="text-xs text-agency-muted font-sans space-y-1.5 list-disc list-inside leading-relaxed">
                <li>
                  <strong className="text-slate-200">Blend in seamlessly:</strong> Provide plausible, adaptable answers that sound believable across different settings.
                </li>
                <li>
                  <strong className="text-slate-200">Extract clues:</strong> Analyze the questions and answers of other operatives to deduce the secret word.
                </li>
                <li>
                  <strong className="text-slate-200">Deflect suspicion:</strong> If cornered, redirect attention toward hesitation from other players.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Operative Roster Strip (Safe, no roles leaked) */}
        <div className="pt-2 border-t border-agency-border space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-agency-muted">
            <span className="flex items-center gap-1.5 text-white font-bold">
              <Users className="w-3.5 h-3.5 text-agency-accent" />
              DEPLOYED OPERATIVES IN ROUND {roleData.roundNumber} ({room.players.length})
            </span>
            <span>ALL ROLES DELIVERED</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {room.players.map((p) => {
              const pAvatar = getAvatarById(p.avatarId);
              const isSelf = p.playerId === currentPlayer.playerId;

              return (
                <div
                  key={p.playerId}
                  className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between ${
                    isSelf
                      ? isAgent
                        ? 'bg-agency-accent/10 border-agency-accent/50 text-agency-accent font-bold'
                        : 'bg-agency-warning/10 border-agency-warning/50 text-agency-warning font-bold'
                      : 'bg-agency-surface border-agency-border text-agency-muted'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-lg">{pAvatar.symbol}</span>
                    <span className="truncate">{p.displayName}</span>
                  </div>
                  {isSelf && <span className="text-[9px] uppercase">YOU</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase 6 Transition & Mission Controls */}
        <div className="p-4 rounded-xl bg-agency-surface/60 border border-agency-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-agency-muted">
            <Radio className="w-4 h-4 text-agency-accent animate-pulse shrink-0" />
            <span>
              <strong className="text-agency-accent font-bold">STAGE READY: </strong>
              {currentPlayer.isHost
                ? 'All operatives have received their dossiers. You may open the Interrogation Arena.'
                : 'Waiting for Mission Leader to commence interrogation and live discussion.'}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLeave}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              LEAVE
            </Button>

            {currentPlayer.isHost ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleStartDiscussion}
                isLoading={isStartingDiscussion}
                leftIcon={<Play className="w-4 h-4 fill-current" />}
              >
                OPEN INTERROGATION ARENA
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate(`/room/${code}/discussion`)}
                leftIcon={<MessageSquare className="w-4 h-4" />}
              >
                ENTER ARENA
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default RoleReveal;
