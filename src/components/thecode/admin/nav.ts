import type { TheCodeIssue } from '@/types/thecode';

export type AdminTab =
  | 'overview' | 'spots' | 'gnomes' | 'riddles' | 'phrases' | 'print' | 'setup' | 'players' | 'settings';

/** Where to go to fix something: a tab, plus what to open there. */
export interface AdminTarget {
  tab: AdminTab;
  spotId?: string;
  gnomeId?: string;
  riddleId?: string;
  phraseId?: string;
  /** Riddles screen: "find me a source for this letter". */
  letter?: string;
  /** Riddles screen: open the one-click bank fill preview. */
  fill?: boolean;
}

export type Navigate = (target: AdminTarget) => void;

export function targetForIssue(issue: TheCodeIssue): AdminTarget {
  switch (issue.code) {
    case 'PHRASE_LETTER_MISSING':
      return issue.riddleId
        ? { tab: 'riddles', gnomeId: issue.gnomeId, riddleId: issue.riddleId }
        : { tab: 'phrases', phraseId: issue.phraseId };
    case 'PHRASE_INVALID_CHARS':
    case 'PHRASE_TOO_SHORT':
    case 'NO_ACTIVE_PHRASE':
      return { tab: 'phrases', phraseId: issue.phraseId };
    case 'GNOME_WITHOUT_RIDDLE':
    case 'RIDDLE_AMBIGUOUS_LETTER':
      return { tab: 'riddles', gnomeId: issue.gnomeId, riddleId: issue.riddleId };
    case 'GNOME_SPOT_MISSING':
      return { tab: 'gnomes', gnomeId: issue.gnomeId };
    case 'DUPLICATE_COLORS_AT_SPOT':
    case 'CONFUSABLE_COLORS_AT_SPOT':
      return { tab: 'gnomes', gnomeId: issue.gnomeId, spotId: issue.spotId };
    case 'SPOT_WITHOUT_HINT':
      return { tab: 'spots', spotId: issue.spotId };
    case 'GNOME_NOT_VERIFIED':
      return { tab: 'setup', gnomeId: issue.gnomeId };
    case 'FEW_FRESH_ROUNDS':
      return { tab: 'phrases' };
    case 'GNOMES_CLUSTERED':
      return { tab: 'gnomes', spotId: issue.spotId };
    case 'GNOME_COLOR_UNAVAILABLE':
      return { tab: 'gnomes', gnomeId: issue.gnomeId, spotId: issue.spotId };
    default:
      return { tab: 'overview' };
  }
}

/** Label of the button that takes the operator to the fix. */
export function fixLabel(issue: TheCodeIssue): string {
  switch (issue.code) {
    case 'PHRASE_LETTER_MISSING':
      return issue.riddleId ? 'לחידה' : 'למשפט';
    case 'GNOME_WITHOUT_RIDDLE':
      return 'הוסיפו חידה';
    case 'RIDDLE_AMBIGUOUS_LETTER':
      return 'לחידה';
    case 'DUPLICATE_COLORS_AT_SPOT':
    case 'CONFUSABLE_COLORS_AT_SPOT':
    case 'GNOME_SPOT_MISSING':
      return 'לגמד';
    case 'SPOT_WITHOUT_HINT':
      return 'הוסיפו רמז';
    case 'GNOME_NOT_VERIFIED':
      return 'למצב התקנה';
    case 'FEW_FRESH_ROUNDS':
      return 'לאותיות';
    case 'GNOMES_CLUSTERED':
      return 'לגמדים';
    case 'GNOME_COLOR_UNAVAILABLE':
      return 'לגמד';
    default:
      return 'לתיקון';
  }
}
