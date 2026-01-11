import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth, hashPassword } from '@/lib/auth';
import { User } from '@/types';

// Force dynamic rendering - this route uses Supabase
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check authentication - admin only
    await requireAuth(['admin']);

    const { data: users, error } = await supabase
      .from('users')
      .select('user_id, username, fullname, role, default_conference, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Fetch assigned conferences for each user
    const usersWithConferences = await Promise.all(
      (users || []).map(async (user) => {
        if (user.role === 'reviewer') {
          const { data: assignments } = await supabase
            .from('user_conferences')
            .select('confcode')
            .eq('user_id', user.user_id);
          return {
            ...user,
            assigned_conferences: (assignments || []).map((a: { confcode: string }) => a.confcode),
          };
        }
        return { ...user, assigned_conferences: [] };
      })
    );

    return NextResponse.json({ users: usersWithConferences });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Users fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication - admin only
    await requireAuth(['admin']);

    const body = await request.json();
    const { username, password, fullname, role, assigned_conferences, default_conference } = body;

    // Validate input
    if (!username || !password || !fullname || !role) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (!['admin', 'reviewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be either admin or reviewer' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        username,
        password_hash,
        fullname,
        role,
        default_conference: default_conference || null,
      })
      .select('user_id, username, fullname, role, default_conference, created_at, updated_at')
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // If reviewer role and assigned_conferences provided, create assignments
    if (role === 'reviewer' && Array.isArray(assigned_conferences) && assigned_conferences.length > 0) {
      const conferenceAssignments = assigned_conferences.map((confcode: string) => ({
        user_id: user.user_id,
        confcode,
      }));

      const { error: assignError } = await supabase
        .from('user_conferences')
        .insert(conferenceAssignments);

      if (assignError) {
        console.error('Error assigning conferences:', assignError);
        // Don't fail the request, user is created successfully
      }
    }

    return NextResponse.json({ 
      user: { ...user, assigned_conferences: assigned_conferences || [], default_conference: default_conference || null } 
    }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('User creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


