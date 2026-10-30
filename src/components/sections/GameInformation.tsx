import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { Badge } from '../ui/Badge';
import { KeyRound, Swords, Users2, ShieldCheck, EyeOff, Trophy } from 'lucide-react';

export const GameInformation: React.FC = () => {
  return (
    <section id="game-info" className="py-16 sm:py-24 border-t border-agency-border/60 bg-agency-bgSecondary/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="TACTICAL BRIEFING"
          title="CLASSIFIED MULTIPLAYER"
          highlight="MECHANICS"
          description="Engineered for high-stakes psychological tension, rapid deduction, and unforgettable social gameplay directly inside your browser."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Card 1: Operation Modes */}
          <Card variant="interactive" withReticle className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-lg bg-agency-surface border border-agency-border text-agency-accent">
                  <Swords className="w-5 h-5" />
                </div>
                <Badge variant="classified" size="sm">
                  DUEL & CLASSIC
                </Badge>
              </div>
              <CardTitle>Adaptive Operative Capacity</CardTitle>
              <CardDescription>
                Scales seamlessly from head-to-head 2-player encounters to full 8-player syndicate parties.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 mt-auto">
              <div className="p-3 rounded-lg bg-agency-surface/80 border border-agency-border text-xs">
                <span className="font-mono text-agency-accent font-bold block mb-1">
                  DUEL MODE (2 OPERATIVES)
                </span>
                <p className="text-agency-muted">
                  Tactical face-off with multi-step interrogation cards and high-pressure bluff calls.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-agency-surface/80 border border-agency-border text-xs">
                <span className="font-mono text-agency-accent font-bold block mb-1">
                  CLASSIC MODE (3–8 OPERATIVES)
                </span>
                <p className="text-agency-muted">
                  Full discussion circle, cross-questioning, secret alliances, and emergency vote summits.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: The Secret Word & The Imposter */}
          <Card variant="interactive" withReticle className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-lg bg-agency-surface border border-agency-border text-agency-warning">
                  <EyeOff className="w-5 h-5" />
                </div>
                <Badge variant="danger" size="sm">
                  ASYMMETRIC INTEL
                </Badge>
              </div>
              <CardTitle>Covert Role Assignment</CardTitle>
              <CardDescription>
                One player is chosen in total secrecy as the Imposter. Agents receive the briefing; the Imposter receives nothing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 mt-auto">
              <div className="p-3 rounded-lg bg-agency-surface/80 border border-agency-border text-xs">
                <div className="flex items-center justify-between text-agency-accent font-mono font-bold mb-1">
                  <span>AGENTS</span>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <p className="text-agency-muted">
                  Share the secret location or code. Drop hints subtle enough for agents, but vague enough to starve the imposter.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-agency-surface/80 border border-agency-border text-xs">
                <div className="flex items-center justify-between text-agency-warning font-mono font-bold mb-1">
                  <span>THE IMPOSTER</span>
                  <Users2 className="w-4 h-4" />
                </div>
                <p className="text-agency-muted">
                  Infiltrate conversation, mimic the agents' tone, deduce the secret word, or redirect suspicions to survive.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: 3-Round Scoring & Zero Barriers */}
          <Card variant="interactive" withReticle className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-lg bg-agency-surface border border-agency-border text-agency-accent">
                  <Trophy className="w-5 h-5" />
                </div>
                <Badge variant="warning" size="sm">
                  CAMPAIGN STRUCTURE
                </Badge>
              </div>
              <CardTitle>Three Rounds & Room Codes</CardTitle>
              <CardDescription>
                Matches span three rapid-fire rounds. A dynamic leaderboard tracks points across deceptive performances.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 mt-auto">
              <div className="p-3 rounded-lg bg-agency-surface/80 border border-agency-border text-xs">
                <div className="flex items-center justify-between text-agency-accent font-mono font-bold mb-1">
                  <span>INSTANT 6-CHAR ENTRANCE</span>
                  <KeyRound className="w-4 h-4" />
                </div>
                <p className="text-agency-muted">
                  Host generates a 6-character room code. Friends join instantaneously from any phone or computer without signing up.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-agency-surface/80 border border-agency-border text-xs">
                <span className="font-mono text-agency-accent font-bold block mb-1">
                  CUMULATIVE AGENT POINTS
                </span>
                <p className="text-agency-muted">
                  Score points for successful vote deductions, undetected imposter runs, and clutch secret word guesses.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
