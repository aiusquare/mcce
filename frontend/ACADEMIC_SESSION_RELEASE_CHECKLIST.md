# Academic Session Release Checklist

Use this checklist for staging and production. It is designed for phpMyAdmin/shared hosting; no SSH or migration command is required.

## 1. Back up and deploy safely

1. Export a full database backup and record the timestamp.
2. Deploy backend and frontend code that supports both legacy and canonical session columns.
3. In phpMyAdmin, select the application database and run these files in order:
   - `backend/db/migrations/023_add_academic_session_envelope_columns.sql`
   - `backend/db/migrations/024_audit_academic_session_envelopes.sql` (read-only; export results)
   - `backend/db/migrations/025_enforce_single_active_academic_session.sql`
   - `backend/db/migrations/026_create_session_fee_settings.sql`
   - `backend/db/migrations/027_add_academic_session_archival.sql`
   - `backend/db/migrations/028_create_academic_session_events.sql`
4. Do **not** run `022_backfill_academic_session_envelopes.sql`; its fixed-year rules are unsafe for real historical data.

## 2. Reconcile historical records

1. Review the exported output from `024` with registry/exams staff.
2. Prepare a reviewed mapping only for records whose session can be proven from source data.
3. Preserve unmapped/ambiguous records for manual resolution. Never map them from a level, the current active session, or a guessed year sequence.
4. Rerun `024` after each approved reconciliation batch.

## 3. Verify release gates

Run `backend/db/migrations/029_verify_academic_session_release_readiness.sql`.

- Every schema and integrity result must be `PASS`.
- Reconciliation-backlog counts must be documented and reach zero before adding foreign keys or removing legacy reads.
- Confirm that the active session shown by the final query has an active fee setting if student payment flows are enabled.
- Save the output with the deployment record.

## 4. Manual smoke tests

1. Anonymous user: cannot create, activate, update, archive, or delete a session.
2. Non-authorized logged-in user: receives `403` for session mutation.
3. Authorized manager: can create a session and activate it only with a reason.
4. Student application: submitted application uses the server-selected session even if the request supplies another session name.
5. Student registration: cannot select an arbitrary session; it uses the active session and configured semester.
6. Result batch: unknown session ID is rejected; a valid batch records `academic_session_id`.
7. Archive: active session cannot archive; inactive session requires a reason, is retained, and cannot be reactivated.
8. Fees: a session fee setting persists after browser refresh and is retrieved by the student payment page without local-storage fallback.

## 5. Rollback

If a code deployment must be rolled back, restore the prior application release. Do not drop the additive session columns/tables during an incident. Restore data only from the backup after approval from the database owner.
