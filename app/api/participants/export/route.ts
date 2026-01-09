import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

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
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication - admin only
    await requireAuth(['admin']);

    // Fetch all approved registrations
    const { data: approvedRegistrations, error: regError } = await supabase
      .from('regh')
      .select('*')
      .eq('status', 'APPROVED')
      .order('regdate', { ascending: false });

    if (regError) {
      console.error('Error fetching approved registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch approved registrations' },
        { status: 500 }
      );
    }

    if (!approvedRegistrations || approvedRegistrations.length === 0) {
      // Return empty CSV with headers
      const headers = [
        'Transaction ID',
        'Registration Number',
        'Registration Date',
        'Confirmation Code',
        'Province',
        'LGU',
        'Contact Person',
        'Contact Number',
        'Email',
        'Participant Line Number',
        'Last Name',
        'First Name',
        'Middle Initial',
        'Designation',
        'Barangay',
        'Participant LGU',
        'Participant Province',
        'T-Shirt Size',
        'Participant Contact Number',
        'PRC Number',
        'PRC Expiry Date',
        'Participant Email'
      ].join(',');
      
      return new NextResponse(headers, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="approved_participants_regD.csv"',
        },
      });
    }

    // Fetch all participants (regd) for approved registrations
    const regnums = approvedRegistrations.map(reg => reg.regnum);
    
    const { data: participants, error: participantError } = await supabase
      .from('regd')
      .select('*')
      .in('regnum', regnums)
      .order('regnum', { ascending: false })
      .order('linenum', { ascending: true });

    if (participantError) {
      console.error('Error fetching participants:', participantError);
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    // Create a map of registration numbers to registration data
    const regMap = new Map(approvedRegistrations.map(reg => [reg.regnum, reg]));

    // Group participants by registration number
    const participantsByRegnum = new Map<number, any[]>();
    if (participants && participants.length > 0) {
      for (const participant of participants) {
        const regnum = participant.regnum;
        if (!participantsByRegnum.has(regnum)) {
          participantsByRegnum.set(regnum, []);
        }
        participantsByRegnum.get(regnum)!.push(participant);
      }
    }

    // Build CSV content
    const csvRows: string[] = [];
    
    // CSV Headers
    csvRows.push([
      'Transaction ID',
      'Registration Number',
      'Registration Date',
      'Confirmation Code',
      'Province',
      'LGU',
      'Contact Person',
      'Contact Number',
      'Email',
      'Participant Line Number',
      'Last Name',
      'First Name',
      'Middle Initial',
      'Designation',
      'Barangay',
      'Participant LGU',
      'Participant Province',
      'T-Shirt Size',
      'Participant Contact Number',
      'PRC Number',
      'PRC Expiry Date',
      'Participant Email'
    ].map(escapeCSV).join(','));

    // Process each approved registration
    for (const registration of approvedRegistrations) {
      const regParticipants = participantsByRegnum.get(registration.regnum) || [];
      
      if (regParticipants.length > 0) {
        // Add one row per participant
        for (const participant of regParticipants) {
          const lastName = escapeCSV(participant.lastname);
          const firstName = escapeCSV(participant.firstname);
          const middleInit = escapeCSV(participant.middleinit);

          csvRows.push([
            escapeCSV(registration.transid || ''),
            escapeCSV(registration.regnum),
            escapeCSV(formatDate(registration.regdate || null)),
            escapeCSV(registration.confcode || ''),
            escapeCSV(registration.province || ''),
            escapeCSV(registration.lgu || ''),
            escapeCSV(registration.contactperson || ''),
            escapeCSV(registration.contactnum || ''),
            escapeCSV(registration.email || ''),
            escapeCSV(participant.linenum),
            lastName,
            firstName,
            middleInit,
            escapeCSV(participant.designation || ''),
            escapeCSV(participant.brgy || ''),
            escapeCSV(participant.lgu || ''),
            escapeCSV(participant.province || ''),
            escapeCSV(participant.tshirtsize || ''),
            escapeCSV(participant.contactnum || ''),
            escapeCSV(participant.prcnum || ''),
            escapeCSV(formatDate(participant.expirydate || null)),
            escapeCSV(participant.email || '')
          ].join(','));
        }
      } else {
        // If no participants for this registration, include registration info with empty participant fields
        csvRows.push([
          escapeCSV(registration.transid || ''),
          escapeCSV(registration.regnum),
          escapeCSV(formatDate(registration.regdate || null)),
          escapeCSV(registration.confcode || ''),
          escapeCSV(registration.province || ''),
          escapeCSV(registration.lgu || ''),
          escapeCSV(registration.contactperson || ''),
          escapeCSV(registration.contactnum || ''),
          escapeCSV(registration.email || ''),
          '', // Participant Line Number
          '', // Last Name
          '', // First Name
          '', // Middle Initial
          '', // Designation
          '', // Barangay
          '', // Participant LGU
          '', // Participant Province
          '', // T-Shirt Size
          '', // Participant Contact Number
          '', // PRC Number
          '', // PRC Expiry Date
          ''  // Participant Email
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

