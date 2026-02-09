import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const voteErrors = new Rate('vote_errors');
const voteDuration = new Trend('vote_duration', true);
const votesSubmitted = new Counter('votes_submitted');

export const options = {
  scenarios: {
    verified_vote_storm: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 100 },
        { duration: '30s', target: 500 },
        { duration: '2m', target: 2000 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    'vote_duration': ['p(95)<5000'],
    'vote_errors': ['rate<0.10'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CODE_ID = __ENV.CODE_ID;
const CANDIDATE_IDS = JSON.parse(__ENV.CANDIDATE_IDS || '[]');
// Pre-created verified voters: JSON array of { phone, sessionToken, voterId }
const VERIFIED_VOTERS = JSON.parse(__ENV.VERIFIED_VOTERS || '[]');

if (!CODE_ID) throw new Error('CODE_ID is required');
if (CANDIDATE_IDS.length === 0) throw new Error('CANDIDATE_IDS is required');
if (VERIFIED_VOTERS.length === 0) throw new Error('VERIFIED_VOTERS is required (use setup.ts to generate)');

export default function () {
  // Each VU picks a unique verified voter based on VU number
  const voterIndex = (__VU - 1) % VERIFIED_VOTERS.length;
  const voter = VERIFIED_VOTERS[voterIndex];

  const numVotes = Math.floor(Math.random() * 3) + 1;
  const shuffled = [...CANDIDATE_IDS].sort(() => Math.random() - 0.5);
  const selectedCandidates = shuffled.slice(0, Math.min(numVotes, shuffled.length));

  const payload = JSON.stringify({
    codeId: CODE_ID,
    voterId: voter.voterId,
    candidateIds: selectedCandidates,
    round: 1,
    phone: voter.phone,
    sessionToken: voter.sessionToken,
  });

  const res = http.post(`${BASE_URL}/api/qvote/vote`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    tags: { name: 'verified_vote' },
  });

  voteDuration.add(res.timings.duration);

  const success = check(res, {
    'verified vote succeeds': (r) => r.status === 200,
    'vote acknowledged': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true || body.errorCode === 'VOTE_LIMIT_REACHED';
      } catch {
        return false;
      }
    },
  });

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (body.success) votesSubmitted.add(body.votesSubmitted || 0);
    } catch { /* ignore */ }
  }

  voteErrors.add(!success);

  sleep(Math.random() * 3 + 2);
}
