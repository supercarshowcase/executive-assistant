import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Check if user has completed onboarding
    const { data: profile } = await supabase
      .from('users')
      .select('name, brokerage')
      .eq('id', user.id)
      .single();

    if (profile?.name && profile?.brokerage) {
      redirect('/home');
    } else {
      redirect('/onboarding');
    }
  }

  redirect('/login');
}
