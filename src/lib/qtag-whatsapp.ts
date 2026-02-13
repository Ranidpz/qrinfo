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

// Reject placeholder/test phone numbers that should never be used for real sends
const BLOCKED_PHONES = ['972500000000', '0500000000', '+972500000000'];

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

export async function sendQTagQRWhatsApp(params: SendQTagQRParams): Promise<{ success: boolean; error?: string; requestId?: string; statusId?: number }> {
  if (!isINFORUConfigured()) {
    console.warn('[QTag WhatsApp] INFORU not configured, skipping WhatsApp send');
    return { success: false, error: 'INFORU not configured' };
  }

  // Validate required params
  if (!params.guestPhone) {
    console.error('[QTag WhatsApp] Missing guestPhone param');
    return { success: false, error: 'Missing phone number' };
  }
  if (!params.shortId) {
    console.error('[QTag WhatsApp] Missing shortId param');
    return { success: false, error: 'Missing shortId' };
  }

  // Log raw params for debugging
  console.log(`[QTag WhatsApp] Raw params: guestPhone="${params.guestPhone}", shortId="${params.shortId}", guestName="${params.guestName}", eventName="${params.eventName}"`);

  // Format phone number
  let formattedPhone = params.guestPhone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '972' + formattedPhone.substring(1);
  }

  // Block placeholder/test phones
  if (BLOCKED_PHONES.includes(formattedPhone) || BLOCKED_PHONES.includes(params.guestPhone)) {
    console.error(`[QTag WhatsApp] BLOCKED: phone "${params.guestPhone}" → "${formattedPhone}" is a placeholder/test number`);
    return { success: false, error: 'Invalid phone: placeholder number detected' };
  }

  // URL button suffix only — the template base URL is already https://qr.playzones.app/v/
  const qrLinkSuffix = `${params.shortId}?token=${params.qrToken}`;

  console.log(`[QTag WhatsApp] Sending to ${formattedPhone}, template=${QTAG_TEMPLATE_ID}, suffix=${qrLinkSuffix.slice(0, 30)}...`);

  try {
    const payload = {
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
    };

    console.log(`[QTag WhatsApp] Full payload:`, JSON.stringify(payload));

    const response = await fetch(`${INFORU_API_BASE_URL}/api/v2/WhatsApp/SendWhatsApp`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log(`[QTag WhatsApp] INFORU response: status=${response.status}, body=${responseText}`);

    if (!response.ok) {
      console.error(`[QTag WhatsApp] API error: ${response.status} | Phone: ${formattedPhone} | Response: ${responseText}`);
      const truncated = responseText.slice(0, 300);
      return { success: false, error: `API error: ${response.status} | ${truncated}` };
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

      console.log(`[QTag WhatsApp] SUCCESS: QR link sent to ${formattedPhone} for event "${params.eventName}", RequestId=${result.RequestId}`);
      return { success: true, requestId: result.RequestId, statusId: result.StatusId };
    }

    const errorMessage = result.StatusDescription || result.DetailedDescription || 'Unknown error';
    console.error(`[QTag WhatsApp] Failed: StatusId=${result.StatusId}, ${errorMessage}, Phone=${formattedPhone}`);
    return { success: false, error: errorMessage, statusId: result.StatusId };
  } catch (error) {
    console.error('[QTag WhatsApp] Error:', error);
    return { success: false, error: String(error) };
  }
}
