import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const pageLoadTime = new Trend('page_load_time', true);

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Ramp to 100 users
    { duration: '1m', target: 500 },    // Ramp to 500
    { duration: '2m', target: 1000 },   // Sustain 1000
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],   // 95% of requests under 3s
    http_req_failed: ['rate<0.05'],      // Less than 5% error rate
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SHORT_ID = __ENV.SHORT_ID || 'test';

export default function () {
  // Simulate loading the voter page
  const res = http.get(`${BASE_URL}/v/${SHORT_ID}`, {
    tags: { name: 'viewer_page' },
  });

  pageLoadTime.add(res.timings.duration);

  const success = check(res, {
    'page loads successfully': (r) => r.status === 200,
    'page loads under 3s': (r) => r.timings.duration < 3000,
  });

  errorRate.add(!success);

  // Simulate user reading the page before voting
  sleep(Math.random() * 3 + 1); // 1-4 seconds think time
}
