# Minimal durable Fattal caller runtime

Status: local engineering evidence only, October 11, 2026. No runtime, volume,
credential, deployment or schedule was provisioned by this work.

Keep the existing Node 24 CLI and API. The smallest operational setup is one
manually invoked caller on one host, using one named, private persistent POSIX
volume. Pin the code revision and non-secret owner/project configuration. All
invocations must use the same absolute state directory, owned by the runtime user
with mode 0700. The storage contract must support exclusive file creation, atomic
rename, and acknowledged file and directory fsync across host failure, not merely
preserve files between two processes.

Initialize once on a verified new empty volume. Subsequent starts inspect `state`
and run `recover-pending` with writes disabled before considering new work. Missing
identity/history, corruption, a changed binding or a retained lock blocks progress;
never turn a startup or volume-replacement event into automatic initialization.
After an abrupt kill, an operator must prove every prior caller stopped and
reconcile receipt/pointer/bytes before removing the exact lock. The isolated test
exercises this procedure; it does not add automatic takeover to the product.

## What is established

The selected workspace reports `/workspace` as an overlay mount. Separate process
restart and SIGKILL retain the journal here. No inspected environment capability
provides a verified independent remount or host-crash durability contract. This
workspace has not been established to be a Vercel Sandbox or attached Drive.

Vercel documents [persistent Sandboxes](https://vercel.com/docs/sandbox/concepts/persistent-sandboxes)
as saving a filesystem snapshot on stop and restoring the last snapshot on resume.
Snapshot expiration is configurable. These lifecycle guarantees alone do not prove
that each acknowledged journal fsync survives an unexpected host loss before stop.

Vercel [Drives](https://vercel.com/docs/sandbox/concepts/drives) are a public beta
with persistent directories across sessions and one read-write mount at a time.
That makes a Drive a candidate for evaluation, not an accepted production journal:
the reviewed page does not specify the crash/rename/fsync contract this caller
requires. No Drive was created or tested. Snapshot restoration must never roll
back the journal behind a server-side activation and silently permit a repeat.

## Next operational gate

The verified execution option is the existing Node 24 CLI on one live host with a
private POSIX state directory. The simplest operational continuation is to use one
existing persistent host and keep that exact directory through reboot. No named
host/volume has yet passed that lifecycle test in this session, so none can
honestly be labeled fully verified for unattended durable operation. Do not add a
new service or migrate to a sandbox merely to complete this milestone.


Select an existing named host and persistent volume, or explicitly authorize
provisioning one. Record its documented storage semantics and lifecycle/retention
policy. On that exact runtime, use synthetic data to verify pending journal,
identity, source/hash ledger and lock across process kill, host stop and volume
detach/reattach; recover through GET-only calls without a second upload. Include a
crash before orderly snapshot/stop where supported. Keep `durableStateConfirmed`
unset until the documented contract and observed acceptance satisfy the journal's
requirements; a passing same-filesystem test is insufficient.

Only afterward address separately authorized real object-storage and private
writer-transport acceptance, and an explicitly reviewed new brochure. No scheduler,
additional service, queue, real grant renewal or production upload is needed for
the remaining local work. The eleven manual completions are not test inputs;
U Splash remains paused.
