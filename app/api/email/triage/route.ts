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

// Refresh Google access token
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

// Fetch email metadata from Gmail
async function fetchGmailMetadata(
  accessToken: string,
  gmailId: string
): Promise<{ from: string; subject: string; snippet: string; date: string } | null> {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) return null;
    const data = await response.json();

    const headers = data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      from: getHeader('From'),
      subject: getHeader('Subject'),
      snippet: data.snippet || '',
      date: getHeader('Date'),
    };
  } catch {
    return null;
  }
}

// Decode HTML entities
function decodeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

function mapTriaged(row: any) {
  return {
    id: row.id,
    accountId: row.account_id,
    gmailId: row.gmail_id,
    from: row.from_address || '',
    subject: row.subject || '',
    snippet: decodeHtml(row.snippet || ''),
    body: '',
    to: '',
    isRead: true,
    threadId: '',
    date: row.received_at || row.created_at,
    category: row.category || 'low_priority',
    summary: decodeHtml(row.summary || ''),
    suggestedAction: decodeHtml(row.suggested_action || ''),
    confidence: 0.8,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = getServiceClient();
    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId');

    // Get user's email accounts with tokens
    const { data: accounts } = await db
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id);

    const accountIds = (accounts || []).map((a: any) => a.id);
    if (accountIds.length === 0) {
      return NextResponse.json({ emails: [], message: 'No email accounts connected' });
    }

    // Filter by specific account if provided
    const filterIds = accountId ? [accountId] : accountIds;

    const { data, error } = await db
      .from('email_triage_cache')
      .select('*')
      .in('account_id', filterIds)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data || [];

    // Check if any rows are missing Gmail metadata (from_address, subject)
    const needsGmailFetch = rows.filter((r: any) => !r.from_address || !r.subject);

    if (needsGmailFetch.length > 0 && accounts && accounts.length > 0) {
      // Try to add columns if they don't exist (safe to run multiple times)
      try {
        await db.rpc('exec_sql', {
          query: `
            DO $$ BEGIN
              ALTER TABLE email_triage_cache ADD COLUMN IF NOT EXISTS from_address TEXT;
              ALTER TABLE email_triage_cache ADD COLUMN IF NOT EXISTS subject TEXT;
              ALTER TABLE email_triage_cache ADD COLUMN IF NOT EXISTS snippet TEXT;
              ALTER TABLE email_triage_cache ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
            EXCEPTION WHEN OTHERS THEN NULL;
            END $$;
          `
        });
      } catch {
        // RPC might not exist, try direct column addition via individual queries
        // This is best-effort - columns may already exist
      }

      // Try to fetch Gmail metadata for rows missing it
      const accountTokenMap = new Map<string, { access: string; refresh: string }>();
      for (const acc of accounts) {
        accountTokenMap.set(acc.id, {
          access: acc.access_token,
          refresh: acc.refresh_token,
        });
      }

      // Fetch Gmail data in parallel (max 10 at a time)
      const batch = needsGmailFetch.slice(0, 10);
      const updates = await Promise.all(
        batch.map(async (row: any) => {
          const tokens = accountTokenMap.get(row.account_id);
          if (!tokens) return null;

          let metadata = await fetchGmailMetadata(tokens.access, row.gmail_id);

          // If failed, try refreshing token
          if (!metadata && tokens.refresh) {
            const newToken = await refreshAccessToken(tokens.refresh);
            if (newToken) {
              // Update the stored access token
              await db
                .from('email_accounts')
                .update({ access_token: newToken, token_expires_at: new Date(Date.now() + 3600000).toISOString() })
                .eq('id', row.account_id);
              tokens.access = newToken;
              metadata = await fetchGmailMetadata(newToken, row.gmail_id);
            }
          }

          if (metadata) {
            // Update the cache row
            try {
              await db
                .from('email_triage_cache')
                .update({
                  from_address: metadata.from,
                  subject: metadata.subject,
                  snippet: metadata.snippet,
                  received_at: metadata.date ? new Date(metadata.date).toISOString() : null,
                })
                .eq('id', row.id);
            } catch {
              // Column might not exist yet, that's ok
            }

            // Update the row in memory for this response
            row.from_address = metadata.from;
            row.subject = metadata.subject;
            row.snippet = metadata.snippet;
            row.received_at = metadata.date ? new Date(metadata.date).toISOString() : null;
          }

          return row;
        })
      );
    }

    return NextResponse.json({ emails: rows.map(mapTriaged) });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
