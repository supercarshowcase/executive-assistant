'use client';

import { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Mail,
  MapPin,
  Building2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { VoiceInput } from '@/components/ui/VoiceInput';
import { createBrowserClient } from '@/lib/supabase';
import type { EmailAccount } from '@/types';

type OnboardingStep = 'profile' | 'email' | 'labels';

export default function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile step
  const [name, setName] = useState('');
  const [brokerage, setBrokerage] = useState('');
  const [city, setCity] = useState('');

  // Email step
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);

  // Labels step
  const [labels, setLabels] = useState<
    Record<string, { label: string; contextNote: string }>
  >({});

  const supabase = createBrowserClient();

  // Check current user
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
      }
    };

    checkUser();
  }, [supabase]);

  const handleGoogleConnect = () => {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/email`,
      response_type: 'code',
      scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const handleProfileNext = async () => {
    if (!name || !brokerage || !city) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Save user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name,
          brokerage,
          city,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Fetch email accounts
      const response = await fetch('/api/email/accounts', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const data = (await response.json()) as { accounts: EmailAccount[] };
      setAccounts(data.accounts);
      setConnectedAccounts(data.accounts.map((a) => a.id));

      // Initialize labels
      const initialLabels: Record<
        string,
        { label: string; contextNote: string }
      > = {};
      data.accounts.forEach((account, idx) => {
        initialLabels[account.id] = {
          label:
            idx === 0
              ? 'Primary'
              : idx === 1
                ? 'Secondary'
                : `Account ${idx + 1}`,
          contextNote: '',
        };
      });
      setLabels(initialLabels);

      setStep('email');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save profile'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailNext = () => {
    if (connectedAccounts.length === 0) {
      setError('Please connect at least one email account');
      return;
    }
    setStep('labels');
  };

  const handleLabelsSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Update labels for connected accounts
      for (const accountId of connectedAccounts) {
        const labelData = labels[accountId];
        if (labelData) {
          const { error: updateError } = await supabase
            .from('email_accounts')
            .update({
              label: labelData.label,
              contextNote: labelData.contextNote,
            })
            .eq('id', accountId);

          if (updateError) throw updateError;
        }
      }

      // Mark onboarding as complete
      const { error: onboardError } = await supabase
        .from('users')
        .update({ isPremium: true })
        .eq('id', user.id);

      if (onboardError) throw onboardError;

      // Redirect to dashboard
      window.location.href = '/';
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save labels'
      );
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 'profile', label: 'Profile', number: 1 },
    { id: 'email', label: 'Email Accounts', number: 2 },
    { id: 'labels', label: 'Account Labels', number: 3 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-6 md:py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Welcome to Executive AI Pro
          </h1>
          <p className="text-gray-600">
            Let's set up your account in a few quick steps
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8 flex items-center justify-between">
          {steps.map((s, idx) => (
            <div key={s.id} className="flex items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  s.id === step
                    ? 'bg-blue-600 text-white'
                    : step === 'email'
                      ? s.id === 'profile'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                      : step === 'labels'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step === 'email' && s.id === 'profile' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : step === 'labels' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  s.number
                )}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    (step === 'email' && idx === 0) ||
                    (step === 'labels' && idx < 2)
                      ? 'bg-green-600'
                      : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6">
            <ErrorBanner
              type="error"
              message={error}
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        {/* Step 1: Profile */}
        {step === 'profile' && (
          <Card className="bg-white shadow-lg">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Your Full Name
                </label>
                <input
                  type="text"
                  placeholder="John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  <Building2 className="w-4 h-4 inline mr-2" />
                  Brokerage or Company
                </label>
                <input
                  type="text"
                  placeholder="Your Real Estate Brokerage"
                  value={brokerage}
                  onChange={(e) => setBrokerage(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  City / Service Area
                </label>
                <input
                  type="text"
                  placeholder="Austin, TX"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <Button
                variant="primary"
                isLoading={loading}
                onClick={handleProfileNext}
                className="w-full flex items-center justify-center gap-2"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Email Accounts */}
        {step === 'email' && (
          <Card className="bg-white shadow-lg">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  <Mail className="w-5 h-5 inline mr-2" />
                  Connect Your Email Accounts
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  We'll securely connect to your Gmail accounts using OAuth 2.0.
                  Your passwords are never shared with us.
                </p>
              </div>

              {connectedAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">
                    Connected Accounts:
                  </p>
                  {accounts
                    .filter((a) => connectedAccounts.includes(a.id))
                    .map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg"
                      >
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {account.email}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <Button
                variant="secondary"
                onClick={handleGoogleConnect}
                className="w-full flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {connectedAccounts.length > 0
                  ? 'Add Another Email'
                  : 'Connect Email with Google'}
              </Button>

              {connectedAccounts.length > 0 && (
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setStep('profile')}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleEmailNext}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 3: Account Labels */}
        {step === 'labels' && (
          <Card className="bg-white shadow-lg">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Label Your Accounts
                </h2>
                <p className="text-sm text-gray-600">
                  Give each email account a meaningful label so you can
                  distinguish them in your briefing and inbox.
                </p>
              </div>

              <div className="space-y-4">
                {accounts
                  .filter((a) => connectedAccounts.includes(a.id))
                  .map((account) => (
                    <div
                      key={account.id}
                      className="p-4 border border-gray-200 rounded-lg space-y-3"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {account.email}
                      </p>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Account Label
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Commercial, Personal Buyers"
                          value={labels[account.id]?.label || ''}
                          onChange={(e) =>
                            setLabels((prev) => ({
                              ...prev,
                              [account.id]: {
                                ...prev[account.id],
                                label: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Context Note (optional)
                        </label>
                        <textarea
                          placeholder="e.g., For commercial properties in downtown area"
                          value={labels[account.id]?.contextNote || ''}
                          onChange={(e) =>
                            setLabels((prev) => ({
                              ...prev,
                              [account.id]: {
                                ...prev[account.id],
                                contextNote: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      </div>
                    </div>
                  ))}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setStep('email')}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  variant="primary"
                  isLoading={loading}
                  onClick={handleLabelsSave}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Complete Setup
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
