import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getEmailAccounts } from '@/lib/supabase';
import { fetchEmails } from '@/lib/gmail';
import { getTodayEvents } from '@/lib/calendar';
import type { HealthStatus } from '@/types';

interface AccountHealth {
  accountId: string;
  email: string;
  gmail: boolean;
  calendar: boolean;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  supabase: boolean;
  accounts: AccountHealth[];
  lastChecked: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id query parameter is required' },
        { status: 400 }
      );
    }

    // Test Supabase connection
    let supabaseHealthy = false;
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      supabaseHealthy = !error && !!data;
    } catch (error) {
      console.error('Supabase health check failed:', error);
    }

    // Get all email accounts for the user
    const emailAccounts = await getEmailAccounts(userId);
    const accounts: AccountHealth[] = [];

    // Test each email account
    for (const account of emailAccounts) {
      let gmailHealthy = false;
      let calendarHealthy = false;

      try {
        // Test Gmail connection by fetching 1 email
        const emails = await fetchEmails(account.accessToken, 1);
        gmailHealthy = emails.length >= 0; // Success if no error thrown
      } catch (error) {
        console.error(`Gmail health check failed for ${account.email}:`, error);
      }

      try {
        // Test Calendar connection by fetching today's events
        const events = await getTodayEvents(account.accessToken);
        calendarHealthy = Array.isArray(events); // Success if no error thrown
      } catch (error) {
        console.error(`Calendar health check failed for ${account.email}:`, error);
      }

      accounts.push({
        accountId: account.id,
        email: account.email,
        gmail: gmailHealthy,
        calendar: calendarHealthy,
      });
    }

    // Determine overall status
    const allAccountsHealthy = accounts.every((a) => a.gmail && a.calendar);
    const anyAccountsHealthy = accounts.some((a) => a.gmail || a.calendar);
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';

    if (supabaseHealthy && allAccountsHealthy) {
      status = 'healthy';
    } else if (supabaseHealthy && anyAccountsHealthy) {
      status = 'degraded';
    }

    const response: HealthResponse = {
      status,
      supabase: supabaseHealthy,
      accounts,
      lastChecked: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: status === 'healthy' ? 200 : status === 'degraded' ? 206 : 503,
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        supabase: false,
        accounts: [],
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
