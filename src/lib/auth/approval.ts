// Approval gate — shared by client (gate screen) and server (API guards).

export type AccountStatus = 'pending' | 'approved' | 'rejected';
export type SignupMethod = 'google' | 'email' | 'phone';

/**
 * Users created before the approval gate have no `status` field and count as
 * approved; every new signup starts as 'pending' until a super admin approves it.
 */
export function isApprovedStatus(status: unknown): boolean {
  return status === undefined || status === null || status === 'approved';
}
