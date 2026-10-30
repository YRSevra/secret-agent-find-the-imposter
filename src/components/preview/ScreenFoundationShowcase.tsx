import React, { useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SectionHeading } from '../ui/SectionHeading';
import {
  Users,
  EyeOff,
  MessageSquare,
  Vote,
  Trophy,
  Shield,
  Clock,
  Send,
} from 'lucide-react';

export const ScreenFoundationShowcase: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<
    'lobby' | 'reveal' | 'arena' | 'voting' | 'leaderboard'
  >('lobby');

  const screens = [
    { id: 'lobby', label: '01. LOBBY & PLAYER CARDS', icon: <Users className="w-4 h-4" /> },
    { id: 'reveal', label: '02. ROLE REVEAL DOSSIER', icon: <EyeOff className="w-4 h-4" /> },
    { id: 'arena', label: '03. QUESTION ARENA & CHAT', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'voting', label: '04. VOTING & UNMASKING', icon: <Vote className="w-4 h-4" /> },
    { id: 'leaderboard', label: '05. FINAL LEADERBOARD', icon: <Trophy className="w-4 h-4" /> },
  ];

  return (
    <section className="py-16 sm:py-24 border-t border-agency-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="DESIGN SYSTEM BLUEPRINT"
          title="FUTURE SCREEN"
          highlight="FOUNDATIONS"
          description="A complete architectural preview of all 12 planned gameplay screens, unified under the Dark Spy / Classified Agency design identity."
        />

        {/* Screen selector navigation tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
          {screens.map((screen) => (
            <button
              key={screen.id}
              onClick={() => setActiveScreen(screen.id as typeof activeScreen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider shrink-0 transition-all border ${
                activeScreen === screen.id
                  ? 'bg-agency-surface text-agency-accent border-agency-accent/50 shadow-glow-sm'
                  : 'bg-agency-card text-agency-muted border-agency-border hover:text-white hover:border-agency-borderLight'
              }`}
            >
              {screen.icon}
              <span>{screen.label}</span>
            </button>
          ))}
        </div>

        {/* Screen Foundation Canvas */}
        <div className="bg-agency-card border border-agency-border rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Header watermark */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 mb-6 border-b border-agency-border gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-agency-accent font-bold">
                  SURFACE ARCHITECTURE //
                </span>
                <span className="text-xs font-mono text-white">
                  {screens.find((s) => s.id === activeScreen)?.label}
                </span>
              </div>
              <p className="text-xs text-agency-muted mt-0.5">
                Target Phase Implementation: Static design model for subsequent gameplay phases
              </p>
            </div>
            <Badge variant="classified" size="sm" withDot>
              DESIGN SYSTEM SPEC READY
            </Badge>
          </div>

          {/* TAB 1: Lobby & Player Cards */}
          {activeScreen === 'lobby' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-agency-surface p-4 rounded-xl border border-agency-border gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-agency-bg border border-agency-accent/40 flex items-center justify-center font-mono text-xl font-black text-agency-accent">
                    6/8
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-mono text-sm font-bold text-white">
                        SAFEHOUSE LOBBY: ALPHA-09
                      </h4>
                      <Badge variant="neutral" size="sm">
                        ROOM CODE: XK79PQ
                      </Badge>
                    </div>
                    <p className="text-xs text-agency-muted">Classic Protocol • Round 1/3 Queued</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Badge variant="classified" size="sm">
                    HOST: CIPHER_ONE
                  </Badge>
                  <Button variant="secondary" size="sm" disabled>
                    START OPERATION (LOCKED)
                  </Button>
                </div>
              </div>

              {/* Player Dossier Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: 'CIPHER_ONE', status: 'MISSION HOST', ready: true, avatar: '👤' },
                  { name: 'GHOST_WALKER', status: 'OPERATIVE', ready: true, avatar: '🎯' },
                  { name: 'SHADOW_07', status: 'OPERATIVE', ready: true, avatar: '🕶️' },
                  { name: 'NIGHT_OWL', status: 'OPERATIVE', ready: false, avatar: '🦉' },
                  { name: 'VIPER_X', status: 'OPERATIVE', ready: true, avatar: '🐍' },
                  { name: 'SOLARIS', status: 'OPERATIVE', ready: false, avatar: '⚡' },
                  { name: 'SLOT 07', status: 'SEARCHING...', ready: false, avatar: '⏳', empty: true },
                  { name: 'SLOT 08', status: 'SEARCHING...', ready: false, avatar: '⏳', empty: true },
                ].map((player, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${
                      player.empty
                        ? 'border-dashed border-agency-border/60 bg-agency-bg/30 text-agency-muted/40'
                        : player.ready
                        ? 'border-agency-accent/40 bg-agency-surface/60 shadow-glow-sm'
                        : 'border-agency-border bg-agency-surface/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl">{player.avatar}</span>
                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                          player.ready
                            ? 'bg-agency-accent/10 text-agency-accent border border-agency-accent/30'
                            : 'bg-agency-bg text-agency-muted border border-agency-border'
                        }`}
                      >
                        {player.ready ? 'CONFIRMED' : 'STANDBY'}
                      </span>
                    </div>
                    <div className="font-mono text-sm font-bold text-white truncate">
                      {player.name}
                    </div>
                    <div className="text-[10px] font-mono text-agency-muted mt-0.5">
                      {player.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Role Reveal Dossier */}
          {activeScreen === 'reveal' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Agent Briefing Dossier */}
              <div className="p-6 rounded-xl bg-agency-surface border border-agency-accent/40 shadow-glow-sm space-y-4 reticle-corner">
                <div className="flex items-center justify-between">
                  <Badge variant="classified" size="sm">
                    CONFIDENTIAL BRIEFING
                  </Badge>
                  <span className="font-mono text-xs text-agency-accent">CLEARANCE // VERIFIED</span>
                </div>
                <div>
                  <span className="text-xs font-mono text-agency-muted uppercase">ASSIGNED ROLE</span>
                  <h3 className="text-2xl font-black text-agency-accent tracking-wide mt-1">
                    AGENT (LOYALIST)
                  </h3>
                </div>
                <div className="p-4 bg-agency-card border border-agency-border rounded-lg space-y-2">
                  <div className="text-[10px] font-mono text-agency-muted">SECRET MISSION LOCATION</div>
                  <div className="font-mono text-xl font-black text-white tracking-widest text-glow">
                    SATELLITE LAUNCH FACILITY
                  </div>
                  <p className="text-xs text-agency-muted">
                    Hint guide: Provide clues about high security, countdowns, or altitude without
                    revealing the word.
                  </p>
                </div>
                <div className="text-xs text-agency-muted font-mono flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-agency-accent" />
                  Objective: Identify and eliminate the undercover imposter.
                </div>
              </div>

              {/* Imposter Infiltration Dossier */}
              <div className="p-6 rounded-xl bg-agency-surface border border-agency-warning/40 shadow-[0_0_15px_rgba(239,68,68,0.2)] space-y-4 reticle-corner">
                <div className="flex items-center justify-between">
                  <Badge variant="danger" size="sm">
                    INFILTRATION INTEL
                  </Badge>
                  <span className="font-mono text-xs text-agency-warning">IMPOSTER PROTOCOL</span>
                </div>
                <div>
                  <span className="text-xs font-mono text-agency-muted uppercase">ASSIGNED ROLE</span>
                  <h3 className="text-2xl font-black text-agency-warning tracking-wide mt-1">
                    THE IMPOSTER
                  </h3>
                </div>
                <div className="p-4 bg-agency-card border border-agency-border rounded-lg space-y-2">
                  <div className="text-[10px] font-mono text-agency-warning">SECRET LOCATION INTEL</div>
                  <div className="font-mono text-lg font-black text-agency-warning tracking-wider">
                    UNKNOWN // ACCESS DENIED
                  </div>
                  <p className="text-xs text-agency-muted">
                    You do not know the location. Listen to fellow agents, bluff your answers, and
                    blend in seamlessly.
                  </p>
                </div>
                <div className="text-xs text-agency-muted font-mono flex items-center gap-1.5">
                  <EyeOff className="w-4 h-4 text-agency-warning" />
                  Objective: Avoid suspicion or deduce the secret location to win.
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Question Arena & Chat */}
          {activeScreen === 'arena' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Question Turn Arena */}
              <div className="lg:col-span-2 space-y-4">
                <div className="p-4 rounded-xl bg-agency-surface border border-agency-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-agency-accent animate-ping" />
                    <div>
                      <span className="text-[10px] font-mono text-agency-muted uppercase">
                        CURRENT INTERROGATION TURN
                      </span>
                      <h4 className="font-mono text-sm font-bold text-white">
                        CIPHER_ONE interrogates GHOST_WALKER
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-agency-accent font-mono text-sm font-bold bg-agency-card px-3 py-1.5 rounded-lg border border-agency-border">
                    <Clock className="w-4 h-4" />
                    <span>00:45</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-agency-surface/50 border border-agency-border space-y-3">
                  <span className="text-xs font-mono text-agency-accent font-bold">
                    TACTICAL QUESTION CARD
                  </span>
                  <p className="text-sm font-medium text-white italic">
                    "Is this location a place you would expect to see armed sentries on duty at all times?"
                  </p>
                  <div className="text-xs text-agency-muted">
                    Response pending from <span className="text-white font-mono">GHOST_WALKER</span>...
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-agency-card border border-agency-border">
                  <span className="text-xs font-mono text-agency-muted block mb-2">
                    YOUR OPERATIVE TURN ACTIONS
                  </span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled>
                      PASS TURN
                    </Button>
                    <Button variant="danger" size="sm" disabled>
                      CALL EMERGENCY VOTE
                    </Button>
                  </div>
                </div>
              </div>

              {/* Public Interrogation Chat Preview */}
              <div className="bg-agency-surface border border-agency-border rounded-xl p-4 flex flex-col h-72">
                <div className="flex items-center justify-between border-b border-agency-border pb-2 mb-3">
                  <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-agency-accent" />
                    COMM LINK
                  </span>
                  <span className="text-[9px] font-mono text-agency-muted">SECURE CHANNEL</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto text-xs font-mono pr-1">
                  <div className="p-2 bg-agency-card rounded border border-agency-border/60">
                    <span className="text-agency-accent font-bold">CIPHER: </span>
                    <span className="text-slate-300">Take note of his hesitation on weather.</span>
                  </div>
                  <div className="p-2 bg-agency-card rounded border border-agency-border/60">
                    <span className="text-amber-400 font-bold">VIPER: </span>
                    <span className="text-slate-300">Agreed. Doesn't match our protocol.</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-agency-border flex gap-2">
                  <input
                    type="text"
                    disabled
                    placeholder="Radio locked in preview..."
                    className="flex-1 bg-agency-card border border-agency-border rounded px-2 text-xs text-agency-muted"
                  />
                  <Button variant="ghost" size="sm" disabled>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Voting Arena & Unmasking */}
          {activeScreen === 'voting' && (
            <div className="space-y-6">
              <div className="p-4 bg-agency-surface border border-agency-border rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-mono text-sm font-bold text-agency-warning flex items-center gap-2">
                    <Vote className="w-4 h-4" />
                    CLASSIFIED BALLOT // EMERGENCY VOTE
                  </h4>
                  <p className="text-xs text-agency-muted">
                    Cast your classified vote to unmask the operative suspected of infiltration.
                  </p>
                </div>
                <div className="font-mono text-sm text-agency-warning font-bold bg-agency-card px-3 py-1.5 rounded border border-agency-warning/30">
                  TIME: 00:28
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { name: 'CIPHER_ONE', votes: 1, isTarget: false },
                  { name: 'GHOST_WALKER', votes: 4, isTarget: true },
                  { name: 'VIPER_X', votes: 1, isTarget: false },
                ].map((candidate, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${
                      candidate.isTarget
                        ? 'border-agency-warning bg-agency-warning/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                        : 'border-agency-border bg-agency-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-white text-sm">
                        {candidate.name}
                      </span>
                      <span className="text-xs font-mono font-bold text-agency-accent">
                        {candidate.votes} VOTES
                      </span>
                    </div>
                    <div className="w-full bg-agency-bg h-2 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full ${
                          candidate.isTarget ? 'bg-agency-warning' : 'bg-agency-accent'
                        }`}
                        style={{ width: `${(candidate.votes / 6) * 100}%` }}
                      />
                    </div>
                    <Button
                      variant={candidate.isTarget ? 'danger' : 'secondary'}
                      size="sm"
                      fullWidth
                      disabled
                    >
                      {candidate.isTarget ? 'LEADING SUSPECT' : 'VOTE OPERATIVE'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: Leaderboard */}
          {activeScreen === 'leaderboard' && (
            <div className="space-y-4">
              <div className="p-4 bg-agency-surface border border-agency-border rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-mono text-sm font-bold text-agency-accent flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    DEBRIEFING & FINAL AGENCY STANDINGS
                  </h4>
                  <p className="text-xs text-agency-muted">3/3 Tactical Rounds Concluded</p>
                </div>
                <Badge variant="classified" size="sm">
                  OPERATION SUCCESSFUL
                </Badge>
              </div>

              <div className="space-y-2">
                {[
                  { rank: '#1', name: 'CIPHER_ONE', score: '380 PTS', role: 'Top Operative', badge: 'GOLD' },
                  { rank: '#2', name: 'VIPER_X', score: '310 PTS', role: 'Master Bluff', badge: 'SILVER' },
                  { rank: '#3', name: 'SHADOW_07', score: '260 PTS', role: 'Deduction Lead', badge: 'BRONZE' },
                  { rank: '#4', name: 'GHOST_WALKER', score: '190 PTS', role: 'Unmasked Imposter', badge: 'DEFEAT' },
                ].map((row, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-agency-surface/80 border border-agency-border rounded-xl flex items-center justify-between hover:border-agency-borderLight transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-black text-agency-accent w-8">
                        {row.rank}
                      </span>
                      <div>
                        <div className="font-mono text-sm font-bold text-white">{row.name}</div>
                        <div className="text-[10px] font-mono text-agency-muted">{row.role}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-black text-white">{row.score}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-agency-card border border-agency-border text-agency-muted">
                        {row.badge}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
