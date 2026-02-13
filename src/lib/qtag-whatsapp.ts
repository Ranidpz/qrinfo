/**
 * Q.Tag WhatsApp QR Link Sender
 * Sends a WhatsApp message with a link to view the guest's event entry QR code.
 *
 * INFORU template 242341 (qtag_registration) has:
 *   Body: [#1#] Guest name, [#2#] Event name
 *   URL Button "צפייה בקוד הכניסה": dynamic suffix (base URL https://qr.playzones.app/v/ is in template)
 *
 * The URL button MUST be sent in a separate Buttons array (not in TemplateParameters).
 */

import { isINFORUConfigured } from '@/lib/inforu';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface SendQTagQRParams {
  codeId: string;
  guestId: string;
  guestName: string;
  guestPhone: string;  // Normalized +972 format
  qrToken: string;
  shortId: string;
  eventName: string;
}

const INFORU_API_USER = process.env.INFORU_API_USER;
const INFORU_API_TOKEN = process.env.INFORU_API_TOKEN;
const INFORU_API_BASE_URL = process.env.INFORU_API_BASE_URL || 'https://capi.inforu.co.il';
const QTAG_TEMPLATE_ID = process.env.INFORU_TEMPLATE_QTAG_REGISTRATION || '242341';
const QTAG_BUTTON_NAME = 'צפייה בקוד הכניסה';

function getAuthHeader(): string {
  if (!INFORU_API_USER || !INFORU_API_TOKEN) {
    throw new Error('INFORU API credentials not configured');
  }
  if (INFORU_API_TOKEN.startsWith('Basic ')) {
    return INFORU_API_TOKEN;
  }
  return `Basic ${Buffer.from(`${INFORU_API_USER}:${INFORU_API_TOKEN}`).toString('base64')}`;
}

export async function sendQTagQRWhatsApp(params: SendQTagQRParams): Promise<{ success: boolean; error?: string }> {
  if (!isINFORUConfigured()) {
    console.warn('[QTag WhatsApp] INFORU not configured, skipping WhatsApp send');
    return { success: false, error: 'INFORU not configured' };
  }

  // URL button suffix only — the template base URL is already https://qr.playzones.app/v/
  const qrLinkSuffix = `${params.shortId}?token=${params.qrToken}`;

  // Format phone number
  let formattedPhone = params.guestPhone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '972' + formattedPhone.substring(1);
  }

  try {
    const response = await fetch(`${INFORU_API_BASE_URL}/api/v2/WhatsApp/SendWhatsApp`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Data: {
          TemplateId: QTAG_TEMPLATE_ID,
          TemplateParameters: [
            { Name: '[#1#]', Type: 'Text', Value: params.guestName },
            { Name: '[#2#]', Type: 'Text', Value: params.eventName },
          ],
          Buttons: [
            { Type: 'URL', FieldName: QTAG_BUTTON_NAME, Value: qrLinkSuffix },
          ],
          Recipients: [{ Phone: formattedPhone }],
        },
      }),
    });

    const responseText = await response.text();
    console.log('[QTag WhatsApp] INFORU response:', response.status, responseText);

    if (!response.ok) {
      console.error('[QTag WhatsApp] API error:', response.status, responseText);
      return { success: false, error: `API error: ${response.status}` };
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, error: 'Invalid API response' };
    }

    if (result.StatusId === 1 || result.StatusDescription === 'Success') {
      // Update guest record
      const db = getAdminDb();
      await db.collection('codes').doc(params.codeId)
        .collection('qtagGuests').doc(params.guestId)
        .update({
          qrSentViaWhatsApp: true,
          qrSentAt: FieldValue.serverTimestamp(),
        });

      console.log(`[QTag WhatsApp] QR link sent to ${formattedPhone} for event "${params.eventName}"`);
      return { success: true };
    }

    const errorMessage = result.StatusDescription || result.DetailedDescription || 'Unknown error';
    console.error(`[QTag WhatsApp] Failed:`, errorMessage);
    return { success: false, error: errorMessage };
  } catch (error) {
    console.error('[QTag WhatsApp] Error:', error);
    return { success: false, error: String(error) };
  }
}
