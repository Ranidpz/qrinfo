# WhatsApp intake reliability plan — 2026-09-24

Status: core incident recovery implemented for pilot 0.8.0; live installation acceptance remains pending. The sections below retain the broader design and its acceptance criteria.

## Incident evidence and limits

The 16:46 Israel export reports installed runner 0.7.2, `attention_required`, `UNCONFIRMED_BATCH`, `pending: true`, and a stale preview/collection from 10:07. `scan: null` means this export provides no evidence that the 0.7.2 history scanner ran. The screenshot shows scheduling disabled. The group screenshot shows a report delivered at 10:08, including implementation details the recipient should not see.

Code confirms four defects/gaps:
- `runner.mjs` rejects every new run/preview/scheduled check when `pending.json` exists. Only CLI `resume` can reconcile; the native app has no recovery control.
- Upload confirmation, report email, group-send acknowledgement and local checkpoint cleanup share one blocking lifecycle. A successful PDF update plus uncertain WhatsApp acknowledgement can leave the entire workflow blocked.
- Upgrading components deliberately disables scheduling, but the UI does not explain the saved previous activation or offer a guided recovery/reactivation flow. Scheduled execution also returns immediately when disabled.
- Diagnostic export omits the pending batch identity, last confirmed results, outbox acknowledgement and schedule attempts. `schedule-sync.mjs` additionally reports a hardcoded runner version 0.7.0 rather than the installed version.

The export cannot prove whether the 12:00 and 14:00 tasks launched, slept, were disabled, or failed on the pending batch. Nor does it prove which PDFs actually changed. The first error must be recovered from the scheduler log, pending record, server batch and local report/outbox, not inferred from the latest overwritten error.

## 1. Resolve the existing operation without repeating writes

Add an owner-scoped read-only batch-status endpoint and include a sanitized incident bundle in the app's existing export. Capture pending batch ID/stage/times, last report file outcomes, outbox states, configured schedule/revision/enabled flag, activation changes, recent attempt history and installed version. Never export credentials, session cookies, browser profiles or arbitrary environment variables.

Reconcile against persisted server results and file-update receipts:
- Confirmed updates: preserve their original timestamps; do not upload again.
- Pending email/group notice only: move to a separate durable notification queue; allow subsequent scans and confirmed-safe updates.
- Uncertain file write: reconcile server state first; do not delete the local pending marker or blindly replay upload. Block the affected target; other targets continue only when the server explicitly proves their independent write state. If scope cannot be proved, stop writes and explain why.
- Active or abandoned server chunk: reconcile its lease and per-file receipts. Do not reset `activeCommits` merely because time elapsed. Use expiring leases plus fencing for new writes, and atomic receipt recording with the QR replacement transaction to close crash windows.

Add a Hebrew button `בדיקת הפעולה הקודמת` for existing blocked installations. Show the result: files confirmed, files requiring review, notification outstanding, or operation still active. Never expose `Use resume` as a user instruction. Preview can run read-only while a previous update is unresolved; explicitly label it as preview and keep the unresolved-write warning.

## 2. One execution path, independent notification delivery

Persist stages separately: collecting -> previewed -> writing -> data_confirmed; each file has its own outcome. Email and WhatsApp each have an independent outbox record referencing that immutable outcome. Persist data completion/checkpoint before attempting notifications. A notification failure must not become an upload failure.

For legacy pending batches, migration is based on server confirmation, never on the mere presence of a local report. Preserve existing outbox text/identity when delivery is uncertain; do not rewrite an old long message into the new wording and resend it. Reconcile that send by exact outgoing identity/group/text where supported, with bounded history search. If still uncertain, surface it to the operator without duplicate sending. New reports use the short wording below.

Normalizing known filenames, identical byte dedupe, original filename audit and explicit region rules remain. Unknown filenames hold only those files. Conflicting contents for one target hold that target until an explicit resolution; a later timestamp alone does not choose a winner. A newly named resend can replace a previously unassigned item. Keep traceability from superseded/clarified source messages to the new file to avoid repeating obsolete correction requests.

## 3. Predictable scheduled checks and a real Update Now button

Use one locked execution service for scheduler and manual runs. `עדכון עכשיו` performs a fresh scan, matching, confident uploads and the short group report. It works with scheduling disabled, but still requires an authorized computer, confirmed business account and safe handling of any previous write. Disable duplicate clicks while running. It does not consume or change the next scheduled slots.

Keep explicit local scheduling activation. After an upgrade, display whether scheduling was previously enabled, why it is paused and the exact action needed to resume after recovery/verification. Do not silently enable a previously disabled installation. Use a single source for installed version in the app, export and heartbeat.

Persist every scheduled attempt (including no changes) with slot, actual start, completion, outcome and reason. Retry transient read/status/sync errors with bounded backoff. Reconcile uncertain writes rather than retry them. When waking late, perform one fresh catch-up scan for the latest due slot and record missed slots as missed, not successful. Calendar edits remain future-only. Display the next check in Israel time, last actual scan, last confirmed upload, schedule state and last heartbeat. An independent server check alerts the operator when an expected heartbeat/check is overdue; a sleeping Mac cannot reliably report its own failure.

## 4. Short recipient-facing WhatsApp report

No agent, interface, internal IDs, manual-assignment instructions or system implementation details. Reports describe only confirmed outcomes, held files and an action the sender can perform in WhatsApp. Detailed filenames, hashes and timestamps stay in the operator report/email.

Illustrative wording (not a claim about today's actual uploads):

> ✅ עודכנו: [שמות החוברות שעודכנו בפועל].
> ⚠️ לא עודכנו: 2 קבצים בשם „תוכניית בידור סופש” ללא שם יעד.
> נא לשלוח אותם מחדש עם שם החוויה והמיקום בשם הקובץ.
> חסרות: [שמות החוברות שעדיין לא התקבלו].

For same-name files, use sender-visible time/size only if needed to distinguish them; do not expose hash suffixes. One concise missing/held list, with no duplicated names. Prefer resend with corrected filename while exact reply linkage remains unavailable. Do not instruct users to reply in a way the collector cannot reliably associate. Follow-ups announce newly confirmed changes; unchanged/no-new runs are recorded privately and remain quiet in the group. A false `all updated` must never follow excluded or failed files.

## 5. Acceptance tests and release gate

Before publishing another installer, verify the entire lifecycle, not only isolated helpers:
1. Morning run updates good files and holds invalid ones; email succeeds; WhatsApp is visibly sent but acknowledgement is lost. Noon still scans corrected resends without duplicate uploads or duplicate group messages.
2. Interrupt after server PDF replacement but before response/local cleanup. Restart and reconcile the original outcome and replacement time without rewriting the PDF.
3. Email outage leaves uploads confirmed and later slots functional; recovery sends the original report once within the supported delivery-idempotency policy.
4. Simulated clock covers configured morning/noon/14:00 slots, no-change runs, sleep/wake, disabled schedule, upgrade pause and next-day rollover. Manual Update Now neither consumes future slots nor races the scheduler.
5. Complete-history cases include delayed Club Dead Sea/Royal messages; missing known messages prevent false completion. Identical Royal bytes dedupe, different versions hold only that target. Renamed corrected resends are detected at the next slot.
6. Native UI visibly offers recovery, Update Now, separate delivery status, clear Hebrew errors and next check. Preview never uploads or posts a group notice. Export includes enough data to explain missed slots without secrets.
7. Only after local tests pass, verify the actual installed build on Michal: recover the existing batch, confirm complete preview, run one explicit update and compare server receipts to downloaded bytes. Then verify an actual scheduled follow-up with a corrected file and its report. One active Mac per connection. Do not declare the feature reliable from unit tests, package checksums or a green preview alone.

Implementation order: incident/status diagnostics and legacy recovery; durable separation of writes and notifications; native controls and scheduling visibility; concise reports; full lifecycle tests; one verified installation/release. The implementation does not alter the live batch or send test messages. The pilot package is published only after local verification.


## Implemented scope and remaining limits — 0.8.0

Implemented: authenticated read-only status, safe legacy reconciliation against complete server results, independent delivery queue, bounded email retry window, preservation of uncertain outgoing text, manual update/recovery controls, next-check and attempt visibility, explicit upgrade pause, actual heartbeat version and concise group summaries. The local acceptance suite covers confirmed server outcomes and notification faults; it does not simulate a server crash before a file receipt exists.

Not implemented in this pilot: atomic per-file receipts plus fencing/lease recovery for an abandoned active chunk; target-isolated continuation when write outcomes are unknown; automatic linking of renamed generic files without verified source/hash evidence; independent server monitoring of a sleeping/missing Mac; recording every missed historical slot; automatic stale process-lock cleanup. Those cases remain conservative stops or documented operational limits, not claims of automatic recovery. The actual 12:00/14:00 incident cannot be reconstructed from the older export. Fresh Michal diagnostics and a real scheduled follow-up remain required before declaring end-to-end operation verified.
