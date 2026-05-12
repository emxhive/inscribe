import React from 'react';
import { StatusIcon, type StatusType } from './StatusIcon';
import { cn } from '@/lib/utils';

interface FileListEntryProps {
  file: string;
  lineCount: number;
  language: string;
  mode: string;
  status: StatusType;
  validationError?: string;
  isSelected?: boolean;
  onClick?: () => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLLIElement>) => void;
  actions?: React.ReactNode;
  actionPlacement?: 'top' | 'side';
}

export function FileListEntry({
  file,
  lineCount,
  language,
  mode,
  status,
  validationError,
  isSelected = false,
  onClick,
  onDoubleClick,
  actions,
  actionPlacement = 'top',
}: FileListEntryProps) {
  const hasActions = Boolean(actions);
  const isInteractive = Boolean(onClick || onDoubleClick);

  return (
    <li
      className={cn(
        'border-b border-border px-3 py-2 bg-card transition-colors',
        isInteractive && 'cursor-pointer',
        isInteractive && 'hover:bg-secondary/60',
        isSelected && 'bg-primary/10 border-l-2 border-l-primary',
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div
        className={cn(
          'flex gap-3',
          hasActions && actionPlacement === 'side' ? 'items-start justify-between' : 'items-start',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex gap-2 items-center min-w-0">
              <StatusIcon status={status} error={validationError} />
              <span className="inline-code truncate max-w-full" title={file}>
                {file}
              </span>
            </div>
            {hasActions && actionPlacement === 'top' && (
              <div className="flex items-center gap-1" aria-label="File actions">
                {actions}
              </div>
            )}
          </div>
          <div className="flex gap-1.5 items-center mt-1 text-muted-foreground text-[11px] min-w-0">
            <span className="truncate">{lineCount} lines</span>
            <span>•</span>
            <span className="truncate">{language}</span>
            <span>•</span>
            <span className="truncate">{mode}</span>
          </div>
          {validationError && (
            <div
              className="text-[11px] text-destructive mt-1 overflow-hidden text-ellipsis whitespace-nowrap"
              title={validationError}
            >
              {validationError}
            </div>
          )}
        </div>
        {hasActions && actionPlacement === 'side' && (
          <div className="flex items-center gap-1 pt-0.5" aria-label="File actions">
            {actions}
          </div>
        )}
      </div>
    </li>
  );
}
