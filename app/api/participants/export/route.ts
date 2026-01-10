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
  // Keep original casing; quote to be safe with any edge cases
  return `"${identifier.replace(/"/g, '""')}"`;
}

function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  // Supabase returns dates/timestamps as strings; keep as quoted strings
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

    if (!approvedRegistrations || approvedRegistrations.length === 0) {
      // Get regd columns structure for empty CSV with headers
      const { data: sampleParticipants } = await supabase
        .from('regd')
        .select('*')
        .limit(1);

      let regdColumns: string[] = [];
      if (sampleParticipants && sampleParticipants.length > 0) {
        // Preserve column order as it comes from Supabase (don't sort)
        regdColumns = Object.keys(sampleParticipants[0]);
      } else {
        // Fallback: use known columns from type definition
        regdColumns = [
          'confcode',
          'batchnum',
          'linenum',
          'lastname',
          'firstname',
          'middleinit',
          'designation',
          'brgy',
          'lgu',
          'province',
          'tshirtsize',
          'contactnum',
          'prcnum',
          'expirydate',
          'email'
        ];
      }

      if (format === 'sql') {
        const cols = regdColumns.map(escapeSqlIdentifier).join(', ');
        const sql = [
          '-- regd export (no rows found for the current filter)',
          confcode ? `-- confcode = ${confcode}` : '-- confcode = (not provided)',
          'BEGIN;',
          `-- Columns: ${regdColumns.join(', ')}`,
          `-- Example: INSERT INTO public.regd (${cols}) VALUES (...);`,
          'COMMIT;',
          '',
        ].join('\n');
        return new NextResponse(sql, {
          headers: {
            'Content-Type': 'text/sql; charset=utf-8',
            'Content-Disposition': 'attachment; filename="approved_participants_regD.sql"',
          },
        });
      }

      // Return empty CSV with headers (all regd columns)
      // IMPORTANT: keep original Supabase column names and casing
      const headers = regdColumns.map(escapeCSV).join(',');

      return new NextResponse(headers, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="approved_participants_regD.csv"',
        },
      });
    }

    // Fetch all regd rows where regid is in approved registrations
    // regd is linked to regh by regid, not batchnum (batchnum is only generated when approved)
    const regids = approvedRegistrations
      .map(reg => reg.regid)
      .filter((id): id is string => id !== null && id !== undefined);
    
    let participants: any[] = [];
    let participantError = null;

    if (regids.length > 0) {
      let participantQuery = supabase
        .from('regd')
        .select('*')
        .in('regid', regids)
        .order('linenum', { ascending: true });

      // Also filter by confcode if provided
      if (confcode) {
        participantQuery = participantQuery.eq('confcode', confcode);
      }

      const { data, error } = await participantQuery;
      participants = data || [];
      participantError = error;
    }

    if (participantError) {
      console.error('Error fetching participants:', participantError);
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    // Get all unique column names from regd table (from all participants to ensure we capture all columns)
    // Preserve the column order as it comes from Supabase
    let regdColumns: string[] = [];
    if (participants && participants.length > 0) {
      // Use the first participant to get the column order (Supabase preserves column order)
      const firstParticipant = participants[0];
      const baseOrder = Object.keys(firstParticipant);
      
      // Collect all unique keys from all participants
      const allKeys = new Set<string>();
      participants.forEach(p => {
        Object.keys(p).forEach(key => allKeys.add(key));
      });
      
      // Preserve the order from first participant, then add any additional columns at the end
      regdColumns = [
        ...baseOrder.filter(key => allKeys.has(key)),
        ...Array.from(allKeys).filter(key => !baseOrder.includes(key))
      ];
    } else {
      // Fallback: use known columns from type definition
      regdColumns = [
        'confcode',
        'batchnum',
        'linenum',
        'lastname',
        'firstname',
        'middleinit',
        'designation',
        'brgy',
        'lgu',
        'province',
        'tshirtsize',
        'contactnum',
        'prcnum',
        'expirydate',
        'email'
      ];
    }

    // Build CSV content
    const csvRows: string[] = [];
    
    // CSV Headers: All columns from regd table
    // IMPORTANT: keep original Supabase column names and casing
    csvRows.push(regdColumns.map(escapeCSV).join(','));

    if (format === 'sql') {
      const colsSql = regdColumns.map(escapeSqlIdentifier).join(', ');
      const lines: string[] = [];
      lines.push('-- regd export');
      if (confcode) lines.push(`-- confcode = ${confcode}`);
      lines.push('BEGIN;');

      for (const participant of participants as any[]) {
        const valuesSql = regdColumns.map((col) => escapeSqlValue(participant?.[col])).join(', ');
        lines.push(`INSERT INTO public.regd (${colsSql}) VALUES (${valuesSql});`);
      }

      lines.push('COMMIT;');
      lines.push('');

      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/sql; charset=utf-8',
          'Content-Disposition': 'attachment; filename="approved_participants_regD.sql"',
        },
      });
    }

    // Process all participants (already filtered to only approved registrations)
    if (participants && participants.length > 0) {
      for (const participant of participants) {
        // Add one row per participant with all regd columns
        const row = regdColumns.map(col => {
          const value = participant[col];
          return escapeCSV(value);
        });
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
        'Content-Disposition': 'attachment; filename="approved_participants_regD.csv"',
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

