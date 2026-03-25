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

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    const email = googleUser.email;
    const name = googleUser.name || '';
    const picture = googleUser.picture || '';

    if (!email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url));
    }

    // Admin client for user management
    const adminSupabase = createPlainClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user exists in our users table
    const { data: existingProfile } = await adminSupabase
      .from('users')
      .select('id, name, brokerage')
      .eq('email', email)
      .single();

    let userId: string;
    let hasCompletedOnboarding = false;

    if (existingProfile) {
      userId = existingProfile.id;
      hasCompletedOnboarding = !!(existingProfile.name && existingProfile.brokerage);
    } else {
      // Create new user in Supabase Auth
      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name, avatar_url: picture },
      });

      if (createError || !newUser.user) {
        console.error('Error creating user:', createError);
        return NextResponse.redirect(new URL('/login?error=create_failed', request.url));
      }

      userId = newUser.user.id;

      // Create user profile row
      await adminSupabase.from('users').insert({
        id: userId,
        email,
        name,
      });
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

    // Generate a magic link to create a Supabase session
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError || !linkData) {
      console.error('Error generating session link:', linkError);
      return NextResponse.redirect(new URL('/login?error=link_failed', request.url));
    }

    // Determine redirect destination
    const redirectTo = hasCompletedOnboarding ? '/home' : '/onboarding';

    // Create the redirect response FIRST
    const response = NextResponse.redirect(new URL(redirectTo, request.url));

    // Create a Supabase SSR client that writes cookies to the response
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // Verify OTP to establish session — this sets auth cookies on the response
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (verifyError) {
      console.error('Error establishing session:', verifyError);
      return NextResponse.redirect(new URL('/login?error=session_failed', request.url));
    }

    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/login?error=auth_failed', request.url)
    );
  }
}
