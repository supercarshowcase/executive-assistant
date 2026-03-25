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

function mapLead(row: any) {
  return {
    id: row.id, userId: row.user_id, name: row.name, email: row.email,
    phone: row.phone, leadType: row.lead_type, stage: row.stage,
    notes: row.notes, lastContactDate: row.last_contact_date,
    followUpDate: row.follow_up_date, sourceEmailId: row.source_email_id,
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
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.leadType !== undefined) updateData.lead_type = body.leadType;
    if (body.stage !== undefined) updateData.stage = body.stage;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.lastContactDate !== undefined) updateData.last_contact_date = body.lastContactDate;
    if (body.followUpDate !== undefined) updateData.follow_up_date = body.followUpDate;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await db.from('leads').update(updateData).eq('id', id).eq('user_id', user.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(mapLead(data));
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
