import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'classified' | 'danger' | 'warning' | 'neutral' | 'secret';
  size?: 'sm' | 'md';
  withDot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'classified',
  size = 'md',
  withDot = false,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center font-mono uppercase font-semibold tracking-wider rounded border transition-colors select-none';

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-2',
  };

  const variantStyles = {
    classified: 'bg-agency-accent/10 border-agency-accent/40 text-agency-accent',
    danger: 'bg-agency-warning/10 border-agency-warning/40 text-agency-warning',
    warning: 'bg-agency-amber/10 border-agency-amber/40 text-agency-amber',
    neutral: 'bg-agency-surface border-agency-border text-agency-muted',
    secret: 'bg-red-950/40 border-red-500/60 text-red-400 font-extrabold tracking-widest',
  };

  const dotColors = {
    classified: 'bg-agency-accent shadow-[0_0_8px_#00FF88]',
    danger: 'bg-agency-warning shadow-[0_0_8px_#EF4444]',
    warning: 'bg-agency-amber shadow-[0_0_8px_#F59E0B]',
    neutral: 'bg-agency-muted',
    secret: 'bg-red-500 animate-ping',
  };

  return (
    <span
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {withDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
};
