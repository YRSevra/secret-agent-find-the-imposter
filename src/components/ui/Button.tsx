import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium font-mono uppercase tracking-wider rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-agency-accent focus-visible:ring-offset-2 focus-visible:ring-offset-agency-bg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 select-none';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-xs sm:text-sm px-5 py-2.5 gap-2',
    lg: 'text-sm sm:text-base px-6 py-3.5 gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-agency-accent text-agency-dark font-bold hover:bg-[#1aff96] hover:shadow-glow-md border border-agency-accent text-shadow-none',
    secondary:
      'bg-agency-surface text-agency-text border border-agency-border hover:border-agency-borderLight hover:bg-[#1d273a] shadow-card-dark',
    danger:
      'bg-agency-warning/10 text-agency-warning border border-agency-warning/40 hover:bg-agency-warning hover:text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]',
    outline:
      'bg-transparent text-agency-accent border border-agency-accent/60 hover:bg-agency-accent/10 hover:border-agency-accent hover:shadow-glow-sm',
    ghost:
      'bg-transparent text-agency-muted hover:text-agency-text hover:bg-agency-surface/50 border border-transparent',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>PROCESSING...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
