import { NextRequest, NextResponse } from 'next/server';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${APP_URL}/api/auth/callback/google`
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }

    // Exchange authorization code for tokens (includes id_token)
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.id_token) {
      console.error('No id_token received from Google');
      return NextResponse.redirect(new URL('/login?error=no_id_token', request.url));
    }

    // Get user info from Google for profile creation
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();
    const email = googleUser.email || '';
    const name = googleUser.name || '';

    if (!email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url));
    }

    // Determine redirect destination before creating the response
    // Check if user profile exists and has completed onboarding
    const adminSupabase = createPlainClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingProfile } = await adminSupabase
      .from('users')
      .select('id, name, brokerage')
      .eq('email', email)
      .single();

    const hasCompletedOnboarding = !!(existingProfile?.name && existingProfile?.brokerage);
    const redirectTo = hasCompletedOnboarding ? '/home' : '/onboarding';

    // Create the redirect response FIRST so we can attach cookies to it
    const response = NextResponse.redirect(new URL(redirectTo, request.url));

    // Create Supabase SSR client that writes session cookies onto the response
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name: cookieName, value, options }) => {
            response.cookies.set(cookieName, value, options);
          });
        },
      },
    });

    // Sign in with the Google ID token — this creates a Supabase session
    // and sets auth cookies on the response via the setAll callback
    const { data: signInData, error: signInError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: tokens.id_token,
      access_token: tokens.access_token || undefined,
    });

    if (signInError) {
      console.error('Error signing in with ID token:', signInError);
      return NextResponse.redirect(new URL(`/login?error=signin_failed&msg=${encodeURIComponent(signInError.message)}`, request.url));
    }

    const userId = signInData.user?.id;

    if (!userId) {
      return NextResponse.redirect(new URL('/login?error=no_user', request.url));
    }

    // Ensure user profile row exists in our users table
    if (!existingProfile) {
      await adminSupabase.from('users').upsert({
        id: userId,
        email,
        name,
      }, { onConflict: 'id' });
    }

    // Store Google OAuth tokens for Gmail/Calendar access
    if (tokens.access_token) {
      const domain = email.split('@')[1] || '';
      await adminSupabase
        .from('email_accounts')
        .upsert(
          {
            user_id: userId,
            email,
            label: domain.includes('gmail') ? 'Gmail' : 'Work',
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            token_expires_at: tokens.expiry_date
              ? new Date(tokens.expiry_date).toISOString()
              : null,
          },
          { onConflict: 'user_id,email' }
        );
    }

    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/login?error=auth_failed&msg=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
