import type { ContentIntakeCommitResult, ContentIntakePreview } from './types';

export function collectBatchResults(
  preview: ContentIntakePreview,
  completedResults: ContentIntakeCommitResult[],
): ContentIntakeCommitResult[] {
  return preview.matches.map((match) => {
    const base = {
      fileId: match.file.id,
      filename: match.file.name,
      codeId: match.target?.codeId,
      shortId: match.target?.shortId,
      title: match.target?.title,
    };
    if (match.status !== 'matched') {
      return { ...base, status: 'skipped', reason: match.status };
    }
    const attempts = completedResults.filter((result) => result.fileId === match.file.id
      && result.filename === match.file.name && result.codeId === match.target?.codeId);
    // A retry reporting a duplicate must not hide an actual update in this batch.
    return attempts.find((result) => result.status === 'updated')
      || attempts.find((result) => result.status === 'skipped_duplicate')
      || attempts.find((result) => result.status === 'failed')
      || { ...base, status: 'failed', error: 'No confirmed update result; check before retrying' };
  });
}
