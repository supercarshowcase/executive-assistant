'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Mail,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Circle,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { VoiceInput } from '@/components/ui/VoiceInput';
import { useAsync, useUser } from '@/lib/hooks';
import { createBrowserClient } from '@/lib/supabase-browser';
import type { User, EmailAccount } from '@/types';

interface EmailAccountFormData {
  label: string;
  contextNote: string;
}

interface ProfileFormData {
  name: string;
  brokerage: string;
  city: string;
}

export default function SettingsPage() {
  const { user, loading: userLoading } = useUser();
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    name: '',
    brokerage: '',
    city: '',
  });
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountFormData, setAccountFormData] = useState<EmailAccountFormData>({
    label: '',
    contextNote: '',
  });
  const [isRemovingAccountId, setIsRemovingAccountId] = useState<string | null>(null);
  const [confirmRemoveAccountId, setConfirmRemoveAccountId] = useState<string | null>(null);

  // Fetch email accounts
  const {
    data: accountsData = [],
    execute: refetchAccounts,
  } = useAsync(async () => {
    const response = await fetch('/api/email-accounts');
    if (!response.ok) throw new Error('Failed to fetch email accounts');
    return response.json();
  }, true);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        brokerage: user.brokerage || '',
        city: user.city || '',
      });
    }
  }, [user]);

  // Update email accounts
  useEffect(() => {
    setEmailAccounts((accountsData || []) as EmailAccount[]);
  }, [accountsData]);

  const handleProfileSave = useCallback(async () => {
    if (!user) return;

    setIsProfileSaving(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      setIsProfileEditing(false);
      alert('Profile updated successfully!');
      // Could refetch user here
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setIsProfileSaving(false);
    }
  }, [user, profileForm]);

  const handleUpdateAccount = useCallback(
    async (accountId: string) => {
      try {
        const response = await fetch(`/api/email-accounts/${accountId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(accountFormData),
        });

        if (!response.ok) throw new Error('Failed to update account');

        setEditingAccountId(null);
        refetchAccounts();
        alert('Account updated successfully!');
      } catch (error) {
        console.error('Error updating account:', error);
        alert('Failed to update account');
      }
    },
    [accountFormData, refetchAccounts]
  );

  const handleRemoveAccount = useCallback(async (accountId: string) => {
    setIsRemovingAccountId(accountId);
    try {
      const response = await fetch(`/api/email-accounts/${accountId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove account');

      setConfirmRemoveAccountId(null);
      refetchAccounts();
      alert('Account removed successfully!');
    } catch (error) {
      console.error('Error removing account:', error);
      alert('Failed to remove account');
    } finally {
      setIsRemovingAccountId(null);
    }
  }, [refetchAccounts]);

  const handleAddAccount = useCallback(async () => {
    try {
      // Initiate OAuth flow
      window.location.href = '/api/auth/google/connect';
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      alert('Failed to initiate OAuth flow');
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, []);

  const handleVoiceInput = useCallback(
    (field: keyof ProfileFormData, text: string) => {
      setProfileForm((prev) => ({
        ...prev,
        [field]: (prev[field] + ' ' + text).trim(),
      }));
    },
    []
  );

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 md:py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Settings
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* User Profile Section */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Profile</h2>
            {!isProfileEditing && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsProfileEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>

          {isProfileEditing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Full Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Your name"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <VoiceInput
                    onTranscript={(text) => handleVoiceInput('name', text)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Brokerage
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={profileForm.brokerage}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        brokerage: e.target.value,
                      }))
                    }
                    placeholder="Your brokerage"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <VoiceInput
                    onTranscript={(text) => handleVoiceInput('brokerage', text)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  City
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={profileForm.city}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                    placeholder="Your city"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <VoiceInput
                    onTranscript={(text) => handleVoiceInput('city', text)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsProfileEditing(false);
                    if (user) {
                      setProfileForm({
                        name: user.name || '',
                        brokerage: user.brokerage || '',
                        city: user.city || '',
                      });
                    }
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleProfileSave}
                  isLoading={isProfileSaving}
                  className="flex-1"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="text-gray-900 font-medium">
                  {user?.name || 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-gray-900 font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Brokerage</p>
                <p className="text-gray-900 font-medium">
                  {user?.brokerage || 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">City</p>
                <p className="text-gray-900 font-medium">
                  {user?.city || 'Not set'}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Subscription Section */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                Subscription
              </h2>
              <div className="flex items-center gap-2">
                <Badge
                  variant="default"
                  className={
                    user?.isPremium
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-800'
                  }
                >
                  {user?.isPremium ? 'Premium' : 'Free'}
                </Badge>
                <span className="text-sm text-gray-600">
                  {user?.isPremium
                    ? 'You have access to all features'
                    : 'Upgrade for more features'}
                </span>
              </div>
            </div>
            {!user?.isPremium && (
              <Button>Upgrade</Button>
            )}
          </div>
        </Card>

        {/* Email Accounts Section */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Email Accounts</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddAccount}
            >
              <Plus className="w-4 h-4" />
              Add Account
            </Button>
          </div>

          {(emailAccounts || []).length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <Mail className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm">No email accounts connected</p>
              <p className="text-xs text-gray-500 mt-1">
                Connect your Gmail account to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(emailAccounts || []).map((account) => (
                <div key={account.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {editingAccountId === account.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                              Label
                            </label>
                            <input
                              type="text"
                              value={accountFormData.label}
                              onChange={(e) =>
                                setAccountFormData((prev) => ({
                                  ...prev,
                                  label: e.target.value,
                                }))
                              }
                              placeholder="e.g., Work, Personal"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1">
                              Context Note
                            </label>
                            <textarea
                              value={accountFormData.contextNote}
                              onChange={(e) =>
                                setAccountFormData((prev) => ({
                                  ...prev,
                                  contextNote: e.target.value,
                                }))
                              }
                              placeholder="e.g., Primary business email"
                              rows={2}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingAccountId(null);
                                setAccountFormData({
                                  label: '',
                                  contextNote: '',
                                });
                              }}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                handleUpdateAccount(account.id)
                              }
                              className="flex-1"
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <p className="font-medium text-gray-900">
                              {account.email}
                            </p>
                          </div>
                          {account.label && (
                            <p className="text-sm text-gray-600 ml-6">
                              {account.label}
                            </p>
                          )}
                          {account.contextNote && (
                            <p className="text-sm text-gray-500 ml-6 mt-1 italic">
                              {account.contextNote}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 ml-6">
                            <Circle className="w-3 h-3 text-green-500 fill-green-500" />
                            <span className="text-xs text-gray-600">
                              Connected
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {editingAccountId !== account.id && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingAccountId(account.id);
                            setAccountFormData({
                              label: account.label,
                              contextNote: account.contextNote,
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() =>
                            setConfirmRemoveAccountId(account.id)
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Connection Health Section */}
        <Card>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Connection Health
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">
                  Gmail
                </span>
              </div>
              {(emailAccounts || []).length > 0 ? (
                <div className="flex items-center gap-1 text-green-600">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-gray-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Not Connected</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                </svg>
                <span className="text-sm font-medium text-gray-900">
                  Google Calendar
                </span>
              </div>
              <div className="flex items-center gap-1 text-gray-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Not Connected</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Sign Out Section */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Account</h3>
              <p className="text-sm text-gray-600 mt-1">
                Sign out of your account
              </p>
            </div>
            <Button
              variant="danger"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </Card>
      </div>

      {/* Remove Account Confirmation Modal */}
      <Modal
        isOpen={confirmRemoveAccountId !== null}
        onClose={() => setConfirmRemoveAccountId(null)}
        title="Remove Email Account"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">
                This action cannot be undone.
              </p>
              <p className="text-sm text-red-700 mt-1">
                Removing this email account will stop syncing emails from this
                address.
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Are you sure you want to remove{' '}
            <span className="font-medium">
              {(emailAccounts || []).find((a) => a.id === confirmRemoveAccountId)
                ?.email}
            </span>
            ?
          </p>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setConfirmRemoveAccountId(null)}
              className="flex-1"
            >
              Keep Account
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmRemoveAccountId) {
                  handleRemoveAccount(confirmRemoveAccountId);
                }
              }}
              isLoading={isRemovingAccountId === confirmRemoveAccountId}
              className="flex-1"
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
