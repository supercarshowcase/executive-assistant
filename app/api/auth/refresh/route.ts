import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: 'account_id is required' },
        { status: 400 }
      );
    }

    // Get current user
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get email account with refresh token
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      );
    }

    if (!account.refresh_token) {
      return NextResponse.json(
        { error: 'No refresh token available for this account' },
        { status: 400 }
      );
    }

    // Refresh the access token
    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      return NextResponse.json(
        { error: 'Failed to refresh access token' },
        { status: 500 }
      );
    }

    // Update token in database
    const serviceClient = createServiceClient();
    const { error: updateError } = await serviceClient
      .from('email_accounts')
      .update({
        access_token: credentials.access_token,
        token_expires_at: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    if (updateError) {
      console.error('Error updating token:', updateError);
      return NextResponse.json(
        { error: 'Failed to update token in database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      accessToken: credentials.access_token,
      expiresIn: credentials.expiry_date
        ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
        : 3600,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Token refresh failed',
      },
      { status: 500 }
    );
  }
}
