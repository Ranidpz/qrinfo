import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Load pre-registered guest tokens (created by setup-qtag.ts)
const guestTokens = new SharedArray('guest_tokens', function () {
  return JSON.parse(open('../results/qtag-guest-tokens.json'));
});

// Custom metrics
const queryDuration = new Trend('query_duration', true);
const checkinDuration = new Trend('checkin_duration', true);
const scanErrors = new Rate('scan_errors');
const checkinSucceeded = new Counter('checkin_succeeded');
const alreadyArrived = new Counter('already_arrived');
const tokenNotFound = new Counter('token_not_found');
const rateLimited = new Counter('rate_limited');
const serverErrors = new Counter('server_errors');

// Simulates 5 phones at the event entrance scanning 600 guests.
// Each scan is a 2-step flow: query (look up guest) then checkin (mark arrived).
// Rate: 20 scans/min (5 phones x ~4 scans each), 30 min to process all guests.
export const options = {
  scenarios: {
    scanner_flood: {
      executor: 'constant-arrival-rate',
      rate: 20,                     // 20 scans per minute
      timeUnit: '1m',
      duration: '30m',             // 600 guests at ~20/min = 30 min
      preAllocatedVUs: 5,
      maxVUs: 10,
    },
  },
  thresholds: {
    'query_duration': ['p(95)<2000'],       // Token lookup should be fast
    'checkin_duration': ['p(95)<3000'],     // Transaction with stats update
    'scan_errors': ['rate<0.05'],           // Check-in must be reliable
    'http_req_failed': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Pick a guest (round-robin so each guest gets scanned roughly once)
  const guestIndex = __ITER % guestTokens.length;
  const guest = guestTokens[guestIndex];

  // Step 1: Query - scanner reads QR code, app fetches guest info
  const queryRes = http.post(`${BASE_URL}/api/qtag/checkin`, JSON.stringify({
    qrToken: guest.qrToken,
    action: 'query',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    tags: { name: 'qtag_query' },
    timeout: '10s',
  });

  queryDuration.add(queryRes.timings.duration);

  const queryOk = check(queryRes, {
    'query succeeds (200)': (r) => r.status === 200,
    'query returns guest data': (r) => {
      try { return !!JSON.parse(r.body).guest; }
      catch { return false; }
    },
  });

  if (queryRes.status === 404) {
    tokenNotFound.add(1);
    scanErrors.add(true);
    return;
  }
  if (queryRes.status === 429) {
    rateLimited.add(1);
    scanErrors.add(true);
    sleep(2);
    return;
  }
  if (queryRes.status >= 500) {
    serverErrors.add(1);
    scanErrors.add(true);
    return;
  }

  // Brief pause: scanner operator reads the name on screen (0.5-1.5s)
  sleep(Math.random() + 0.5);

  // Step 2: Checkin - operator confirms, app marks guest as arrived
  const checkinRes = http.post(`${BASE_URL}/api/qtag/checkin`, JSON.stringify({
    qrToken: guest.qrToken,
    action: 'checkin',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    tags: { name: 'qtag_checkin' },
    timeout: '10s',
  });

  checkinDuration.add(checkinRes.timings.duration);

  const checkinOk = check(checkinRes, {
    'checkin succeeds (200)': (r) => r.status === 200,
    'checkin response valid': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.guest !== undefined;
      } catch { return false; }
    },
  });

  if (checkinRes.status === 200) {
    try {
      const body = JSON.parse(checkinRes.body);
      if (body.alreadyArrived) {
        alreadyArrived.add(1);
      } else {
        checkinSucceeded.add(1);
      }
    } catch { /* ignore */ }
  } else if (checkinRes.status >= 500) {
    serverErrors.add(1);
  }

  scanErrors.add(!queryOk || !checkinOk);

  // Think time: next guest approaches scanner (2-4 seconds)
  sleep(Math.random() * 2 + 2);
}
