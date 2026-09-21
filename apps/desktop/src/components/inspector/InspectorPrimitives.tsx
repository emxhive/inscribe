import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function InspectorPropertyGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function InspectorEmptyState({ message }: { message: string }) {
  return <p className="py-4 text-center text-xs text-muted-foreground">{message}</p>;
}

export function InspectorRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid min-h-8 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'min-w-0 break-words text-foreground',
          mono && 'font-mono text-[11px]',
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}