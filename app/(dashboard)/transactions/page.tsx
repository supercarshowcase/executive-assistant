'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, AlertCircle, Calendar, Phone, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAsync } from '@/lib/hooks';
import type { Transaction, Lead } from '@/types';

type TransactionStatus = 'pending' | 'option_period' | 'pending_financing' | 'clear_to_close' | 'closed';

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Pending',
  option_period: 'Option Period',
  pending_financing: 'Pending Financing',
  clear_to_close: 'Clear to Close',
  closed: 'Closed',
};

const STATUS_COLORS: Record<TransactionStatus, string> = {
  pending: 'bg-blue-100 text-blue-800',
  option_period: 'bg-amber-100 text-amber-800',
  pending_financing: 'bg-purple-100 text-purple-800',
  clear_to_close: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

interface AddTransactionForm {
  propertyAddress: string;
  clientName: string;
  contractDate: string;
  optionPeriodEnd: string;
  closingDate: string;
  lenderContact: string;
  titleCompanyContact: string;
  status: TransactionStatus;
  leadId: string;
}

const initialFormState: AddTransactionForm = {
  propertyAddress: '',
  clientName: '',
  contractDate: '',
  optionPeriodEnd: '',
  closingDate: '',
  lenderContact: '',
  titleCompanyContact: '',
  status: 'pending',
  leadId: '',
};

export default function TransactionsPage() {
  const [filterStatus, setFilterStatus] = useState<'all' | TransactionStatus>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddTransactionForm>(initialFormState);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Transaction | null>(null);
  const [isDraftingEmail, setIsDraftingEmail] = useState(false);
  const [draftedEmail, setDraftedEmail] = useState<{
    subject: string;
    body: string;
    recipientEmail: string;
  } | null>(null);

  // Fetch transactions
  const {
    data: transactions = [],
    status: transactionsStatus,
    execute: refetchTransactions,
  } = useAsync(async () => {
    const response = await fetch('/api/transactions');
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return response.json();
  }, true);

  // Fetch leads for dropdown
  const { data: leads = [] } = useAsync(async () => {
    const response = await fetch('/api/leads');
    if (!response.ok) throw new Error('Failed to fetch leads');
    return response.json();
  }, true);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (filterStatus === 'all') return transactions as Transaction[];
    return ((transactions || []) as Transaction[]).filter(
      (t) => t.status === filterStatus
    );
  }, [transactions, filterStatus]);

  // Get deadline alerts (< 7 days)
  const deadlineAlerts = useMemo(() => {
    const now = new Date();
    return ((transactions || []) as Transaction[]).filter((t) => {
      let deadlineDate: Date | null = null;

      if (
        t.status === 'option_period' &&
        t.optionPeriodEnd
      ) {
        deadlineDate = new Date(t.optionPeriodEnd);
      } else if (
        ['pending_financing', 'clear_to_close'].includes(t.status) &&
        t.closingDate
      ) {
        deadlineDate = new Date(t.closingDate);
      }

      if (!deadlineDate) return false;

      const daysUntil =
        (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntil > 0 && daysUntil <= 7;
    });
  }, [transactions]);

  const getDaysUntil = (date: string | null): number | null => {
    if (!date) return null;
    const now = new Date();
    const targetDate = new Date(date);
    return Math.ceil(
      (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const handleAddTransaction = useCallback(async () => {
    if (!addForm.propertyAddress || !addForm.clientName || !addForm.contractDate) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });

      if (!response.ok) throw new Error('Failed to add transaction');

      setAddForm(initialFormState);
      setIsAddModalOpen(false);
      refetchTransactions();
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Failed to add transaction');
    }
  }, [addForm, refetchTransactions]);

  const handleUpdateTransaction = useCallback(async () => {
    if (!editForm) return;

    try {
      const response = await fetch(`/api/transactions/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) throw new Error('Failed to update transaction');

      setEditingTransactionId(null);
      setEditForm(null);
      setExpandedTransactionId(null);
      refetchTransactions();
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction');
    }
  }, [editForm, refetchTransactions]);

  const handleDraftStatusUpdate = useCallback(async (transaction: Transaction) => {
    setIsDraftingEmail(true);
    try {
      const response = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: 'transaction_status_update',
          transaction: {
            propertyAddress: transaction.propertyAddress,
            clientName: transaction.clientName,
            status: transaction.status,
            contractDate: transaction.contractDate,
            closingDate: transaction.closingDate,
            optionPeriodEnd: transaction.optionPeriodEnd,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to draft email');

      const data = await response.json();
      setDraftedEmail({
        subject: data.subject || `Status Update: ${transaction.propertyAddress}`,
        body: data.body || `Hi ${transaction.clientName},\n\nHere's a status update on your transaction...`,
        recipientEmail: '', // Should be filled from lead email
      });
    } catch (error) {
      console.error('Error drafting email:', error);
      alert('Failed to draft status update email');
    } finally {
      setIsDraftingEmail(false);
    }
  }, []);

  if (transactionsStatus === 'pending') {
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
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Transaction Tracker
          </h1>

          {/* Status Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['all', 'pending', 'option_period', 'pending_financing', 'clear_to_close', 'closed'] as const).map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? 'All' : STATUS_LABELS[status as TransactionStatus]}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Deadline Alerts */}
      {deadlineAlerts.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 mb-2">
                  {deadlineAlerts.length} transaction{deadlineAlerts.length !== 1 ? 's' : ''} with upcoming deadlines
                </h3>
                <div className="space-y-1">
                  {deadlineAlerts.map((t) => {
                    const daysUntil =
                      t.status === 'option_period'
                        ? getDaysUntil(t.optionPeriodEnd)
                        : getDaysUntil(t.closingDate);
                    return (
                      <p key={t.id} className="text-sm text-red-800">
                        <strong>{t.propertyAddress}</strong> -{' '}
                        {daysUntil} day{daysUntil !== 1 ? 's' : ''} remaining
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {filteredTransactions.length === 0 ? (
          <EmptyState
            icon="ð"
            title="No transactions"
            description={
              filterStatus === 'all'
                ? 'Create a new transaction to get started.'
                : `No transactions with status "${STATUS_LABELS[filterStatus as TransactionStatus]}"`
            }
            action={
              filterStatus === 'all' ? (
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-4"
                >
                  <Plus className="w-4 h-4" />
                  Add Transaction
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((transaction) => {
              const daysUntilOption =
                transaction.optionPeriodEnd &&
                transaction.status === 'option_period'
                  ? getDaysUntil(transaction.optionPeriodEnd)
                  : null;

              const daysUntilClosing =
                transaction.closingDate &&
                ['pending_financing', 'clear_to_close'].includes(
                  transaction.status
                )
                  ? getDaysUntil(transaction.closingDate)
                  : null;

              return (
                <Card
                  key={transaction.id}
                  onClick={() => {
                    setExpandedTransactionId(transaction.id);
                    setEditForm(transaction);
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Property Address */}
                      <h3 className="text-lg font-bold text-gray-900 mb-2 break-words">
                        {transaction.propertyAddress}
                      </h3>

                      {/* Status Badge */}
                      <div className="mb-3">
                        <Badge variant="default" className={STATUS_COLORS[transaction.status]}>
                          {STATUS_LABELS[transaction.status as TransactionStatus]}
                        </Badge>
                      </div>

                      {/* Key Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Client</p>
                          <p className="font-medium text-gray-900">
                            {transaction.clientName}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-600">Contract Date</p>
                          <p className="font-medium text-gray-900">
                            {new Date(transaction.contractDate).toLocaleDateString()}
                          </p>
                        </div>

                        {transaction.optionPeriodEnd && (
                          <div>
                            <p className="text-gray-600">Option Period</p>
                            <p className={`font-medium ${
                              daysUntilOption !== null && daysUntilOption < 7
                                ? 'text-red-600'
                                : 'text-gray-900'
                            }`}>
                              {new Date(transaction.optionPeriodEnd).toLocaleDateString()}
                              {daysUntilOption !== null && (
                                <span className="ml-2 text-xs">
                                  ({daysUntilOption} days)
                                </span>
                              )}
                            </p>
                          </div>
                        )}

                        <div>
                          <p className="text-gray-600">Closing Date</p>
                          <p className={`font-medium ${
                            daysUntilClosing !== null && daysUntilClosing < 7
                              ? 'text-red-600'
                              : 'text-gray-900'
                          }`}>
                            {transaction.closingDate
                              ? new Date(transaction.closingDate).toLocaleDateString()
                              : 'TBD'}
                            {daysUntilClosing !== null && (
                              <span className="ml-2 text-xs">
                                ({daysUntilClosing} days)
                              </span>
                            )}
                          </p>
                        </div>

                        {transaction.lenderContact && (
                          <div>
                            <p className="text-gray-600 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> Lender
                            </p>
                            <p className="font-medium text-gray-900 truncate">
                              {transaction.lenderContact}
                            </p>
                          </div>
                        )}

                        {transaction.titleCompanyContact && (
                          <div>
                            <p className="text-gray-600 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> Title Company
                            </p>
                            <p className="font-medium text-gray-900 truncate">
                              {transaction.titleCompanyContact}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 md:flex-col">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDraftStatusUpdate(transaction);
                        }}
                        isLoading={isDraftingEmail}
                        className="flex-1 md:w-full"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Draft Update
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddForm(initialFormState);
        }}
        title="Add Transaction"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Property Address *
            </label>
            <input
              type="text"
              value={addForm.propertyAddress}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  propertyAddress: e.target.value,
                }))
              }
              placeholder="123 Main St, Austin, TX 78701"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Client Name *
            </label>
            <input
              type="text"
              value={addForm.clientName}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, clientName: e.target.value }))
              }
              placeholder="Client name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Contract Date *
              </label>
              <input
                type="date"
                value={addForm.contractDate}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    contractDate: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Option Period End
              </label>
              <input
                type="date"
                value={addForm.optionPeriodEnd}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    optionPeriodEnd: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Closing Date
              </label>
              <input
                type="date"
                value={addForm.closingDate}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    closingDate: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Status
              </label>
              <select
                value={addForm.status}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    status: e.target.value as TransactionStatus,
                  }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Link to Lead
            </label>
            <select
              value={addForm.leadId}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, leadId: e.target.value }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a lead (optional)</option>
              {((leads || []) as Lead[]).map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} ({lead.leadType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Lender Contact
            </label>
            <input
              type="text"
              value={addForm.lenderContact}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  lenderContact: e.target.value,
                }))
              }
              placeholder="Name and phone"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Title Company Contact
            </label>
            <input
              type="text"
              value={addForm.titleCompanyContact}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  titleCompanyContact: e.target.value,
                }))
              }
              placeholder="Name and phone"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setIsAddModalOpen(false);
                setAddForm(initialFormState);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleAddTransaction} className="flex-1">
              Add Transaction
            </Button>
          </div>
        </div>
      </Modal>

      {/* Expand Transaction Modal */}
      <Modal
        isOpen={expandedTransactionId !== null}
        onClose={() => {
          setExpandedTransactionId(null);
          setEditingTransactionId(null);
          setEditForm(null);
        }}
        title={editForm ? `Transaction: ${editForm.propertyAddress}` : 'Transaction Details'}
        size="lg"
      >
        {editForm && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Property Address
              </label>
              {editingTransactionId === editForm.id ? (
                <input
                  type="text"
                  value={editForm.propertyAddress}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev
                        ? { ...prev, propertyAddress: e.target.value }
                        : null
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 break-words">{editForm.propertyAddress}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Client Name
                </label>
                {editingTransactionId === editForm.id ? (
                  <input
                    type="text"
                    value={editForm.clientName}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, clientName: e.target.value } : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{editForm.clientName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Status
                </label>
                {editingTransactionId === editForm.id ? (
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              status: e.target.value as TransactionStatus,
                            }
                          : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge variant="default" className={STATUS_COLORS[editForm.status]}>
                    {STATUS_LABELS[editForm.status as TransactionStatus]}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Contract Date
                </label>
                {editingTransactionId === editForm.id ? (
                  <input
                    type="date"
                    value={editForm.contractDate.split('T')[0]}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, contractDate: e.target.value }
                          : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">
                    {new Date(editForm.contractDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Option Period End
                </label>
                {editingTransactionId === editForm.id ? (
                  <input
                    type="date"
                    value={
                      editForm.optionPeriodEnd
                        ? editForm.optionPeriodEnd.split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, optionPeriodEnd: e.target.value }
                          : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">
                    {editForm.optionPeriodEnd
                      ? new Date(editForm.optionPeriodEnd).toLocaleDateString()
                      : 'Not set'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Closing Date
                </label>
                {editingTransactionId === editForm.id ? (
                  <input
                    type="date"
                    value={
                      editForm.closingDate
                        ? editForm.closingDate.split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, closingDate: e.target.value } : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">
                    {editForm.closingDate
                      ? new Date(editForm.closingDate).toLocaleDateString()
                      : 'Not set'}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Lender Contact
                </label>
                {editingTransactionId === editForm.id ? (
                  <input
                    type="text"
                    value={editForm.lenderContact}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, lenderContact: e.target.value }
                          : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">
                    {editForm.lenderContact || 'Not set'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Title Company Contact
                </label>
                {editingTransactionId === editForm.id ? (
                  <input
                    type="text"
                    value={editForm.titleCompanyContact}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              titleCompanyContact: e.target.value,
                            }
                          : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">
                    {editForm.titleCompanyContact || 'Not set'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setExpandedTransactionId(null);
                  setEditingTransactionId(null);
                  setEditForm(null);
                }}
                className="flex-1"
              >
                Close
              </Button>

              {editingTransactionId === editForm.id ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setEditingTransactionId(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateTransaction} className="flex-1">
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setEditingTransactionId(editForm.id)}
                  className="flex-1"
                >
                  Edit
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Draft Email Modal */}
      <Modal
        isOpen={draftedEmail !== null}
        onClose={() => setDraftedEmail(null)}
        title="Status Update Email"
        size="lg"
      >
        {draftedEmail && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                To
              </label>
              <input
                type="email"
                value={draftedEmail.recipientEmail}
                onChange={(e) =>
                  setDraftedEmail((prev) =>
                    prev
                      ? { ...prev, recipientEmail: e.target.value }
                      : null
                  )
                }
                placeholder="client@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={draftedEmail.subject}
                onChange={(e) =>
                  setDraftedEmail((prev) =>
                    prev ? { ...prev, subject: e.target.value } : null
                  )
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Message
              </label>
              <textarea
                value={draftedEmail.body}
                onChange={(e) =>
                  setDraftedEmail((prev) =>
                    prev ? { ...prev, body: e.target.value } : null
                  )
                }
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setDraftedEmail(null)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  alert('Email would be sent - integrate with Gmail API');
                  setDraftedEmail(null);
                }}
                className="flex-1"
              >
                Send Email
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center md:hidden"
        aria-label="Add transaction"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Desktop Add Button */}
      <div className="hidden md:block fixed bottom-6 right-6">
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-full"
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </Button>
      </div>
    </div>
  );
}
