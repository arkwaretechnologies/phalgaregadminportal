import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { position_id: string } }
) {
  try {
    await requireAuth(['admin']);

    const positionId = parseInt(params.position_id);
    if (isNaN(positionId) || positionId <= 0) {
      return NextResponse.json({ error: 'Invalid position ID' }, { status: 400 });
    }

    // Check if position exists
    const { data: existing, error: checkError } = await supabase
      .from('positions')
      .select('position_id, name')
      .eq('position_id', positionId)
      .maybeSingle();

    if (checkError) {
      console.error('Position check error:', checkError);
      return NextResponse.json({ error: 'Failed to check position' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    // Delete the position
    const { error: deleteError } = await supabase
      .from('positions')
      .delete()
      .eq('position_id', positionId);

    if (deleteError) {
      console.error('Position delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete position' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Position deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Position DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
