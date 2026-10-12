import type { DataSnapshot, Reference } from 'firebase-admin/database';
import { getAdminRtdb } from '@/lib/firebase-admin';

/**
 * Admin-SDK stand-ins for the modular `firebase/database` calls used by the *-realtime libs,
 * so their server-side copies (src/lib/server/*-rtdb.ts) keep the same bodies.
 * API routes must write RTDB through these: database.rules.json denies client writes to
 * every server-owned node, and the client SDK on the server runs unauthenticated.
 */
export const realtimeDb = null;

export function ref(_db: unknown, path: string): Reference {
  return getAdminRtdb().ref(path);
}

export function set(r: Reference, value: unknown): Promise<void> {
  return r.set(value);
}

export function update(r: Reference, values: object): Promise<void> {
  return r.update(values);
}

export function get(r: Reference): Promise<DataSnapshot> {
  return r.once('value');
}

export function remove(r: Reference): Promise<void> {
  return r.remove();
}

export function push(r: Reference): Reference {
  return r.push();
}

export function runTransaction<T>(
  r: Reference,
  fn: (current: T) => unknown
): Promise<{ committed: boolean; snapshot: DataSnapshot }> {
  return r.transaction(fn as (current: unknown) => unknown);
}
