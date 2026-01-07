import React, { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'default';
  children: ReactNode;
}

export function Button({ 
  variant = 'default', 
  children, 
  className = '',
  ...props 
}: ButtonProps) {
  const variantClass = variant === 'primary' 
    ? 'primary-btn' 
    : variant === 'ghost' 
    ? 'ghost-btn' 
    : '';
  
  const combinedClassName = `${variantClass} ${className}`.trim();

  return (
    <button 
      className={combinedClassName}
      {...props}
    >
      {children}
    </button>
  );
}
