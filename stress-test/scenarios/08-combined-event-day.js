import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Load pre-registered guest tokens (created by setup-qtag.ts)
const guestTokens = new SharedArray('guest_tokens', function () {
  return JSON.parse(open('../results/qtag-guest-tokens.json'));
});

// Registration metrics
const registerDuration = new Trend('register_duration', true);
const registerErrors = new Rate('register_errors');
const registrationsSucceeded = new Counter('registrations_succeeded');

// Scanner metrics
const queryDuration = new Trend('query_duration', true);
const checkinDuration = new Trend('checkin_duration', true);
const scanErrors = new Rate('scan_errors');
const checkinSucceeded = new Counter('checkin_succeeded');
const alreadyArrived = new Counter('already_arrived');

// Status check metrics
const statusDuration = new Trend('status_duration', true);
const statusErrors = new Rate('status_errors');

// Shared
const rateLimited = new Counter('rate_limited');
const serverErrors = new Counter('server_errors');

// Full event day simulation with 3 concurrent activities:
// 1. Late registrations trickling in (people who saw link late)
// 2. Scanner operators checking guests in at entrance
// 3. Guests checking their QR status on their phones
export const options = {
  scenarios: {
    // Late registrations (constant trickle)
    late_registrations: {
      executor: 'constant-arrival-rate',
      rate: 5,                      // 5 new registrations per minute
      timeUnit: '1m',
      duration: '10m',
      preAllocatedVUs: 5,
      maxVUs: 20,
      exec: 'registerGuest',
    },
    // Scanner check-ins (starts 1 min in, ramps up during rush)
    scanner_checkins: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1m',
      stages: [
        { duration: '2m', target: 10 },    // Slow start - early arrivals
        { duration: '3m', target: 30 },    // Peak rush
        { duration: '3m', target: 20 },    // Tapering
        { duration: '2m', target: 5 },     // Stragglers
      ],
      preAllocatedVUs: 5,
      maxVUs: 15,
      startTime: '1m',
      exec: 'scanAndCheckin',
    },
    // Guests checking their status on phones
    status_checks: {
      executor: 'constant-arrival-rate',
      rate: 30,                     // 30 status checks per minute
      timeUnit: '1m',
      duration: '10m',
      preAllocatedVUs: 10,
      maxVUs: 30,
      exec: 'checkStatus',
    },
  },
  thresholds: {
    'register_duration': ['p(95)<8000'],       // Higher tolerance: contention with scanners
    'checkin_duration': ['p(95)<4000'],         // Slightly higher: concurrent writes
    'status_duration': ['p(95)<2000'],          // Read-only, should be fast
    'register_errors': ['rate<0.15'],
    'scan_errors': ['rate<0.05'],
    'status_errors': ['rate<0.10'],
    'http_req_failed': ['rate<0.15'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CODE_ID = __ENV.CODE_ID;

if (!CODE_ID) {
  throw new Error('CODE_ID environment variable is required');
}

// --- Late Registration Flow ---
export function registerGuest() {
  // Use high offset to avoid collisions with pre-registered guests (058 0000001-0000600)
  const uniqueNum = (9000000 + __VU * 1000 + __ITER) % 10000000;
  const phone = `058${String(uniqueNum).padStart(7, '0')}`;

  const payload = JSON.stringify({
    codeId: CODE_ID,
    name: `Late Guest ${__VU}-${__ITER}`,
    phone: phone,
    plusOneCount: 0,
    plusOneDetails: [],
    locale: 'he',
  });

  const res = http.post(`${BASE_URL}/api/qtag/register`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    tags: { name: 'qtag_register' },
    timeout: '15s',
  });

  registerDuration.add(res.timings.duration);

  const success = check(res, {
    'registration succeeds (200)': (r) => r.status === 200,
  });

  if (res.status === 200) {
    registrationsSucceeded.add(1);
  } else if (res.status === 429) {
    rateLimited.add(1);
  } else if (res.status >= 500) {
    serverErrors.add(1);
  }

  registerErrors.add(!success);
}

// --- Scanner Check-in Flow ---
export function scanAndCheckin() {
  const guestIndex = __ITER % guestTokens.length;
  const guest = guestTokens[guestIndex];

  // Step 1: Query
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

  if (queryRes.status !== 200) {
    scanErrors.add(true);
    if (queryRes.status >= 500) serverErrors.add(1);
    if (queryRes.status === 429) rateLimited.add(1);
    return;
  }

  // Brief pause: operator reads guest name
  sleep(Math.random() + 0.5);

  // Step 2: Checkin
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

  if (checkinRes.status === 200) {
    try {
      const body = JSON.parse(checkinRes.body);
      if (body.alreadyArrived) {
        alreadyArrived.add(1);
      } else {
        checkinSucceeded.add(1);
      }
    } catch { /* ignore */ }
    scanErrors.add(false);
  } else {
    scanErrors.add(true);
    if (checkinRes.status >= 500) serverErrors.add(1);
    if (checkinRes.status === 429) rateLimited.add(1);
  }

  // Think time: next guest approaches
  sleep(Math.random() * 2 + 2);
}

// --- Guest Status Check Flow ---
export function checkStatus() {
  const guestIndex = __ITER % guestTokens.length;
  const guest = guestTokens[guestIndex];

  const res = http.get(
    `${BASE_URL}/api/qtag/guest-status?codeId=${CODE_ID}&token=${guest.qrToken}`,
    {
      headers: { 'Origin': BASE_URL },
      tags: { name: 'qtag_status' },
      timeout: '10s',
    }
  );

  statusDuration.add(res.timings.duration);

  const ok = check(res, {
    'status check succeeds (200)': (r) => r.status === 200,
    'returns exists field': (r) => {
      try { return JSON.parse(r.body).exists !== undefined; }
      catch { return false; }
    },
  });

  statusErrors.add(!ok);
  if (res.status >= 500) serverErrors.add(1);
  if (res.status === 429) rateLimited.add(1);
}

// Default function (required by k6)
export default function () {
  scanAndCheckin();
}
