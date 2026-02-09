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
# 1. Set up test data in Firebase
npx tsx stress-test/setup.ts

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

## Save Results to JSON

```bash
k6 run --out json=stress-test/results/vote-storm-results.json \
       --env BASE_URL=... \
       stress-test/scenarios/02-vote-storm.js
```

## Capacity Limits (Vercel Pro)

| Component | Limit |
|---|---|
| Concurrent functions | 1,000 |
| Function timeout | 60s |
| Firestore writes/sec | 10,000 |
| Firestore transactions/sec | ~500 sustained |
| Single document writes/sec | 1/sec sustained |
