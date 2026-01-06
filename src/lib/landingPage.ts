/**
 * Landing Page Helper Functions
 * Utilities for determining when to show landing page and grouping media into buttons
 */

import { MediaItem, MediaType, MediaSchedule } from '@/types';

// Media type icons and labels for landing page buttons
export const MEDIA_TYPE_INFO: Record<MediaType, {
  icon: string;          // Lucide icon name
  labelHe: string;
  labelEn: string;
}> = {
  image: { icon: 'Image', labelHe: 'אלבום', labelEn: 'Album' },
  gif: { icon: 'Image', labelHe: 'אלבום', labelEn: 'Album' },
  video: { icon: 'Video', labelHe: 'וידאו', labelEn: 'Video' },
  pdf: { icon: 'FileText', labelHe: 'מסמך', labelEn: 'Document' },
  link: { icon: 'ExternalLink', labelHe: 'קישור', labelEn: 'Link' },
  riddle: { icon: 'ScrollText', labelHe: 'חידה', labelEn: 'Riddle' },
  wordcloud: { icon: 'Cloud', labelHe: 'ענן מילים', labelEn: 'Word Cloud' },
  selfiebeam: { icon: 'Camera', labelHe: 'סלפי', labelEn: 'Selfie' },
  qvote: { icon: 'Vote', labelHe: 'הצבעה', labelEn: 'Vote' },
  weeklycal: { icon: 'CalendarDays', labelHe: 'לוח פעילות', labelEn: 'Schedule' },
  qstage: { icon: 'Sparkles', labelHe: 'הצבעה חיה', labelEn: 'Live Vote' },
  qhunt: { icon: 'Crosshair', labelHe: 'ציד קודים', labelEn: 'Code Hunt' },
  qtreasure: { icon: 'Map', labelHe: 'ציד אוצרות', labelEn: 'Treasure Hunt' },
};

/**
 * Check if schedule is currently active
 * @returns true if active, false if not active, null if no schedule
 */
export function isScheduleActive(schedule?: MediaSchedule): boolean | null {
  if (!schedule?.enabled) return null; // No schedule

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const { startDate, endDate, startTime, endTime } = schedule;

  // Check date range
  if (startDate && now < startDate) return false;
  if (endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    if (now > endOfDay) return false;
  }

  // Check time range
  if (startTime && currentTime < startTime) return false;
  if (endTime && currentTime > endTime) return false;

  return true;
}

/**
 * Determine if landing page should be shown for mixed media
 * @returns true if mixed media types that benefit from landing page
 */
export function shouldShowLandingPage(media: MediaItem[]): boolean {
  if (media.length <= 1) return false;

  // Check if all are images/gifs (use gallery instead)
  const allImages = media.every(m => m.type === 'image' || m.type === 'gif');
  if (allImages) return false;

  // Check if all are PDFs (use combined PDF viewer)
  const allPDFs = media.every(m => m.type === 'pdf');
  if (allPDFs) return false;

  // Mixed types - recommend landing page
  return true;
}

// Landing page button representation
export interface LandingPageButton {
  id: string;
  type: 'album' | 'single';
  mediaType: MediaType;
  media: MediaItem | MediaItem[];
  title: string;
  icon: string;
  order: number;  // For maintaining order
}

/**
 * Get appropriate title for a media item
 */
function getMediaTitle(item: MediaItem, locale: 'he' | 'en'): string {
  const isHe = locale === 'he';

  switch (item.type) {
    case 'riddle':
      return item.riddleContent?.title || (isHe ? 'חידה' : 'Riddle');
    case 'selfiebeam':
      return item.selfiebeamContent?.title || (isHe ? 'סלפי' : 'Selfie');
    case 'weeklycal':
      return item.weeklycalConfig?.branding?.landing?.title || item.title || (isHe ? 'לוח פעילות' : 'Schedule');
    case 'qvote':
      return item.qvoteConfig?.branding?.landingTitle || item.title || 'Q.Vote';
    case 'qstage':
      return item.qstageConfig?.branding?.eventName || item.title || 'Q.Stage';
    case 'qhunt':
      return item.qhuntConfig?.branding?.gameTitle || item.title || 'Q.Hunt';
    case 'pdf':
      return item.title || item.filename?.replace(/\.pdf$/i, '') || (isHe ? 'מסמך' : 'Document');
    case 'video':
      return item.title || (isHe ? 'וידאו' : 'Video');
    case 'link':
      return item.title || item.linkTitle || (isHe ? 'קישור' : 'Link');
    default:
      return item.title || MEDIA_TYPE_INFO[item.type]?.[isHe ? 'labelHe' : 'labelEn'] || item.type;
  }
}

/**
 * Group media items into landing page buttons
 * - Images/GIFs grouped into single "Album" button
 * - Each PDF gets its own button
 * - Each system item gets its own button
 * - Items filtered by schedule (inactive items excluded)
 */
export function groupMediaForLandingPage(
  media: MediaItem[],
  locale: 'he' | 'en'
): LandingPageButton[] {
  const buttons: LandingPageButton[] = [];
  const activeImages: MediaItem[] = [];
  let albumOrder = Infinity; // Track earliest image order for album placement

  // Sort by order first
  const sortedMedia = [...media].sort((a, b) => a.order - b.order);

  for (const item of sortedMedia) {
    // Check schedule - skip inactive items
    const scheduleStatus = isScheduleActive(item.schedule);
    if (scheduleStatus === false) continue; // Skip inactive scheduled items

    if (item.type === 'image' || item.type === 'gif') {
      activeImages.push(item);
      // Track the earliest order among images for album placement
      if (item.order < albumOrder) {
        albumOrder = item.order;
      }
    } else {
      // Each other type gets its own button
      buttons.push({
        id: item.id,
        type: 'single',
        mediaType: item.type,
        media: item,
        title: getMediaTitle(item, locale),
        icon: MEDIA_TYPE_INFO[item.type]?.icon || 'File',
        order: item.order,
      });
    }
  }

  // Add album button if there are active images
  if (activeImages.length > 0) {
    const isHe = locale === 'he';
    buttons.push({
      id: 'album',
      type: 'album',
      mediaType: 'image',
      media: activeImages,
      title: isHe ? 'אלבום' : 'Album',
      icon: 'Images',
      order: albumOrder, // Place album at earliest image position
    });
  }

  // Sort buttons by order to maintain original media list order
  return buttons.sort((a, b) => a.order - b.order);
}

/**
 * Get count of active media items (for display)
 */
export function getActiveMediaCount(media: MediaItem[]): number {
  return media.filter(item => {
    const scheduleStatus = isScheduleActive(item.schedule);
    return scheduleStatus !== false;
  }).length;
}
