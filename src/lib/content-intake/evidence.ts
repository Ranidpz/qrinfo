import type { IntakeAssignmentEvidence } from './types';

// Evidence comes from an authenticated, owner-scoped runner, never from model output.
export function parseEvidence(value: unknown): IntakeAssignmentEvidence[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 16) throw new Error('Invalid assignment evidence');
  return value.map(raw => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid assignment evidence');
    const item = raw as Record<string, unknown>;
    if (!['caption', 'reply', 'manual'].includes(String(item.kind))) throw new Error('Invalid evidence kind');
    const result: Record<string, unknown> = { kind: item.kind };
    for (const key of ['text', 'targetMessageId', 'messageId', 'senderId', 'attachmentSenderId', 'at']) {
      if (typeof item[key] !== 'string' || !item[key] || item[key].length > (key === 'text' ? 500 : 250)) throw new Error('Invalid evidence field');
      result[key] = item[key];
    }
    if (!Number.isFinite(Date.parse(item.at as string))) throw new Error('Invalid evidence time');
    if (item.targetCodeId !== undefined) {
      if (typeof item.targetCodeId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(item.targetCodeId)) throw new Error('Invalid target');
      result.targetCodeId = item.targetCodeId;
    }
    if (item.exclude === true) result.exclude = true;
    return result as unknown as IntakeAssignmentEvidence;
  });
}
