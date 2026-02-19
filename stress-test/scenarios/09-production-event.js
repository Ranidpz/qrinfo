/**
 * Scenario 09: Production Event Simulation
 *
 * Simulates a realistic live event with up to 10,000 voters and 200 candidates.
 * Models the actual traffic pattern of a 2-3 hour costume contest / talent show:
 *
 *   Phase 1 (warm-up):  MC announces voting, QR code on screen → initial burst
 *   Phase 2 (ramp):     Word spreads, more people join → steady ramp
 *   Phase 3 (sustain):  Peak voting period → sustained high load
 *   Phase 4 (surge):    "Last chance to vote!" announcement → final spike
 *   Phase 5 (cool-down): Voting closes → rapid drop
 *
 * Two concurrent scenarios run in parallel:
 *   - page_loads: Voters opening the voting page (GET /v/{shortId})
 *   - votes:      Actual vote submissions (POST /api/qvote/vote)
 *
 * Usage:
 *   # Quick test (30 min, ~10K votes)
 *   k6 run --env BASE_URL=https://qr.playzones.app \
 *          --env CODE_ID=stress-test-code \
 *          --env SHORT_ID=stress-test \
 *          --env CANDIDATE_IDS="$(jq -c '.candidateIds' stress-test/results/test-config.json)" \
 *          stress-test/scenarios/09-production-event.js
 *
 *   # Full event (2.5 hours, ~10K votes) - add FULL=1
 *   k6 run --env FULL=1 --env BASE_URL=... (same as above)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ───────────────────────────────────────────
const voteDuration = new Trend('vote_duration', true);
const pageLoadDuration = new Trend('page_load_duration', true);
const voteErrors = new Rate('vote_errors');
const pageErrors = new Rate('page_errors');
const votesSubmitted = new Counter('votes_submitted');
const rateLimited = new Counter('rate_limited');
const duplicateDevice = new Counter('duplicate_device');
const serverErrors = new Counter('server_errors');
const retriedVotes = new Counter('retried_votes');

// ─── Config ───────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CODE_ID = __ENV.CODE_ID;
const SHORT_ID = __ENV.SHORT_ID;
const CANDIDATE_IDS = JSON.parse(__ENV.CANDIDATE_IDS || '[]');
const IS_FULL = __ENV.FULL === '1';
const BYPASS_SECRET = __ENV.VERCEL_BYPASS || '';

if (!CODE_ID) throw new Error('CODE_ID is required');
if (!SHORT_ID) throw new Error('SHORT_ID is required');
if (CANDIDATE_IDS.length === 0) throw new Error('CANDIDATE_IDS is required');

// ─── Popularity Distribution (Pareto 80/20) ──────────────────
// Pre-compute weighted candidate selection.
// Top 20% of candidates receive ~65% of votes.
const NUM_CANDIDATES = CANDIDATE_IDS.length;
const weights = [];
let totalWeight = 0;
for (let i = 0; i < NUM_CANDIDATES; i++) {
  // Power law: weight = 1 / (rank ^ 0.8)
  const w = 1 / Math.pow(i + 1, 0.8);
  weights.push(w);
  totalWeight += w;
}
// Normalize to cumulative distribution
const cumulativeWeights = [];
let cumulative = 0;
for (let i = 0; i < NUM_CANDIDATES; i++) {
  cumulative += weights[i] / totalWeight;
  cumulativeWeights.push(cumulative);
}

function pickWeightedCandidate() {
  const r = Math.random();
  for (let i = 0; i < cumulativeWeights.length; i++) {
    if (r <= cumulativeWeights[i]) return CANDIDATE_IDS[i];
  }
  return CANDIDATE_IDS[NUM_CANDIDATES - 1];
}

function pickCandidates(count) {
  const selected = new Set();
  let attempts = 0;
  while (selected.size < count && attempts < count * 3) {
    selected.add(pickWeightedCandidate());
    attempts++;
  }
  return Array.from(selected);
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Scenario Configuration ──────────────────────────────────
// Quick mode: 30 min compressed simulation (~10K votes)
// Full mode:  2.5 hours real-time simulation (~10K votes)
const M = IS_FULL ? 5 : 1; // Duration multiplier

export const options = {
  scenarios: {
    // Page loads: voters opening the voting page
    page_loads: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1m',
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { duration: `${2 * M}m`, target: 150 },   // Initial QR scan burst
        { duration: `${3 * M}m`, target: 80 },     // Settle to steady
        { duration: `${10 * M}m`, target: 40 },    // Sustained (most already loaded)
        { duration: `${3 * M}m`, target: 100 },    // "Last chance" announcement
        { duration: `${2 * M}m`, target: 0 },      // Cool down
      ],
      exec: 'pageLoad',
    },

    // Vote submissions: the core load
    votes: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1m',
      preAllocatedVUs: 200,
      maxVUs: 1000,
      stages: [
        { duration: `${2 * M}m`, target: 100 },    // Warm up: ~100 votes
        { duration: `${3 * M}m`, target: 300 },     // Ramp: ~600 votes
        { duration: `${10 * M}m`, target: 350 },    // Sustained peak: ~3,500 votes
        { duration: `${5 * M}m`, target: 500 },     // Peak: ~2,500 votes (MC hype)
        { duration: `${5 * M}m`, target: 400 },     // Sustained high: ~2,000 votes
        { duration: `${3 * M}m`, target: 200 },     // "Closing soon": ~600 votes
        { duration: `${2 * M}m`, target: 0 },       // Cool down: ~200 votes
      ],                                             // Total: ~9,500 votes
      exec: 'submitVote',
      startTime: '30s', // Votes start 30s after page loads begin
    },
  },

  thresholds: {
    // Vote latency
    'vote_duration': ['p(95)<5000', 'p(99)<10000'],

    // Page load latency
    'page_load_duration': ['p(95)<3000', 'p(99)<8000'],

    // Error rates
    'vote_errors': ['rate<0.05'],          // <5% vote errors
    'page_errors': ['rate<0.03'],          // <3% page load errors

    // HTTP failures (includes 429 rate limits)
    'http_req_failed': ['rate<0.15'],
  },
};

// ─── Page Load Function ──────────────────────────────────────
export function pageLoad() {
  const opts = { tags: { name: 'page_load' }, redirects: 3 };
  if (BYPASS_SECRET) opts.headers = { 'x-vercel-protection-bypass': BYPASS_SECRET };
  const res = http.get(`${BASE_URL}/v/${SHORT_ID}`, opts);

  pageLoadDuration.add(res.timings.duration);

  const ok = check(res, {
    'page loads (200)': (r) => r.status === 200,
    'page has content': (r) => r.body && r.body.length > 1000,
  });

  pageErrors.add(!ok);

  // Simulate browsing time before voting
  sleep(Math.random() * 4 + 1); // 1-5s
}

// ─── Vote Submission Function ────────────────────────────────
export function submitVote() {
  const voterId = generateUUID();
  const visitorId = generateUUID();

  // Most voters select 1-2 candidates, some select 3
  const r = Math.random();
  const numSelections = r < 0.4 ? 1 : r < 0.85 ? 2 : 3;
  const selectedCandidates = pickCandidates(numSelections);

  const payload = JSON.stringify({
    codeId: CODE_ID,
    voterId: voterId,
    candidateIds: selectedCandidates,
    round: 1,
    visitorId: visitorId,
  });

  const headers = {
    'Content-Type': 'application/json',
    'Origin': BASE_URL,
  };
  if (BYPASS_SECRET) headers['x-vercel-protection-bypass'] = BYPASS_SECRET;

  // Simulate real user: think time before submitting
  sleep(Math.random() * 3 + 1); // 1-4s browsing candidates

  const res = http.post(`${BASE_URL}/api/qvote/vote`, payload, {
    headers: headers,
    tags: { name: 'vote' },
  });

  voteDuration.add(res.timings.duration);

  // Track response types
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (body.success) {
        votesSubmitted.add(1);
      }
    } catch { /* ignore parse errors */ }
  } else if (res.status === 429) {
    rateLimited.add(1);
    // Respect Retry-After header (server sends 5s)
    const retryAfter = res.headers['Retry-After'];
    if (retryAfter) {
      sleep(parseInt(retryAfter, 10) || 5);
    } else {
      sleep(5);
    }
    // Retry once
    const retryRes = http.post(`${BASE_URL}/api/qvote/vote`, payload, {
      headers: headers,
      tags: { name: 'vote_retry' },
    });
    retriedVotes.add(1);
    if (retryRes.status === 200) {
      try {
        const body = JSON.parse(retryRes.body);
        if (body.success) votesSubmitted.add(1);
      } catch { /* ignore */ }
    }
  } else if (res.status === 403) {
    try {
      const body = JSON.parse(res.body);
      if (body.errorCode === 'DUPLICATE_DEVICE') {
        duplicateDevice.add(1);
      }
    } catch { /* ignore */ }
  } else if (res.status >= 500) {
    serverErrors.add(1);
  }

  const ok = check(res, {
    'vote succeeds or expected error': (r) =>
      r.status === 200 || r.status === 403 || r.status === 429,
    'not server error': (r) => r.status < 500,
  });

  voteErrors.add(!ok);
}
