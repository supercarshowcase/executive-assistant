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
import { createBrowserClient } from '@/lib/supabase';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: Home, label: 'Home', href: '/', id: 'home' },
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
    if (href === '/' && pathname === '/') return true;
    if (href !== '/' && pathname.startsWith(href)) return true;
    return false;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Will be redirected to login if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Health Banner */}
      <HealthBanner />

      {/* Desktop Side Navigation */}
      <div className="hidden md:fixed md:left-0 md:top-0 md:h-screen md:w-64 md:bg-white md:border-r md:border-gray-200 md:flex md:flex-col md:shadow-sm z-50">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">Executive AI</h1>
          <p className="text-xs text-gray-500 mt-1">Pro Assistant</p>
        </div>

        {/* User Section */}
        {user && !loading && (
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-blue-600">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm
                  transition-all duration-200
                  ${
                    active
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Navigation */}
        <div className="px-4 py-4 border-t border-gray-200 space-y-2">
          <Link
            href="/settings"
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm
              transition-all duration-200
              ${
                isActive('/settings')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="md:ml-64 min-h-screen flex flex-col">
        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around h-20 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center w-14 h-14 rounded-lg
                  transition-all duration-200
                  ${
                    active
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
