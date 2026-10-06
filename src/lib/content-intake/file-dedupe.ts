import { createHash } from 'node:crypto';

export function buildDedupeId(codeId: string, fileHash: string, sourceMessageId?: string): string {
  const basis = `${sourceMessageId || 'no-message'}:${fileHash}`;
  return `fattal-booklets_${codeId}_${createHash('sha256').update(basis).digest('hex')}`;
}
