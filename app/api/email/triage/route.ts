import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase';
import { fetchEmails, getEmailBody } from '@/lib/gmail';
import { categorizeEmail } from '@/lib/anthropic';
import type { TriagedEmail, EmailMessage } from '@/types';

export async function GET(request: NextRequest) {
  try {
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

    // Check if accountId is in query params
    const accountId = request.nextUrl.searchParams.get('accountId');

    if (accountId) {
      // Fetch emails for a specific account
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

      // Fetch recent emails
      const emails = await fetchEmails(account.access_token, 20);

      if (emails.length === 0) {
        return NextResponse.json({ emails: [] });
      }

      // Get cached triage results
      const { data: cachedEmails } = await supabase
        .from('email_triage_cache')
        .select('gmail_id, category, summary, suggested_action')
        .eq('account_id', accountId)
        .eq('user_id', user.id);

      const cachedMap = new Map(
        (cachedEmails || []).map((e) => [e.gmail_id, e])
      );

      // Triage emails
      const triagePromises = emails.map(async (email) => {
        // Check cache first
        if (cachedMap.has(email.id)) {
          const cached = cachedMap.get(email.id)!;
          return {
            ...email,
            category: cached.category as any,
            summary: cached.summary || email.snippet,
            suggestedAction: cached.suggested_action || '',
            confidence: 0.95,
          } as TriagedEmail;
        }

        try {
          // Get full email body
          const fullBody = await getEmailBody(account.access_token, email.id);

          // Categorize email
          const emailWithBody: EmailMessage = {
            ...email,
            body: fullBody || email.snippet,
          };

          const triaged = await categorizeEmail(
            emailWithBody,
            account.context_note || 'Real estate agent assistant'
          );

          // Cache the result
          try {
            await createServiceClient()
              .from('email_triage_cache')
              .upsert(
                {
                  user_id: user.id,
                  account_id: accountId,
                  gmail_id: email.id,
                  category: triaged.category,
                  summary: triaged.summary,
                  suggested_action: triaged.suggestedAction,
                },
                { onConflict: 'gmail_id,account_id' }
              );
          } catch (cacheError) {
            console.error('Error caching triage result:', cacheError);
          }

          return triaged;
        } catch (error) {
          console.error('Error triaging email:', error);
          return {
            ...email,
            category: 'low_priority' as const,
            summary: email.snippet,
            suggestedAction: 'Review manually',
            confidence: 0.5,
          } as TriagedEmail;
        }
      });

      const triaged = await Promise.all(triagePromises);

      // Sort by priority
      const priorityMap: Record<string, number> = {
        urgent: 0,
        new_lead: 1,
        transaction_update: 2,
        follow_up: 3,
        low_priority: 4,
      };

      const sorted = triaged.sort(
        (a, b) => (priorityMap[a.category] || 5) - (priorityMap[b.category] || 5)
      );

      return NextResponse.json({ emails: sorted });
    } else {
      // Return list of user's email accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (accountsError) {
        return NextResponse.json(
          { error: 'Failed to fetch accounts' },
          { status: 500 }
        );
      }

      return NextResponse.json({ accounts: accounts || [] });
    }
  } catch (error) {
    console.error('Email triage error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Request failed',
      },
      { status: 500 }
    );
  }
}

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

    // Get email account
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

    // Fetch recent emails
    const emails = await fetchEmails(account.access_token, 20);

    if (emails.length === 0) {
      return NextResponse.json({ emails: [] });
    }

    // Get cached triage results
    const { data: cachedEmails } = await supabase
      .from('email_triage_cache')
      .select('gmail_id, category, summary, suggested_action')
      .eq('account_id', accountId)
      .eq('user_id', user.id);

    const cachedMap = new Map(
      (cachedEmails || []).map((e) => [e.gmail_id, e])
    );

    // Triage emails
    const triagePromises = emails.map(async (email) => {
      // Check cache first
      if (cachedMap.has(email.id)) {
        const cached = cachedMap.get(email.id)!;
        return {
          ...email,
          category: cached.category as any,
          summary: cached.summary || email.snippet,
          suggestedAction: cached.suggested_action || '',
          confidence: 0.95,
        } as TriagedEmail;
      }

      try {
        // Get full email body
        const fullBody = await getEmailBody(account.access_token, email.id);

        // Categorize email
        const emailWithBody: EmailMessage = {
          ...email,
          body: fullBody || email.snippet,
        };

        const triaged = await categorizeEmail(
          emailWithBody,
          account.context_note || 'Real estate agent assistant'
        );

        // Cache the result
        try {
          await createServiceClient()
            .from('email_triage_cache')
            .upsert(
              {
                user_id: user.id,
                account_id: accountId,
                gmail_id: email.id,
                category: triaged.category,
                summary: triaged.summary,
                suggested_action: triaged.suggestedAction,
              },
              { onConflict: 'gmail_id,account_id' }
            );
        } catch (cacheError) {
          console.error('Error caching triage result:', cacheError);
        }

        return triaged;
      } catch (error) {
        console.error('Error triaging email:', error);
        return {
          ...email,
          category: 'low_priority' as const,
          summary: email.snippet,
          suggestedAction: 'Review manually',
          confidence: 0.5,
        } as TriagedEmail;
      }
    });

    const triaged = await Promise.all(triagePromises);

    // Sort by priority
    const priorityMap: Record<string, number> = {
      urgent: 0,
      new_lead: 1,
      transaction_update: 2,
      follow_up: 3,
      low_priority: 4,
    };

    const sorted = triaged.sort(
      (a, b) => (priorityMap[a.category] || 5) - (priorityMap[b.category] || 5)
    );

    return NextResponse.json({ emails: sorted });
  } catch (error) {
    console.error('Email triage error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Email triage failed',
      },
      { status: 500 }
    );
  }
}
