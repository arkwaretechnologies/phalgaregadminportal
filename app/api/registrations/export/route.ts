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

function escapeSqlIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  const s = String(value);
  return `'${s.replace(/'/g, "''")}'`;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication - admin only
    await requireAuth(['admin']);

    // Get confcode from query parameters
    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');
    const format = (searchParams.get('format') || 'csv').toLowerCase(); // csv | sql

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

    // Determine column order (keep Supabase column names and casing)
    let reghColumns: string[] = [];
    if (approvedRegistrations && approvedRegistrations.length > 0) {
      const first = approvedRegistrations[0] as any;
      const baseOrder = Object.keys(first);

      const allKeys = new Set<string>();
      for (const row of approvedRegistrations as any[]) {
        Object.keys(row || {}).forEach((k) => allKeys.add(k));
      }

      reghColumns = [
        ...baseOrder.filter((k) => allKeys.has(k)),
        ...Array.from(allKeys).filter((k) => !baseOrder.includes(k)),
      ];
    } else {
      // If no data, fetch one row to infer columns (or fallback)
      const { data: sample } = await supabase.from('regh').select('*').limit(1);
      if (sample && sample.length > 0) {
        reghColumns = Object.keys(sample[0] as any);
      } else {
        // Fallback to known schema
        reghColumns = [
          'batchnum',
          'confcode',
          'province',
          'lgu',
          'contactperson',
          'contactnum',
          'email',
          'regdate',
          'status',
          'remarks',
          'payment_proof_url',
          'regid',
        ];
      }
    }

    // Build CSV content
    const csvRows: string[] = [];

    // Header row: exact Supabase column names
    csvRows.push(reghColumns.map(escapeCSV).join(','));

    if (format === 'sql') {
      const colsSql = reghColumns.map(escapeSqlIdentifier).join(', ');
      const lines: string[] = [];
      lines.push('-- regh export');
      if (confcode) lines.push(`-- confcode = ${confcode}`);
      lines.push('BEGIN;');

      if (approvedRegistrations && approvedRegistrations.length > 0) {
        for (const registration of approvedRegistrations as any[]) {
          const valuesSql = reghColumns.map((col) => escapeSqlValue(registration?.[col])).join(', ');
          lines.push(`INSERT INTO public.regh (${colsSql}) VALUES (${valuesSql});`);
        }
      }

      lines.push('COMMIT;');
      lines.push('');

      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/sql; charset=utf-8',
          'Content-Disposition': 'attachment; filename="approved_participants_regH.sql"',
        },
      });
    }

    // Data rows
    if (approvedRegistrations && approvedRegistrations.length > 0) {
      for (const registration of approvedRegistrations as any[]) {
        const row = reghColumns.map((col) => escapeCSV(registration?.[col]));
        csvRows.push(row.join(','));
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

