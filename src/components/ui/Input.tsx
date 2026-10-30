import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isCodeInput?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  isCodeInput = false,
  className = '',
  disabled,
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-mono font-medium uppercase tracking-wider text-agency-muted flex items-center justify-between"
        >
          <span>{label}</span>
          {isCodeInput && (
            <span className="text-[10px] text-agency-accent/70 font-normal">
              6-CHAR CODENAME
            </span>
          )}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 flex items-center pointer-events-none text-agency-muted">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          disabled={disabled}
          className={`w-full bg-agency-bgSecondary text-agency-text placeholder-agency-muted/50 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-1 ${
            leftIcon ? 'pl-10' : 'pl-4'
          } ${rightIcon ? 'pr-10' : 'pr-4'} ${
            isCodeInput
              ? 'py-3 font-mono text-center tracking-[0.25em] text-lg uppercase font-bold text-agency-accent border-agency-accent/40 focus:border-agency-accent focus:ring-agency-accent'
              : 'py-2.5 text-sm font-sans border-agency-border focus:border-agency-accent focus:ring-agency-accent'
          } ${
            error
              ? 'border-agency-warning focus:border-agency-warning focus:ring-agency-warning'
              : 'hover:border-agency-borderLight'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-agency-card' : ''} ${className}`}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3.5 flex items-center pointer-events-none text-agency-muted">
            {rightIcon}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs text-agency-warning font-mono flex items-center gap-1 mt-1">
          <span>⚠</span> {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-agency-muted/80 font-sans mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
};
