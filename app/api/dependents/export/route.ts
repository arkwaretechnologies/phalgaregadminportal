import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/** PostgREST `.in('regid', …)` is sent on the query string; keep chunks well under URL limits. */
const REGID_IN_CHUNK_SIZE = 120;

// Helper function to fetch all records without Supabase's default 1000 row limit
async function fetchAllRecords(
  client: SupabaseClient,
  table: string,
  queryBuilder: (query: any) => any,
  pageSize: number = 1000
): Promise<{ data: any[]; error: any }> {
  const allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = client.from(table).select('*');
    query = queryBuilder(query);
    query = query.range(from, from + pageSize - 1);

    const { data, error } = await query;

    if (error) {
      return { data: [], error };
    }

    if (data && data.length > 0) {
      allData.push(...data);
      from += pageSize;
      // If we got fewer results than pageSize, we've reached the end
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return { data: allData, error: null };
}

async function fetchRegdepForRegIds(
  client: SupabaseClient,
  regids: string[],
  confcode: string | null,
  pageSize: number
): Promise<{ data: any[]; error: any }> {
  const merged: any[] = [];

  for (let i = 0; i < regids.length; i += REGID_IN_CHUNK_SIZE) {
    const chunk = regids.slice(i, i + REGID_IN_CHUNK_SIZE);
    const { data, error } = await fetchAllRecords(
      client,
      'regdep',
      (query) => {
        let q = query.in('regid', chunk).order('regid', { ascending: true });
        if (confcode) {
          q = q.eq('confcode', confcode);
        }
        return q;
      },
      pageSize
    );
    if (error) {
      return { data: [], error };
    }
    if (data?.length) {
      merged.push(...data);
    }
  }

  merged.sort((a, b) => String(a.regid ?? '').localeCompare(String(b.regid ?? '')));

  return { data: merged, error: null };
}

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
    // Check authentication - allow admin and reviewer
    await requireAuth(['admin', 'reviewer']);

    // Get confcode from query parameters
    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');
    const format = (searchParams.get('format') || 'csv').toLowerCase(); // csv | sql

    // Fetch approved registrations, optionally filtered by conference (no row limit)
    const { data: approvedRegistrations, error: regError } = await fetchAllRecords(
      supabaseServer,
      'regh',
      (query) => {
        query = query.eq('status', 'APPROVED').order('regdate', { ascending: false }).order('regid', { ascending: true });
        if (confcode) {
          query = query.eq('confcode', confcode);
        }
        return query;
      }
    );

    if (regError) {
      console.error('Error fetching approved registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch approved registrations' },
        { status: 500 }
      );
    }

    if (!approvedRegistrations || approvedRegistrations.length === 0) {
      // Get regdep columns structure for empty CSV with headers
      const { data: sampleDependents } = await supabaseServer
        .from('regdep')
        .select('*')
        .limit(1);

      let regdepColumns: string[] = [];
      if (sampleDependents && sampleDependents.length > 0) {
        // Preserve column order as it comes from Supabase (don't sort)
        regdepColumns = Object.keys(sampleDependents[0]);
      } else {
        // Fallback: use known columns from database schema
        regdepColumns = [
          'regid',
          'confcode',
          'payment_proof_url'
        ];
      }

      if (format === 'sql') {
        const cols = regdepColumns.map(escapeSqlIdentifier).join(', ');
        const sql = [
          '-- regdep export (no rows found for the current filter)',
          confcode ? `-- confcode = ${confcode}` : '-- confcode = (not provided)',
          'BEGIN;',
          `-- Columns: ${regdepColumns.join(', ')}`,
          `-- Example: INSERT INTO public.regdep (${cols}) VALUES (...);`,
          'COMMIT;',
          '',
        ].join('\n');
        return new NextResponse(sql, {
          headers: {
            'Content-Type': 'text/sql; charset=utf-8',
            'Content-Disposition': 'attachment; filename="approved_participants_regdep.sql"',
          },
        });
      }

      // Return empty CSV with headers (all regdep columns)
      // IMPORTANT: keep original Supabase column names and casing
      const headers = regdepColumns.map(escapeCSV).join(',');

      return new NextResponse(headers, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="approved_participants_regdep.csv"',
        },
      });
    }

    // Fetch all regdep rows where regid is in approved registrations
    // regdep is linked to regh by regid
    const regids = approvedRegistrations
      .map(reg => reg.regid)
      .filter((id): id is string => id !== null && id !== undefined);
    
    let dependents: any[] = [];
    let dependentError = null;

    if (regids.length > 0) {
      // Fetch all dependents without row limit
      const { data, error } = await fetchRegdepForRegIds(
        supabaseServer,
        regids,
        confcode,
        1000
      );
      dependents = data || [];
      dependentError = error;
    }

    if (dependentError) {
      console.error('Error fetching dependents:', dependentError);
      return NextResponse.json(
        { error: 'Failed to fetch dependents' },
        { status: 500 }
      );
    }

    // Get all unique column names from regdep table (from all dependents to ensure we capture all columns)
    // Preserve the column order as it comes from Supabase
    let regdepColumns: string[] = [];
    if (dependents && dependents.length > 0) {
      // Use the first dependent to get the column order (Supabase preserves column order)
      const firstDependent = dependents[0];
      const baseOrder = Object.keys(firstDependent);
      
      // Collect all unique keys from all dependents
      const allKeys = new Set<string>();
      dependents.forEach(d => {
        Object.keys(d).forEach(key => allKeys.add(key));
      });
      
      // Preserve the order from first dependent, then add any additional columns at the end
      regdepColumns = [
        ...baseOrder.filter(key => allKeys.has(key)),
        ...Array.from(allKeys).filter(key => !baseOrder.includes(key))
      ];
    } else {
      // Fallback: use known columns from database schema
      regdepColumns = [
        'regid',
        'confcode',
        'payment_proof_url'
      ];
    }

    // Build CSV content
    const csvRows: string[] = [];
    
    // CSV Headers: All columns from regdep table
    // IMPORTANT: keep original Supabase column names and casing
    csvRows.push(regdepColumns.map(escapeCSV).join(','));

    if (format === 'sql') {
      const colsSql = regdepColumns.map(escapeSqlIdentifier).join(', ');
      const lines: string[] = [];
      lines.push('-- regdep export');
      if (confcode) lines.push(`-- confcode = ${confcode}`);
      lines.push('BEGIN;');

      for (const dependent of dependents as any[]) {
        const valuesSql = regdepColumns.map((col) => escapeSqlValue(dependent?.[col])).join(', ');
        lines.push(`INSERT INTO public.regdep (${colsSql}) VALUES (${valuesSql});`);
      }

      lines.push('COMMIT;');
      lines.push('');

      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/sql; charset=utf-8',
          'Content-Disposition': 'attachment; filename="approved_participants_regdep.sql"',
        },
      });
    }

    // Process all dependents (already filtered to only approved registrations)
    if (dependents && dependents.length > 0) {
      for (const dependent of dependents) {
        // Add one row per dependent with all regdep columns
        const row = regdepColumns.map(col => {
          const value = dependent[col];
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
        'Content-Disposition': 'attachment; filename="approved_participants_regdep.csv"',
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
