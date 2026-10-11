# Cloud caller modes and pilot gate

Status: local implementation and isolated acceptance, October 11, 2026. No live
credential, infrastructure, deployment, object-storage probe or schedule was created.

The supervised mode uses the existing cloud API and Firestore. It does not require
Michal's computer, a new host, a purchased server or an asserted persistent caller
volume. The original durable mode remains available with its unchanged private
POSIX journal requirements.

| Mode | Authoritative evidence | Caller loss |
| --- | --- | --- |
| Durable (default) | Local identity/journal plus server receipts/claims | Existing missing-history and stale-lock safeguards remain; remount durability must be established for this mode |
| Supervised, explicit | Exact approved manifest, one-use writer marker, target claim, receipt and file ledger in existing Firestore | Original reviewing administrator uses independent GET reconciliation, even after the writer expires or is revoked; never resubmit automatically |

A supervised grant is new, valid for 15 minutes, and limited to one non-paused
hotel. The server binds its first admitted attempt permanently to the exact
manifest digest in the same transaction that reserves quota and creates the
pending target claim. This transaction precedes R2. Activation, receipt and ledger
are atomic. Ambiguous storage or a lost reply leaves the marker/claim in place.
Neither expiry, cancellation, missing receipt nor a new caller clears it. The
cloud R2 adapter sets SDK `maxAttempts:1`; normal storage callers are unchanged.

The approved manifest exists before upload. Keep its exported file/digest in the
operator's cloud review record. `/api/content-intake/dot/supervised?manifestId=...`
requires the original reviewing super-admin's Firebase session, not a writer key
or caller journal. It rechecks server identity, owner, target, review, receipt and
actual bytes, and rechecks authorization/pointer after object I/O. Expiry and
revocation do not hide review evidence. A missing receipt is `uncertain`, with
`retryAllowed:false` and `uploadAllowed:false`. There is no POST or repair action
on this endpoint. If the digest is also lost, an administrator must locate the
existing approval through separately authorized audit; this UI does not enumerate
other reviews or initialize new history.

No unattended schedule, automatic uncertain-write retry, lock/claim takeover or
cleanup is implemented. Unattended operation requires additional lifecycle and
reconciliation design/testing; it need not require local caller storage if the
server remains authoritative. The supervised acceptance does not prove host
remount durability for the separate durable mode.

## Publication and first-pilot approvals

1. Review the two local implementation commits and approve publication separately.
   A main release must follow the repository's version/changelog policy. No push,
   release version bump or deployment has been performed by this work.
2. Explicitly approve server configuration for the chosen verified owner/project:
   cloud and supervised gates, writer issuance gate, approval gate and the independent
   write gate. Review storage origins must be exact trusted HTTPS origins. Keep
   writes disabled until the particular first upload is authorized. Flag changes
   and publication alone do not authorize a brochure replacement.
3. After publication, the user signs in as super-admin, opens content-intake setup,
   verifies the owner/project mapping, selects one hotel under the Hebrew supervised
   writer panel, confirms, and creates the 15-minute permission. The user explicitly
   copies its secret only into Personal Vault as `FATTAL_CLOUD_WRITER_NETWORK_KEY`,
   restricted to `qr.playzones.app`, and publishes the corresponding environment
   binding. Do not put it in chat or files. Retain the non-secret connection ID;
   reload loses the secret, but status and cancellation remain available. On any
   ambiguous issuance, inspect or cancel that ID; do not create another attempt.
4. Review a genuinely new/revised PDF and source evidence, preview/export its exact
   manifest in the approval panel, and approve that digest for the writer. The eleven
   manually completed brochures are not pilot inputs; U Splash stays paused.
5. Explicitly authorize one supervised upload of that exact manifest/hash/target.
   Configure the CLI as documented below, use Node 24 `--use-env-proxy`, then reconcile
   through GET. On uncertainty stop; use the independent administrator panel. No
   further upload, deletion, message or schedule follows implicitly.

Prepare the PDF, review evidence and runtime before issuance because the writer
expires after 15 minutes. The host secret-proxy binding and real R2/public-object
transport remain live acceptance gates, not facts established by emulator tests.

## Non-secret supervised CLI configuration

Use the existing build and CLI commands. Set `executionMode:"supervised"`, the
exact `supervisedManifestId` from the exported approved manifest, `allowedTargets`
to the single approved short ID, and `credentialMode:"network-secret"`. Set the
verified owner ID/email/project and `baseUrl:"https://qr.playzones.app"` explicitly.
Set `enabled:true` and `writesEnabled:true` only for the authorized upload. Omit
`stateDirectory` and `durableStateConfirmed`; supervised mode rejects a claimed
durable volume. `initialize-state`, `state` and `recover-pending` remain durable
mode commands. `recover --manifest ...` in supervised mode is GET-only and can
work without local history while the scoped credential is valid; after expiry,
use the administrator reconciliation panel.

## Prepared storage probe — not executed

The existing cloud preview uses `saveRun:false` and writes no object. It can test
approved request transport/validation but cannot prove R2 writes. Cloud commit
requires activation; there is no stage-only production target or safe reason to
replace one of the completed brochures for testing.

The proposed smallest non-publishing probe is one unique object in an explicitly
approved isolated private test bucket/prefix, using generated test bytes rather
than a brochure. Run the actual R2 upload adapter with `maxAttempts:1`, HEAD the
exact object and authenticated-GET it for SHA-256/length verification. Record only
non-secret bucket/key identifiers, expected/observed length/hash and result; stop
on uncertainty without retry or deletion. It must not call cloud commit, touch QR
records/quotas/receipts, expose a public brochure URL, or alter production storage
configuration. Any eventual cleanup is separately authorized. The bucket, least
privilege credentials, target key and execution authorization must be approved
before preparing executable live connection details. None were selected or used.

This adapter probe would not prove public-PDF transport or the production secret
proxy. A full synthetic activation requires separately verified isolated
application/database/storage resources and an approved test transport binding.
No such deployed resources were assumed or provisioned. The production target
allowlist was not expanded.
