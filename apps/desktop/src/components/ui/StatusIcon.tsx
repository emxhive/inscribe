import React from 'react';
import { CheckCircle2, XCircle, Circle } from 'lucide-react';

export type StatusType = 'pending' | 'applied' | 'invalid';

interface StatusIconProps {
  status: StatusType;
  error?: string;
}

export function StatusIcon({ status, error }: StatusIconProps) {
  const ariaLabel = error ?? (status === 'pending' ? 'Pending' : status);

  if (status === 'invalid') {
    return (
      <span title={ariaLabel}>
        <XCircle
          className="h-3 w-3 text-destructive flex-shrink-0"
          role="img"
          aria-label={ariaLabel}
        />
      </span>
    );
  }

  if (status === 'applied') {
    return (
      <span title={ariaLabel}>
        <CheckCircle2
          className="h-3 w-3 text-green-600 flex-shrink-0"
          role="img"
          aria-label={ariaLabel}
        />
      </span>
    );
  }

  return (
    <span title={ariaLabel}>
      <Circle
        className="h-3 w-3 text-muted-foreground flex-shrink-0"
        role="img"
        aria-label={ariaLabel}
      />
    </span>
  );
}
