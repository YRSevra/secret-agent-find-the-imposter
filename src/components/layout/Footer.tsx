import React from 'react';
import { Shield, Terminal, Lock, Globe2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-agency-bgSecondary border-t border-agency-border mt-20 relative overflow-hidden">
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-agency-accent/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand & Concept */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-agency-surface border border-agency-border flex items-center justify-center">
                <Shield className="w-5 h-5 text-agency-accent" />
              </div>
              <span className="font-mono text-base font-extrabold tracking-widest text-white">
                SECRET AGENT
              </span>
            </div>
            <p className="text-sm text-agency-muted leading-relaxed max-w-md">
              A high-stakes browser-based social deduction multiplayer game. Join private rooms,
              question fellow operatives, identify the imposter, and secure the agency objective.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="w-2 h-2 rounded-full bg-agency-accent shadow-[0_0_6px_#00FF88]" />
              <span className="text-xs font-mono text-agency-muted">
                ALL SYSTEMS OPERATIONAL // PROTOCOL LEVEL 1
              </span>
            </div>
          </div>

          {/* Quick Access */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-agency-accent" />
              DIRECTIVES
            </h4>
            <ul className="space-y-2 text-xs font-mono text-agency-muted">
              <li>
                <Link to="/" className="hover:text-agency-accent transition-colors">
                  MISSION BRIEFING (HOME)
                </Link>
              </li>
              <li>
                <Link to="/how-to-play" className="hover:text-agency-accent transition-colors">
                  OPERATIVE GUIDEBOOK
                </Link>
              </li>
              <li>
                <a href="#rules" className="hover:text-agency-accent transition-colors">
                  RULES OF ENGAGEMENT
                </a>
              </li>
              <li>
                <a href="#modes" className="hover:text-agency-accent transition-colors">
                  DUEL & CLASSIC MODES
                </a>
              </li>
            </ul>
          </div>

          {/* Security Clearance & Architecture */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-agency-accent" />
              SECURITY & SYSTEM
            </h4>
            <div className="p-3 rounded-lg bg-agency-card border border-agency-border text-xs font-mono space-y-1.5">
              <div className="flex justify-between text-agency-muted">
                <span>VERSION:</span>
                <span className="text-white font-semibold">v0.2.0-STABLE</span>
              </div>
              <div className="flex justify-between text-agency-muted">
                <span>ENCRYPTION:</span>
                <span className="text-agency-accent">E2E ROOM PROTOCOL</span>
              </div>
              <div className="flex justify-between text-agency-muted">
                <span>DEPLOYMENT:</span>
                <span className="text-white">NETLIFY EDGE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-agency-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-agency-muted">
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-agency-muted" />
            <span>&copy; {new Date().getFullYear()} SECRET AGENT – FIND THE IMPOSTER. ALL RIGHTS RESERVED.</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-agency-accent/80">NO LOGIN REQUIRED</span>
            <span>•</span>
            <span>ZERO INSTALLATION</span>
            <span>•</span>
            <span>100% BROWSER BASED</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
