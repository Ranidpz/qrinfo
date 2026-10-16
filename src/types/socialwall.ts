// Social Wall — a private social network for one event (feed + likes + LED wall).
// Spec: docs/SOCIAL_WALL.md. The config below sits on the PUBLIC code doc
// (codes/{id}.media[].socialWallConfig); the two operator links' tokens are split off to
// codes/{id}/private/secrets by SECRET_FIELDS (src/lib/codeSecrets.ts) on every save.
// Participant data (members, posts, the allowlist) lives in Admin-SDK-only subcollections
// behind src/lib/socialwall/store.ts. Every field is optional on disk: always read the config
// through resolveSocialWallConfig() so older codes pick up new defaults.

/** Who may join: anyone who scans, a WhatsApp-verified phone, a phone on the HR list, or both. */
export type SocialWallAccess = 'open' | 'whatsapp' | 'allowlist' | 'allowlist_whatsapp';

/** Feed: 'post' = a post shows at once and operators can hide it; 'pre' = hidden until approved. */
export type SocialWallFeedModeration = 'post' | 'pre';

/** Screen: 'auto' = a visible post goes up after screenDelaySec unless hidden; 'manual' = only approved posts. */
export type SocialWallScreenModeration = 'auto' | 'manual';

/** Live screen state set by an operator: normal, frozen on the current grid, or the branded slate (panic). */
export type SocialWallScreenState = 'live' | 'frozen' | 'slate';

export interface SocialWallGroup {
  id: string;
  label: string;
  color?: string;
}

export interface SocialWallBranding {
  logoUrl?: string;
  coverImageUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  screenTitle?: string;
  screenSubtitle?: string;
  screenSideText?: string;
  screenBackgroundUrl?: string;
  screenBackgroundColor?: string;
}

/** A "production team" cheer post. `text` may hold placeholders, see CHEER_PLACEHOLDERS. */
export interface SocialWallCheer {
  id: string;
  text: string;
  on: boolean;
}

export interface SocialWallCheersConfig {
  enabled?: boolean;
  /** A cheer post after every N photos in the feed */
  every?: number;
  /** Shown as the author of the cheer posts (default: צוות ההפקה) */
  author?: string;
  items?: SocialWallCheer[];
}

/** Live values a cheer line can use. A line whose placeholder has no value yet is skipped. */
export const CHEER_PLACEHOLDERS = [
  { key: '{hot}', he: 'המחלקה עם הכי הרבה לייקים', en: 'department with most likes' },
  { key: '{hotLikes}', he: 'הלייקים שלה', en: 'its likes' },
  { key: '{active}', he: 'המחלקה עם הכי הרבה תמונות', en: 'department with most photos' },
  { key: '{activePhotos}', he: 'התמונות שלה', en: 'its photos' },
  { key: '{second}', he: 'המחלקה במקום השני', en: 'second department' },
  { key: '{gap}', he: 'הפרש הלייקים בין הראשונה לשנייה', en: 'likes gap first-second' },
  { key: '{photos}', he: 'כל התמונות באירוע', en: 'all photos' },
  { key: '{likes}', he: 'כל הלייקים באירוע', en: 'all likes' },
] as const;

export const DEFAULT_CHEERS: SocialWallCheer[] = [
  { id: 'c1', on: true, text: '🔥 אלופים! {hot} מובילים עם {hotLikes} ❤️' },
  { id: 'c2', on: true, text: '🤳 איפה הסלפי שלכם? מעלים עכשיו!' },
  { id: 'c3', on: true, text: '📸 {active} הכי מצלמים היום: {activePhotos} תמונות' },
  { id: 'c4', on: true, text: '💪 כבר {photos} תמונות באירוע! תמשיכו ככה' },
  { id: 'c5', on: true, text: '🏁 {second} רודפים אחרי {hot}! רק {gap} ❤️ הפרש' },
  { id: 'c6', on: true, text: '🙌 אנשים טובים. רגעים גדולים.' },
  { id: 'c7', on: true, text: '❤️ {likes} לבבות, ועוד לא סיימנו' },
  { id: 'c8', on: true, text: '🎉 כל תמונה שלכם מקדמת את המחלקה' },
  { id: 'c9', on: true, text: '😍 שווה לייק? תנו לתמונה הכי טובה שראיתם היום' },
  { id: 'c10', on: true, text: '🏆 מי תיקח את הגביע? המרוץ בעיצומו' },
];

export interface ResolvedCheers {
  enabled: boolean;
  every: number;
  author: string;
  items: SocialWallCheer[];
}

export function resolveCheers(raw: SocialWallCheersConfig | undefined): ResolvedCheers {
  const items = Array.isArray(raw?.items)
    ? raw!.items
        .filter((c): c is SocialWallCheer => !!c && typeof c.text === 'string' && !!c.text.trim())
        .slice(0, 30)
        .map((c) => ({ id: String(c.id || ''), on: c.on !== false, text: c.text.slice(0, 120) }))
    : DEFAULT_CHEERS;
  const every = typeof raw?.every === 'number' && Number.isFinite(raw.every) ? Math.min(20, Math.max(2, Math.round(raw.every))) : 4;
  return {
    enabled: raw?.enabled !== false,
    every,
    author: typeof raw?.author === 'string' && raw.author.trim() ? raw.author.trim().slice(0, 40) : '',
    items,
  };
}

export interface SocialWallConfig {
  eventTitle?: string;
  locale?: 'he' | 'en';
  access?: SocialWallAccess;
  /** What a group is called at this event: מחלקה / צוות / כיתה ... */
  groupLabel?: string;
  groups?: SocialWallGroup[];
  feedModeration?: SocialWallFeedModeration;
  screenModeration?: SocialWallScreenModeration;
  screenDelaySec?: number;
  captionMax?: number;
  maxPostsPerMember?: number;
  maxMembers?: number;
  branding?: SocialWallBranding;
  cheers?: SocialWallCheersConfig;
  /** "How it works" card shown once, right after joining. Absent = shown, no prizes line. */
  guide?: SocialWallGuideConfig;
  /** Big-screen link token — secret, stored in private/secrets. */
  screenToken?: string;
  /** On-site operator (moderation) link token — secret, stored in private/secrets. */
  moderatorToken?: string;
  eventEndsAt?: string;
  retentionDays?: number;
  /** Bytes of the stored logo / cover (owner storage accounting on replace). */
  logoSize?: number;
  coverSize?: number;
}

export interface ResolvedSocialWallConfig {
  eventTitle: string;
  locale: 'he' | 'en';
  access: SocialWallAccess;
  groupLabel: string;
  groups: SocialWallGroup[];
  feedModeration: SocialWallFeedModeration;
  screenModeration: SocialWallScreenModeration;
  screenDelaySec: number;
  captionMax: number;
  maxPostsPerMember: number;
  maxMembers: number;
  branding: SocialWallBranding;
  eventEndsAt: string | null;
  retentionDays: number;
}

export const SOCIALWALL_LIMITS = {
  nameMin: 2,
  nameMax: 40,
  captionHardMax: 280,
  groupsMax: 60,
  groupLabelMax: 40,
  postsPerMemberMax: 500,
  membersMax: 20000,
  screenDelayMaxSec: 600,
  retentionMaxDays: 365,
} as const;

const DEFAULTS: ResolvedSocialWallConfig = {
  eventTitle: '',
  locale: 'he',
  access: 'open',
  groupLabel: '',
  groups: [],
  feedModeration: 'post',
  screenModeration: 'auto',
  screenDelaySec: 60,
  captionMax: 120,
  maxPostsPerMember: 40,
  maxMembers: 3000,
  branding: {},
  eventEndsAt: null,
  retentionDays: 30,
};

export const DEFAULT_SOCIALWALL_CONFIG: SocialWallConfig = {
  access: 'open',
  feedModeration: 'post',
  screenModeration: 'auto',
  screenDelaySec: 60,
  captionMax: 120,
  maxPostsPerMember: 40,
  groups: [],
  branding: { primaryColor: '#6d28d9', secondaryColor: '#2563eb' },
};

const ACCESS: SocialWallAccess[] = ['open', 'whatsapp', 'allowlist', 'allowlist_whatsapp'];

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * The config every reader uses. The owner writes the raw config from the editor, so the
 * server treats it as untrusted: enums fall back, numbers are clamped, groups are capped.
 */
export interface SocialWallGuideConfig {
  enabled?: boolean;
  /** Adds "the top photos win prizes" — only when the organizer actually gives prizes. */
  prizes?: boolean;
}

export function resolveGuide(g: SocialWallGuideConfig | undefined): { enabled: boolean; prizes: boolean } {
  return { enabled: g?.enabled !== false, prizes: g?.prizes === true };
}

export function resolveSocialWallConfig(raw: SocialWallConfig | undefined | null): ResolvedSocialWallConfig {
  const c = raw || {};
  const groups = Array.isArray(c.groups)
    ? c.groups
        .filter((g): g is SocialWallGroup => !!g && typeof g.id === 'string' && !!g.id && typeof g.label === 'string' && !!g.label.trim())
        .slice(0, SOCIALWALL_LIMITS.groupsMax)
    : [];
  return {
    eventTitle: typeof c.eventTitle === 'string' ? c.eventTitle.slice(0, 120) : DEFAULTS.eventTitle,
    locale: c.locale === 'en' ? 'en' : 'he',
    access: ACCESS.includes(c.access as SocialWallAccess) ? (c.access as SocialWallAccess) : DEFAULTS.access,
    groupLabel: typeof c.groupLabel === 'string' ? c.groupLabel.slice(0, SOCIALWALL_LIMITS.groupLabelMax) : DEFAULTS.groupLabel,
    groups,
    feedModeration: c.feedModeration === 'pre' ? 'pre' : 'post',
    screenModeration: c.screenModeration === 'manual' ? 'manual' : 'auto',
    screenDelaySec: clampInt(c.screenDelaySec, 0, SOCIALWALL_LIMITS.screenDelayMaxSec, DEFAULTS.screenDelaySec),
    captionMax: clampInt(c.captionMax, 0, SOCIALWALL_LIMITS.captionHardMax, DEFAULTS.captionMax),
    maxPostsPerMember: clampInt(c.maxPostsPerMember, 1, SOCIALWALL_LIMITS.postsPerMemberMax, DEFAULTS.maxPostsPerMember),
    maxMembers: clampInt(c.maxMembers, 1, SOCIALWALL_LIMITS.membersMax, DEFAULTS.maxMembers),
    branding: c.branding && typeof c.branding === 'object' ? c.branding : {},
    eventEndsAt: typeof c.eventEndsAt === 'string' && !Number.isNaN(Date.parse(c.eventEndsAt)) ? c.eventEndsAt : null,
    retentionDays: clampInt(c.retentionDays, 1, SOCIALWALL_LIMITS.retentionMaxDays, DEFAULTS.retentionDays),
  };
}

export const accessNeedsPhone = (a: SocialWallAccess) => a !== 'open';
export const accessNeedsOtp = (a: SocialWallAccess) => a === 'whatsapp' || a === 'allowlist_whatsapp';
export const accessUsesAllowlist = (a: SocialWallAccess) => a === 'allowlist' || a === 'allowlist_whatsapp';

// ---- Wire shapes (API responses) ----

export interface SocialWallPostView {
  id: string;
  authorName: string;
  groupId: string | null;
  caption: string;
  fullUrl: string;
  cardUrl: string;
  width: number;
  height: number;
  likeCount: number;
  likedByMe?: boolean;
  mine?: boolean;
  /** Only sent to the author / operators: 'pending' while waiting for approval. */
  status?: 'visible' | 'pending' | 'hidden';
  createdAt: number;
  /** Delta responses: the post left the feed (hidden or deleted). */
  removed?: boolean;
}

export interface SocialWallScreenPost {
  id: string;
  authorName: string;
  groupId: string | null;
  caption: string;
  fullUrl: string;
  cardUrl: string;
  width: number;
  height: number;
  likeCount: number;
  pinned: boolean;
  createdAt: number;
  /** false = counts toward group totals but is not (yet) on the wall. */
  onScreen: boolean;
  /** auto mode: when it goes up (ms). */
  eligibleAt: number;
  removed?: boolean;
}

export interface SocialWallControl {
  rev: number;
  screen: SocialWallScreenState;
  uploads: boolean;
}

export const DEFAULT_SOCIALWALL_CONTROL: SocialWallControl = { rev: 0, screen: 'live', uploads: true };
