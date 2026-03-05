import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { resetQGamesData } from '@/lib/qgames-admin';
import { QGamesScheduleSlot } from '@/types/qgames';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current Israel time
    const now = new Date();
    const israelStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' });
    const israelTime = new Date(israelStr);
    const currentDay = israelTime.getDay();     // 0=Sun..6=Sat
    const currentHour = israelTime.getHours();
    const currentMinute = israelTime.getMinutes();

    // Query all enabled schedules
    const db = getAdminDb();
    const schedulesSnap = await db.collection('autoResetSchedules')
      .where('enabled', '==', true)
      .get();

    if (schedulesSnap.empty) {
      return NextResponse.json({ message: 'No schedules', resets: 0 });
    }

    let resetCount = 0;
    const errors: string[] = [];

    for (const doc of schedulesSnap.docs) {
      const schedule = doc.data();

      // Check if any slot matches current 5-min window
      const shouldReset = (schedule.slots as QGamesScheduleSlot[]).some(slot => {
        const dayMatch = slot.dayOfWeek === -1 || slot.dayOfWeek === currentDay;
        const slotMinutes = slot.hour * 60 + slot.minute;
        const currentMinutes = currentHour * 60 + currentMinute;
        const diff = currentMinutes - slotMinutes;
        return dayMatch && diff >= 0 && diff < 5;
      });

      if (!shouldReset) continue;

      // Double-reset guard: skip if last reset was within 10 minutes
      const lastReset = schedule.lastResetAt || 0;
      if (Date.now() - lastReset < 600_000) continue;

      try {
        await resetQGamesData(schedule.codeId);
        await doc.ref.update({ lastResetAt: Date.now() });
        resetCount++;
        console.log(`[Cron] Auto-reset Q.Games for code ${schedule.codeId}`);
      } catch (err) {
        console.error(`[Cron] Failed to reset code ${schedule.codeId}:`, err);
        errors.push(schedule.codeId);
      }
    }

    return NextResponse.json({
      message: 'Done',
      resets: resetCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Cron] Q.Games auto-reset error:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
