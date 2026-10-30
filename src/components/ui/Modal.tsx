import React, { useEffect } from 'react';
import { X, ShieldAlert } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  classification?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  classification = 'RESTRICTED ACCESS',
  children,
  footer,
  maxWidth = 'md',
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Dark backdrop with blur */}
      <div
        className="fixed inset-0 bg-agency-bg/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className={`relative w-full ${maxWidthStyles[maxWidth]} bg-agency-card border border-agency-border rounded-xl shadow-2xl z-10 overflow-hidden transform transition-all duration-200 reticle-corner animate-in zoom-in-95`}
      >
        {/* Top security clearance banner */}
        <div className="bg-agency-surface border-b border-agency-border px-5 py-2 flex items-center justify-between text-[10px] font-mono tracking-widest text-agency-muted">
          <div className="flex items-center gap-1.5 text-agency-accent">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{classification}</span>
          </div>
          <span className="text-agency-muted/60">CLEARANCE LEVEL 4</span>
        </div>

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-bold text-white tracking-tight">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-agency-muted hover:text-white hover:bg-agency-surface transition-colors focus:outline-none focus:ring-1 focus:ring-agency-accent"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 pt-0">{children}</div>

        {/* Modal Footer (Optional) */}
        {footer && (
          <div className="p-5 sm:p-6 pt-3 border-t border-agency-border bg-agency-surface/40 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
