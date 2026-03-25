'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ReactNode } from 'react';
import {
  Home,
  Mail,
  Users,
  FileText,
  Library,
  Settings,
  LogOut,
} from 'lucide-react';
import { HealthBanner } from '@/components/ui/HealthBanner';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useUser } from '@/lib/hooks';
import { createBrowserClient } from '@/lib/supabase-browser';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: Home, label: 'Home', href: '/home', id: 'home' },
  { icon: Mail, label: 'Inbox', href: '/inbox', id: 'inbox' },
  { icon: Users, label: 'Leads', href: '/leads', id: 'leads' },
  { icon: FileText, label: 'Transactions', href: '/transactions', id: 'transactions' },
  { icon: Library, label: 'Content', href: '/content', id: 'content' },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, error } = useUser();
  const supabase = createBrowserClient();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const isActive = (href: string) => {
    if (href === '/home' && pathname === '/home') return true;
    if (href !== '/home' && pathname.startsWith(href)) return true;
    return false;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HealthBanner />

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Executive AI Pro</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-56px)] md:h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 p-4">
          <div className="mb-8">
            <h1 className="text-xl font-bold text-gray-900">
              Executive AI Pro
            </h1>
            <p className="text-xs text-gray-500 mt-1">AI-powered assistant</p>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-gray-200 pt-4 space-y-1">
            <Link
              href="/settings"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                isActive('/settings')
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Settings className={`w-5 h-5 ${isActive('/settings') ? 'text-blue-600' : ''}`} />
              Settings
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1 z-50">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                  active ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
