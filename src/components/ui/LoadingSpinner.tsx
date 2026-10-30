import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label = 'DECRYPTING SATELLITE FEED...',
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-4 select-none ${className}`}>
      <div className={`relative ${sizeMap[size]} flex items-center justify-center`}>
        {/* Outer dashed radar ring */}
        <div className="absolute inset-0 rounded-full border border-dashed border-agency-accent/30 animate-spin [animation-duration:6s]" />

        {/* Inner rotating sweep line */}
        <div className="absolute inset-1 rounded-full border border-agency-border flex items-center justify-center">
          <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-agency-accent to-agency-accent animate-radar-spin origin-center" />
        </div>

        {/* Center glowing ping */}
        <div className="w-2 h-2 rounded-full bg-agency-accent shadow-[0_0_8px_#00FF88] animate-ping" />
      </div>

      {label && (
        <span className="font-mono text-[11px] uppercase tracking-widest text-agency-muted animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
};
