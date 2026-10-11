# Isolated Fattal acceptance

This test uses the actual uploader CLI, journal, cloud route, policy, approval
service and PDF review reader. Firebase Admin executes real transactions against
the official local Firestore emulator. A loopback HTTP object store persists and
rereads generated one-page fixture PDFs on disk. Nothing contacts a production
Firebase project, R2 bucket, website, grant service or messaging provider.

Install the repository's ordinary development dependencies, then the test-only
dependencies pinned in this directory:

```sh
npm install --prefix scripts/fattal-emulator --ignore-scripts --no-audit --no-fund
```

Java 21+ and an already downloaded official emulator JAR are required. Obtain the
JAR only through an allowed official network path; stop if denied. The runner
does not download anything. It independently verifies the JAR's exact size and
SHA-256 against installed firebase-tools metadata before starting Java.

```sh
FATTAL_TEST_EMULATOR_JAR=/absolute/path/cloud-firestore-emulator-v1.22.0.jar \
  npm run fattal:cloud:test:emulator
```

Optional `FATTAL_TEST_DEPENDENCY_ROOT` selects another private installation of
the test package. Optional `FATTAL_TEST_ARTIFACTS` selects an evidence directory;
otherwise a private temporary directory is created. Root TypeScript is used by
the existing trusted CLI build and source loader.

The runner creates a minimal child environment (no inherited credentials,
proxies, NODE_OPTIONS or Firebase project), binds Java to numeric loopback on an
unused port, and fixes the project to `demo-fattal-acceptance`. Cross-project
emulator access is an error. Deny-all rules prevent client writes; Admin SDK
fixture setup and transactions operate only on that emulator. Each case resets
only the dedicated demo database. The runner stops its emulator afterward and
saves `environment.json`, `emulator.log` and `acceptance.tap`.

The base cases cover:

- Approval and one replacement: persisted PDF bytes/SHA-256, active pointer,
  receipt, file ledger, predecessor retention, quota, verified journal.
- A new CLI process repeating the request and a direct duplicate server commit:
  one object upload and zero object deletions.
- Lost commit reply after activation plus unavailable recovery: a different OS
  process uses the same journal directory, writes disabled, and only GET health
  and GET recovery to confirm the pending attempt without another commit.
- SIGKILL after server activation retains the pending journal and lock. Automatic
  recovery is blocked; an explicit test operator proves the child dead and verifies
  receipt/pointer/bytes before removing only the lock and invoking GET-only recovery.
- Competing actual SDK transactions: one accepted revision, one conflict,
  one receipt/storage write/quota reservation; overlapping callbacks measured.
- Stale expectedVersion, renamed same-byte PDF, expired/revoked/read-only grant,
  absent/expired/revoked approval, foreign owner/project/target, child target,
  changed owner email, and paused Splash.
- Grant expiry/revocation or approval revocation after staging: old pointer
  retained, durable pending claim and quota reservation, no reupload/delete.
- Corrupt/missing history, missing identity and stale lock: new processes cannot
  upload, recover or silently initialize; historical inspection preserves locks.

## Running Next and browser acceptance

Add `FATTAL_TEST_NEXT=true` to the command to run the actual Next HTTP routes,
actual Firebase Admin bootstrap and server authorization guards. This mode starts
the installed Auth emulator on loopback, seeds synthetic identities, and loads the
real approval component in a minimal Next page. Playwright covers preview, JSON
export, approval, one upload, revocation and recovery of the activated receipt.
Missing authentication, ordinary-user role and foreign Origin are also rejected.
The full mode now reports 34 tests; without it, 33 pass and the Next case is skipped.

Use an already available Chromium with `FATTAL_TEST_CHROMIUM=/absolute/path/chromium`.
`FATTAL_TEST_PLAYWRIGHT_ROOT` optionally selects an existing Playwright package
installation. Otherwise the pinned test dependency is used. Browser installation
is separate; the runner never downloads a browser. Next/React resolve from the
ordinary repository dependencies; the test package also pins its Next executable.
The fixture is opt-in, demo-project-only and bound to numeric loopback.

The base route adapter substitutes Next response/bootstrap imports. The Next case
uses actual Next request/response handling, Firestore and Auth emulators, but
substitutes browser login token acquisition and media storage. Synthetic unsigned
JWTs work only in explicit Auth emulator mode. No production login or token is
used. The page omits the full application shell/styles, so screenshots establish
functional approval states, not production visual acceptance.

Production HTTPS validation is unchanged. Explicit test-only transport maps
`.invalid` fixture object origins to loopback HTTP. R2-shaped metadata exercises
service checks but does not prove real S3/R2 behavior. No notification/deletion
adapter is supplied; the object server records and rejects DELETE. No real
brochures or connections are used. Metadata-server discovery and telemetry are
disabled; browser requests outside the local Next origin are blocked and fail the
test. The minimal environment excludes credentials and proxies.

Evidence includes `acceptance.tap`, `environment.json`, `emulator.log`,
`sigkill-reconciliation.json`, and, in Next mode, `next-server.log` plus desktop and
mobile approval-state screenshots. Process restart and explicit SIGKILL
reconciliation are covered. Environment destruction/remount, host storage
durability, production credential transport, real R2 acceptance, full dashboard
integration and live PDF rendering remain unverified. Retry counts can vary with
emulator scheduling. Passing does not authorize production activation. See the
[minimal caller runtime plan](../../docs/FATTAL_CALLER_RUNTIME.md).

October 11 acceptance: the full 31-test mode passed twice; the existing 90 focused
regressions also passed. Initial fixture iterations exposed Auth emulator setup
and NextURL loopback normalization issues, corrected only in the harness. An
earlier SDK metadata-discovery attempt failed DNS; explicit
`METADATA_SERVER_DETECTION=none` suppresses that probe in final runs. No production
API or credentials were used. Desktop/mobile screenshots show the functional
approved/revoked states; omitted application CSS causes narrow-screen hash
overflow, so they do not establish responsive styling acceptance.

Supervised extensions verify no-local-journal SIGKILL recovery, independent admin
reconciliation after writer expiry/revocation, permanent consumption on uncertain
storage, missing-receipt refusal, writer issuance/cancellation contention, and
actual Next writer/approval/reconciliation endpoints with Hebrew browser controls.
The original durable-mode cases remain in the same suite.

Final local supervised milestone: 34 emulator/Next/browser tests passed; 161
focused security, API, UI, SDK retry and legacy regression tests passed. Focused
TypeScript/ESLint checks and the isolated Next production build passed. The full
application shell/build and live R2/proxy transport were not acceptance targets.
