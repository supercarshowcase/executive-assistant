'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, Search, Phone, Calendar, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { VoiceInput } from '@/components/ui/VoiceInput';
import { useAsync, useDebounce } from '@/lib/hooks';
import type { Lead } from '@/types';

const PIPELINE_STAGES: Array<Lead['stage']> = [
  'new',
  'contacted',
  'active',
  'under_contract',
  'closed',
  'dead',
];

const STAGE_LABELS: Record<Lead['stage'], string> = {
  new: 'New',
  contacted: 'Contacted',
  active: 'Active',
  under_contract: 'Under Contract',
  closed: 'Closed',
  dead: 'Dead',
};

const STAGE_COLORS: Record<Lead['stage'], string> = {
  new: 'bg-blue-50 border-blue-200',
  contacted: 'bg-indigo-50 border-indigo-200',
  active: 'bg-green-50 border-green-200',
  under_contract: 'bg-amber-50 border-amber-200',
  closed: 'bg-purple-50 border-purple-200',
  dead: 'bg-gray-50 border-gray-200',
};

interface AddLeadForm {
  name: string;
  email: string;
  phone: string;
  leadType: 'buyer' | 'seller';
  notes: string;
  followUpDate: string;
}

const initialFormState: AddLeadForm = {
  name: '',
  email: '',
  phone: '',
  leadType: 'buyer',
  notes: '',
  followUpDate: '',
};

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'buyer' | 'seller'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddLeadForm>(initialFormState);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Lead | null>(null);
  const [moveMenuLeadId, setMoveMenuLeadId] = useState<string | null>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Fetch leads
  const {
    data: leads = [],
    status: leadsStatus,
    execute: refetchLeads,
  } = useAsync(async () => {
    const response = await fetch('/api/leads');
    if (!response.ok) throw new Error('Failed to fetch leads');
    return response.json();
  }, true);

  // Filter and search leads
  const filteredLeads = useMemo(() => {
    return ((leads || []) as Lead[]).filter((lead) => {
      const matchesSearch =
        lead.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        lead.phone.includes(debouncedQuery);

      const matchesType =
        filterType === 'all' || lead.leadType === filterType;

      return matchesSearch && matchesType;
    });
  }, [leads, debouncedQuery, filterType]);

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped: Record<Lead['stage'], Lead[]> = {
      new: [],
      contacted: [],
      active: [],
      under_contract: [],
      closed: [],
      dead: [],
    };

    filteredLeads.forEach((lead) => {
      grouped[lead.stage].push(lead);
    });

    return grouped;
  }, [filteredLeads]);

  // Count leads by stage (unfiltered for display)
  const stagesCounts = useMemo(() => {
    const counts: Record<Lead['stage'], number> = {
      new: 0,
      contacted: 0,
      active: 0,
      under_contract: 0,
      closed: 0,
      dead: 0,
    };

    ((leads || []) as Lead[]).forEach((lead) => {
      counts[lead.stage]++;
    });

    return counts;
  }, [leads]);

  const handleAddLead = useCallback(async () => {
    if (!addForm.name || !addForm.email || !addForm.phone) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });

      if (!response.ok) throw new Error('Failed to add lead');

      setAddForm(initialFormState);
      setIsAddModalOpen(false);
      refetchLeads();
    } catch (error) {
      console.error('Error adding lead:', error);
      alert('Failed to add lead');
    }
  }, [addForm, refetchLeads]);

  const handleUpdateLead = useCallback(async () => {
    if (!editForm) return;

    try {
      const response = await fetch(`/api/leads/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) throw new Error('Failed to update lead');

      setEditingLeadId(null);
      setEditForm(null);
      setExpandedLeadId(null);
      refetchLeads();
    } catch (error) {
      console.error('Error updating lead:', error);
      alert('Failed to update lead');
    }
  }, [editForm, refetchLeads]);

  const handleMoveLead = useCallback(
    async (leadId: string, newStage: Lead['stage']) => {
      const lead = ((leads || []) as Lead[]).find((l) => l.id === leadId);
      if (!lead) return;

      try {
        const response = await fetch(`/api/leads/${leadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...lead, stage: newStage }),
        });

        if (!response.ok) throw new Error('Failed to move lead');

        setMoveMenuLeadId(null);
        refetchLeads();
      } catch (error) {
        console.error('Error moving lead:', error);
        alert('Failed to move lead');
      }
    },
    [leads, refetchLeads]
  );

  const handleSetFollowUp = useCallback(async (leadId: string) => {
    if (!editForm?.followUpDate) {
      alert('Please select a follow-up date');
      return;
    }

    try {
      const response = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          scheduledDate: editForm.followUpDate,
          draftBody: `Follow-up with ${editForm.name}`,
        }),
      });

      if (!response.ok) throw new Error('Failed to set follow-up');

      alert('Follow-up reminder set!');
      setEditForm(null);
      setEditingLeadId(null);
    } catch (error) {
      console.error('Error setting follow-up:', error);
      alert('Failed to set follow-up');
    }
  }, [editForm]);

  const handleVoiceInput = useCallback(
    (field: keyof AddLeadForm, text: string) => {
      setAddForm((prev) => ({
        ...prev,
        [field]: (prev[field] + ' ' + text).trim(),
      }));
    },
    []
  );

  if (leadsStatus === 'pending') {
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
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Lead Pipeline
          </h1>

          {/* Search and Filters */}
          <div className="space-y-3">
            <SearchInput
              placeholder="Search by name, email, or phone..."
              onSearch={setSearchQuery}
              className="w-full"
            />

            <div className="flex gap-2 overflow-x-auto pb-2">
              {(['all', 'buyer', 'seller'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    filterType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type === 'all' ? 'All Leads' : type === 'buyer' ? 'Buyers' : 'Sellers'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Board */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredLeads.length === 0 && debouncedQuery === '' && filterType === 'all' ? (
          <EmptyState
            icon="ð¼"
            title="No leads yet"
            description="New leads will appear automatically when inquiry emails are detected. You can also add leads manually."
            action={
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-4"
              >
                <Plus className="w-4 h-4" />
                Add Your First Lead
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 min-w-max md:min-w-full">
              {PIPELINE_STAGES.map((stage) => (
                <div key={stage} className="flex-shrink-0 w-full md:flex-1">
                  {/* Column Header */}
                  <div className={`rounded-t-xl border-2 ${STAGE_COLORS[stage]} p-3 md:p-4`}>
                    <h2 className="font-semibold text-gray-900 text-sm md:text-base">
                      {STAGE_LABELS[stage]}
                    </h2>
                    <p className="text-xs text-gray-600 mt-1">
                      {stagesCounts[stage]} leads
                    </p>
                  </div>

                  {/* Column Content */}
                  <div className={`border-2 border-t-0 ${STAGE_COLORS[stage]} rounded-b-xl p-3 md:p-4 min-h-96 md:min-h-screen`}>
                    <div className="space-y-2">
                      {leadsByStage[stage].map((lead) => (
                        <div key={lead.id} className="relative">
                          <Card
                            onClick={() => {
                              setExpandedLeadId(lead.id);
                              setEditForm(lead);
                            }}
                            className="cursor-pointer"
                            padding="sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm truncate">
                                  {lead.name}
                                </p>
                                <Badge
                                  variant={lead.leadType}
                                  className="mt-1"
                                >
                                  {lead.leadType === 'buyer' ? 'Buyer' : 'Seller'}
                                </Badge>
                                {lead.phone && (
                                  <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {lead.phone}
                                  </p>
                                )}
                                {lead.lastContactDate && (
                                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(lead.lastContactDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMoveMenuLeadId(
                                      moveMenuLeadId === lead.id ? null : lead.id
                                    );
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                                  aria-label="Move lead"
                                >
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                </button>
                                {moveMenuLeadId === lead.id && (
                                  <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-40">
                                    <div className="py-1">
                                      {PIPELINE_STAGES.filter(
                                        (s) => s !== lead.stage
                                      ).map((newStage) => (
                                        <button
                                          key={newStage}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveLead(
                                              lead.id,
                                              newStage
                                            );
                                          }}
                                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                        >
                                          {STAGE_LABELS[newStage]}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Card>
                        </div>
                      ))}

                      {leadsByStage[stage].length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          No leads
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddForm(initialFormState);
        }}
        title="Add Lead"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={addForm.name}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Lead name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={addForm.email}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="email@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Phone *
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={addForm.phone}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="(555) 123-4567"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <VoiceInput
                onTranscript={(text) => handleVoiceInput('phone', text)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Lead Type
            </label>
            <div className="flex gap-4">
              {(['buyer', 'seller'] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={type}
                    checked={addForm.leadType === type}
                    onChange={(e) =>
                      setAddForm((prev) => ({
                        ...prev,
                        leadType: e.target.value as 'buyer' | 'seller',
                      }))
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {type}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Notes
            </label>
            <textarea
              value={addForm.notes}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Any notes about this lead..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Follow-up Date
            </label>
            <input
              type="date"
              value={addForm.followUpDate}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  followUpDate: e.target.value,
                }))
              }
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
            <Button
              onClick={handleAddLead}
              className="flex-1"
            >
              Add Lead
            </Button>
          </div>
        </div>
      </Modal>

      {/* Expand Lead Modal */}
      <Modal
        isOpen={expandedLeadId !== null}
        onClose={() => {
          setExpandedLeadId(null);
          setEditingLeadId(null);
          setEditForm(null);
        }}
        title={editForm ? `Lead: ${editForm.name}` : 'Lead Details'}
        size="lg"
      >
        {editForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Name
                </label>
                {editingLeadId === editForm.id ? (
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, name: e.target.value } : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{editForm.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Email
                </label>
                {editingLeadId === editForm.id ? (
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, email: e.target.value } : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{editForm.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Phone
                </label>
                {editingLeadId === editForm.id ? (
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, phone: e.target.value } : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">{editForm.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Type
                </label>
                {editingLeadId === editForm.id ? (
                  <select
                    value={editForm.leadType}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              leadType: e.target.value as 'buyer' | 'seller',
                            }
                          : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="buyer">Buyer</option>
                    <option value="seller">Seller</option>
                  </select>
                ) : (
                  <Badge variant={editForm.leadType}>
                    {editForm.leadType === 'buyer' ? 'Buyer' : 'Seller'}
                  </Badge>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Stage
                </label>
                {editingLeadId === editForm.id ? (
                  <select
                    value={editForm.stage}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              stage: e.target.value as Lead['stage'],
                            }
                          : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PIPELINE_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {STAGE_LABELS[stage]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge variant="default">{STAGE_LABELS[editForm.stage]}</Badge>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Last Contact
                </label>
                {editingLeadId === editForm.id ? (
                  <input
                    type="date"
                    value={
                      editForm.lastContactDate
                        ? editForm.lastContactDate.split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, lastContactDate: e.target.value }
                          : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900">
                    {editForm.lastContactDate
                      ? new Date(editForm.lastContactDate).toLocaleDateString()
                      : 'Never'}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Notes
              </label>
              {editingLeadId === editForm.id ? (
                <textarea
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, notes: e.target.value } : null
                    )
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 whitespace-pre-wrap">
                  {editForm.notes || 'No notes'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Follow-up Date
              </label>
              {editingLeadId === editForm.id ? (
                <input
                  type="date"
                  value={
                    editForm.followUpDate
                      ? editForm.followUpDate.split('T')[0]
                      : ''
                  }
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, followUpDate: e.target.value } : null
                    )
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">
                  {editForm.followUpDate
                    ? new Date(editForm.followUpDate).toLocaleDateString()
                    : 'Not set'}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setExpandedLeadId(null);
                  setEditingLeadId(null);
                  setEditForm(null);
                }}
                className="flex-1"
              >
                Close
              </Button>

              {editingLeadId === editForm.id ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setEditingLeadId(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateLead} className="flex-1">
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setEditingLeadId(editForm.id)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleSetFollowUp(editForm.id)}
                    className="flex-1"
                  >
                    Set Follow-Up
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center md:hidden"
        aria-label="Add lead"
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
          Add Lead
        </Button>
      </div>
    </div>
  );
}
