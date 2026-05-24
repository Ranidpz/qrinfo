export type ContentIntakeSource = 'whatsapp' | 'email' | 'drive' | 'manual' | 'api';

export interface IntakeFileCandidate {
  id?: string;
  name: string;
  size?: number;
  contentType?: string;
  receivedAt?: string;
  source?: ContentIntakeSource;
  sourceMessageId?: string;
  senderName?: string;
}

export interface ContentIntakeTarget {
  codeId: string;
  shortId?: string;
  title: string;
  ownerId: string;
  folderId?: string;
  folderName?: string;
  currentMediaType?: string;
  currentFilename?: string;
  aliases?: string[];
}

export type IntakeMatchStatus = 'matched' | 'needs_review' | 'duplicate' | 'unmatched';

export interface IntakeDetectedDate {
  value?: string;
  source: 'filename' | 'receivedAt' | 'none';
  raw?: string;
}

export interface IntakeFileMatch {
  file: IntakeFileCandidate;
  status: IntakeMatchStatus;
  confidence: number;
  target?: ContentIntakeTarget;
  detectedDate: IntakeDetectedDate;
  reasons: string[];
  warnings: string[];
}

export interface IntakeMissingTarget {
  target: ContentIntakeTarget;
  reason: string;
}

export interface ContentIntakePreview {
  workflow: 'fattal-booklets';
  generatedAt: string;
  commitReady: boolean;
  summary: {
    totalFiles: number;
    matched: number;
    needsReview: number;
    duplicate: number;
    unmatched: number;
    missingTargets: number;
  };
  matches: IntakeFileMatch[];
  missingTargets: IntakeMissingTarget[];
  suggestedReplyAfterCommitHe: string;
}
