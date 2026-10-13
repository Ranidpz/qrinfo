import { getAuth } from 'firebase-admin/auth';
import { getAdminDb, getAdminApp } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

// --- Types ---

interface AuthResult {
  uid: string;
  isOwner: boolean;
  isSuperAdmin: boolean;
}

interface AuthError {
  response: NextResponse;
}

type AuthOutcome = AuthResult | AuthError;

// --- Core helpers ---

export function getAdminAuth() {
  const app = getAdminApp();
  return getAuth(app);
}

/**
 * Verify Firebase Auth Bearer token from request.
 * Returns uid or error response.
 */
export async function verifyAuthToken(
  request: NextRequest
): Promise<{ uid: string } | { error: NextResponse }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    return { uid: decodedToken.uid };
  } catch {
    return {
      error: NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Verify auth token + require a super_admin user.
 * Use for admin-wide API routes that are not scoped to a single QR code.
 */
export async function requireSuperAdmin(
  request: NextRequest
): Promise<AuthOutcome> {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return { response: authResult.error };

  const { uid } = authResult;
  const db = getAdminDb();
  const userDoc = await db.collection('users').doc(uid).get();

  if (userDoc.data()?.role !== 'super_admin') {
    return {
      response: NextResponse.json(
        { error: 'Forbidden: super admin required' },
        { status: 403 }
      ),
    };
  }

  return { uid, isOwner: false, isSuperAdmin: true };
}

/**
 * Verify auth token + require an approved account.
 * Use for routes that let a signed-in user create content not tied to a code they own.
 */
export async function requireApprovedUser(
  request: NextRequest
): Promise<{ uid: string } | { error: NextResponse }> {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult;

  // Same rule as isApprovedStatus (src/lib/auth/approval.ts): no status = pre-gate account = approved.
  // Inlined so this module keeps no app imports (tests load it with stubbed deps).
  const userDoc = await getAdminDb().collection('users').doc(authResult.uid).get();
  const status = userDoc.data()?.status;
  if (!userDoc.exists || (status != null && status !== 'approved')) {
    return {
      error: NextResponse.json(
        { error: 'Account pending approval' },
        { status: 403 }
      ),
    };
  }
  return authResult;
}

/**
 * Verify auth token + check code ownership or super_admin role.
 * Primary guard for admin-only endpoints.
 */
export async function requireCodeOwner(
  request: NextRequest,
  codeId: string
): Promise<AuthOutcome> {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return { response: authResult.error };

  const { uid } = authResult;
  const db = getAdminDb();

  const codeDoc = await db.collection('codes').doc(codeId).get();
  if (!codeDoc.exists) {
    return {
      response: NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      ),
    };
  }

  const codeData = codeDoc.data();
  const isOwner = codeData?.ownerId === uid;

  let isSuperAdmin = false;
  if (!isOwner) {
    const userDoc = await db.collection('users').doc(uid).get();
    isSuperAdmin = userDoc.data()?.role === 'super_admin';
    if (!isSuperAdmin) {
      return {
        response: NextResponse.json(
          { error: 'Forbidden: not the owner of this code' },
          { status: 403 }
        ),
      };
    }
  }

  return { uid, isOwner, isSuperAdmin };
}

/**
 * Type guard: checks if result is an auth error
 */
export function isAuthError(result: AuthOutcome): result is AuthError {
  return 'response' in result;
}
