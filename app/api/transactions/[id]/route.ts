import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createPlainClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function getUser(request: NextRequest) {
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll() {},
    },
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

function mapTx(row: any) {
  return {
    id: row.id, userId: row.user_id, leadId: row.lead_id,
    propertyAddress: row.property_address, clientName: row.client_name,
    contractDate: row.contract_date, optionPeriodEnd: row.option_period_end,
    closingDate: row.closing_date, lenderContact: row.lender_contact,
    titleCompanyContact: row.title_company_contact, status: row.status,
    createdAt: row.created_at,
  };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const db = getServiceClient();

    const updateData: any = {};
    if (body.leadId !== undefined) updateData.lead_id = body.leadId;
    if (body.propertyAddress !== undefined) updateData.property_address = body.propertyAddress;
    if (body.clientName !== undefined) updateData.client_name = body.clientName;
    if (body.contractDate !== undefined) updateData.contract_date = body.contractDate;
    if (body.optionPeriodEnd !== undefined) updateData.option_period_end = body.optionPeriodEnd;
    if (body.closingDate !== undefined) updateData.closing_date = body.closingDate;
    if (body.lenderContact !== undefined) updateData.lender_contact = body.lenderContact;
    if (body.titleCompanyContact !== undefined) updateData.title_company_contact = body.titleCompanyContact;
    if (body.status !== undefined) updateData.status = body.status;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await db.from('transactions').update(updateData).eq('id', id).eq('user_id', user.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(mapTx(data));
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
