import React from 'react';
import { Play, HelpCircle, Users, Clock, Target, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface HeroProps {
  onPlayClick?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onPlayClick }) => {
  return (
    <section className="relative pt-8 pb-16 sm:pt-16 sm:pb-24 overflow-hidden">
      {/* Background ambient decorative radar elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[850px] h-[600px] sm:h-[850px] rounded-full border border-agency-border/30 pointer-events-none -z-10 bg-radar-grid" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[550px] h-[400px] sm:h-[550px] rounded-full border border-dashed border-agency-accent/10 pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Classified Clearance Tag */}
        <div className="inline-flex items-center gap-2 mb-6">
          <Badge variant="secret" size="md">
            TOP SECRET // NOFORN
          </Badge>
          <span className="hidden sm:inline-block text-xs font-mono text-agency-muted">
            DIRECTIVE CODE: 0x88-AGENCY
          </span>
        </div>

        {/* Main Titles */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-2 font-sans">
          SECRET <span className="text-agency-accent text-glow">AGENT</span>
        </h1>

        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-[1px] w-12 sm:w-20 bg-agency-accent/40" />
          <h2 className="text-lg sm:text-2xl font-mono tracking-[0.25em] sm:tracking-[0.35em] text-agency-muted font-bold uppercase">
            FIND THE IMPOSTER
          </h2>
          <div className="h-[1px] w-12 sm:w-20 bg-agency-accent/40" />
        </div>

        {/* Tactical Mission Briefing Copy */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-agency-muted leading-relaxed font-sans mb-10">
          Infiltrate private rooms with fellow operatives. One of you is an undercover imposter
          without the classified secret word. Interrogate, deduce, and vote to eliminate them before
          your agency cover is compromised.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-16">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={<Play className="w-5 h-5 fill-current" />}
            onClick={onPlayClick}
            className="shadow-glow-md"
          >
            DEPLOY / PLAY NOW
          </Button>

          <Link to="/how-to-play" className="w-full sm:w-auto">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={<HelpCircle className="w-5 h-5 text-agency-accent" />}
            >
              HOW TO PLAY
            </Button>
          </Link>
        </div>

        {/* Tactical Key Specs Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
          <div className="bg-agency-card border border-agency-border rounded-xl p-4 text-left transition-colors hover:border-agency-borderLight">
            <div className="flex items-center gap-2 text-agency-accent mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-mono font-bold">2–8 PLAYERS</span>
            </div>
            <p className="text-xs text-agency-muted">Duel & Classic party modes</p>
          </div>

          <div className="bg-agency-card border border-agency-border rounded-xl p-4 text-left transition-colors hover:border-agency-borderLight">
            <div className="flex items-center gap-2 text-agency-accent mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-mono font-bold">3 ROUNDS</span>
            </div>
            <p className="text-xs text-agency-muted">Dynamic campaign scoring</p>
          </div>

          <div className="bg-agency-card border border-agency-border rounded-xl p-4 text-left transition-colors hover:border-agency-borderLight">
            <div className="flex items-center gap-2 text-agency-accent mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs font-mono font-bold">SECRET ROLES</span>
            </div>
            <p className="text-xs text-agency-muted">Agent vs Imposter bluffing</p>
          </div>

          <div className="bg-agency-card border border-agency-border rounded-xl p-4 text-left transition-colors hover:border-agency-borderLight">
            <div className="flex items-center gap-2 text-agency-accent mb-1">
              <Smartphone className="w-4 h-4" />
              <span className="text-xs font-mono font-bold">INSTANT PLAY</span>
            </div>
            <p className="text-xs text-agency-muted">6-character room code, zero app</p>
          </div>
        </div>
      </div>
    </section>
  );
};
