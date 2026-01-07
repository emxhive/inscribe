import React from 'react';

interface EmptyStateProps {
  icon?: string;
  message: string;
}

export function EmptyState({ icon = '📄', message }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <p>{message}</p>
    </div>
  );
}
