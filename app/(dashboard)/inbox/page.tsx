'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  ChevronDown,
  Check,
  X,
  ArrowRightLeft,
  MessageSquare,
  Mail,
  Clock,
  AlertCircle,
  User,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { VoiceInput } from '@/components/ui/VoiceInput';
import type { EmailAccount, TriagedEmail } from '@/types';

type FilterCategory =
  | 'all'
  | 'urgent'
  | 'new_lead'
  | 'transaction_update'
  | 'follow_up'
  | 'low_priority';

const filterOptions: Array<{ label: string; value: FilterCategory }> = [
  { label: 'All', value: 'all' },
  { label: 'Urgent', value: 'urgent' },
  { label: 'New Leads', value: 'new_lead' },
  { label: 'Transaction', value: 'transaction_update' },
  { label: 'Follow-up', value: 'follow_up' },
  { label: 'Low Priority', value: 'low_priority' },
];

const categoryColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800 border-red-200',
  new_lead: 'bg-green-100 text-green-800 border-green-200',
  transaction_update: 'bg-blue-100 text-blue-800 border-blue-200',
  follow_up: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low_priority: 'bg-gray-100 text-gray-600 border-gray-200',
};

// Decode HTML entities
function decodeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/\u200b/g, '');
}

// Format date nicely
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) return Math.max(1, Math.floor(diffMs / 60000)) + 'm ago';
    if (diffHours < 24) return Math.floor(diffHours) + 'h ago';
    if (diffDays < 7) return Math.floor(diffDays) + 'd ago';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// Extract sender name from "Name <email>" format
function extractSenderName(from: string): string {
  if (!from) return 'Unknown Sender';
  const decoded = decodeHtml(from);
  // Match "Name <email>" pattern
  const match = decoded.match(/^([^<]+)</);
  if (match) return match[1].trim().replace(/"/g, '');
  // Just an email
  return decoded.split('@')[0];
}

function extractSenderEmail(from: string): string {
  if (!from) return '';
  const decoded = decodeHtml(from);
  const match = decoded.match(/<([^>]+)>/);
  if (match) return match[1];
  return decoded;
}

export default function InboxPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [emails, setEmails] = useState<TriagedEmail[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [reassignDropdown, setReassignDropdown] = useState<string | null>(null);
  const [composeModal, setComposeModal] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<TriagedEmail | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  // Fetch accounts on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch('/api/email-accounts', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch accounts');
        const data = (await response.json()) as EmailAccount[];
        setAccounts(data || []);
        if (data && data.length > 0) {
          setSelectedAccountId(data[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load accounts');
      }
    };
    fetchAccounts();
  }, []);

  // Fetch emails when account changes
  useEffect(() => {
    if (!selectedAccountId) return;
    const fetchEmails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/email/triage?accountId=${selectedAccountId}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) throw new Error('Failed to fetch emails');
        const data = (await response.json()) as { emails: TriagedEmail[] };
        setEmails(data.emails || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load emails');
      } finally {
        setLoading(false);
      }
    };
    fetchEmails();
  }, [selectedAccountId]);

  // Filter emails
  const filteredEmails = useMemo(() => {
    if (activeFilter === 'all') return emails;
    return emails.filter((email) => email.category === activeFilter);
  }, [emails, activeFilter]);

  // Count by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: emails.length };
    for (const email of emails) {
      counts[email.category] = (counts[email.category] || 0) + 1;
    }
    return counts;
  }, [emails]);

  const handleReassign = async (emailId: string, newCategory: FilterCategory) => {
    setEmails((prev) =>
      prev.map((email) =>
        email.id === emailId ? { ...email, category: newCategory } : email
      )
    );
    setReassignDropdown(null);
  };

  const handleDismiss = async (emailId: string) => {
    setDismissingId(emailId);
    try {
      const response = await fetch('/api/email/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId }),
      });
      const result = await response.json();
      if (response.ok) {
        setEmails((prev) => prev.filter((email) => email.id !== emailId));
      } else {
        // Still remove locally even if Gmail trash failed
        setEmails((prev) => prev.filter((email) => email.id !== emailId));
      }
    } catch {
      // Remove locally on network error too
      setEmails((prev) => prev.filter((email) => email.id !== emailId));
    } finally {
      setDismissingId(null);
    }
  };

  const handleCompose = (email: TriagedEmail) => {
    setSelectedEmail(email);
    setComposeModal(true);
  };

  const selectedAccount = (accounts || []).find((a) => a.id === selectedAccountId);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="bg-white px-4 py-6 md:px-6 md:py-8 border-b border-gray-200">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Inbox
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Account Selector */}
          <div className="flex items-center gap-4 mb-6">
            <label className="text-sm font-medium text-gray-700">Account:</label>
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label} ({account.email})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Voice Search */}
          <div className="mb-4">
            <VoiceInput
              onTranscript={(text) => console.log('Voice input:', text)}
              placeholder="Speak to search..."
              className="w-full"
            />
          </div>

          {/* Filter Tabs with counts */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setActiveFilter(option.value)}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                  activeFilter === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
                {(categoryCounts[option.value] || 0) > 0 && (
                  <span className={`ml-1.5 text-xs ${
                    activeFilter === option.value ? 'text-blue-200' : 'text-gray-400'
                  }`}>
                    ({categoryCounts[option.value] || 0})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-4 md:px-6">
          <ErrorBanner type="error" message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-6 md:px-6 md:py-8 max-w-4xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredEmails.length === 0 ? (
          <EmptyState
            icon={<Mail className="w-12 h-12" />}
            title="No emails"
            description={`No ${activeFilter !== 'all' ? activeFilter.replace(/_/g, ' ') : ''} emails in this account.`}
          />
        ) : (
          <div className="space-y-3">
            {filteredEmails.map((email) => {
              const senderName = extractSenderName(email.from);
              const senderEmail = extractSenderEmail(email.from);
              const subject = decodeHtml(email.subject) || decodeHtml(email.summary || '').substring(0, 80);
              const summary = decodeHtml(email.summary || '');
              const snippet = decodeHtml(email.snippet || '');
              const timeAgo = formatDate(email.date || (email as any).createdAt);
              const isDismissing = dismissingId === email.id;

              return (
                <Card
                  key={email.id}
                  className={`cursor-pointer hover:shadow-md transition-all ${isDismissing ? 'opacity-50' : ''}`}
                  onClick={() =>
                    setExpandedEmailId(expandedEmailId === email.id ? null : email.id)
                  }
                >
                  <div className="space-y-3">
                    {/* Email Header */}
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="font-semibold text-gray-900 truncate">
                            {senderName}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {timeAgo && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {timeAgo}
                              </span>
                            )}
                          </div>
                        </div>
                        {senderEmail && (
                          <p className="text-xs text-gray-400 truncate mb-1">
                            {senderEmail}
                          </p>
                        )}
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">
                          {subject}
                        </p>
                      </div>
                    </div>

                    {/* Category badge + Summary */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          categoryColors[email.category] || categoryColors.low_priority
                        }`}>
                          {email.category.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {summary && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {summary}
                        </p>
                      )}
                      {email.suggestedAction && (
                        <div className="flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2">
                          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-blue-700 font-medium">
                            {decodeHtml(email.suggestedAction)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Expanded Content */}
                    {expandedEmailId === email.id && (
                      <div className="pt-3 border-t border-gray-200 space-y-3">
                        {snippet && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 font-medium mb-2">
                              Email Preview
                            </p>
                            <p className="text-sm text-gray-700">
                              {snippet}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-wrap pt-1">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompose(email);
                        }}
                        className="flex-1 md:flex-none"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Reply
                      </Button>

                      <div className="relative flex-1 md:flex-none">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReassignDropdown(
                              reassignDropdown === email.id ? null : email.id
                            );
                          }}
                          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-gray-200 text-gray-900 hover:bg-gray-300 rounded-lg transition-colors"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          Reassign
                        </button>
                        {reassignDropdown === email.id && (
                          <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                            {filterOptions
                              .filter((opt) => opt.value !== 'all')
                              .map((option) => (
                                <button
                                  key={option.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReassign(email.id, option.value);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                >
                                  {option.label}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(email.id);
                        }}
                        className="flex-1 md:flex-none"
                        disabled={isDismissing}
                      >
                        <Trash2 className="w-4 h-4" />
                        {isDismissing ? 'Deleting...' : 'Dismiss'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Compose Modal */}
      <Modal
        isOpen={composeModal}
        onClose={() => {
          setComposeModal(false);
          setSelectedEmail(null);
        }}
        title={
          selectedEmail
            ? `Reply to ${extractSenderName(selectedEmail.from)}`
            : 'Compose'
        }
        size="lg"
      >
        {selectedEmail && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900 mb-1">
                {decodeHtml(selectedEmail.subject) || 'No subject'}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                From: {decodeHtml(selectedEmail.from) || 'Unknown'}
              </p>
              <p className="text-sm text-gray-700">
                {decodeHtml(selectedEmail.snippet || selectedEmail.summary || '')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Your Reply
              </label>
              <textarea
                placeholder="Compose your reply..."
                defaultValue={`Hi ${extractSenderName(selectedEmail.from)},\n\n`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={8}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  setComposeModal(false);
                  setSelectedEmail(null);
                }}
              >
                <Check className="w-4 h-4" />
                Send Reply
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setComposeModal(false);
                  setSelectedEmail(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
