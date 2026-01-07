import React from 'react';
import { StatusIcon, type StatusType } from './StatusIcon';

interface FileListItemProps {
  file: string;
  lineCount: number;
  language: string;
  mode: string;
  status: StatusType;
  validationError?: string;
  isSelected: boolean;
  onClick: () => void;
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
}: FileListItemProps) {
  return (
    <li
      className={`file-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="file-header">
        <StatusIcon status={status} error={validationError} />
        <span className="file-path">{file}</span>
      </div>
      <div className="meta">
        <span>{lineCount} lines</span>
        <span>•</span>
        <span>{language}</span>
        <span>•</span>
        <span>{mode}</span>
      </div>
      {validationError && (
        <div className="validation-error-hint" title={validationError}>
          {validationError}
        </div>
      )}
    </li>
  );
}
