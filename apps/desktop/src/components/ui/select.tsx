import * as React from 'react';

import { cn } from '@/lib/utils';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: SelectOption[];
  placeholder?: string;
};

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, value, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex w-full items-center justify-between rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      value={value ?? ''}
      {...props}
    >
      {placeholder ? (
        <option value="" disabled hidden>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  ),
);
Select.displayName = 'Select';

export { Select };
