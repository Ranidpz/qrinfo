# dot management view

The super-admin `/he/content-intake` and `/en/content-intake` view now focuses on
read-only dot status, verified owner/project/target bounds and identity-bound receipt
lookup. The previous installation/download/key creation walkthrough and schedule
editor are removed from this page. Existing APIs, schedules and audit records are
unchanged. Legacy computers and connections remain visible with their existing
confirmed disconnect/reconnect/revoke controls. Website disconnection is never
presented as proof that the local computer process has stopped.

## Server-only configuration (not performed)

`GET /api/content-intake/dot` requires a verified Firebase Bearer token and a current
`users` record with `role: super_admin`. It authenticates before checking configuration
or resolving any cloud credential. It uses the existing strict read-only client;
it does not add Bearer or legacy-key authentication to `/fattal/cloud/*`.

Default response is `{ "state": "unconfigured" }`. To prepare a future isolated
read-only connection, an administrator must verify the development deployment and
owner mapping, provision a dedicated read-only grant separately, then use the chosen
host's secure configuration facility. No setup is performed by this patch.

| Server setting | Required value |
| --- | --- |
| `FATTAL_CLOUD_MANAGEMENT_ENABLED` | Explicit `true`; absent/false performs no transport or secret resolution |
| `FATTAL_CLOUD_CLIENT_BASE_URL` | Approved HTTPS origin for the isolated cloud API |
| `FATTAL_CLOUD_CLIENT_OWNER_ID` | Explicit verified owner UID |
| `FATTAL_CLOUD_CLIENT_OWNER_EMAIL` | Explicit verified owner email; never inferred |
| `FATTAL_CLOUD_CLIENT_PROJECT_ID` | Explicit verified project ID |
| `FATTAL_CLOUD_CLIENT_TARGETS` | JSON array of the explicitly approved subset of the exact 12 parent target IDs |
| `FATTAL_CLOUD_CLIENT_KEY` | Dedicated read-only credential injected securely at runtime; never browser/chat/source/CLI input |

Client/API enablement is separate. Keep `FATTAL_CLOUD_WRITES_ENABLED` disabled.
The management endpoint's settings cannot be supplied through query parameters,
request headers or the UI. No real configuration or credential was generated.
See [the read-only client contract](FATTAL_CLOUD_CLIENT.md).

Successful health returns `state: ready` with only the client's sanitized attestation.
Incomplete configuration returns `unconfigured`. Expired/revoked credentials,
identity mismatches, transport failures and unsafe responses return a generic
`unavailable` response; no raw exception or remote body reaches the browser. All
responses disable caching. The UI describes readiness as the last check, not a
continuous guarantee. The view cannot commit, send notifications, clean up or schedule.

## Receipt lookup

The only accepted query is all three of `manifestId`, `shortId` and `sha256`, using
retained reviewed ledger values. Both hashes must be 64 lowercase hexadecimal
characters. Unknown, duplicate and partial parameters are rejected. Recovery checks
fresh authenticated health and the exact returned manifest/target/hash binding.
It only issues GET requests and returns `verified`, `superseded` or `uncertain`.
It never retries writes, clears pending files, edits receipts or deletes evidence.
A missing/unverifiable receipt remains an error requiring retained evidence.

## Local validation boundaries

Tests use synthetic identities, mocked transport and DOM fixtures. No production
configuration, credentials, database writes, uploads or messages are involved.
The supplied Library screenshots could not be downloaded, so screenshot-dependent
validation is unavailable. A local browser fixture can exercise the actual page
components with mocked auth/API responses; it does not establish live integration
or that any legacy process has stopped. Full application builds previously failed
on unavailable Google Fonts access; no deployment readiness is implied.
