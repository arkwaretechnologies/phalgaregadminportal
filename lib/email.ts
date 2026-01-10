import { Resend } from 'resend';
import { Registration } from '@/types';

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@phalga.org';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const registrationPortalUrl = 'https://registration.phalga.org';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

interface StatusUpdateEmailData {
  registration: Registration;
  status: 'APPROVED' | 'REJECTED';
  remarks?: string | null;
  conferenceName?: string | null;
  conferenceDomain?: string | null;
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

function getEmailTemplate(data: StatusUpdateEmailData): string {
  const { registration, status, remarks, conferenceName, conferenceDomain } = data;
  const statusColor = getStatusColor(status);
  const statusBadgeStyle = getStatusBadgeColor(status);
  const greeting = registration.contactperson || 'Dear Participant';
  const escapedRemarks = escapeHtml(remarks || '');
  const conferenceDisplayName = conferenceName || registration.confcode || 'Conference';
  
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
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">${escapeHtml(conferenceDisplayName)}</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Registration ${status === 'APPROVED' ? 'Confirmed' : status}</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Dear ${greeting},</p>
              
              ${
                status === 'APPROVED'
                  ? `<p style="margin: 0 0 30px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                      Congratulations! Your registration for ${escapeHtml(conferenceDisplayName)} has been <strong style="color: ${statusColor};">CONFIRMED</strong>.
                    </p>
                    ${registration.batchnum ? `<div style="margin: 0 0 30px 0; padding: 20px; background-color: #f0fdf4; border-left: 4px solid ${statusColor}; border-radius: 4px;">
                      <p style="margin: 0 0 8px 0; font-size: 12px; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;">Batch Number</p>
                      <p style="margin: 0; font-size: 28px; font-weight: bold; color: #047857; letter-spacing: 1px;">Batch ${registration.batchnum}</p>
                    </div>` : ''}
                    <p style="margin: 0 0 30px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                      We are pleased to confirm your participation. Please ensure you have submitted all required documents and payment proof as specified in the registration requirements.
                    </p>`
                  : `<p style="margin: 0 0 30px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                      We regret to inform you that your registration for ${escapeHtml(conferenceDisplayName)} has been <strong style="color: ${statusColor};">REJECTED</strong>.
                    </p>
                    ${remarks ? `<div style="margin: 0 0 30px 0; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                      <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #92400e;">Reason for Rejection:</p>
                      <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.6;">${escapedRemarks}</p>
                    </div>` : ''}
                    <p style="margin: 0 0 30px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                      If you believe this is an error or have any questions, please contact us using the information provided in your registration.
                    </p>`
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
                  <tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6b7280;">Province</td>
                    <td style="padding: 10px 0; font-size: 14px; color: #111827; font-weight: 500;">${registration.province || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6b7280;">LGU</td>
                    <td style="padding: 10px 0; font-size: 14px; color: #111827; font-weight: 500;">${registration.lgu || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6b7280;">Contact Number</td>
                    <td style="padding: 10px 0; font-size: 14px; color: #111827; font-weight: 500;">${registration.contactnum || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6b7280;">Status</td>
                    <td style="padding: 10px 0;">
                      <span style="display: inline-block; padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 20px; ${statusBadgeStyle}">
                        ${status === 'APPROVED' ? 'CONFIRMED' : status}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="margin: 30px 0 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                Please keep your Registration ID safe. You can use it to view your registration details at any time.
              </p>
              
              <!-- Action Button -->
              <div style="margin: 30px 0; text-align: center;">
                <a href="${registrationPortalUrl}/view/${registration.regid}" 
                   style="display: inline-block; padding: 14px 28px; background-color: ${statusColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  View Registration Details
                </a>
              </div>
              
              <p style="margin: 30px 0 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                If you have any questions or need to make changes to your registration, please contact us using the information provided in your registration.
              </p>
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
    const subject = data.status === 'APPROVED' 
      ? `Registration Confirmed - ${registration.regid}`
      : `Registration Rejected - ${registration.regid}`;

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
