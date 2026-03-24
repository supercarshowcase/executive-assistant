'use client';

import { ReactNode } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  children,
  onClick,
  className = '',
  type = 'button',
}: ButtonProps) {
  const variantClasses = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400',
    secondary:
      'bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400',
    ghost:
      'bg-transparent text-gray-700 hover:bg-gray-100 disabled:text-gray-400',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-10',
    md: 'px-4 py-2.5 text-sm min-h-11',
    lg: 'px-6 py-3 text-base min-h-12',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors duration-200 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {isLoading && <LoadingSpinner size="sm" />}
      <span>{children}</span>
    </button>
  );
}
