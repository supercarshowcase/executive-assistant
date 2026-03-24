'use client';

import { useHealthCheck } from '@/lib/hooks';
import Link from 'next/link';

export function HealthBanner() {
  const { isHealthy, disconnectedServices } = useHealthCheck();

  if (isHealthy || !disconnectedServices || disconnectedServices.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-yellow-50 border-l-4 border-yellow-500 px-4 py-3">
      {disconnectedServices.map((service) => (
        <div
          key={service.type}
          className="flex items-center justify-between gap-3"
        >
          <p className="text-sm font-medium text-yellow-800">
            {service.type === 'gmail' ? 'Gmail' : 'Calendar'} connection lost
            {service.account && ` for ${service.account}`}. Tap to reconnect.
          </p>
          <Link
            href={`/settings/reconnect?service=${service.type}`}
            className="text-sm font-semibold text-yellow-600 hover:text-yellow-700 whitespace-nowrap"
          >
            Reconnect
          </Link>
        </div>
      ))}
    </div>
  );
}
