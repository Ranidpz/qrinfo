import { randomUUID } from 'node:crypto';

export type IntakeOperation = 'health' | 'preview' | 'commit' | 'recovery';
export interface IntakeOperationEvent {
  operation: IntakeOperation;
  outcome: 'completed' | 'failed';
  durationMs: number;
  retry: boolean;
}
type RunOutcome = 'completed' | 'failed' | 'uncertain' | 'disabled';
const operations: IntakeOperation[] = ['health', 'preview', 'commit', 'recovery'];
const count = () => ({ attempts: 0, completed: 0, failures: 0, retries: 0, durationMs: 0 });
function quantity(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid telemetry quantity');
  return value;
}

// A bounded, in-memory operational receipt. No network, persistence, credential
// access, arbitrary tags, filenames, identities, URLs, hashes or error messages.
// The trusted host owns collection/persistence; this never enables an operation.
export function createIntakeRunTelemetry(
  inventory: { files: number; bytes: number },
  clock = { wall: () => Date.now(), monotonic: () => performance.now() },
) {
  const files = quantity(inventory.files), bytes = quantity(inventory.bytes);
  const runId = randomUUID();
  const startedAt = new Date(clock.wall()).toISOString();
  const start = clock.monotonic();
  const counts = { health: count(), preview: count(), commit: count(), recovery: count() };
  let finished: { endedAt: string; durationMs: number; outcome: RunOutcome } | null = null;
  function snapshot() {
    return {
      schemaVersion: 1, runId, startedAt, endedAt: finished?.endedAt ?? null,
      durationMs: finished?.durationMs ?? null, outcome: finished?.outcome ?? 'running',
      files, bytes, operations: Object.fromEntries(operations.map(op => [op, { ...counts[op] }])),
      retries: operations.reduce((sum, op) => sum + counts[op].retries, 0),
      operationFailures: operations.reduce((sum, op) => sum + counts[op].failures, 0),
      runFailures: finished?.outcome === 'failed' ? 1 : 0,
      billing: { cost: null, currency: null, status: 'unknown' },
    };
  }
  function recordOperation(event: IntakeOperationEvent) {
    if (finished || !operations.includes(event.operation) || !['completed', 'failed'].includes(event.outcome)
      || typeof event.retry !== 'boolean' || !Number.isFinite(event.durationMs) || event.durationMs < 0) {
      throw new Error('Invalid telemetry event');
    }
    const counter = counts[event.operation];
    counter.attempts++;
    counter[event.outcome === 'failed' ? 'failures' : 'completed']++;
    counter.retries += event.retry ? 1 : 0;
    counter.durationMs += Math.round(event.durationMs);
  }
  function finish(outcome: RunOutcome) {
    if (!['completed', 'failed', 'uncertain', 'disabled'].includes(outcome)) throw new Error('Invalid telemetry outcome');
    if (finished) {
      if (finished.outcome !== outcome) throw new Error('Telemetry already finalized');
      return snapshot();
    }
    // An HTTP operation can complete while later receipt/identity checks fail.
    // The host supplies the overall result after all verification is complete.
    const end = Math.max(Date.parse(startedAt), clock.wall());
    finished = { endedAt: new Date(end).toISOString(), durationMs: Math.max(0, Math.round(clock.monotonic() - start)), outcome };
    return snapshot();
  }
  return { recordOperation, finish, snapshot };
}
