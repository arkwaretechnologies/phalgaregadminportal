import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth, hashPassword } from '@/lib/auth';

// Force dynamic rendering - this route uses Supabase
export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { user_id: string } }
) {
  try {
    // Check authentication - admin only
    await requireAuth(['admin']);

    const user_id = parseInt(params.user_id);

    if (isNaN(user_id)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { fullname, role, password, assigned_conferences, default_conference } = body;

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (fullname) {
      updateData.fullname = fullname;
    }

    if (role) {
      if (!['admin', 'reviewer'].includes(role)) {
        return NextResponse.json(
          { error: 'Role must be either admin or reviewer' },
          { status: 400 }
        );
      }
      updateData.role = role;
    }

    if (password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters long' },
          { status: 400 }
        );
      }
      updateData.password_hash = await hashPassword(password);
    }

    // Handle default_conference - can be set to null or a valid confcode
    if (default_conference !== undefined) {
      updateData.default_conference = default_conference || null;
    }

    // Update user
    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', user_id)
      .select('user_id, username, fullname, role, default_conference, created_at, updated_at')
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Handle conference assignments for reviewers
    const finalRole = role || user.role;
    if (Array.isArray(assigned_conferences)) {
      // Delete existing assignments
      await supabase
        .from('user_conferences')
        .delete()
        .eq('user_id', user_id);

      // If reviewer role and has conferences to assign
      if (finalRole === 'reviewer' && assigned_conferences.length > 0) {
        const conferenceAssignments = assigned_conferences.map((confcode: string) => ({
          user_id: user_id,
          confcode,
        }));

        const { error: assignError } = await supabase
          .from('user_conferences')
          .insert(conferenceAssignments);

        if (assignError) {
          console.error('Error assigning conferences:', assignError);
        }
      }
    }

    // Fetch current assignments to return
    let currentAssignments: string[] = [];
    if (finalRole === 'reviewer') {
      const { data: assignments } = await supabase
        .from('user_conferences')
        .select('confcode')
        .eq('user_id', user_id);
      currentAssignments = (assignments || []).map((a: { confcode: string }) => a.confcode);
    }

    return NextResponse.json({ 
      user: { ...user, assigned_conferences: currentAssignments, default_conference: user.default_conference } 
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('User update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { user_id: string } }
) {
  try {
    // Check authentication - admin only
    await requireAuth(['admin']);

    const user_id = parseInt(params.user_id);

    if (isNaN(user_id)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Get current user to prevent self-deletion
    const currentUser = await requireAuth(['admin']);

    if (currentUser.user_id === user_id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Delete user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('user_id', user_id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('User deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


