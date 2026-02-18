import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const registerErrors = new Rate('register_errors');
const registerDuration = new Trend('register_duration', true);
const registrationsSucceeded = new Counter('registrations_succeeded');
const rateLimited = new Counter('rate_limited');
const phoneExists = new Counter('phone_exists');
const capacityFull = new Counter('capacity_full');
const serverErrors = new Counter('server_errors');

// Simulates 600 people clicking a WhatsApp link and registering within minutes.
// Tests POST /api/qtag/register with verification disabled.
export const options = {
  scenarios: {
    registration_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 100 },    // First wave clicks link
        { duration: '30s', target: 300 },    // Spreading through group chats
        { duration: '1m',  target: 600 },    // Peak - everyone registering
        { duration: '2m',  target: 600 },    // Sustained peak
        { duration: '30s', target: 0 },      // Tail off
      ],
    },
  },
  thresholds: {
    'register_duration': ['p(95)<5000', 'p(99)<10000'],
    'register_errors': ['rate<0.10'],
    'http_req_failed': ['rate<0.15'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CODE_ID = __ENV.CODE_ID;

if (!CODE_ID) {
  throw new Error('CODE_ID environment variable is required');
}

export default function () {
  // Generate unique phone per VU+iteration to avoid PHONE_EXISTS errors
  // +97258 prefix (valid Israeli mobile), 7 unique digits
  const uniqueNum = (__VU * 10000 + __ITER) % 10000000;
  const phone = `058${String(uniqueNum).padStart(7, '0')}`;

  const payload = JSON.stringify({
    codeId: CODE_ID,
    name: `Stress Guest ${__VU}-${__ITER}`,
    phone: phone,
    plusOneCount: Math.random() > 0.7 ? 1 : 0, // 30% bring a +1
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
    'response has guestId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return !!body.guestId;
      } catch { return false; }
    },
  });

  // Track specific outcomes
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (body.success && body.guestId) {
        registrationsSucceeded.add(1);
      }
    } catch { /* ignore */ }
  } else if (res.status === 429) {
    rateLimited.add(1);
  } else if (res.status === 409) {
    try {
      const body = JSON.parse(res.body);
      if (body.errorCode === 'PHONE_EXISTS') phoneExists.add(1);
      if (body.errorCode === 'CAPACITY_FULL') capacityFull.add(1);
    } catch { /* ignore */ }
  } else if (res.status >= 500) {
    serverErrors.add(1);
  }

  registerErrors.add(!success);

  // Simulate form fill time: 3-8 seconds (user types name + phone)
  sleep(Math.random() * 5 + 3);
}
