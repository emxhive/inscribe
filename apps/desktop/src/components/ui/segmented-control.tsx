import { cn } from '@/lib/utils';

export type SegmentedControlOption<T extends string> = {
  id: T;
  label: string;
  disabled?: boolean;
};

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('flex items-center rounded-md border border-border bg-secondary/60 p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={option.disabled}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'h-7 rounded px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            value === option.id
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
