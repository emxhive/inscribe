import { cn } from '@/lib/utils';

export type PanelTabOption<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

export type PanelTabsProps<T extends string> = {
  options: readonly PanelTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function PanelTabs<T extends string>({ options, value, onChange }: PanelTabsProps<T>) {
  return (
    <div className="grid h-9 flex-shrink-0 border-b border-border px-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            'relative flex items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground',
            value === option.id && 'text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary',
          )}
        >
          {option.label}
          {option.count ? <span className="text-[9px] text-destructive">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
