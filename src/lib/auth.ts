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

function getAdminAuth() {
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
