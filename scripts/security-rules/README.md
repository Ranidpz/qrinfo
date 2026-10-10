# Local role-rule regression tests

The Firestore rules are a candidate pending separate Firebase activation. `npm install` in this directory installs only the
pinned test tools here, without changing application dependencies. Java 21+ is needed.
Run `npm test` from this directory in a disposable environment without credentials.
The command starts only Firestore on 127.0.0.1:8088 with project
`demo-qrinfo-role-review`, runs the actual candidate rules, then stops the emulator.
The suite refuses any other emulator address and never uses a production project.

Seven cases cover update/merge/replacement/deletion role changes, initial privileged
registration, forged identity/limits, delete-recreate, batch escalation, ordinary and
anonymous access, existing admin workflows, and actual server guards reading emulator
state. Firebase token verification is stubbed with a fixture UID; database reads use
the local emulator. Tests do not claim that production rules or existing roles are safe.

Validated locally on main 65f25ec501a884b59de050255d7827d3e9fd27ad (v1.26.15).
All checks were repeated for v1.26.17 on main 3d7860b1bfc824afcb7751a55f7252a211f2be78.
The official emulator JAR matched the expected SHA-256. All seven emulator cases,
118 application regressions, TypeScript and focused lint passed. The fixture reader
captures its snapshot explicitly because withSecurityRulesDisabled returns void.
An independent control confirmed baseline self-promotion enables both actual server
guards and a foreign-code update; candidate rules deny the same attack.
To repeat the control, use emulators:exec with the same demo project/config and
`node --test scripts/tests/firestore-roles.control.mjs`. For the baseline only, set
RULES_TEST_SOURCE to an isolated old-rules file and RULES_TEST_EXPECT_VULNERABLE=1.

The patch keeps legacy storageUsed/messageQuota updates for compatibility. It is not
complete quota hardening. Existing forged admin records would remain privileged;
an authorized operator must reconcile privileged records before activation. New
browser registrations always get `free`; creating/promoting an admin requires an
existing trusted administrator or separately authorized Admin SDK operation.
Do not publish/deploy rules or change privileged records without specific approval.
