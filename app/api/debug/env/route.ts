import { NextResponse } from 'next/server';

export async function GET() {
  // Only expose in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  return NextResponse.json({
    hasResendApiKey: !!process.env.RESEND_API_KEY,
    resendApiKeyLength: process.env.RESEND_API_KEY?.length || 0,
    resendApiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 10) || 'NOT_SET',
    resendFromEmail: process.env.RESEND_FROM_EMAIL || 'NOT_SET',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'NOT_SET',
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
  });
}

