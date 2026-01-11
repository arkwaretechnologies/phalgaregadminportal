import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { comparePassword, createSession, setAuthCookie } from '@/lib/auth';

// Force dynamic rendering - this route uses Supabase
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Query user by username
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Create session
    const token = await createSession({
      user_id: user.user_id,
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });

    // Set cookie
    await setAuthCookie(token);

    // Fetch assigned conferences for reviewers
    let assigned_conferences: string[] = [];
    if (user.role === 'reviewer') {
      const { data: assignments } = await supabase
        .from('user_conferences')
        .select('confcode')
        .eq('user_id', user.user_id);
      assigned_conferences = (assignments || []).map((a: { confcode: string }) => a.confcode);
    }

    // Return user data (without password_hash)
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
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


