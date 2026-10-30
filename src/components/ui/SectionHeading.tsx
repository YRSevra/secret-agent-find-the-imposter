import React from 'react';
import { Badge } from './Badge';

export interface SectionHeadingProps {
  badge?: string;
  title: string;
  highlight?: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  badge,
  title,
  highlight,
  description,
  align = 'center',
  className = '',
}) => {
  const isCenter = align === 'center';

  return (
    <div
      className={`max-w-3xl mb-10 sm:mb-14 ${isCenter ? 'mx-auto text-center' : 'text-left'} ${className}`}
    >
      {badge && (
        <div className={`mb-3 flex ${isCenter ? 'justify-center' : 'justify-start'}`}>
          <Badge variant="classified" size="md" withDot>
            {badge}
          </Badge>
        </div>
      )}

      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
        {title}{' '}
        {highlight && (
          <span className="text-agency-accent relative inline-block">
            {highlight}
            <span
              className="absolute -bottom-1 left-0 right-0 h-0.5 bg-agency-accent/40 rounded"
              aria-hidden="true"
            />
          </span>
        )}
      </h2>

      {description && (
        <p className="mt-3 sm:mt-4 text-sm sm:text-base text-agency-muted leading-relaxed font-sans max-w-2xl mx-auto">
          {description}
        </p>
      )}
    </div>
  );
};
