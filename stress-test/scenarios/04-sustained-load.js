import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const voteErrors = new Rate('vote_errors');
const voteDuration = new Trend('vote_duration', true);
const votesSubmitted = new Counter('votes_submitted');

export const options = {
  scenarios: {
    sustained_voting: {
      executor: 'constant-arrival-rate',
      rate: 500,              // 500 votes per minute
      timeUnit: '1m',
      duration: '15m',        // Sustain for 15 minutes (like a real event)
      preAllocatedVUs: 200,
      maxVUs: 500,
    },
  },
  thresholds: {
    'vote_duration': ['p(95)<5000', 'p(99)<10000'],
    'vote_errors': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CODE_ID = __ENV.CODE_ID;
const CANDIDATE_IDS = JSON.parse(__ENV.CANDIDATE_IDS || '[]');

if (!CODE_ID) throw new Error('CODE_ID is required');
if (CANDIDATE_IDS.length === 0) throw new Error('CANDIDATE_IDS is required');

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function () {
  const voterId = generateUUID();
  const numVotes = Math.floor(Math.random() * 3) + 1;
  const shuffled = [...CANDIDATE_IDS].sort(() => Math.random() - 0.5);
  const selectedCandidates = shuffled.slice(0, Math.min(numVotes, shuffled.length));

  const payload = JSON.stringify({
    codeId: CODE_ID,
    voterId: voterId,
    candidateIds: selectedCandidates,
    round: 1,
  });

  const res = http.post(`${BASE_URL}/api/qvote/vote`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    tags: { name: 'sustained_vote' },
  });

  voteDuration.add(res.timings.duration);

  const success = check(res, {
    'vote succeeds': (r) => r.status === 200 || r.status === 403,
    'not server error': (r) => r.status < 500,
  });

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (body.success) votesSubmitted.add(body.votesSubmitted || 0);
    } catch { /* ignore */ }
  }

  voteErrors.add(res.status >= 500);
}
