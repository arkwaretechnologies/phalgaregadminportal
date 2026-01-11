import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering - this route uses cookies
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch assigned conferences for reviewers
    let assigned_conferences: string[] = [];
    if (user.role === 'reviewer') {
      const { data: assignments } = await supabase
        .from('user_conferences')
        .select('confcode')
        .eq('user_id', user.user_id);
      assigned_conferences = (assignments || []).map((a: { confcode: string }) => a.confcode);
    }

    // Return user data without sensitive information
    return NextResponse.json({
      user: {
        user_id: user.user_id,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        assigned_conferences,
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


