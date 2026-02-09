import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const voteErrors = new Rate('vote_errors');
const voteDuration = new Trend('vote_duration', true);
const votesSubmitted = new Counter('votes_submitted');
const serverErrors = new Counter('server_errors');

// This scenario simulates what happens when you send a WhatsApp blast
// and 2000 people all click the link within seconds
export const options = {
  scenarios: {
    // Phase 1: Everyone loads the page at once
    page_spike: {
      executor: 'shared-iterations',
      vus: 2000,
      iterations: 2000,
      maxDuration: '30s',
      exec: 'loadPage',
    },
    // Phase 2: Everyone votes (starting 10 seconds after page load)
    vote_spike: {
      executor: 'shared-iterations',
      vus: 2000,
      iterations: 2000,
      maxDuration: '2m',
      startTime: '10s',
      exec: 'submitVote',
    },
  },
  thresholds: {
    'vote_duration': ['p(95)<10000'],       // 95% under 10s (generous for spike)
    'vote_errors': ['rate<0.20'],            // Accept up to 20% errors during spike
    'http_req_failed': ['rate<0.25'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SHORT_ID = __ENV.SHORT_ID || 'test';
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

export function loadPage() {
  const res = http.get(`${BASE_URL}/v/${SHORT_ID}`, {
    tags: { name: 'spike_page_load' },
  });

  check(res, {
    'page loads': (r) => r.status === 200,
  });

  // Small random delay simulating user reading the page
  sleep(Math.random() * 5 + 2);
}

export function submitVote() {
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
    tags: { name: 'spike_vote' },
    timeout: '30s',
  });

  voteDuration.add(res.timings.duration);

  const success = check(res, {
    'vote not server error': (r) => r.status < 500,
    'vote response received': (r) => r.body !== '',
  });

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (body.success) votesSubmitted.add(body.votesSubmitted || 0);
    } catch { /* ignore */ }
  }

  if (res.status >= 500) {
    serverErrors.add(1);
  }

  voteErrors.add(!success);
}

// Default function (required by k6 but we use named functions)
export default function () {
  submitVote();
}
