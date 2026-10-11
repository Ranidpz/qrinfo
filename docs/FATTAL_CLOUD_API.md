# Fattal cloud brochure API (opt-in, protocol 1)

This isolated server adapter supports the **existing exact 12 Fattal parent QR targets**.
It preserves `/fattal/{health,preview,commit,report}`, the desktop updater, its batch
protocol, recovery, schedules and reporting. The shared PDF replacement helper now refuses
a pending cloud claim before upload and again at activation; ordinary legacy calls are unchanged. Its credentials are separate and cannot be
used by the legacy updater. Nothing is enabled or provisioned by installing this code.

## Setup boundary

The user explicitly confirmed that all 12 intended **production** Fattal targets belong
to `biduratias@gmail.com`. This confirms the intended production email only: the Firebase
UID, actual records and development-project ownership remain unverified. It authorizes
no deployment, credentials, provisioning, uploads, notifications or deletion. Legacy
examples/defaults also mention `playzonest1@gmail.com`; do not use that default or infer
a UID or development identity from the production email. Before setup,
a human administrator must verify the UID, registered email, intended Firebase project
and the actual ownership of the explicit targets in that project. Development testing
needs development-owned fixtures; do not substitute production credentials.

The smallest next integration step, if existing verified read access is available, is a narrowly scoped read-only
check of the selected development project's 12 allowlisted code records and their referenced
owner records. `qrinfo-dev` is the development project named in AGENTS.md, not a project
verified by this task. Report absent, duplicate, foreign or child targets without creating
fixtures or changing ownership. A read-only connection is a later, separate step. Writer credential
provisioning is not implemented. The separate default-disabled read-grant dashboard
flow is described in FATTAL_DOT_MANAGEMENT.md and cannot issue write scope. A trusted administrator can
create the following record through their existing authenticated Firebase Admin tooling,
using a locally generated cryptographically random ID (16 bytes) and secret (32 bytes).
Never paste credentials into chat, source, command arguments, logs or a software archive.
Keep the generated key only in an approved server-side secret store and provision its
hash through the administrator's private tooling. Do not copy an existing desktop key.

Dedicated key format: `tq_fc_<32 lowercase hex ID>.<64 lowercase hex secret>`.
Store only its complete-token SHA-256 hash in `fattalCloudConnections/<ID>`:

| Field | Required value |
| --- | --- |
| `workflow` | `fattal-cloud-v1` |
| `keyHash` | Lowercase SHA-256 of the complete token |
| `ownerId`, `ownerEmail`, `projectId` | Explicitly verified identity, exact strings |
| `ownerVerifiedBy` | Administrator identity |
| `ownerVerifiedAt` | Verification UTC epoch milliseconds |
| `scopes` | Start with `["read"]`; future reviewed writes require `["read","write"]` |
| `allowedTargets` | Explicit nonempty subset of `FATTAL_BOOKLET_TARGETS` short IDs, at most 12, no duplicates |
| `expiresAt` | Finite future UTC epoch milliseconds; choose a short operational lifetime |
| `revokedAt`, `disabledAt` | Absent/null while permitted; any other value blocks access |

The new collections have no client allow rule (Firestore defaults to deny). Verify that
policy in the intended deployment before provisioning. Revocation is checked per request
and again inside both write transactions. There is no shared-key, Firebase Bearer,
super-admin or legacy-key fallback for this path. Read grants cannot save preview runs,
reserve storage, upload, activate, notify or delete.

Server configuration (none changed by this implementation):

- `FATTAL_CLOUD_ENABLED=true` explicitly enables this path; absent is disabled.
- `FATTAL_CLOUD_OWNER_ID`, `FATTAL_CLOUD_OWNER_EMAIL`, `FATTAL_CLOUD_PROJECT_ID` are mandatory.
- The configured project must equal both Admin SDK project and `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
- If `FATTAL_BOOKLETS_OWNER_ID` or `FATTAL_BOOKLETS_OWNER_EMAIL` is set, it must agree.
- `FATTAL_CLOUD_WRITES_ENABLED` defaults off. Only a later explicitly authorized setup
  may set it to `true`, with a write-scoped grant. Leave it off for readiness review.
- Existing server Admin SDK configuration is required for development integration checks:
  `FIREBASE_SERVICE_ACCOUNT_KEY` (or approved Application Default Credentials) and
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. These are not needed for unit tests.
- Future upload integration additionally needs the existing R2 settings:
  `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`,
  `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_PUBLIC_URL`.
  Supply them privately to the development server, never to this conversation.

## Integration order and secret-entry gap

1. **Verify mapping (existing authorized read access):** in the explicitly selected development
   project, look up only the 12 fixed short IDs and the user records referenced by their
   owner IDs. Confirm the development UID/email and parent-only mapping. Do not assume
   the production email or UID also owns development fixtures. If records are absent,
   fixture creation requires separate authorization; synthetic unit tests still work.
2. **Deploy separately (deployment approval):** build and deploy this Next.js checkout
   to a named isolated development deployment pointing only at that development
   Firebase project. The route is part of the app, not a standalone deployed connector.
   Start with `FATTAL_CLOUD_ENABLED=false` and `FATTAL_CLOUD_WRITES_ENABLED=false`.
   No production environment inheritance, production credentials, or R2/notification
   credentials are needed for read-only health/preview. Cloud flags do not disable
   the app's separate legacy APIs. Local production builds use synthetic Firebase
   configuration and a local font fixture with external networking disabled; they
   do not verify production deployment or production storage behavior.
3. **Configure the server-side caller and verify secure entry before generating a secret:**
   `cloud-client.ts` now provides a default-disabled client and strict read-only dispatcher;
   see [FATTAL_CLOUD_CLIENT.md](FATTAL_CLOUD_CLIENT.md). There is no registered MCP
   facade, vault integration or new user-operated secret-entry screen. The client resolves
   `env:FATTAL_CLOUD_CLIENT_KEY` only at server runtime, never from model inputs or CLI
   arguments. A host's secure injection mechanism must still be selected and verified.
   The existing dashboard/desktop `tq_ci_` key flow is incompatible. Do not ask for a
   token in chat or generate one before its storage/binding destination is ready.
4. **Provision and bind separately (credential/record-write approval):** after steps
   1–3, an authorized administrator may create a short-lived `scopes:["read"]` record
   with the verified development owner/project and exact allowed IDs, store only the
   token hash in Firestore, and deliver the token directly through the verified secure
   entry mechanism. This operation is not implemented or performed by this task.
   Populate `FATTAL_CLOUD_OWNER_ID`, `FATTAL_CLOUD_OWNER_EMAIL`,
   `FATTAL_CLOUD_PROJECT_ID` from the verified development mapping; ensure Admin SDK
   project and `NEXT_PUBLIC_FIREBASE_PROJECT_ID` agree. Any configured
   `FATTAL_BOOKLETS_OWNER_ID` / `FATTAL_BOOKLETS_OWNER_EMAIL` must agree too.
5. **Read-only acceptance:** only after separate configuration approval, set
   `FATTAL_CLOUD_ENABLED=true`, retain `FATTAL_CLOUD_WRITES_ENABLED=false`, then call
   `GET /api/content-intake/fattal/cloud/health` and a metadata-only
   `POST /api/content-intake/fattal/cloud/preview` with `saveRun:false`. Verify scoped
   identity, target bounds and denial of write attempts using mocks/local tests; do not
   issue a live commit as a read-only acceptance test. Initial health/preview require
   neither R2 credentials nor a manifest approval record.

The next integration input is the non-secret development mapping and deployment choice.
Read-only mapping checks using existing authorized access do not inherently require
fresh approval; this task currently has no verified access. Do not seek or provision
credentials to obtain it. An existing administrator can provide the 12-ID/UID/email
mapping. Deployment, fixture creation, credential issuance/binding and activation remain
separate permission-dependent actions; none is authorized merely by confirming the
intended production owner email.

## Administrator review approval

A write key and a caller-computable digest are **not** review authorization. The
super-admin dashboard includes a separately disabled review panel backed by
`/api/content-intake/dot/approvals`. It accepts the non-secret writer connection ID
and a prepared manifest JSON file, never a credential or PDF upload. The administrator
must inspect the actual PDF and exact group/message evidence, explicitly confirm it,
and export the server-normalized manifest for the worker. This is a narrow operator
review flow; it does not collect WhatsApp evidence or issue writer credentials.

- GET without parameters reports capabilities. Creation and the panel require both
  `FATTAL_CLOUD_ENABLED=true` and `FATTAL_CLOUD_APPROVALS_ENABLED=true`; defaults are off.
- POST `{action:"preview",connectionId,manifest}` reads only. The authenticated reviewer
  and server time replace caller attribution. Owner/project, the writer's scope and
  expiry, all twelve unique parent targets, expected active version, pending claims,
  receipts and correction evidence are checked before and after reading current bytes.
- Current PDF reads require `FATTAL_CLOUD_REVIEW_STORAGE_ORIGINS`, a JSON array of exact
  trusted HTTPS storage origins, configured by an administrator. There is no default,
  redirect, forwarded credential, query-string URL or arbitrary source URL support.
  The bounded read compares the actual active SHA-256, including manual uploads with
  no cloud metadata. Identical bytes are rejected even under a different filename.
- POST `{action:"approve",connectionId,manifest,manifestId}` repeats those checks and
  transactionally creates only the approval record. It does not upload, activate,
  reserve quota, notify or clean up. Expiry is bounded by 15 minutes, writer expiry and
  review freshness. An existing approval cannot be overwritten, extended or revived.
- GET `?manifestId=...` inspects the issuing reviewer's record; DELETE revokes it with
  same-origin authentication. These remain available with creation disabled. A missing
  DELETE fails closed: it does not claim cancellation of a possibly delayed creation.
- After an uncertain mutation, the panel freezes the attempt and offers status recovery.
  A missing result does not authorize resubmission. Export and retain the exact manifest
  before approval so its digest can be inspected after a page or worker restart.

U Splash (`5ubXFS`) is explicitly paused for new cloud approvals and commits until a
reviewed reopening policy change. It remains in the exact twelve-target mapping and
read/recovery access. The eleven manually completed brochures are not an upload queue;
only genuinely new or revised, explicitly reviewed evidence is eligible.

The approval collection has default-deny client access. Existing approvals created
through trusted Admin SDK tooling remain compatible; this feature changes neither
legacy desktop keys nor legacy commit/report behavior.

The approval record contains `manifest` (the exact normalized manifest), `connectionId`
(the dedicated writer key ID), `approvedBy` (matching `manifest.review.reviewer`),
`approvedAt` (UTC epoch milliseconds at/after review and not in the future), `expiresAt`
(future UTC epoch milliseconds), and optional `revokedAt` / `disabledAt` (absent/null
while permitted). Granting a broad write credential alone cannot create these records.
Both the claim and activation transactions verify the full manifest, writer binding,
reviewer, expiry and revocation. Existing receipts may still be recovered without an
active approval because recovery never writes. Rotating a writer requires new approval
for any not-yet-started write; it does not authorize replay of pending writes.

For a same-period correction of an active cloud receipt, `supersedes` must include all
known predecessor source identities and hashes. A new period is distinct. Legacy
predecessors lack reliable cloud source/hash evidence; the administrator must review
those replacements explicitly against the manifest's expected active version.

## Requests

Base path: `/api/content-intake/fattal/cloud/`. Supply the dedicated token in
`x-fattal-cloud-key` over HTTPS. All responses are `Cache-Control: no-store`.

- `GET health` resolves the actual user and every permitted target, rejecting missing,
  duplicate, foreign-owned and child QRs. Returns owner ID/email, project, scopes,
  expiry, permitted hotel/short-ID pairs, current `expectedVersion`, pending claims
  and write/effect capabilities. It never returns credentials or their hashes.
- `POST preview` accepts `{ "saveRun": false, "manifest": ... }`. Omitting `saveRun:false`
  is an error. This operation reads only and returns the normalized manifest and
  `manifestId` (SHA-256 of canonical accepted fields). It never calls legacy preview.
- `POST commit` accepts `{ "activate": true, "manifest": ..., "manifestId": ...,
  "pdfBase64": ... }`. Requires write scope and the independent write switch.
  Pass the exact reviewed manifest/digest; the uploaded bytes must match its size/hash.
- `GET recovery?manifestId=<digest>` reads receipts, current pointer and stored bytes;
  it never uploads, saves, finalizes, unlocks, sends or deletes anything.

`sendEmail`, `notify`, `deleteOld` and `cleanup` default to false; any supplied value
other than false is rejected. Notification and cleanup endpoints are intentionally
unavailable. They require separate implementation, authorization and review. Never
use the legacy report/commit APIs as a fallback for a cloud operation.

Each manifest explicitly describes **one** selected hotel/period and its complete
reviewed source evidence. This is a narrow replacement connector, not a collector or
batch matcher. Never split an unresolved same-target conflict into separate requests.
Resolve it first, select the corrected file, and list the excluded predecessors in
`supersedes`. Do not send old and corrected brochures as two missing targets.

```typescript
{
  protocol: 1,
  ownerId: string, projectId: string,
  shortId: string, hotel: string, // exact short ID + config key, not an inferred title
  period: { kind: 'weekday' | 'weekend', startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' },
  filename: string, sha256: string, size: number,
  expectedVersion: string, // copy from authenticated health; do not invent
  sourceGroupId: string,
  sources: [{ messageId: string, fileId: string, sha256: string }],
  supersedes: [{ messageId: string, fileId: string, sha256: string }],
  review: {
    reviewer: string, reviewedAt: number, evidence: string,
    contextResolved: true, replacementApproved: true
  }
}
```

The review must be at most one hour old at claim and activation, not in the future.
It records the reviewer's assertion that hotel, period and contextual conflicts were
resolved using message/PDF evidence. The server requires the separate administrator
approval and binds that exact evidence; it cannot prove that a human read WhatsApp. Filenames and adjacency never select
a hotel here. All `sources` must have identical hashes; differing bytes require review
and explicit predecessor identities in `supersedes`. A source identity cannot appear
on both sides. Same filename alone proves nothing. SHA-256 dedupe is per target,
including retransmissions with different message IDs and filenames.

Bodies are limited to 4 MiB including base64/metadata (therefore usable PDF size is
slightly below 3 MiB); larger files require a separately reviewed transport. This path
supports a target with exactly one PDF or no media. Multiple-media and non-PDF targets
are held for review. It does not fetch user-supplied source URLs. The period is an
explicit date interval of at most seven days; no schedule or date is inferred.

## Commit and uncertainty contract

1. Revalidate credential, administrator approval, owner and all permitted targets in a Firestore transaction.
   Compare the reviewed active-media fingerprint, reject any pending target claim,
   reserve new bytes against quota, and create a durable pending receipt/target claim.
2. Upload through `media-storage` to an immutable, manifest-specific R2 key. Fetch the
   returned server-generated R2 URL with no redirects and bounded bytes; verify SHA-256.
   The old pointer and object remain unchanged during this phase.
3. In a second transaction, recheck credential and approval (including expiry/revocation), ownership,
   child/uniqueness checks, expected version and claim. Atomically activate the new
   pointer, mark its receipt activated, and store the per-target hash ledger.
4. Re-read the pointer/receipt and verify public bytes before returning `verified:true`.
   Only this outcome proves the reviewed file is currently active. HTTP 200 alone does not.

A repeated manifest or previously committed target/hash never uploads again. It reads
the original receipt. If a different file has since become active, the result is
`superseded`, not a new update. The server keeps source/hash/review evidence and the
predecessor metadata. Existing legacy file receipts are not migrated or trusted as
cloud verification; first cloud ingestion requires a fresh explicit review.

A timeout, staged-byte mismatch, lost transaction response, revocation mid-upload or
concurrent change yields an uncertain result/claim. **Persist the manifest digest before
POST. After any uncertain result or transport error, call GET recovery before considering
another operation. Never automatically retry uploads or clear a claim on elapsed time.**
Recovery always reports `retryAllowed:false`. Lost activation responses can recover to
`verified` because the pointer and receipt were committed together. A pending upload
cannot be resumed automatically. It requires separately authorized administrator
reconciliation; this release deliberately provides no force-unlock or cleanup API.
If staging succeeded but activation failed, the pending receipt does not save the
storage response. Reconciliation must locate the deterministic R2 key
`fattal-cloud/<ownerId>/<shortId>/<manifestId>.pdf` using the intended server storage
configuration, verify the bytes, and inspect the active pointer before any separately
authorized decision. Never infer that a pending receipt means no object exists.

Retained predecessors and uncertain staged uploads remain charged conservatively against
quota. No subtraction/deletion occurs after a failed transaction, since its outcome might
be ambiguous. Future cleanup must be separately gated, prove the new active file again,
and restrict deletion to that receipt's obsolete predecessor. Never delete the current
object or broadly purge a directory. Quota release must correspond to verified cleanup.

## Future workflow; not enabled here

A future collector can prepare Sunday/Thursday readiness at 08:00 in `Asia/Jerusalem`,
with 10:00/12:00/14:00 checks processing only new or revised evidence. No schedules,
WhatsApp sessions, messages or activation are configured by this change. An independent
missed-run monitor is still future work; a schedule on the same platform cannot guarantee
monitoring when that platform is unavailable.

The future staging queue should key entries by source group/message/file and hash, persist
submitted manifests and digests before writes, and retain the message/hash ledger. Remove
an item from pending only after an exact `verified` recovery/commit matches its target,
hash and receipt; record retransmission-to-original receipt links. Retain uncertain,
superseded and conflicting entries for review. Do not delete the ledger with the PDF.
Future completion messages should use warm team wording without automatic/agent labels.
No local staging-directory processor or WhatsApp functionality is included here.

## Local verification

`node --test scripts/tests/*.test.mjs` runs mocked Firestore/storage and route fixtures,
including the legacy intake regressions. Synthetic owner/project/email/key values are
sufficient; target fixtures use the real fixed short-ID constants with mock ownership
and storage. No development secrets or connection provisioning are necessary. `npx tsc --noEmit --incremental false` and
focused ESLint validate the TypeScript. The cloud tests exercise durable claims,
concurrency, idempotency, expected-version rejection, ambiguous writes and revocation
between upload/activation. The approval tests also exercise actual-PDF dedupe,
read-only preview, actor/owner/grant changes during the read, stale manifests,
concurrent creation, revocation and uncertain-response recovery. No live data is
needed or accessed.

`npm run fattal:cloud:test:emulator` adds isolated acceptance with actual Firebase
Admin transactions, the official Firestore emulator, a loopback disk-backed object
store and separate uploader OS processes. It checks replacement bytes/pointer/
receipt/quota, competing transactions, duplicate requests, lost-response recovery,
SIGKILL reconciliation, permission changes, paused Splash and missing/corrupt journal
history. Optional `FATTAL_TEST_NEXT=true` adds running Next HTTP routes, real
server auth through the Auth emulator, and browser approval/export/revocation. See
[setup and exact limits](../scripts/fattal-emulator/README.md). The fresh October 11
environment allowed the official JAR download; size and SHA-256 matched installed
firebase-tools metadata. The initial 29-test run and extended 31-test Next/browser run passed. The test
README records exact scope and limits. This supersedes the earlier
environment's HTTP 403 download blocker, not the remaining production acceptance.

The transaction fixture also replays a callback to check that quota reservations and
external writes are not duplicated. That fixture remains a mock; the separate
emulator suite exercises real SDK contention. Actual R2/S3 adapter integration,
environment remount persistence and deployed transport remain unverified. The legacy helper's pre-existing ambiguous
transaction cleanup behavior is not redesigned here; the cloud path never calls that
helper and does not inherit its notification/deletion behavior.

### Cancelling an uncertain read-grant attempt

The authenticated same-origin `DELETE /api/content-intake/dot/read-grant?connectionId=...`
revokes an existing issuer-owned read grant. Since 1.27.7, cancelling a missing ID
transactionally creates a permanent `revocation_tombstone` in the same connection
document. For a missing ID, the server requires explicit cloud owner/email/project
bindings and rechecks the administrator, owner identity and all twelve parent targets
inside the transaction. Existing grant revocation remains available when issuance is
disabled or its configuration is absent.

A tombstone has no key hash, access expiry or allowed targets and cannot authenticate.
Do not automatically expire or delete it: its existence prevents late issuance from
creating that ID. If issuance commits first, cancellation retries and revokes that
grant; if cancellation commits first, issuance retries and refuses the existing ID.
Repeated cancellation is idempotent and status remains issuer-scoped. GET is always
read-only and a `missing` response alone is not proof of cancellation.

Keep the original browser page open until the exact attempt returns `revoked` from a
successful cancellation or subsequent status read. Only then may the operator discard
that page and start one newly authorized read-grant attempt. An uncertain DELETE must
be reconciled by GET, not treated as success. Publishing this behavior does not cancel
or issue any connection; the operator must explicitly invoke cancellation.
