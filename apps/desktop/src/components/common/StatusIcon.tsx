import React from 'react';

export type StatusType = 'pending' | 'applied' | 'invalid';

interface StatusIconProps {
  status: StatusType;
  error?: string;
}

export function StatusIcon({ status, error }: StatusIconProps) {
  const iconClass = status === 'invalid' ? 'error' : status === 'applied' ? 'success' : 'pending';
  const icon = status === 'invalid' ? '❌' : status === 'applied' ? '✅' : '•';
  const ariaLabel = error ?? (status === 'pending' ? 'Pending' : status);

  return (
    <span
      className={`status-icon ${iconClass}`}
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {icon}
    </span>
  );
}
