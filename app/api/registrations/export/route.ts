import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Helper function to escape CSV values
function escapeCSV(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  // If value contains comma, newline, or quote, wrap it in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// Helper function to format date
function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return dateString;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication - admin only
    await requireAuth(['admin']);

    // Get confcode from query parameters
    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');

    // Fetch approved registrations, optionally filtered by conference
    let query = supabase
      .from('regh')
      .select('*')
      .eq('status', 'APPROVED')
      .order('regdate', { ascending: false });

    if (confcode) {
      query = query.eq('confcode', confcode);
    }

    const { data: approvedRegistrations, error: regError } = await query;

    if (regError) {
      console.error('Error fetching approved registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch approved registrations' },
        { status: 500 }
      );
    }

    // Build CSV content
    const csvRows: string[] = [];
    
    // CSV Headers
    csvRows.push([
      'Registration Number',
      'Transaction ID',
      'Confirmation Code',
      'Province',
      'LGU',
      'Contact Person',
      'Contact Number',
      'Email',
      'Registration Date',
      'Status',
      'Remarks',
      'Payment Proof URL'
    ].map(escapeCSV).join(','));

    // Add registration rows
    if (approvedRegistrations && approvedRegistrations.length > 0) {
      for (const registration of approvedRegistrations) {
        csvRows.push([
          escapeCSV(registration.batchnum),
          escapeCSV(registration.regid || ''),
          escapeCSV(registration.confcode || ''),
          escapeCSV(registration.province || ''),
          escapeCSV(registration.lgu || ''),
          escapeCSV(registration.contactperson || ''),
          escapeCSV(registration.contactnum || ''),
          escapeCSV(registration.email || ''),
          escapeCSV(formatDate(registration.regdate || null)),
          escapeCSV(registration.status || ''),
          escapeCSV(registration.remarks || ''),
          escapeCSV(registration.payment_proof_url || '')
        ].join(','));
      }
    }

    const csvContent = csvRows.join('\n');
    
    // Add BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    return new NextResponse(csvWithBOM, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="approved_participants_regH.csv"',
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

