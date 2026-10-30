import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glow' | 'interactive';
  withReticle?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  withReticle = false,
  className = '',
  ...props
}) => {
  const baseStyles = 'rounded-xl transition-all duration-200 relative overflow-hidden';

  const variantStyles = {
    default: 'bg-agency-card border border-agency-border shadow-card-dark',
    elevated: 'bg-agency-surface border border-agency-borderLight shadow-2xl',
    glow: 'bg-agency-card border border-agency-accent/40 shadow-glow-sm',
    interactive:
      'bg-agency-card border border-agency-border hover:border-agency-accent/60 hover:shadow-glow-sm hover:-translate-y-0.5 cursor-pointer',
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${withReticle ? 'reticle-corner' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`p-5 sm:p-6 pb-3 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <h3 className={`text-lg sm:text-xl font-bold text-white tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <p className={`text-xs sm:text-sm text-agency-muted mt-1 leading-relaxed ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`p-5 sm:p-6 pt-2 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div
    className={`p-5 sm:p-6 pt-0 border-t border-agency-border/60 flex items-center justify-between text-xs text-agency-muted ${className}`}
    {...props}
  >
    {children}
  </div>
);
