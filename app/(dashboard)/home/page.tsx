'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles,
  AlertCircle,
  Calendar,
  TrendingDown,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useUser } from '@/lib/hooks';
import type { DailyBriefing } from '@/types';

export default function BriefingPage() {
  const { user, loading: userLoading } = useUser();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBriefing = async () => {
    try {
      setError(null);
      const response = await fetch('/api/ai/briefing', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch briefing: ${response.status}`);
      }

      const data = (await response.json()) as DailyBriefing;
      setBriefing(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load briefing'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!userLoading) {
      fetchBriefing();
    }
  }, [userLoading]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBriefing();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header with Greeting and Refresh */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-6 md:px-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {getGreeting()}, {user?.name?.split(' ')[0]}
              </h1>
              <p className="text-gray-600 mt-2">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2 rounded-lg transition-all ${
                refreshing
                  ? 'bg-gray-200 text-gray-400'
                  : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'
              }`}
              aria-label="Refresh briefing"
            >
              <RefreshCw
                className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-4 md:px-6">
          <ErrorBanner
            type="error"
            message={error}
            onRetry={handleRefresh}
            onDismiss={() => setError(null)}
          />
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-6 md:px-6 md:py-8 max-w-4xl mx-auto space-y-6">
        {/* AI Summary */}
        {briefing?.summary && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex gap-4">
              <div className="flex-shrink-0 pt-1">
                <Sparkles className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900 mb-2">
                  AI Daily Summary
                </h2>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {briefing.summary}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Top Emails Needing Action */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Top Emails Needing Action
          </h2>
          {briefing?.urgentEmails && briefing.urgentEmails.length > 0 ? (
            <div className="space-y-3">
              {briefing.urgentEmails.slice(0, 3).map((email) => (
                <Card key={email.id} className="hover:shadow-md transition-shadow">
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <Badge variant={email.category}>
                          {email.category.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="font-medium text-gray-900 truncate">
                        {email.from}
                      </p>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {email.subject}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {email.summary}
                      </p>
                      <p className="text-xs text-blue-600 font-medium mt-2">
                        Action: {email.suggestedAction}
                      </p>
                    </div>
                    <div className="flex-shrink-0 pt-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<AlertCircle className="w-12 h-12" />}
              title="No urgent emails"
              description="All caught up! Check back later for new messages."
            />
          )}
        </section>

        {/* Today's Calendar */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Today&apos;s Calendar
          </h2>
          {briefing?.todayEvents && briefing.todayEvents.length > 0 ? (
            <div className="space-y-2">
              {briefing.todayEvents.map((event, idx) => (
                <Card key={idx} padding="sm" className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="text-sm text-gray-500">
                      {event.time} &bull; {event.duration} min
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Calendar className="w-12 h-12" />}
              title="No events today"
              description="Your calendar is clear. Great for focused work!"
            />
          )}
        </section>

        {/* Stale Leads */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-amber-600" />
            Stale Leads
          </h2>
          {briefing?.staleLeads && briefing.staleLeads.length > 0 ? (
            <div className="space-y-3">
              {briefing.staleLeads.map((lead) => (
                <Card key={lead.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{lead.name}</p>
                    <p className="text-sm text-gray-500">
                      Last contact:{' '}
                      {lead.lastContactDate
                        ? new Date(lead.lastContactDate).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary">
                    Follow Up
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<TrendingDown className="w-12 h-12" />}
              title="No stale leads"
              description="All your leads are up to date!"
            />
          )}
        </section>

        {/* Upcoming Deadlines */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            Upcoming Deadlines
          </h2>
          {briefing?.upcomingDeadlines &&
          briefing.upcomingDeadlines.length > 0 ? (
            <div className="space-y-3">
              {briefing.upcomingDeadlines.map((transaction) => {
                const daysUntilClosing = Math.ceil(
                  (new Date(transaction.closingDate).getTime() -
                    new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                );
                const isUrgent = daysUntilClosing <= 7;

                return (
                  <Card
                    key={transaction.id}
                    className={`${
                      isUrgent ? 'bg-red-50 border-red-200' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {transaction.propertyAddress}
                        </p>
                        <p className="text-sm text-gray-600">
                          {transaction.clientName}
                        </p>
                        <p
                          className={`text-sm font-medium mt-1 ${
                            isUrgent
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }`}
                        >
                          Closing: {new Date(transaction.closingDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div
                        className={`text-right flex-shrink-0 px-4 py-2 rounded-lg ${
                          isUrgent
                            ? 'bg-red-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        <p
                          className={`text-lg font-bold ${
                            isUrgent
                              ? 'text-red-600'
                              : 'text-gray-700'
                          }`}
                        >
                          {daysUntilClosing}d
                        </p>
                        <p className="text-xs text-gray-500">remaining</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Clock className="w-12 h-12" />}
              title="No upcoming deadlines"
              description="You're all caught up with your transactions!"
            />
          )}
        </section>
      </div>
    </div>
  );
}
