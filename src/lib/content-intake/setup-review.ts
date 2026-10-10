import { FATTAL_BOOKLET_TARGETS } from './fattal';

export type SetupTargetState = 'valid' | 'missing' | 'duplicate' | 'child' | 'owner_mismatch';
export interface SetupSelection { ownerId: string; ownerEmail: string; projectId: string; durationHours: number }
export interface SetupBindings {
  projectId: string; publicProjectId: string; cloudProjectId?: string;
  cloudOwnerId?: string; cloudOwnerEmail?: string; legacyOwnerId?: string; legacyOwnerEmail?: string;
}
export class SetupReviewError extends Error {
  constructor(public code: 'input' | 'projectMismatch' | 'ownerMismatch') { super(code); }
}
export function verifySetupProject(bindings: SetupBindings) {
  if (!bindings.projectId || bindings.projectId !== bindings.publicProjectId
    || (bindings.cloudProjectId && bindings.cloudProjectId !== bindings.projectId)) throw new SetupReviewError('projectMismatch');
  return bindings.projectId;
}
export function parseSetupSelection(params: URLSearchParams): SetupSelection {
  if ([...params.keys()].sort().join(',') !== 'durationHours,ownerEmail,ownerId,projectId') throw new SetupReviewError('input');
  const ownerId = params.get('ownerId') || '', ownerEmail = params.get('ownerEmail') || '', projectId = params.get('projectId') || '';
  const durationHours = Number(params.get('durationHours'));
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(ownerId) || ownerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)
    || !/^[A-Za-z0-9_-]{1,128}$/.test(projectId) || !['1', '4', '24'].includes(params.get('durationHours') || '')) throw new SetupReviewError('input');
  return { ownerId, ownerEmail, projectId, durationHours };
}
export function buildSetupReview(selection: SetupSelection, bindings: SetupBindings,
  owner: Record<string, unknown> | undefined, codes: Record<string, unknown>[], now = Date.now()) {
  const projectId = verifySetupProject(bindings);
  if (selection.projectId !== projectId) throw new SetupReviewError('projectMismatch');
  if (!owner || owner.email !== selection.ownerEmail
    || [bindings.cloudOwnerId, bindings.legacyOwnerId].some(v => v && v !== selection.ownerId)
    || [bindings.cloudOwnerEmail, bindings.legacyOwnerEmail].some(v => v && v !== selection.ownerEmail)) throw new SetupReviewError('ownerMismatch');
  const targets = FATTAL_BOOKLET_TARGETS.map(target => {
    const matches = codes.filter(code => code.shortId === target.shortId);
    const state: SetupTargetState = matches.length === 0 ? 'missing' : matches.length !== 1 ? 'duplicate'
      : matches[0].parentCodeShortId ? 'child' : matches[0].ownerId !== selection.ownerId ? 'owner_mismatch' : 'valid';
    return { shortId: target.shortId, hotel: target.key, title: target.title, state };
  });
  const mappingVerified = targets.length === 12 && targets.every(t => t.state === 'valid');
  return {
    protocol: 1, checkedAt: now, mappingVerified, ownerId: selection.ownerId, ownerEmail: selection.ownerEmail, projectId, targets,
    proposal: mappingVerified ? { workflow: 'fattal-cloud-v1', scopes: ['read'], allowedTargets: targets.map(t => t.shortId),
      durationHours: selection.durationHours, expiresAt: now + selection.durationHours * 3600000 } : null,
    credentialCreated: false, persisted: false, flagsChanged: false, secretBinding: 'unverified',
  };
}
