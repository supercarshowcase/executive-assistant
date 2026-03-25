import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createPlainClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

async function getUser(request: NextRequest) {
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

function getServiceClient() {
  return createPlainClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function trashGmailMessage(accessToken: string, gmailId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}/trash`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { emailId } = body;

    if (!emailId) {
      return NextResponse.json({ error: 'emailId is required' }, { status: 400 });
    }

    const db = getServiceClient();

    // Get the triage cache entry
    const { data: triageEntry } = await db
      .from('email_triage_cache')
      .select('*')
      .eq('id', emailId)
      .single();

    if (!triageEntry) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // Get the email account for access token
    const { data: account } = await db
      .from('email_accounts')
      .select('*')
      .eq('id', triageEntry.account_id)
      .single();

    let gmailTrashed = false;

    if (account && triageEntry.gmail_id) {
      // Try to trash in Gmail
      gmailTrashed = await trashGmailMessage(account.access_token, triageEntry.gmail_id);

      // If failed, try refreshing token
      if (!gmailTrashed && account.refresh_token) {
        const newToken = await refreshAccessToken(account.refresh_token);
        if (newToken) {
          await db
            .from('email_accounts')
            .update({
              access_token: newToken,
              token_expires_at: new Date(Date.now() + 3600000).toISOString(),
            })
            .eq('id', account.id);
          gmailTrashed = await trashGmailMessage(newToken, triageEntry.gmail_id);
        }
      }
    }

    // Delete from triage cache
    await db
      .from('email_triage_cache')
      .delete()
      .eq('id', emailId);

    return NextResponse.json({
      success: true,
      gmailTrashed,
      message: gmailTrashed
        ? 'Email moved to Gmail trash and removed from inbox'
        : 'Email removed from inbox (Gmail trash may not have been applied)',
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
