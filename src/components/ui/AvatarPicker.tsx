import React from 'react';
import { AVATARS } from '../../constants/avatars';
import { Check } from 'lucide-react';

interface AvatarPickerProps {
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  selectedId,
  onSelect,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-xs font-mono font-medium uppercase tracking-wider text-agency-muted flex items-center justify-between">
        <span>OPERATIVE AVATAR IDENTITY</span>
        <span className="text-[10px] text-agency-accent/80 font-normal">
          12 CLASSIFIED BADGES
        </span>
      </label>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-2 bg-agency-bgSecondary border border-agency-border rounded-xl">
        {AVATARS.map((avatar) => {
          const isSelected = avatar.id === selectedId;

          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onSelect(avatar.id)}
              aria-pressed={isSelected}
              title={avatar.name}
              className={`relative flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-150 group ${
                isSelected
                  ? 'bg-agency-surface border-agency-accent shadow-glow-sm scale-[1.03] ring-1 ring-agency-accent'
                  : 'bg-agency-card border-agency-border/60 hover:border-agency-borderLight hover:bg-agency-surface/50'
              }`}
            >
              <span className="text-2xl sm:text-3xl select-none transform group-hover:scale-110 transition-transform">
                {avatar.symbol}
              </span>
              <span className="text-[9px] font-mono font-bold tracking-tight text-agency-muted truncate w-full text-center mt-1 group-hover:text-white">
                {avatar.id.toUpperCase()}
              </span>

              {isSelected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-agency-accent text-agency-dark flex items-center justify-center shadow-md">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
