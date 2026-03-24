import { createClient as createServerClient } from '@supabase/supabase-js';
import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User, EmailAccount } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server-side client using SSR with cookies
export async function createClient() {
  const cookieStore = await cookies();

  return createSupabaseBrowserClient({
    supabaseUrl,
    supabaseKey: supabaseAnonKey,
    options: {
      auth: {
        storage: {
          getItem: (key: string) => {
            return cookieStore.get(key)?.value ?? null;
          },
          setItem: (key: string, value: string) => {
            cookieStore.set(key, value);
          },
          removeItem: (key: string) => {
            cookieStore.delete(key);
          },
        },
      },
    },
  });
}

// Browser/client-side client
export function createBrowserClient() {
  return createSupabaseBrowserClient({
    supabaseUrl,
    supabaseKey: supabaseAnonKey,
  });
}

// Server-side service client with admin privileges
export function createServiceClient() {
  return createServerClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Get current authenticated user
export async function getUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('Error getting user:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
}

// Get user profile from database
export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data as User;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
}

// Get all email accounts for a user
export async function getEmailAccounts(userId: string): Promise<EmailAccount[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching email accounts:', error);
      return [];
    }

    return (data || []) as EmailAccount[];
  } catch (error) {
    console.error('Failed to get email accounts:', error);
    return [];
  }
}

// Get a single email account
export async function getEmailAccount(
  userId: string,
  accountId: string
): Promise<EmailAccount | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('id', accountId)
      .single();

    if (error) {
      console.error('Error fetching email account:', error);
      return null;
    }

    return data as EmailAccount;
  } catch (error) {
    console.error('Failed to get email account:', error);
    return null;
  }
}

// Update user profile
export async function updateUserProfile(
  userId: string,
  updates: Partial<User>
): Promise<User | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }

    return data as User;
  } catch (error) {
    console.error('Failed to update user profile:', error);
    return null;
  }
}

// Upsert email account
export async function upsertEmailAccount(
  userId: string,
  account: Partial<EmailAccount>
): Promise<EmailAccount | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('email_accounts')
      .upsert(
        {
          ...account,
          user_id: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error upserting email account:', error);
      return null;
    }

    return data as EmailAccount;
  } catch (error) {
    console.error('Failed to upsert email account:', error);
    return null;
  }
}

// Delete email account
export async function deleteEmailAccount(
  userId: string,
  accountId: string
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('email_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('id', accountId);

    if (error) {
      console.error('Error deleting email account:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete email account:', error);
    return false;
  }
}

// Logout user
export async function logout() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Error signing out:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to logout:', error);
    return false;
  }
}
