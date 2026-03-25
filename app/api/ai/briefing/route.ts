import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createPlainClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase SSR client to read session from cookies
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Use service client for DB queries (bypasses RLS for reliability)
    const adminSupabase = createPlainClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch user profile
    const { data: profile } = await adminSupabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // Fetch email accounts
    const { data: emailAccounts } = await adminSupabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', user.id);

    // Fetch stale leads (no contact in 7+ days, not closed/dead)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: staleLeads } = await adminSupabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .not('stage', 'in', '("closed","dead")')
      .or(`last_contact_date.is.null,last_contact_date.lt.${sevenDaysAgo.toISOString()}`)
      .order('last_contact_date', { ascending: true, nullsFirst: true })
      .limit(5);

    // Fetch upcoming deadlines (transactions with closing dates in next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { data: upcomingDeadlines } = await adminSupabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .not('status', 'eq', 'closed')
      .gte('closing_date', now.toISOString())
      .lte('closing_date', thirtyDaysFromNow.toISOString())
      .order('closing_date', { ascending: true })
      .limit(5);

    // Build the briefing response
    const briefing = {
      summary: buildSummary(profile, emailAccounts, staleLeads, upcomingDeadlines),
      urgentEmails: [],
      todayEvents: [],
      staleLeads: (staleLeads || []).map(mapLead),
      upcomingDeadlines: (upcomingDeadlines || []).map(mapTransaction),
    };

    // Try to generate AI summary if Anthropic key is available
    if (anthropicApiKey) {
      try {
        const aiSummary = await generateAISummary(
          profile,
          emailAccounts || [],
          staleLeads || [],
          upcomingDeadlines || []
        );
        if (aiSummary) {
          briefing.summary = aiSummary;
        }
      } catch (aiErr) {
        console.error('AI summary generation failed, using fallback:', aiErr);
      }
    }

    return NextResponse.json(briefing);
  } catch (error) {
    console.error('Briefing API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate briefing' },
      { status: 500 }
    );
  }
}

function buildSummary(
  profile: any,
  emailAccounts: any[] | null,
  staleLeads: any[] | null,
  upcomingDeadlines: any[] | null
): string {
  const parts: string[] = [];
  const name = profile?.name?.split(' ')[0] || 'there';

  parts.push(`Good day, ${name}.`);

  const accountCount = emailAccounts?.length || 0;
  if (accountCount > 0) {
    parts.push(`You have ${accountCount} email account${accountCount > 1 ? 's' : ''} connected.`);
  }

  const staleCount = staleLeads?.length || 0;
  if (staleCount > 0) {
    parts.push(`You have ${staleCount} lead${staleCount > 1 ? 's' : ''} that may need follow-up.`);
  }

  const deadlineCount = upcomingDeadlines?.length || 0;
  if (deadlineCount > 0) {
    parts.push(`There are ${deadlineCount} upcoming transaction deadline${deadlineCount > 1 ? 's' : ''} in the next 30 days.`);
  }

  if (staleCount === 0 && deadlineCount === 0) {
    parts.push('Everything looks clear — a great day to prospect or follow up with clients!');
  }

  return parts.join(' ');
}

async function generateAISummary(
  profile: any,
  emailAccounts: any[],
  staleLeads: any[],
  upcomingDeadlines: any[]
): Promise<string | null> {
  const context = `You are a helpful executive assistant for a real estate agent.
Generate a brief, friendly daily summary (2-3 sentences max).
Agent name: ${profile?.name || 'Agent'}
Brokerage: ${profile?.brokerage || 'N/A'}
City: ${profile?.city || 'N/A'}
Connected email accounts: ${emailAccounts.length}
Stale leads needing follow-up: ${staleLeads.length}
Upcoming transaction deadlines: ${upcomingDeadlines.length}
${upcomingDeadlines.length > 0 ? 'Nearest closing: ' + upcomingDeadlines[0]?.closing_date : ''}
${staleLeads.length > 0 ? 'Most overdue lead: ' + staleLeads[0]?.name : ''}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: context,
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error('Anthropic API error:', response.status);
    return null;
  }

  const data = await response.json();
  return data.content?.[0]?.text || null;
}

// Map snake_case DB rows to camelCase for frontend
function mapLead(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    leadType: row.lead_type,
    stage: row.stage,
    notes: row.notes,
    lastContactDate: row.last_contact_date,
    followUpDate: row.follow_up_date,
    sourceEmailId: row.source_email_id,
    createdAt: row.created_at,
  };
}

function mapTransaction(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    leadId: row.lead_id,
    propertyAddress: row.property_address,
    clientName: row.client_name,
    contractDate: row.contract_date,
    optionPeriodEnd: row.option_period_end,
    closingDate: row.closing_date,
    lenderContact: row.lender_contact,
    titleCompanyContact: row.title_company_contact,
    status: row.status,
    createdAt: row.created_at,
  };
}
