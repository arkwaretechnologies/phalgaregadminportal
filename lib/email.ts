import { Resend } from 'resend';
import { Registration } from '@/types';
import { APPROVED_PARTICIPANT_AND_ACCOMPANYING } from '@/lib/registration-status';

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@phalga.org';
// Remove trailing slash if present to avoid double slashes in image paths
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const appUrl = rawAppUrl.replace(/\/$/, '');
const registrationPortalUrl = 'https://registration.phalga.org';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

interface StatusUpdateEmailData {
  registration: Registration;
  status: 'APPROVED' | 'REJECTED';
  remarks?: string | null;
  conferenceName?: string | null;
  conferenceDomain?: string | null;
  conferenceVenue?: string | null;
  conferenceDateFrom?: string | null;
  conferenceDateTo?: string | null;
  /** When 'Y', hide Province/LGU in emails (ANC flow). */
  conferenceIsAnc?: string | null;
  /** Public registration portal contact numbers (same as PhalgaOnlineRegistration confirmation email). */
  conferenceContactNumbers?: string[] | null;
  /** Participant count for award-style template details table. */
  participantCount?: number | null;
}

function formatDate(date: string | null): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatDateOnly(date: string | null): string {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateRange(dateFrom: string | null, dateTo: string | null): string {
  if (!dateFrom && !dateTo) return 'TBA';
  if (!dateFrom) return formatDateOnly(dateTo);
  if (!dateTo) return formatDateOnly(dateFrom);
  
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  
  // Check if same month and year
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    // Same month: "November 11-13, 2026"
    const monthFull = from.toLocaleDateString('en-US', { month: 'long' });
    const year = from.getFullYear();
    const dayFrom = from.getDate();
    const dayTo = to.getDate();
    return `${monthFull} ${dayFrom}-${dayTo}, ${year}`;
  } else {
    // Different months: "November 30, 2026 - December 2, 2026"
    return `${formatDateOnly(dateFrom)} - ${formatDateOnly(dateTo)}`;
  }
}

function getStatusColor(status: 'APPROVED' | 'REJECTED'): string {
  return status === 'APPROVED' ? '#10b981' : '#ef4444';
}

function getStatusBadgeColor(status: 'APPROVED' | 'REJECTED'): string {
  return status === 'APPROVED' 
    ? 'background-color: #d1fae5; color: #065f46;' 
    : 'background-color: #fee2e2; color: #991b1b;';
}

function escapeHtml(text: string | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatContactNumbersList(contacts: string[]): string {
  if (contacts.length === 0) return '';
  if (contacts.length === 1) return contacts[0];
  if (contacts.length === 2) return `${contacts[0]} and ${contacts[1]}`;
  const last = contacts[contacts.length - 1];
  const rest = contacts.slice(0, -1);
  return `${rest.join(', ')}, and ${last}`;
}

/**
 * Award conference approval email — matches the layout of PhalgaOnlineRegistration’s
 * registration confirmation email (gradient header, side logos, details table) but
 * states that registration is confirmed; no batch number or QR block.
 */
function getAwardApprovalPortalStyleTemplate(data: StatusUpdateEmailData): string {
  const {
    registration,
    conferenceName,
    conferenceDomain,
    conferenceVenue,
    conferenceDateFrom,
    conferenceDateTo,
    conferenceIsAnc,
    conferenceContactNumbers,
    participantCount,
  } = data;

  const greeting = escapeHtml(registration.contactperson || 'Participant');
  const conferenceDisplayName =
    escapeHtml(conferenceName || registration.confcode || 'Conference');
  const isAnc = String(conferenceIsAnc ?? '').toUpperCase() === 'Y';

  let portalBaseUrl = registrationPortalUrl;
  if (conferenceDomain) {
    if (conferenceDomain.startsWith('http://') || conferenceDomain.startsWith('https://')) {
      portalBaseUrl = conferenceDomain.replace(/\/$/, '');
    } else {
      portalBaseUrl = `https://${conferenceDomain.replace(/\/$/, '')}`;
    }
  }

  const viewUrl = `${portalBaseUrl}/view/${encodeURIComponent(registration.regid)}${
    registration.confcode ? `?confcode=${encodeURIComponent(registration.confcode)}` : ''
  }`;

  const leftImageUrl = `${appUrl}/left.png`;
  const rightImageUrl = `${appUrl}/right.png`;

  const formattedDateRange = formatDateRange(
    conferenceDateFrom ?? null,
    conferenceDateTo ?? null
  );
  const venueLine = conferenceVenue ? escapeHtml(conferenceVenue) : '';

  const provinceAndLguRows = isAnc
    ? ''
    : `
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666666; font-size: 14px;">
                    Province:
                  </td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333333; font-size: 14px; font-weight: 500;">
                    ${escapeHtml(registration.province || 'N/A')}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666666; font-size: 14px;">
                    LGU:
                  </td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333333; font-size: 14px; font-weight: 500;">
                    ${escapeHtml(registration.lgu || 'N/A')}
                  </td>
                </tr>`;

  const contacts = conferenceContactNumbers?.filter(Boolean) ?? [];
  const contactsSentence =
    contacts.length > 0
      ? `<p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If you have any questions or need to make changes to your registration, please contact the registration team using this number${
                  contacts.length > 1 ? 's' : ''
                } <strong>${escapeHtml(formatContactNumbersList(contacts))}</strong>.
              </p>`
      : `<p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If you have any questions, please contact the registration team through the official channels announced for this event.
              </p>`;

  const participantRow =
    participantCount != null && Number.isFinite(participantCount)
      ? `
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666666; font-size: 14px;">
                    Number of Participants:
                  </td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333333; font-size: 14px; font-weight: 500;">
                    ${participantCount}
                  </td>
                </tr>`
      : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f4;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 30%; vertical-align: middle; text-align: left; padding: 0 10px;">
                    <img src="${leftImageUrl}" alt="PHALGA" width="120" style="max-width: 120px; width: 120px; height: auto; display: block; border: 0;" />
                  </td>
                  <td style="width: 40%; vertical-align: middle; text-align: center; padding: 0 10px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold; line-height: 1.2;">
                      ${conferenceDisplayName}
                    </h1>
                    ${
                      formattedDateRange && formattedDateRange !== 'TBA'
                        ? `<p style="margin: 8px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">${escapeHtml(formattedDateRange)}</p>`
                        : ''
                    }
                    ${
                      venueLine
                        ? `<p style="margin: 4px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">${venueLine}</p>`
                        : ''
                    }
                    <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px;">
                      Registration Confirmed
                    </p>
                  </td>
                  <td style="width: 30%; vertical-align: middle; text-align: right; padding: 0 10px;">
                    <img src="${rightImageUrl}" alt="" width="120" style="max-width: 120px; width: 120px; height: auto; display: block; margin-left: auto; border: 0;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Dear ${greeting},
              </p>
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Your registration for <strong>${conferenceDisplayName}</strong> has been <strong style="color: #047857;">confirmed</strong>. Thank you for registering.
              </p>
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 5px 0; color: #666666; font-size: 14px; font-weight: bold;">
                  REGISTRATION ID
                </p>
                <p style="margin: 0; color: #333333; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
                  ${escapeHtml(registration.regid)}
                </p>
              </div>
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666666; font-size: 14px; width: 40%;">
                    Registration Date &amp; Time:
                  </td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333333; font-size: 14px; font-weight: 500;">
                    ${formatDate(registration.regdate)}
                  </td>
                </tr>
                ${provinceAndLguRows}
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666666; font-size: 14px;">
                    Contact Number:
                  </td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333333; font-size: 14px; font-weight: 500;">
                    ${escapeHtml(registration.contactnum || 'N/A')}
                  </td>
                </tr>
                ${participantRow}
                <tr>
                  <td style="padding: 10px; color: #666666; font-size: 14px;">
                    Status:
                  </td>
                  <td style="padding: 10px; color: #065f46; font-size: 13px; font-weight: 600; line-height: 1.35;">
                    ${escapeHtml(APPROVED_PARTICIPANT_AND_ACCOMPANYING)}
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Use your Registration ID to view your registration details on the portal.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${viewUrl}" style="display: inline-block; background-color: #667eea; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: bold; font-size: 16px;">
                  View Registration Details
                </a>
              </div>
              ${contactsSentence}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px 0; color: #666666; font-size: 12px;">
                This is an automated message. Please do not reply to this email.
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} PHALGA. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getEmailTemplate(data: StatusUpdateEmailData): string {
  const { registration, status, remarks, conferenceName, conferenceDomain, conferenceVenue, conferenceDateFrom, conferenceDateTo, conferenceIsAnc } = data;

  if (
    status === 'APPROVED' &&
    registration.status === APPROVED_PARTICIPANT_AND_ACCOMPANYING
  ) {
    return getAwardApprovalPortalStyleTemplate(data);
  }
  const statusColor = getStatusColor(status);
  const statusBadgeStyle = getStatusBadgeColor(status);
  const greeting = registration.contactperson || 'Dear Participant';
  const escapedRemarks = escapeHtml(remarks || '');
  const conferenceDisplayName = conferenceName || registration.confcode || 'Conference';
  const isAnc = String(conferenceIsAnc ?? '').toUpperCase() === 'Y';
  
  // Build registration portal URL based on conference domain
  let registrationPortalUrl = 'https://registration.phalga.org'; // Default fallback
  if (conferenceDomain) {
    // If domain starts with http:// or https://, use it as is, otherwise prepend https://
    if (conferenceDomain.startsWith('http://') || conferenceDomain.startsWith('https://')) {
      registrationPortalUrl = conferenceDomain;
    } else {
      registrationPortalUrl = `https://${conferenceDomain}`;
    }
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration ${status === 'APPROVED' ? 'Confirmed' : status}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="80" align="left">
                    <img src="${appUrl}/left.png" alt="PHALGA Logo" width="80" style="display: block; border: 0;">
                  </td>
                  <td align="center" style="padding: 0 10px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; line-height: 1.2;">${escapeHtml(conferenceDisplayName)}</h1>
                    ${(conferenceVenue || conferenceDateFrom || conferenceDateTo) ? `
                    <div style="margin: 12px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.95; line-height: 1.6;">
                      ${(conferenceDateFrom || conferenceDateTo) ? `
                      <p style="margin: 0; padding: 0;">
                        ${formatDateRange(conferenceDateFrom ?? null, conferenceDateTo ?? null)}
                      </p>
                      ` : ''}
                      ${conferenceVenue ? `<p style="margin: ${(conferenceDateFrom || conferenceDateTo) ? '4px 0 0 0' : '0'}; padding: 0;">${escapeHtml(conferenceVenue)}</p>` : ''}
                    </div>
                    ` : ''}
                    <p style="margin: ${(conferenceVenue || conferenceDateFrom || conferenceDateTo) ? '12px' : '10px'} 0 0 0; color: #ffffff; font-size: 18px; font-weight: 500; opacity: 0.9;">
                      Registration ${status === 'APPROVED' ? 'Confirmed' : (status === 'REJECTED' ? 'Unsuccessful' : status)}
                    </p>
                  </td>
                  <td width="80" align="right">
                    <img src="${appUrl}/right.png" alt="Conference Logo" width="80" style="display: block; border: 0;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Dear ${greeting},</p>
              
              ${
                status === 'APPROVED'
                  ? `<p style="margin: 0 0 30px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                      Congratulations! Your registration for the ${escapeHtml(conferenceDisplayName)} has been <strong style="color: ${statusColor};">CONFIRMED</strong>.
                    </p>
                    ${registration.batchnum ? `<div style="margin: 0 0 30px 0; padding: 20px; background-color: #f0fdf4; border-left: 4px solid ${statusColor}; border-radius: 4px;">
                      <p style="margin: 0 0 8px 0; font-size: 12px; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;">Batch Number</p>
                      <p style="margin: 0; font-size: 28px; font-weight: bold; color: #047857; letter-spacing: 1px;">Batch ${registration.batchnum}</p>
                    </div>` : ''}`
                  : `<p style="margin: 0 0 30px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                      We regret to inform you that your registration for the ${escapeHtml(conferenceDisplayName)} has been <strong style="color: ${statusColor};">UNSUCCESSFUL</strong>.
                    </p>
                    ${remarks ? `<div style="margin: 0 0 30px 0; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                      <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #92400e;">Reason for Rejection:</p>
                      <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.6;">${escapedRemarks}</p>
                    </div>` : ''}
                    `
              }
              
              <!-- Registration ID Box -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-left: 4px solid ${statusColor}; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Registration ID</p>
                <p style="margin: 0; font-size: 24px; font-weight: bold; color: #111827; letter-spacing: 1px;">${registration.regid}</p>
              </div>
              
              <!-- Registration Details -->
              <div style="margin: 30px 0; padding: 20px 0; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6b7280; width: 40%;">Registration Date & Time</td>
                    <td style="padding: 10px 0; font-size: 14px; color: #111827; font-weight: 500;">${formatDate(registration.regdate)}</td>
                  </tr>
                  ${
                    isAnc
                      ? ''
                      : `<tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6b7280;">Province</td>
                    <td style="padding: 10px 0; font-size: 14px; color: #111827; font-weight: 500;">${registration.province || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6b7280;">LGU</td>
                    <td style="padding: 10px 0; font-size: 14px; color: #111827; font-weight: 500;">${registration.lgu || 'N/A'}</td>
                  </tr>`
                  }
                  <tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6b7280;">Contact Number</td>
                    <td style="padding: 10px 0; font-size: 14px; color: #111827; font-weight: 500;">${registration.contactnum || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6b7280;">Status</td>
                    <td style="padding: 10px 0;">
                      <span style="display: inline-block; padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 20px; ${statusBadgeStyle}">
                        ${status === 'APPROVED' ? 'CONFIRMED' : 'UNSUCCESSFUL'}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>
              
              ${
                status === 'APPROVED'
                  ? `<p style="margin: 30px 0 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                      Please present ${registration.batchnum ? ` your Batch Number (Batch ${registration.batchnum})` : ' this Registration ID'} to claim your conference kits.
                    </p>`
                  : ``
              }
              
              <!-- Action Button -->
              <div style="margin: 30px 0; text-align: center;">
                <a href="${registrationPortalUrl}/view/${registration.regid}" 
                   style="display: inline-block; padding: 14px 28px; background-color: ${statusColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  View Registration Details
                </a>
              </div>
              
              ${status === 'APPROVED' ? `
              <!-- QR Code Section -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px; text-align: center;">
                
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(registration.regid)}" 
                  alt="Registration QR Code" 
                  width="150" 
                  height="150" 
                  style="display: block; margin: 0 auto; border: 4px solid white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
                />
                <p style="margin: 15px 0 0 0; font-size: 12px; color: #6b7280;">Registration ID: <strong style="color: #111827;">${registration.regid}</strong></p>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                This is an automated message. Please do not reply to this email.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">
                © ${new Date().getFullYear()} ${escapeHtml(conferenceDisplayName)}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendStatusUpdateEmail(data: StatusUpdateEmailData): Promise<boolean> {
  console.log('[EMAIL] Starting email send process...');
  console.log('[EMAIL] RESEND_API_KEY configured:', !!resendApiKey);
  console.log('[EMAIL] RESEND_API_KEY length:', resendApiKey?.length || 0);
  console.log('[EMAIL] RESEND_FROM_EMAIL:', resendFromEmail);
  
  if (!resend) {
    console.error('[EMAIL] Resend API key not configured. Email sending is disabled.');
    console.error('[EMAIL] RESEND_API_KEY from env:', process.env.RESEND_API_KEY ? 'EXISTS' : 'MISSING');
    return false;
  }

  const { registration } = data;

  console.log('[EMAIL] Registration data:', {
    batchnum: registration.batchnum,
    regid: registration.regid,
    email: registration.email,
    status: data.status,
    hasRemarks: !!data.remarks,
  });

  if (!registration.email) {
    console.warn(`[EMAIL] No email address found for registration ${registration.batchnum}. Email not sent.`);
    return false;
  }

  try {
    const isAwardConfirmationEmail =
      data.status === 'APPROVED' &&
      registration.status === APPROVED_PARTICIPANT_AND_ACCOMPANYING;
    const conferenceSubjectTitle =
      data.conferenceName || registration.confcode || registration.regid;
    const subject =
      data.status === 'REJECTED'
        ? `Registration Unsuccessful - ${registration.regid}`
        : isAwardConfirmationEmail
          ? `Registration Confirmed - ${conferenceSubjectTitle}`
          : `Registration Confirmed - ${registration.regid}`;

    console.log('[EMAIL] Email subject:', subject);
    console.log('[EMAIL] Sending to:', registration.email);
    console.log('[EMAIL] From:', resendFromEmail);

    const html = getEmailTemplate(data);

    console.log('[EMAIL] Calling Resend API...');
    const { data: emailData, error } = await resend.emails.send({
      from: `PHALGA <${resendFromEmail}>`,
      to: [registration.email],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('[EMAIL] Error sending status update email:', error);
      console.error('[EMAIL] Error details:', JSON.stringify(error, null, 2));
      return false;
    }

    console.log(`[EMAIL] Status update email sent successfully to ${registration.email} for registration ${registration.batchnum}`);
    console.log('[EMAIL] Email ID:', emailData?.id);
    return true;
  } catch (err) {
    console.error('[EMAIL] Unexpected error sending status update email:', err);
    console.error('[EMAIL] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    return false;
  }
}
