import { ReactNode } from 'react';

interface BadgeProps {
  variant?:
    | 'urgent'
    | 'new_lead'
    | 'transaction_update'
    | 'follow_up'
    | 'low_priority'
    | 'buyer'
    | 'seller'
    | 'default';
  children: ReactNode;
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  const variantClasses = {
    urgent: 'bg-red-100 text-red-800',
    new_lead: 'bg-green-100 text-green-800',
    transaction_update: 'bg-purple-100 text-purple-800',
    follow_up: 'bg-amber-100 text-amber-800',
    low_priority: 'bg-gray-100 text-gray-800',
    buyer: 'bg-blue-100 text-blue-800',
    seller: 'bg-pink-100 text-pink-800',
    default: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
