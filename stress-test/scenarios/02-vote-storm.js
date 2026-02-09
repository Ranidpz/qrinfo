import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const voteErrors = new Rate('vote_errors');
const voteDuration = new Trend('vote_duration', true);
const votesSubmitted = new Counter('votes_submitted');
const rateLimited = new Counter('rate_limited');
const duplicateDevice = new Counter('duplicate_device');

export const options = {
  scenarios: {
    vote_storm: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 200 },    // Warm up
        { duration: '30s', target: 1000 },   // Ramp to 1000
        { duration: '2m', target: 2000 },    // Sustain 2000
        { duration: '30s', target: 0 },      // Ramp down
      ],
    },
  },
  thresholds: {
    'vote_duration': ['p(95)<5000'],      // 95% of votes under 5s
    'vote_errors': ['rate<0.10'],          // Less than 10% error rate
    'http_req_failed': ['rate<0.15'],      // Less than 15% HTTP failures
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CODE_ID = __ENV.CODE_ID;
const CANDIDATE_IDS = JSON.parse(__ENV.CANDIDATE_IDS || '[]');

if (!CODE_ID) {
  throw new Error('CODE_ID environment variable is required');
}
if (CANDIDATE_IDS.length === 0) {
  throw new Error('CANDIDATE_IDS environment variable is required (JSON array)');
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function () {
  // Each VU is a unique voter
  const voterId = generateUUID();
  const numVotes = Math.floor(Math.random() * 3) + 1; // 1-3 votes

  // Randomly select candidates
  const shuffled = [...CANDIDATE_IDS].sort(() => Math.random() - 0.5);
  const selectedCandidates = shuffled.slice(0, Math.min(numVotes, shuffled.length));

  const payload = JSON.stringify({
    codeId: CODE_ID,
    voterId: voterId,
    candidateIds: selectedCandidates,
    round: 1,
  });

  const startTime = new Date().getTime();
  const res = http.post(`${BASE_URL}/api/qvote/vote`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    tags: { name: 'vote' },
  });
  const duration = new Date().getTime() - startTime;

  voteDuration.add(duration);

  const success = check(res, {
    'vote request succeeds (200)': (r) => r.status === 200,
    'response has success field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success !== undefined;
      } catch {
        return false;
      }
    },
  });

  // Track specific response types
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (body.success) {
        votesSubmitted.add(body.votesSubmitted || 0);
      }
    } catch { /* ignore */ }
  } else if (res.status === 429) {
    rateLimited.add(1);
  } else if (res.status === 403) {
    try {
      const body = JSON.parse(res.body);
      if (body.errorCode === 'DUPLICATE_DEVICE') {
        duplicateDevice.add(1);
      }
    } catch { /* ignore */ }
  }

  voteErrors.add(!success);

  // Simulate real user behavior: browse candidates then vote
  sleep(Math.random() * 3 + 2); // 2-5 seconds between votes
}
