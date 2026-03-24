'use client';

import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface ErrorBannerProps {
  type?: 'error' | 'warning' | 'info';
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function ErrorBanner({
  type = 'error',
  message,
  onDismiss,
  onRetry,
}: ErrorBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const colorClasses = {
    error: 'bg-red-50 border-l-4 border-red-500',
    warning: 'bg-yellow-50 border-l-4 border-yellow-500',
    info: 'bg-blue-50 border-l-4 border-blue-500',
  };

  const textClasses = {
    error: 'text-red-800',
    warning: 'text-yellow-800',
    info: 'text-blue-800',
  };

  const iconClasses = {
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={`w-full px-4 py-3 flex items-center gap-3 ${colorClasses[type]}`}>
      <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${iconClasses[type]}`} />
      <p className={`flex-1 text-sm font-medium ${textClasses[type]}`}>
        {message}
      </p>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className={`p-1 rounded hover:bg-white/50 transition-colors ${textClasses[type]}`}
            aria-label="Retry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className={`p-1 rounded hover:bg-white/50 transition-colors ${textClasses[type]}`}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
