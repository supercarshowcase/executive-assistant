import { createServerClient } from '@supabase/ssr';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { User, EmailAccount } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server-side client with cookie-based auth (for App Router server components & route handlers)
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll called from a Server Component — safe to ignore
        }
      },
    },
  });
}

// Server-side service client with admin privileges (no cookies needed)
export function createServiceClient() {
  return createPlainClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Get the currently authenticated user
export async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// Get user profile from our users table
export async function getUserProfile(userId: string): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

// Get all email accounts for a user
export async function getEmailAccounts(userId: string): Promise<EmailAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('user_id', userId);
  if (error) return [];
  return data || [];
}

// Get a specific email account
export async function getEmailAccount(userId: string, accountId: string): Promise<EmailAccount | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('id', accountId)
    .single();
  if (error) return null;
  return data;
}

// Update user profile
export async function updateUserProfile(userId: string, updates: Partial<User>): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) return null;
  return data;
}

// Upsert an email account
export async function upsertEmailAccount(userId: string, account: Partial<EmailAccount>): Promise<EmailAccount | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('email_accounts')
    .upsert({ ...account, user_id: userId }, { onConflict: 'user_id,email' })
    .select()
    .single();
  if (error) return null;
  return data;
}

// Delete an email account
export async function deleteEmailAccount(userId: string, accountId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('email_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('id', accountId);
  return !error;
}

// Logout the current user
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
