import React, { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'default' | 'large';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'default',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      const openModals = document.querySelectorAll<HTMLElement>('[data-inscribe-modal="true"]');
      if (openModals[openModals.length - 1] !== modalRef.current) return;

      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[1000] backdrop-blur-sm" 
      data-inscribe-shortcut-overlay="true"
      data-inscribe-modal="true"
      role="dialog"
      aria-modal="true"
      ref={modalRef}
      onClick={onClose}
    >
      <div 
        className={cn(
          "bg-card rounded-lg shadow-2xl max-h-[80vh] flex flex-col w-[90%]",
          size === 'large' ? 'max-w-[800px]' : 'max-w-[600px]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-5 border-b border-border">
          <h2 className="text-xl font-semibold m-0">{title}</h2>
          <button 
            className="bg-transparent border-none text-muted-foreground p-0 w-8 h-8 flex items-center justify-center rounded cursor-pointer hover:bg-secondary hover:text-foreground transition-colors"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="px-6 py-6 overflow-y-auto flex-1">
          {children}
        </div>
        {footer && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
