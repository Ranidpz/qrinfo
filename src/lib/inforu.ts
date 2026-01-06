/**
 * INFORU WhatsApp & SMS API Integration
 * Documentation: https://apidoc.inforu.co.il
 */

import type { INFORUSendResult, VerificationMethod } from '@/types/verification';

// Environment variables
const INFORU_API_USER = process.env.INFORU_API_USER;
const INFORU_API_TOKEN = process.env.INFORU_API_TOKEN;
const INFORU_SENDER_ID = process.env.INFORU_SENDER_ID || 'QVote';
const INFORU_API_BASE_URL = process.env.INFORU_API_BASE_URL || 'https://capi.inforu.co.il';

// WhatsApp Template IDs (approved by Meta)
const WHATSAPP_TEMPLATE_ID_HE = process.env.INFORU_WHATSAPP_TEMPLATE_HE || '234887';
const WHATSAPP_TEMPLATE_ID_EN = process.env.INFORU_WHATSAPP_TEMPLATE_EN || '234889';

// Validate environment variables
function validateConfig(): void {
  if (!INFORU_API_USER || !INFORU_API_TOKEN) {
    throw new Error('INFORU API credentials not configured. Set INFORU_API_USER and INFORU_API_TOKEN environment variables.');
  }
}

/**
 * Create Basic Auth header from credentials
 */
function getAuthHeader(): string {
  validateConfig();
  // If token already starts with "Basic ", use it directly
  if (INFORU_API_TOKEN?.startsWith('Basic ')) {
    return INFORU_API_TOKEN;
  }
  // Otherwise, create Basic auth header from username:token
  const credentials = Buffer.from(`${INFORU_API_USER}:${INFORU_API_TOKEN}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Send WhatsApp OTP message via INFORU using approved templates
 * API Documentation: https://capi.inforu.co.il/api/v2/WhatsApp/SendWhatsApp
 */
export async function sendWhatsAppOTP(
  phone: string,
  code: string,
  locale: 'he' | 'en' = 'he'
): Promise<INFORUSendResult> {
  validateConfig();

  // Select template based on locale
  const templateId = locale === 'he' ? WHATSAPP_TEMPLATE_ID_HE : WHATSAPP_TEMPLATE_ID_EN;

  // Format phone number (remove + if present, ensure country code)
  let formattedPhone = phone.replace(/\D/g, ''); // Remove non-digits
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '972' + formattedPhone.substring(1); // Convert 05X to 9725X
  }

  console.log(`[INFORU] Sending WhatsApp OTP to ${formattedPhone} using template ${templateId}`);

  try {
    // INFORU WhatsApp OTP API endpoint
    const response = await fetch(`${INFORU_API_BASE_URL}/api/v2/WhatsApp/SendWhatsApp`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Data: {
          TemplateId: templateId,
          TemplateParameters: [
            {
              Name: '[#1#]',
              Type: 'OTP',
              Value: code,
            }
          ],
          Recipients: [
            {
              Phone: formattedPhone,
            }
          ],
        }
      }),
    });

    const responseText = await response.text();
    console.log('[INFORU] WhatsApp API response:', response.status, responseText);

    if (!response.ok) {
      console.error('[INFORU] WhatsApp send failed:', response.status, responseText);
      return {
        success: false,
        error: `API error: ${response.status} - ${responseText}`,
      };
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      // Response might not be JSON
      result = { message: responseText };
    }

    // Check INFORU response format - StatusId: 1 means success
    if (result.StatusId === 1 || result.StatusDescription === 'Success') {
      console.log('[INFORU] WhatsApp OTP sent successfully:', result.RequestId);
      return {
        success: true,
        messageId: result.RequestId || result.Data?.RequestId,
      };
    }

    // Check for error in response
    const errorMessage = result.StatusDescription || result.DetailedDescription || result.error || 'Unknown error';
    console.error('[INFORU] WhatsApp send error:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    console.error('[INFORU] WhatsApp send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Send SMS OTP message via INFORU
 */
export async function sendSMSOTP(
  phone: string,
  code: string,
  locale: 'he' | 'en' = 'he'
): Promise<INFORUSendResult> {
  validateConfig();

  // Message templates (shorter for SMS)
  const messages = {
    he: `קוד אימות: ${code}`,
    en: `Verification code: ${code}`,
  };

  const message = messages[locale];

  // Format phone number
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '972' + formattedPhone.substring(1);
  }

  console.log(`[INFORU] Sending SMS OTP to ${formattedPhone}`);

  try {
    // INFORU SMS API endpoint
    const response = await fetch(`${INFORU_API_BASE_URL}/api/v2/SMS/SendSms`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        User: INFORU_API_USER,
        Token: INFORU_API_TOKEN?.replace('Basic ', ''),
        Recipients: [{ Phone: formattedPhone }],
        Settings: {
          Sender: INFORU_SENDER_ID,
        },
        Message: message,
      }),
    });

    const responseText = await response.text();
    console.log('[INFORU] SMS API response:', response.status, responseText);

    if (!response.ok) {
      console.error('[INFORU] SMS send failed:', response.status, responseText);
      return {
        success: false,
        error: `API error: ${response.status} - ${responseText}`,
      };
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { message: responseText };
    }

    if (result.Status === 1 || result.status === 'sent' || result.success || result.MessageId || result.messageId) {
      console.log('[INFORU] SMS OTP sent successfully');
      return {
        success: true,
        messageId: result.MessageId || result.messageId || result.id,
      };
    }

    const errorMessage = result.Description || result.error || result.message || 'Unknown error';
    console.error('[INFORU] SMS send error:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    console.error('[INFORU] SMS send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Send OTP via preferred method with optional fallback
 */
export async function sendOTP(
  phone: string,
  code: string,
  method: VerificationMethod,
  locale: 'he' | 'en' = 'he'
): Promise<{ result: INFORUSendResult; methodUsed: 'whatsapp' | 'sms' }> {
  // Try WhatsApp first if method is 'whatsapp' or 'both'
  if (method === 'whatsapp' || method === 'both') {
    const whatsappResult = await sendWhatsAppOTP(phone, code, locale);

    if (whatsappResult.success) {
      return { result: whatsappResult, methodUsed: 'whatsapp' };
    }

    // If method is 'both', try SMS as fallback
    if (method === 'both') {
      console.log('[INFORU] WhatsApp failed, falling back to SMS');
      const smsResult = await sendSMSOTP(phone, code, locale);
      return { result: smsResult, methodUsed: 'sms' };
    }

    return { result: whatsappResult, methodUsed: 'whatsapp' };
  }

  // SMS only
  const smsResult = await sendSMSOTP(phone, code, locale);
  return { result: smsResult, methodUsed: 'sms' };
}

/**
 * Check if INFORU is properly configured
 */
export function isINFORUConfigured(): boolean {
  return !!(INFORU_API_USER && INFORU_API_TOKEN);
}

/**
 * Get INFORU configuration status (for admin panel)
 */
export function getINFORUStatus(): {
  configured: boolean;
  senderId: string;
  apiUrl: string;
} {
  return {
    configured: isINFORUConfigured(),
    senderId: INFORU_SENDER_ID,
    apiUrl: INFORU_API_BASE_URL,
  };
}
