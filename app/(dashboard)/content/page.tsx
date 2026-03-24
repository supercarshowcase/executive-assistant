'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, Copy, Check, Sparkles, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAsync, useDebounce } from '@/lib/hooks';
import { useUser } from '@/lib/hooks';
import type { ContentItem } from '@/types';

const CATEGORIES = [
  'All',
  'Social Media',
  'Email Templates',
  'Listing Scripts',
  'Buyer Scripts',
  'Seller Scripts',
  'Objection Handlers',
  'Open House Follow-up',
  'Market Updates',
];

interface AddContentForm {
  title: string;
  category: string;
  tags: string;
  body: string;
}

const initialFormState: AddContentForm = {
  title: '',
  category: 'Social Media',
  tags: '',
  body: '',
};

export default function ContentPage() {
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<ContentItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddContentForm>(initialFormState);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [personalizedContent, setPersonalizedContent] = useState<{
    itemId: string;
    title: string;
    body: string;
  } | null>(null);
  const [isPersonalizing, setIsPersonalizing] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Fetch content
  const {
    data: content = [],
    status: contentStatus,
    execute: refetchContent,
  } = useAsync(async () => {
    const response = await fetch('/api/content');
    if (!response.ok) throw new Error('Failed to fetch content');
    return response.json();
  }, true);

  // Filter content
  const filteredContent = useMemo(() => {
    return (content as ContentItem[]).filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        item.body.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        item.tags.some((tag) =>
          tag.toLowerCase().includes(debouncedQuery.toLowerCase())
        );

      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [content, debouncedQuery, selectedCategory]);

  // Get new items
  const newItems = useMemo(() => {
    return (content as ContentItem[]).filter((item) => item.isNew);
  }, [content]);

  const handleAddContent = useCallback(async () => {
    if (!addForm.title || !addForm.body) {
      alert('Please fill in title and body');
      return;
    }

    try {
      const response = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addForm,
          tags: addForm.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag),
        }),
      });

      if (!response.ok) throw new Error('Failed to add content');

      setAddForm(initialFormState);
      setIsAddModalOpen(false);
      refetchContent();
    } catch (error) {
      console.error('Error adding content:', error);
      alert('Failed to add content');
    }
  }, [addForm, refetchContent]);

  const handleCopyContent = useCallback((itemId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedItemId(itemId);
    setTimeout(() => setCopiedItemId(null), 2000);
  }, []);

  const handlePersonalize = useCallback(
    async (item: ContentItem) => {
      if (!user) return;

      setIsPersonalizing(true);
      try {
        const response = await fetch('/api/ai/personalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId: item.id,
            content: item.body,
            context: {
              userTitle: user.name,
              brokerage: user.brokerage,
              city: user.city,
            },
          }),
        });

        if (!response.ok) throw new Error('Failed to personalize content');

        const data = await response.json();
        setPersonalizedContent({
          itemId: item.id,
          title: item.title,
          body: data.personalizedContent,
        });
      } catch (error) {
        console.error('Error personalizing content:', error);
        alert('Failed to personalize content');
      } finally {
        setIsPersonalizing(false);
      }
    },
    [user]
  );

  if (contentStatus === 'pending') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // Premium gate
  if (!user?.isPremium) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Lock className="w-12 h-12 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Premium Feature
            </h2>
            <p className="text-gray-600 mb-6">
              The Content Library is exclusively available for premium subscribers.
              Unlock professionally crafted templates, scripts, and resources to boost
              your productivity.
            </p>
            <Button className="w-full">
              Upgrade to Premium
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Content Library
          </h1>

          {/* Search */}
          <div className="mb-4">
            <SearchInput
              placeholder="Search content by title, tags..."
              onSearch={setSearchQuery}
              className="w-full"
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* New This Month Section */}
        {newItems.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-gray-900">New This Month</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {newItems.slice(0, 3).map((item) => (
                <Card
                  key={item.id}
                  onClick={() => {
                    setExpandedItemId(item.id);
                    setExpandedItem(item);
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-gray-900 text-sm flex-1">
                      {item.title}
                    </h3>
                    <Badge variant="default" className="bg-amber-100 text-amber-800 flex-shrink-0">
                      New
                    </Badge>
                  </div>
                  <Badge variant="default" className="mb-2">
                    {item.category}
                  </Badge>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {item.body.substring(0, 100)}...
                  </p>
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {item.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Content */}
        {filteredContent.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No content found"
            description={
              debouncedQuery
                ? 'No content matches your search.'
                : 'No content in this category yet.'
            }
          />
        ) : (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {selectedCategory === 'All' ? 'All Content' : selectedCategory}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContent.map((item) => (
                <Card
                  key={item.id}
                  onClick={() => {
                    setExpandedItemId(item.id);
                    setExpandedItem(item);
                  }}
                  className="cursor-pointer flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-gray-900 text-sm flex-1 line-clamp-2">
                      {item.title}
                    </h3>
                    {item.isNew && (
                      <Badge variant="default" className="bg-amber-100 text-amber-800 flex-shrink-0 text-xs">
                        New
                      </Badge>
                    )}
                  </div>

                  <Badge variant="default" className="mb-2 w-fit">
                    {item.category}
                  </Badge>

                  <p className="text-sm text-gray-600 line-clamp-2 flex-1">
                    {item.body.substring(0, 100)}...
                  </p>

                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {item.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 2 && (
                        <span className="text-xs text-gray-500">
                          +{item.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expand Content Modal */}
      <Modal
        isOpen={expandedItemId !== null}
        onClose={() => {
          setExpandedItemId(null);
          setExpandedItem(null);
        }}
        title={expandedItem?.title}
        size="lg"
      >
        {expandedItem && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="default">{expandedItem.category}</Badge>
                {expandedItem.isNew && (
                  <Badge variant="default" className="bg-amber-100 text-amber-800">
                    New
                  </Badge>
                )}
              </div>
            </div>

            {expandedItem.tags.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-900 mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {expandedItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Content</p>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-900 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {expandedItem.body}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setExpandedItemId(null);
                  setExpandedItem(null);
                }}
                className="flex-1"
              >
                Close
              </Button>

              <Button
                variant="secondary"
                onClick={() =>
                  handleCopyContent(expandedItem.id, expandedItem.body)
                }
                className="flex-1"
              >
                {copiedItemId === expandedItem.id ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>

              <Button
                onClick={() => handlePersonalize(expandedItem)}
                isLoading={isPersonalizing}
                className="flex-1"
              >
                <Sparkles className="w-4 h-4" />
                Personalize
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Personalized Content Modal */}
      <Modal
        isOpen={personalizedContent !== null}
        onClose={() => setPersonalizedContent(null)}
        title={`Personalized: ${personalizedContent?.title}`}
        size="lg"
      >
        {personalizedContent && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">
                Personalized Content
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-900 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {personalizedContent.body}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setPersonalizedContent(null)}
                className="flex-1"
              >
                Close
              </Button>

              <Button
                onClick={() => {
                  handleCopyContent(
                    personalizedContent.itemId,
                    personalizedContent.body
                  );
                }}
                className="flex-1"
              >
                {copiedItemId === personalizedContent.itemId ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Content Modal (Admin Only) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddForm(initialFormState);
        }}
        title="Add Content"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={addForm.title}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Content title"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Category
            </label>
            <select
              value={addForm.category}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, category: e.target.value }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.filter((c) => c !== 'All').map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={addForm.tags}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, tags: e.target.value }))
              }
              placeholder="tag1, tag2, tag3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Body *
            </label>
            <textarea
              value={addForm.body}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, body: e.target.value }))
              }
              placeholder="Content body..."
              rows={8}
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
            <Button onClick={handleAddContent} className="flex-1">
              Add Content
            </Button>
          </div>
        </div>
      </Modal>

      {/* Floating Action Button (Admin) */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center md:hidden"
        aria-label="Add content"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Desktop Add Button (Admin) */}
      <div className="hidden md:block fixed bottom-6 right-6">
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-full"
        >
          <Plus className="w-4 h-4" />
          Add Content
        </Button>
      </div>
    </div>
  );
}
