import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

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

    const adminSupabase = createServiceClient();

    // Check if user exists in our users table
    const { data: existingProfile } = await adminSupabase
      .from('users')
      .select('id, name, brokerage')
      .eq('email', email)
      .single();

    let userId: string;
    let hasCompletedOnboarding = false;

    if (existingProfile) {
      // Existing user
      userId = existingProfile.id;
      hasCompletedOnboarding = !!(existingProfile.name && existingProfile.brokerage);
    } else {
      // New user — create in Supabase Auth
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

    // Generate a magic link to create a proper Supabase session
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError || !linkData) {
      console.error('Error generating session link:', linkError);
      return NextResponse.redirect(new URL('/login?error=session_failed', request.url));
    }

    // Verify the OTP to establish a session (sets cookies automatically)
    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (verifyError) {
      console.error('Error establishing session:', verifyError);
      return NextResponse.redirect(new URL('/login?error=session_failed', request.url));
    }

    // Redirect based on onboarding status
    const redirectTo = hasCompletedOnboarding ? '/home' : '/onboarding';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/login?error=auth_failed', request.url)
    );
  }
}
