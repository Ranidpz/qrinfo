# Isolated Fattal acceptance

This test uses the actual uploader CLI, journal, cloud route, policy, approval
service and PDF review reader. Firebase Admin executes real transactions against
the official local Firestore emulator. A loopback HTTP object store persists and
rereads generated one-page fixture PDFs on disk. Nothing contacts a production
Firebase project, R2 bucket, website, grant service or messaging provider.

Install the repository's ordinary development dependencies, then the test-only
dependencies (`firebase-admin@13.6.0`, `firebase-tools@15.33.0`):

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

The ten top-level cases (29 tests including parameterized subtests) cover:

- Approval and one replacement: persisted PDF bytes/SHA-256, active pointer,
  receipt, file ledger, predecessor retention, quota, verified journal.
- A new CLI process repeating the request and a direct duplicate server commit:
  one object upload and zero object deletions.
- Lost commit reply after activation plus unavailable recovery: a different OS
  process uses the same journal directory, writes disabled, and only GET health
  and GET recovery to confirm the pending attempt without another commit.
- Competing actual SDK transactions: one accepted revision, one conflict,
  one receipt/storage write/quota reservation; overlapping callbacks measured.
- Stale expectedVersion, renamed same-byte PDF, expired/revoked/read-only grant,
  absent/expired/revoked approval, foreign owner/project/target, child target,
  changed owner email, and paused Splash.
- Grant expiry/revocation or approval revocation after staging: old pointer
  retained, durable pending claim and quota reservation, no reupload/delete.
- Corrupt/missing history, missing identity and stale lock: new processes cannot
  upload, recover or silently initialize; historical inspection preserves locks.

The production HTTPS validation is unchanged. An explicit test-only transport
maps `.invalid` fixture origins to the loopback HTTP server. Next's response and
bootstrap imports are substituted, so this is not a running Next/TLS deployment
test. The real media-storage/R2 adapter is replaced by the local disk store; its
R2-shaped metadata exercises service checks but does not prove S3/R2 behavior.
No notification/deletion adapter is supplied; the object server also records and
rejects DELETE. No real brochures or connections are used.

Process restart on the same live filesystem is verified. Environment destruction
and remount, host storage durability guarantees, abrupt SIGKILL reconciliation,
production credential transport, real R2 acceptance, and live PDF rendering
remain unverified. Transaction contention is real; exact retry counts may vary
with emulator scheduling. A passing run does not authorize production activation.
