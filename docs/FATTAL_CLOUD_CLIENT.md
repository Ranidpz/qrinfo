# Server-side Fattal read-only caller

`src/lib/content-intake/cloud-client.ts` closes the programmatic caller gap for the
cloud API. It uses the existing Node/Next runtime and fetch; no dependency is added.
It is marked `server-only` and must not be imported by browser components.
It is a client library plus a strict dispatcher, **not a registered MCP server/tool**.
The repository has no MCP SDK, MCP registration, OAuth service or vault integration.

## Trusted runtime setup (not performed)

The factory `createFattalCloudClient(config?, runtime?)` defaults to disabled. Disabled
clients resolve no secrets and perform no network calls. An enabled client requires
all of these trusted, non-secret configuration fields:

| Field | Meaning |
| --- | --- |
| `enabled` | Must explicitly equal `true` to allow HTTPS transport; default false |
| `baseUrl` | Exact approved deployment origin, HTTPS, no userinfo/path/query/fragment/custom port |
| `ownerId`, `ownerEmail`, `projectId` | Verified mapping for that deployment; no inferred defaults |
| `allowedTargets` | Explicit nonempty subset of the fixed 12 Fattal parent short IDs |
| `credentialRef` | Exactly `env:FATTAL_CLOUD_CLIENT_KEY` |

These fields are supplied by trusted server bootstrap code, never by model tool
arguments. Non-secret mapping may be supplied later without adding credentials now.
The default resolver reads **only** `process.env.FATTAL_CLOUD_CLIENT_KEY`, at invocation
time, after transport configuration is checked. It expects a dedicated `tq_fc_` token.
It does not read connection files, generate secrets or provision records. The key is
sent only as `x-fattal-cloud-key` to the configured origin. Redirects and transport
credentials are disabled; errors are fixed codes and responses are explicitly projected.
Credential-shaped input/echoed responses are rejected; the client never logs payloads,
headers or raw underlying errors. Host-level request tracing must redact auth headers.

The existing repository configuration mechanism is server process environment access.
Actual secure injection must come from the chosen host's user-operated configuration
facility, directly into that server process. **No such facility has been selected or
verified in this task.** Do not paste the secret into chat, model inputs, CLI arguments,
checked-in files, `.env` files, diagnostic exports or browser storage. There is no new
user-facing credential form. The legacy dashboard/desktop key flow is incompatible.
A trusted runtime may supply an in-memory `resolveSecret` implementation through the
optional runtime dependency, but no vault adapter or external binding is implemented.

Example bootstrap shape (non-secret reference only; deliberately disabled):

```typescript
import { createFattalCloudClient, createFattalCloudReadTools } from '@/lib/content-intake/cloud-client';

// verifiedMapping is supplied by trusted host code after separate setup.
const client = createFattalCloudClient({
  enabled: false,
  baseUrl: verifiedMapping.deploymentOrigin,
  ownerId: verifiedMapping.ownerId,
  ownerEmail: verifiedMapping.ownerEmail,
  projectId: verifiedMapping.projectId,
  allowedTargets: verifiedMapping.shortIds,
  credentialRef: 'env:FATTAL_CLOUD_CLIENT_KEY',
});
const dispatch = createFattalCloudReadTools(client);
```

No bootstrap instance is installed or enabled by this change. The server API's separate
`FATTAL_CLOUD_ENABLED` and `FATTAL_CLOUD_WRITES_ENABLED` switches are not the client's
`enabled` setting. Leave cloud writes disabled. Readiness requires a credential whose
attested scopes are exactly `["read"]`; a write-scoped credential is rejected by this client.

## Exact future tool contract

The dispatcher accepts `(name: string, input: JSON object)` and rejects unknown names,
additional top-level keys, configuration, credentials, URLs, activation and write flags.
It can be registered later with an explicitly authorized tool host. There is no MCP
protocol transport or discoverable registered tool in this patch.

| Name | Exact input object | Output |
| --- | --- | --- |
| `fattal_cloud_health` | `{}` | Protocol, verified owner/email/project, read scope, expiry, allowed target hotel/version/pending entries, `clientReadOnly:true`, effects disabled |
| `fattal_cloud_preview` | `{ "manifest": CloudManifest }` | Exact normalized manifest/digest, duplicate/pending flags, `saved:false`, effects disabled |
| `fattal_cloud_recovery` | `{ "manifestId": SHA256, "shortId": allowedShortId, "sha256": SHA256 }` | Exact bound receipt/target/hash, `status`, `verified`, `retryAllowed:false`, effects disabled |

`CloudManifest` is the exact protocol-1 structure and constraints documented in
[FATTAL_CLOUD_API.md](FATTAL_CLOUD_API.md#requests) and validated by `parseManifest`:
explicit owner/project/hotel/target, period, original filename/size/SHA256, expected
active version, group/message/file identities, superseded identities and review evidence.
All three recovery input fields are required; SHA256 means 64 lowercase hex characters.
No tool accepts the key, credential reference, deployment origin or owner configuration.

Every invocation resolves a runtime secret and checks authenticated health against the
configured owner/project/target bounds. Preview additionally rejects a pending/stale
active target and sends `saveRun:false` and every notification/cleanup flag false.
It verifies that the server returned the exact submitted normalized manifest and digest.
Recovery compares the returned receipt ID, target and hash to the supplied expected
identities. It preserves `uncertain`/`superseded` results and does not upload or retry.
There are no commit, notification, deletion, report-finalization or scheduling methods.

All network operations have a 20-second timeout and 256-KiB bounded response. Unexpected
remote fields are omitted. Errors are only `CloudClientError` with one of `disabled`,
`configuration`, `input`, `credential`, `transport` or `response`; remote bodies and
exceptions are not exposed. Applications should show these generic errors and retain
pending evidence. Never clear staging based only on HTTP success.

## What is verified and what is still missing

Mock tests exercise default-disabled transport, secret resolution ordering, origin
restrictions, identity/scope mismatches, forced read-only preview, manifest tampering,
recovery binding, no retries, secret/error suppression and response limits. Synthetic
owner/project/key values and fixed allowlist IDs suffice; no secrets are needed.

Still required: a successful deployment build, an isolated development API URL,
verified development ownership (not inferred from confirmed production email
`biduratias@gmail.com`), a chosen secure host injection mechanism, a separately
provisioned read-only connection, and host-side bootstrap/registration. None is
performed here. A supported MCP facade could later wrap this exact contract after
choosing a host/SDK; it is not currently registered. Real Firebase/R2 behavior,
staging-directory processing, schedules and independent missed-run monitoring remain
outside these local tests. No WhatsApp or email functionality is added.

The smallest next integration input is a non-secret development mapping/deployment
choice. If existing authorized read access becomes available, checking mapping does
not inherently require fresh approval. This task currently has no verified access;
do not seek or create credentials to obtain it. An existing administrator may supply
the non-secret mapping instead. Deployment, credential provisioning/binding and any
future writes remain distinct permission-dependent actions.
