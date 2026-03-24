import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default async function RootPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Check if user has completed onboarding
    const { data: profile } = await supabase
      .from('users')
      .select('name, brokerage')
      .eq('id', user.id)
      .single();

    if (profile?.name && profile?.brokerage) {
      redirect('/inbox');
    } else {
      redirect('/onboarding');
    }
  }

  redirect('/login');
}
