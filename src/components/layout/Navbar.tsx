import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Shield, Radio, HelpCircle, Play } from 'lucide-react';
import { Button } from '../ui/Button';

interface NavbarProps {
  onPlayClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onPlayClick }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'HOME', path: '/', icon: <Shield className="w-4 h-4" /> },
    { name: 'HOW TO PLAY', path: '/how-to-play', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full bg-agency-bg/85 backdrop-blur-md border-b border-agency-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Branding */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-agency-accent rounded-lg"
          >
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-agency-surface border border-agency-border flex items-center justify-center overflow-hidden group-hover:border-agency-accent/60 transition-colors shadow-inner">
              <img
                src="/logo.svg"
                alt="Secret Agent Logo"
                className="w-7 h-7 sm:w-8 sm:h-8 transform group-hover:scale-105 transition-transform"
              />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-agency-accent shadow-[0_0_6px_#00FF88]" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm sm:text-base font-extrabold tracking-widest text-white group-hover:text-agency-accent transition-colors">
                  SECRET AGENT
                </span>
                <span className="hidden sm:inline-block text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded bg-agency-surface border border-agency-border text-agency-muted">
                  V0.2
                </span>
              </div>
              <span className="text-[10px] sm:text-xs font-mono tracking-wider text-agency-muted group-hover:text-agency-muted/80">
                FIND THE IMPOSTER
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium tracking-wider transition-all duration-150 ${
                  isActive(link.path)
                    ? 'bg-agency-surface text-agency-accent border border-agency-accent/40 shadow-glow-sm'
                    : 'text-agency-muted hover:text-white hover:bg-agency-surface/50 border border-transparent'
                }`}
              >
                {link.icon}
                <span>{link.name}</span>
              </Link>
            ))}

            <a
              href="#game-info"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-medium tracking-wider text-agency-muted hover:text-white hover:bg-agency-surface/50 transition-colors"
            >
              <Radio className="w-4 h-4 text-agency-accent/80" />
              <span>INTEL</span>
            </a>
          </nav>

          {/* Action CTA & Mobile Hamburger */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
              onClick={onPlayClick}
              className="shadow-glow-sm text-xs"
            >
              DEPLOY NOW
            </Button>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-agency-muted hover:text-white hover:bg-agency-surface border border-agency-border transition-colors focus:outline-none focus:ring-1 focus:ring-agency-accent"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-agency-bgSecondary border-b border-agency-border px-4 pt-3 pb-5 space-y-2 animate-in slide-in-from-top duration-200">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono font-medium tracking-wider ${
                isActive(link.path)
                  ? 'bg-agency-surface text-agency-accent border border-agency-accent/30'
                  : 'text-agency-muted hover:text-white hover:bg-agency-surface'
              }`}
            >
              {link.icon}
              <span>{link.name}</span>
            </Link>
          ))}

          <a
            href="#game-info"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono font-medium tracking-wider text-agency-muted hover:text-white hover:bg-agency-surface"
          >
            <Radio className="w-4 h-4 text-agency-accent/80" />
            <span>OPERATION INTEL</span>
          </a>

          <div className="pt-2 border-t border-agency-border mt-3">
            <Button
              variant="primary"
              size="md"
              fullWidth
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (onPlayClick) onPlayClick();
              }}
            >
              INITIALIZE ROOM ACCESS
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
