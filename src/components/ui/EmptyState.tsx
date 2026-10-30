import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-agency-border rounded-xl bg-agency-card/50 max-w-lg mx-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-agency-surface border border-agency-border flex items-center justify-center text-agency-muted mb-4 shadow-inner">
        {icon || <AlertCircle className="w-6 h-6 text-agency-accent" />}
      </div>

      <h3 className="text-base sm:text-lg font-bold text-white font-mono tracking-wide mb-2">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-agency-muted leading-relaxed max-w-sm mb-6">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
