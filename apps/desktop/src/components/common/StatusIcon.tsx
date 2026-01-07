import React from 'react';

export type StatusType = 'valid' | 'invalid' | 'warning';

interface StatusIconProps {
  status: StatusType;
  error?: string;
}

export function StatusIcon({ status, error }: StatusIconProps) {
  const iconClass = status === 'invalid' ? 'error' : status === 'warning' ? 'warn' : 'success';
  const icon = status === 'invalid' ? '❌' : status === 'warning' ? '⚠' : '✅';
  const ariaLabel = error || status;

  return (
    <span
      className={`status-icon ${iconClass}`}
      role="img"
      aria-label={ariaLabel}
      title={error || status}
    >
      {icon}
    </span>
  );
}
