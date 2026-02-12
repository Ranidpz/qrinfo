/**
 * Q.Tag WhatsApp QR Link Sender
 * Sends a WhatsApp message with a link to view the guest's event entry QR code.
 */

import { sendTemplateMessage, isINFORUConfigured } from '@/lib/inforu';
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

const QTAG_TEMPLATE_NAME = 'qtag_registration';

export async function sendQTagQRWhatsApp(params: SendQTagQRParams): Promise<{ success: boolean; error?: string }> {
  if (!isINFORUConfigured()) {
    console.warn('[QTag WhatsApp] INFORU not configured, skipping WhatsApp send');
    return { success: false, error: 'INFORU not configured' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://qr.playzones.app';
  const qrLink = `${baseUrl}/v/${params.shortId}?token=${params.qrToken}`;

  // Template parameters:
  // [#1#] Guest name
  // [#2#] Event name
  // [#3#] QR link (URL button)
  const templateParams = [
    params.guestName,
    params.eventName,
    qrLink,
  ];

  try {
    const result = await sendTemplateMessage(
      params.guestPhone,
      QTAG_TEMPLATE_NAME,
      templateParams,
      'whatsapp'
    );

    if (result.success) {
      // Update guest record
      const db = getAdminDb();
      await db.collection('codes').doc(params.codeId)
        .collection('qtagGuests').doc(params.guestId)
        .update({
          qrSentViaWhatsApp: true,
          qrSentAt: FieldValue.serverTimestamp(),
        });

      console.log(`[QTag WhatsApp] QR link sent to ${params.guestPhone} for event "${params.eventName}"`);
      return { success: true };
    } else {
      console.error(`[QTag WhatsApp] Failed to send to ${params.guestPhone}:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('[QTag WhatsApp] Error:', error);
    return { success: false, error: String(error) };
  }
}
