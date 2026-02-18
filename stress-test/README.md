# Q.Vote Stress Test Suite

Load testing for the Q.Vote voting system using [k6](https://k6.io/).

## Prerequisites

```bash
# Install k6
brew install k6

# Install dotenv (for setup/teardown scripts)
npm install dotenv --save-dev
```

## Quick Start

```bash
# 1. Set up test data (default: 100 candidates, 2000 voters)
npx tsx stress-test/setup.ts

# Or for large events: 200 candidates, 10000 voters
NUM_CANDIDATES=200 NUM_VOTERS=10000 npx tsx stress-test/setup.ts

# 2. Run a test scenario
k6 run --env BASE_URL=https://qr.playzones.app \
       --env CODE_ID=stress-test-code \
       --env CANDIDATE_IDS="$(jq -c '.candidateIds' stress-test/results/test-config.json)" \
       stress-test/scenarios/02-vote-storm.js

# 3. Clean up when done
npx tsx stress-test/teardown.ts
```

## Test Scenarios

| # | Scenario | Description | Peak VUs |
|---|----------|-------------|----------|
| 01 | Page Load | Voters loading the viewer page | 1,000 |
| 02 | Vote Storm | Anonymous voting under load | 2,000 |
| 03 | Verified Vote | Phone-verified voting under load | 2,000 |
| 04 | Sustained Load | Constant 500 votes/min for 15 min | 500 |
| 05 | Spike Test | WhatsApp blast: 2,000 users in 10s | 2,000 |
| **09** | **Production Event** | **Full event: 10K votes, realistic traffic pattern** | **1,000** |

## What Gets Tested

- **Vercel**: Serverless function cold starts, concurrent execution limits, response times
- **Firebase Firestore**: Write throughput, transaction contention, rate limiting
- **Vote API**: Rate limiting, duplicate detection, fingerprinting
- **Full Flow**: Page load -> Browse candidates -> Submit vote

## Key Metrics

- `vote_duration` - Time to submit a vote (p95 target: <5s)
- `vote_errors` - Percentage of failed votes (target: <10%)
- `votes_submitted` - Total successful votes
- `rate_limited` - Number of rate-limited requests
- `server_errors` - HTTP 500 errors

## Production Event Test (Scenario 09)

Simulates a full live event (costume contest, talent show) with realistic traffic:

```bash
# Quick mode: 30 min compressed simulation (~10K votes)
k6 run --env BASE_URL=https://qr.playzones.app \
       --env SHORT_ID=stress-test \
       --env CODE_ID=stress-test-code \
       --env CANDIDATE_IDS="$(jq -c '.candidateIds' stress-test/results/test-config.json)" \
       stress-test/scenarios/09-production-event.js

# Full mode: 2.5 hour real-time simulation (~10K votes)
k6 run --env FULL=1 \
       --env BASE_URL=https://qr.playzones.app \
       --env SHORT_ID=stress-test \
       --env CODE_ID=stress-test-code \
       --env CANDIDATE_IDS="$(jq -c '.candidateIds' stress-test/results/test-config.json)" \
       stress-test/scenarios/09-production-event.js
```

**Traffic pattern** (models real event timeline):
1. Warm-up: MC announces voting, QR on screen (0 -> 100/min)
2. Ramp: Word spreads (100 -> 300/min)
3. Sustained peak: Active voting (300-350/min)
4. Hype: "Last chance!" announcement (up to 500/min)
5. Cool-down: Voting closes (-> 0/min)

**Features**: Pareto popularity distribution (top 20% candidates get 65% of votes), think time simulation, 429 retry with Retry-After, concurrent page loads + votes.

## Save Results to JSON

```bash
k6 run --out json=stress-test/results/vote-storm-results.json \
       --env BASE_URL=... \
       stress-test/scenarios/02-vote-storm.js
```

## Q.Tag Stress Tests

Load testing for Q.Tag event registration and check-in scanner.

### Setup & Teardown (Q.Tag)

```bash
# Create test Q.Tag event + 600 pre-registered guests
npx tsx stress-test/setup-qtag.ts

# Clean up all Q.Tag test data
npx tsx stress-test/teardown-qtag.ts
```

### Q.Tag Scenarios

| # | Scenario | Description | Peak VUs |
|---|----------|-------------|----------|
| 06 | Registration Burst | 600 users registering via WhatsApp link | 600 |
| 07 | Scanner Flood | 5 phones scanning 600 guests | 10 |
| 08 | Combined Event Day | Registration + scanning + status concurrent | ~50 |

```bash
# Registration burst (600 users)
k6 run --env BASE_URL=https://qr.playzones.app \
       --env CODE_ID=stressTestQtag \
       stress-test/scenarios/06-registration-burst.js

# Scanner flood (5 phones, 600 guests)
k6 run --env BASE_URL=https://qr.playzones.app \
       stress-test/scenarios/07-scanner-flood.js

# Combined event day
k6 run --env BASE_URL=https://qr.playzones.app \
       --env CODE_ID=stressTestQtag \
       stress-test/scenarios/08-combined-event-day.js
```

### Q.Tag Key Metrics

- `register_duration` - Time to complete registration (p95 target: <5s)
- `query_duration` - Time to query guest by QR token (p95 target: <2s)
- `checkin_duration` - Time to mark guest as arrived (p95 target: <3s)
- `status_duration` - Time for guest status check (p95 target: <2s)
- `registrations_succeeded` / `checkin_succeeded` - Total successful operations
- `already_arrived` - Duplicate scan detections
- `capacity_full` - Registration attempts after capacity reached

---

## Capacity Limits (Vercel Pro)

| Component | Limit |
|---|---|
| Concurrent functions | 1,000 |
| Function timeout | 60s |
| Firestore writes/sec | 10,000 |
| Firestore transactions/sec | ~500 sustained |
| Single document writes/sec | 1/sec sustained |
