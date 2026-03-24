import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const userId = searchParams.get('state'); // We pass user_id as state

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.json(
        { error: 'Failed to obtain access token' },
        { status: 400 }
      );
    }

    // Get user email from Gmail API
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profileRes = await gmail.users.getProfile({ userId: 'me' });
    const userEmail = profileRes.data.emailAddress || '';

    // Store tokens in Supabase
    const supabase = createServiceClient();

    const { error: upsertError } = await supabase
      .from('email_accounts')
      .upsert(
        {
          user_id: userId,
          email: userEmail,
          label: 'Primary',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
        },
        { onConflict: 'user_id,email' }
      );

    if (upsertError) {
      console.error('Error storing email account:', upsertError);
      return NextResponse.json(
        { error: 'Failed to store email account' },
        { status: 500 }
      );
    }

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
