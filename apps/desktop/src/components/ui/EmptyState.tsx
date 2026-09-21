import React from 'react';
import { FileText } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
}

export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-lg bg-secondary text-muted-foreground text-center p-6">
      <div className="text-2xl">
        {icon || <FileText className="h-6 w-6" />}
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
