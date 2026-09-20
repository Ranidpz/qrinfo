import type { ContentIntakePreview, IntakeFileCandidate } from './types';

// Keep the complete manifest when splitting transport requests. Otherwise two
// conflicting PDFs become individually confident matches and overwrite each other.
export function selectBatchMatches(preview: ContentIntakePreview, files: IntakeFileCandidate[]): ContentIntakePreview {
  const selected = new Set<string>();
  const matches = files.map((file) => {
    const match = preview.matches.find((candidate) => candidate.file.id === file.id);
    if (!file.id || selected.has(file.id) || !match
      || match.file.name !== file.name || match.file.size !== file.size) {
      throw new Error('Uploaded files do not match the saved batch preview');
    }
    selected.add(file.id);
    return { ...match, file };
  });
  return { ...preview, matches };
}
