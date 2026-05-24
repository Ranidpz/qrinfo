import type {
  ContentIntakePreview,
  ContentIntakeTarget,
  IntakeDetectedDate,
  IntakeFileCandidate,
  IntakeFileMatch,
} from './types';

type AreaId = 'eilat' | 'dead-sea' | 'tiberias';

interface FattalAliasSet {
  key: string;
  area?: AreaId;
  aliases: string[];
}

interface FattalPreviewParams {
  files: IntakeFileCandidate[];
  targets: ContentIntakeTarget[];
  receivedAt?: string;
  generatedAt?: Date;
}

interface ScoredTarget {
  target: ContentIntakeTarget;
  score: number;
  reasons: string[];
  warnings: string[];
}

export const FATTAL_DEFAULT_FOLDER_NAMES = ['אילת', 'ים המלח', 'טבריה'];

const AREA_ALIASES: Record<AreaId, string[]> = {
  eilat: ['אילת', 'eilat'],
  'dead-sea': ['ים המלח', 'dead sea', 'deadsea'],
  tiberias: ['טבריה', 'tiberias', 'kinneret', 'כנרת'],
};

const FATTAL_ALIAS_SETS: FattalAliasSet[] = [
  {
    key: 'royal-resort-eilat',
    area: 'eilat',
    aliases: ['royal resort eilat', 'רויאל ריזורט אילת', 'רויאל ריזורט'],
  },
  {
    key: 'herods-eilat',
    area: 'eilat',
    aliases: ['herods eilat', 'הרודס אילת'],
  },
  {
    key: 'u-splash-eilat',
    area: 'eilat',
    aliases: ['u splash eilat', 'u-splash eilat', 'יו ספלאש אילת', 'ספלאש אילת'],
  },
  {
    key: 'leonardo-plaza-eilat',
    area: 'eilat',
    aliases: ['leonardo plaza eilat', 'לאונרדו פלאזה אילת', 'לאונרדו פלזה אילת'],
  },
  {
    key: 'u-privilege-eilat',
    area: 'eilat',
    aliases: ['u privilege eilat', 'יו פריוילג אילת', 'יו פריווילג אילת', 'פריוילג אילת', 'פריווילג אילת'],
  },
  {
    key: 'magic-palace-eilat',
    area: 'eilat',
    aliases: ['magic palace eilat', 'מגיק פאלאס אילת', "מג'יק פאלאס אילת", 'פאלאס אילת'],
  },
  {
    key: 'leonardo-club-eilat',
    area: 'eilat',
    aliases: ['leonardo club eilat', 'לאונרדו קלאב אילת', 'קלאב אילת'],
  },
  {
    key: 'u-coral-eilat',
    area: 'eilat',
    aliases: ['u coral eilat', 'u coral beach eilat', 'יו קורל אילת', 'יי קורל אילת', 'יו קורל', 'יי קורל'],
  },
  {
    key: 'herods-dead-sea',
    area: 'dead-sea',
    aliases: ['herods dead sea', 'herods ים המלח', 'הרודס ים המלח'],
  },
  {
    key: 'leonardo-plaza-dead-sea',
    area: 'dead-sea',
    aliases: ['leonardo plaza dead sea', 'לאונרדו פלאזה ים המלח', 'לאונרדו פלזה ים המלח'],
  },
  {
    key: 'leonardo-club-dead-sea',
    area: 'dead-sea',
    aliases: ['leonardo club dead sea', 'לאונרדו קלאב ים המלח'],
  },
  {
    key: 'leonardo-plaza-tiberias',
    area: 'tiberias',
    aliases: ['leonardo plaza tiberias', 'לאונרדו פלאזה טבריה', 'לאונרדו פלזה טבריה'],
  },
  {
    key: 'leonardo-club-tiberias',
    area: 'tiberias',
    aliases: ['leonardo club tiberias', 'לאונרדו קלאב טבריה'],
  },
  {
    key: 'u-boutique-kinneret',
    area: 'tiberias',
    aliases: ['u boutique kinneret', 'יו בוטיק כנרת', 'יו בוטיק טבריה'],
  },
];

const NOISE_TOKENS = new Set([
  'pdf',
  'חוברת',
  'בידור',
  'תכנית',
  'תוכנית',
  'סופש',
  'סופ"ש',
  'אמצש',
  'אמצ"ש',
  'אמצע',
  'שבוע',
  'אמעצש',
  'אמעצ"ש',
]);

export function buildFattalPreview(params: FattalPreviewParams): ContentIntakePreview {
  const generatedAt = params.generatedAt || new Date();
  const normalizedTargets = params.targets.map((target) => ({
    ...target,
    aliases: getTargetAliases(target),
  }));

  let matches = params.files.map((file) =>
    matchFattalFile(file, normalizedTargets, params.receivedAt)
  );

  matches = markDuplicateMatches(matches);

  const associatedTargetIds = new Set(
    matches
      .filter((match) => match.target)
      .map((match) => match.target?.codeId)
      .filter(Boolean) as string[]
  );

  const missingTargets = normalizedTargets
    .filter((target) => !associatedTargetIds.has(target.codeId))
    .map((target) => ({
      target,
      reason: 'No received PDF matched this QR code target',
    }));

  const summary = {
    totalFiles: matches.length,
    matched: matches.filter((match) => match.status === 'matched').length,
    needsReview: matches.filter((match) => match.status === 'needs_review').length,
    duplicate: matches.filter((match) => match.status === 'duplicate').length,
    unmatched: matches.filter((match) => match.status === 'unmatched').length,
    missingTargets: missingTargets.length,
  };

  const commitReady =
    summary.totalFiles > 0 &&
    summary.matched === summary.totalFiles &&
    summary.needsReview === 0 &&
    summary.duplicate === 0 &&
    summary.unmatched === 0 &&
    summary.missingTargets === 0;

  return {
    workflow: 'fattal-booklets',
    generatedAt: generatedAt.toISOString(),
    commitReady,
    summary,
    matches,
    missingTargets,
    suggestedReplyAfterCommitHe: buildSuggestedReply(matches, missingTargets),
  };
}

function matchFattalFile(
  file: IntakeFileCandidate,
  targets: ContentIntakeTarget[],
  defaultReceivedAt?: string
): IntakeFileMatch {
  const detectedDate = detectFileDate(file.name, file.receivedAt || defaultReceivedAt);
  const warnings = [...dateWarnings(detectedDate, file.receivedAt || defaultReceivedAt)];

  if (file.contentType && file.contentType !== 'application/pdf') {
    warnings.push(`File content type is ${file.contentType}, expected application/pdf`);
  }

  const scoredTargets = targets
    .map((target) => scoreTarget(file, target))
    .sort((a, b) => b.score - a.score);

  const [best, second] = scoredTargets;
  if (!best || best.score < 50) {
    return {
      file,
      status: 'unmatched',
      confidence: best?.score || 0,
      detectedDate,
      reasons: best?.reasons || [],
      warnings,
    };
  }

  const confidenceGap = best.score - (second?.score || 0);
  const isConfident = best.score >= 78 && confidenceGap >= 12;

  return {
    file,
    status: isConfident ? 'matched' : 'needs_review',
    confidence: best.score,
    target: best.target,
    detectedDate,
    reasons: [...best.reasons, ...(!isConfident ? [`Closest alternative is ${second?.target.title || 'none'}`] : [])],
    warnings: [...warnings, ...best.warnings],
  };
}

function scoreTarget(file: IntakeFileCandidate, target: ContentIntakeTarget): ScoredTarget {
  const fileText = normalizeText(file.name);
  const fileArea = detectArea(fileText);
  const targetArea = detectArea(normalizeText(`${target.folderName || ''} ${target.title}`));
  const aliases = getTargetAliases(target).map(normalizeText).filter(Boolean);
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  for (const alias of aliases) {
    if (alias.length >= 3 && fileText.includes(alias)) {
      const aliasScore = alias.split(' ').length >= 2 ? 88 : 72;
      if (aliasScore > score) {
        score = aliasScore;
        reasons.splice(0, reasons.length, `Filename contains alias "${alias}"`);
      }
    }
  }

  if (score < 80) {
    const fileTokens = tokenize(fileText);
    const targetTokens = tokenize(normalizeText(`${target.title} ${target.currentFilename || ''}`));
    const overlap = targetTokens.filter((token) => fileTokens.includes(token));
    if (targetTokens.length > 0 && overlap.length > 0) {
      const overlapRatio = overlap.length / targetTokens.length;
      const overlapScore = Math.round(30 + overlapRatio * 45);
      if (overlapScore > score) {
        score = overlapScore;
        reasons.splice(0, reasons.length, `Filename shares target tokens: ${overlap.join(', ')}`);
      }
    }
  }

  if (fileArea && targetArea && fileArea === targetArea) {
    score += 8;
    reasons.push(`Area matches ${areaLabel(targetArea)}`);
  } else if (fileArea && targetArea && fileArea !== targetArea) {
    score -= 25;
    warnings.push(`Filename area looks like ${areaLabel(fileArea)}, target is ${areaLabel(targetArea)}`);
  }

  if (target.currentMediaType && target.currentMediaType !== 'pdf') {
    warnings.push(`Target current media type is ${target.currentMediaType}, not pdf`);
  }

  return {
    target,
    score: clampScore(score),
    reasons,
    warnings,
  };
}

function markDuplicateMatches(matches: IntakeFileMatch[]): IntakeFileMatch[] {
  const targetCounts = new Map<string, number>();
  for (const match of matches) {
    if (match.status === 'matched' && match.target) {
      targetCounts.set(match.target.codeId, (targetCounts.get(match.target.codeId) || 0) + 1);
    }
  }

  return matches.map((match) => {
    if (!match.target || match.status !== 'matched') return match;
    if ((targetCounts.get(match.target.codeId) || 0) <= 1) return match;

    return {
      ...match,
      status: 'duplicate',
      warnings: [...match.warnings, 'Multiple received files matched the same QR code target'],
    };
  });
}

function getTargetAliases(target: ContentIntakeTarget): string[] {
  const baseAliases = [target.title, target.currentFilename, target.folderName, ...(target.aliases || [])]
    .filter(Boolean) as string[];
  const normalizedTitle = normalizeText(`${target.title} ${target.folderName || ''}`);

  const matchingSets = FATTAL_ALIAS_SETS.filter((set) =>
    set.aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias);
      return normalizedTitle.includes(normalizedAlias) || aliasTokenOverlap(normalizedTitle, normalizedAlias) >= 0.65;
    })
  );

  return [...baseAliases, ...matchingSets.flatMap((set) => set.aliases)];
}

function aliasTokenOverlap(text: string, alias: string): number {
  const textTokens = tokenize(text);
  const aliasTokens = tokenize(alias);
  if (aliasTokens.length === 0) return 0;
  return aliasTokens.filter((token) => textTokens.includes(token)).length / aliasTokens.length;
}

function detectFileDate(filename: string, fallbackReceivedAt?: string): IntakeDetectedDate {
  const dotDate = filename.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (dotDate) {
    const parsed = dateFromParts(dotDate[1], dotDate[2], dotDate[3]);
    if (parsed) return { value: parsed, source: 'filename', raw: dotDate[0] };
  }

  const compactDates = filename.match(/\b\d{6,8}\b/g) || [];
  for (const raw of compactDates) {
    const parsed = raw.length === 8
      ? dateFromParts(raw.slice(0, 2), raw.slice(2, 4), raw.slice(4))
      : dateFromParts(raw.slice(0, 2), raw.slice(2, 4), raw.slice(4));
    if (parsed) return { value: parsed, source: 'filename', raw };
  }

  const received = fallbackReceivedAt ? dateKeyFromString(fallbackReceivedAt) : undefined;
  return received
    ? { value: received, source: 'receivedAt', raw: fallbackReceivedAt }
    : { source: 'none' };
}

function dateWarnings(detectedDate: IntakeDetectedDate, receivedAt?: string): string[] {
  if (!detectedDate.value || !receivedAt || detectedDate.source !== 'filename') return [];
  const receivedKey = dateKeyFromString(receivedAt);
  if (!receivedKey) return [];

  const days = Math.abs(daysBetween(detectedDate.value, receivedKey));
  return days > 14
    ? [`Filename date is ${days} days away from received date`]
    : [];
}

function dateFromParts(dayRaw: string, monthRaw: string, yearRaw: string): string | undefined {
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return undefined;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2020 || year > 2100) return undefined;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1 || date.getUTCFullYear() !== year) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

function dateKeyFromString(value: string): string | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const aTime = new Date(`${a}T00:00:00.000Z`).getTime();
  const bTime = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.round((aTime - bTime) / 86400000);
}

function detectArea(normalizedText: string): AreaId | undefined {
  for (const [area, aliases] of Object.entries(AREA_ALIASES) as [AreaId, string[]][]) {
    if (aliases.some((alias) => normalizedText.includes(normalizeText(alias)))) {
      return area;
    }
  }
  return undefined;
}

function areaLabel(area: AreaId): string {
  return AREA_ALIASES[area][0];
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !NOISE_TOKENS.has(token));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (char) => ({ 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }[char] || char))
    .replace(/\.(pdf|jpg|jpeg|png|webp)$/i, '')
    .replace(/["'`׳״]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function buildSuggestedReply(matches: IntakeFileMatch[], missingTargets: { target: ContentIntakeTarget }[]): string {
  const matched = matches.filter((match) => match.status === 'matched');
  const needsReview = matches.filter((match) => match.status === 'needs_review' || match.status === 'duplicate');
  const unmatched = matches.filter((match) => match.status === 'unmatched');

  if (needsReview.length === 0 && unmatched.length === 0 && missingTargets.length === 0) {
    const hotels = matched.map((match) => match.target?.title).filter(Boolean).join(', ');
    return `תודה, בוצע ✅\nעודכנו ${matched.length} חוברות${hotels ? `: ${hotels}` : ''}`;
  }

  const lines = ['קיבלתי את הקבצים, אבל צריך בדיקה לפני עדכון מלא:'];
  if (matched.length > 0) lines.push(`מוכנים לעדכון: ${matched.length}`);
  if (needsReview.length > 0) lines.push(`דורשים בדיקה: ${needsReview.map((match) => match.file.name).join(', ')}`);
  if (unmatched.length > 0) lines.push(`לא זוהו: ${unmatched.map((match) => match.file.name).join(', ')}`);
  if (missingTargets.length > 0) lines.push(`חסרים: ${missingTargets.map(({ target }) => target.title).join(', ')}`);
  return lines.join('\n');
}
