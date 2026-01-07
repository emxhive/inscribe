import React, { HTMLAttributes } from 'react';

interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'accent';
  isClickable?: boolean;
  error?: boolean;
  children: React.ReactNode;
}

export function StatusPill({ 
  variant = 'primary', 
  isClickable = false, 
  error = false,
  children,
  className = '',
  ...props 
}: StatusPillProps) {
  const variantClass = variant === 'secondary' 
    ? 'pill-secondary' 
    : variant === 'accent' 
    ? 'accent' 
    : '';
  
  const clickableClass = isClickable ? 'clickable' : '';
  const errorClass = error ? 'error' : '';
  
  const combinedClassName = `pill ${variantClass} ${clickableClass} ${errorClass} ${className}`.trim();

  return (
    <span className={combinedClassName} {...props}>
      {children}
    </span>
  );
}
