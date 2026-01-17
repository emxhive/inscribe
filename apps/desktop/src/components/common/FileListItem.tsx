import React from 'react';
import { StatusIcon, type StatusType } from './StatusIcon';
import { cn } from '@/lib/utils';

interface FileListItemProps {
  file: string;
  lineCount: number;
  language: string;
  mode: string;
  status: StatusType;
  validationError?: string;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLLIElement>) => void;
}

export function FileListItem({
  file,
  lineCount,
  language,
  mode,
  status,
  validationError,
  isSelected,
  onClick,
  onDoubleClick,
}: FileListItemProps) {
  return (
    <li
      className={cn(
        "border border-border rounded-lg p-3 bg-card cursor-pointer transition-all",
        "hover:border-primary",
        isSelected && "border-primary shadow-[0_0_0_3px_rgba(79,70,229,0.12)] bg-indigo-50/30"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex gap-2 items-center min-w-0">
        <StatusIcon status={status} error={validationError} />
        <span className="font-mono text-sm text-foreground truncate" title={file}>{file}</span>
      </div>
      <div className="flex gap-2 items-center mt-1.5 text-muted-foreground text-xs min-w-0">
        <span className="truncate">{lineCount} lines</span>
        <span>•</span>
        <span className="truncate">{language}</span>
        <span>•</span>
        <span className="truncate">{mode}</span>
      </div>
      {validationError && (
        <div className="text-[11px] text-destructive mt-1 overflow-hidden text-ellipsis whitespace-nowrap" title={validationError}>
          {validationError}
        </div>
      )}
    </li>
  );
}
