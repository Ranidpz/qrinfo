/**
 * Resend Email Integration
 * Used for internal admin notifications (new user registration, etc.)
 */
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable not configured');
  }
  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }
  return resendClient;
}

export function isResendConfigured(): boolean {
  return !!RESEND_API_KEY;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(
  params: SendEmailParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: params.from || 'The Q <notifications@playzone.co.il>',
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error('[Resend] Send error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[Resend] Error:', err);
    return { success: false, error: 'Failed to send email' };
  }
}
