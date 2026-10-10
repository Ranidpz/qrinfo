import { createHash, timingSafeEqual } from 'node:crypto';
import { FATTAL_BOOKLET_TARGETS } from './fattal';

export class CloudIntakeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requireCloud(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) throw new CloudIntakeError(status, message);
}
export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const isHash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
export const activeVersion = (media: unknown) => sha256(canonical(media ?? []));
export type CloudScope = 'read' | 'write';
export interface CloudConfig {
  enabled: boolean; writesEnabled: boolean;
  ownerId: string; ownerEmail: string; projectId: string;
}
export interface CloudGrant {
  workflow: 'fattal-cloud-v1'; keyHash: string;
  ownerId: string; ownerEmail: string; projectId: string;
  ownerVerifiedBy: string; ownerVerifiedAt: number;
  scopes: CloudScope[]; allowedTargets: string[]; expiresAt: number;
  revokedAt?: unknown; disabledAt?: unknown;
}
export function validateGrant(record: unknown, token: string, config: CloudConfig, scope: CloudScope, now = Date.now()): CloudGrant {
  requireCloud(config.enabled && config.ownerId && config.ownerEmail && config.projectId, 503, 'Cloud intake is not configured');
  requireCloud(record && typeof record === 'object', 401, 'Invalid cloud credential');
  const grant = record as CloudGrant;
  const hash = sha256(token);
  requireCloud(isHash(grant.keyHash) && timingSafeEqual(Buffer.from(hash), Buffer.from(grant.keyHash)), 401, 'Invalid cloud credential');
  requireCloud(grant.workflow === 'fattal-cloud-v1' && grant.revokedAt == null && grant.disabledAt == null
    && Number.isSafeInteger(grant.expiresAt) && grant.expiresAt > now, 401, 'Cloud credential expired or disabled');
  requireCloud(grant.ownerId === config.ownerId && grant.ownerEmail === config.ownerEmail && grant.projectId === config.projectId
    && typeof grant.ownerVerifiedBy === 'string' && grant.ownerVerifiedBy.trim()
    && Number.isSafeInteger(grant.ownerVerifiedAt) && grant.ownerVerifiedAt > 0 && grant.ownerVerifiedAt <= now, 403, 'Verified owner or project mismatch');
  requireCloud(Array.isArray(grant.scopes) && grant.scopes.includes('read') && grant.scopes.includes(scope)
    && grant.scopes.every(s => s === 'read' || s === 'write'), 403, 'Cloud operation is not permitted');
  const allowed = new Set(FATTAL_BOOKLET_TARGETS.map(t => t.shortId));
  requireCloud(Array.isArray(grant.allowedTargets) && grant.allowedTargets.length > 0 && grant.allowedTargets.length <= 12
    && new Set(grant.allowedTargets).size === grant.allowedTargets.length
    && grant.allowedTargets.every(id => allowed.has(id)), 403, 'Invalid cloud target bounds');
  return grant;
}
export function cloudTokenId(token: string): string {
  const match = /^tq_fc_([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  requireCloud(match, 401, 'A dedicated cloud credential is required');
  return match[1];
}
function bounded(value: unknown, max = 300): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
}
export interface SourceIdentity { messageId: string; fileId: string; sha256: string }
export interface CloudManifest {
  protocol: 1; ownerId: string; projectId: string; shortId: string; hotel: string;
  period: { kind: 'weekday' | 'weekend'; startDate: string; endDate: string };
  filename: string; sha256: string; size: number; expectedVersion: string;
  sourceGroupId: string; sources: SourceIdentity[];
  supersedes: SourceIdentity[];
  review: { reviewer: string; reviewedAt: number; evidence: string; contextResolved: true; replacementApproved: true };
}
function identities(value: unknown): value is SourceIdentity[] {
  return Array.isArray(value) && value.length <= 100 && value.every(v => v && bounded(v.messageId) && bounded(v.fileId) && isHash(v.sha256));
}
function date(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
// No filename/adjacency inference. A review is an explicit assertion by the
// credential holder; it does not claim that the server observed WhatsApp.
export function parseManifest(value: unknown, grant: Pick<CloudGrant, 'ownerId' | 'projectId' | 'allowedTargets'>, now = Date.now(), fresh = true): CloudManifest {
  requireCloud(value && typeof value === 'object', 400, 'A reviewed manifest is required');
  const m = value as CloudManifest;
  const target = FATTAL_BOOKLET_TARGETS.find(t => t.shortId === m.shortId);
  requireCloud(m.protocol === 1 && m.ownerId === grant.ownerId && m.projectId === grant.projectId, 403, 'Manifest owner or project mismatch');
  requireCloud(target && grant.allowedTargets.includes(m.shortId) && m.hotel === target.key, 403, 'Manifest hotel or target mismatch');
  requireCloud(m.period && ['weekday', 'weekend'].includes(m.period.kind) && date(m.period.startDate) && date(m.period.endDate)
    && Date.parse(m.period.endDate) >= Date.parse(m.period.startDate)
    && Date.parse(m.period.endDate) - Date.parse(m.period.startDate) <= 7 * 86400000, 400, 'Explicit booklet period is required');
  requireCloud(bounded(m.filename, 200) && m.filename.toLowerCase().endsWith('.pdf') && !/[\\/]/.test(m.filename)
    && isHash(m.sha256) && isHash(m.expectedVersion) && Number.isSafeInteger(m.size) && m.size > 5 && m.size <= 3 * 1024 * 1024, 400, 'Invalid file identity or size');
  requireCloud(bounded(m.sourceGroupId) && identities(m.sources) && m.sources.length > 0
    && m.sources.every(s => s.sha256 === m.sha256) && identities(m.supersedes)
    && m.supersedes.every(s => s.sha256 !== m.sha256), 400, 'Source identity or replacement evidence is inconsistent');
  const sourceIds = [...m.sources, ...m.supersedes].map(s => `${s.messageId}\u0000${s.fileId}`);
  requireCloud(new Set(sourceIds).size === sourceIds.length, 400, 'Conflicting or repeated source identity');
  const review = m.review;
  requireCloud(review && bounded(review.reviewer) && bounded(review.evidence, 2000)
    && review.contextResolved === true && review.replacementApproved === true
    && Number.isSafeInteger(review.reviewedAt) && review.reviewedAt > 0 && review.reviewedAt <= now
    && (!fresh || now - review.reviewedAt <= 60 * 60 * 1000), 409, 'A fresh resolved replacement review is required');
  // Project only supported fields. Digest binds every accepted review field.
  const source = (s: SourceIdentity) => ({ messageId: s.messageId, fileId: s.fileId, sha256: s.sha256 });
  return { protocol: 1, ownerId: m.ownerId, projectId: m.projectId, shortId: m.shortId, hotel: m.hotel,
    period: { kind: m.period.kind, startDate: m.period.startDate, endDate: m.period.endDate }, filename: m.filename,
    sha256: m.sha256, size: m.size, expectedVersion: m.expectedVersion, sourceGroupId: m.sourceGroupId,
    sources: m.sources.map(source), supersedes: m.supersedes.map(source),
    review: { reviewer: review.reviewer, reviewedAt: review.reviewedAt, evidence: review.evidence, contextResolved: true, replacementApproved: true } };
}
export const manifestId = (m: CloudManifest) => sha256(canonical(m));
export const fileLedgerId = (m: CloudManifest) => sha256(`${m.ownerId}:${m.shortId}:${m.sha256}`);
