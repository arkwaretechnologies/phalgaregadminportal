import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

// Force dynamic rendering - this route uses cookies
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await clearAuthCookie();
    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


