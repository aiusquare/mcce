# Academic Session Management Remediation Plan

## Purpose

This document is an execution playbook for fixing academic-session management across the frontend and backend. It is written so an agent unfamiliar with the project can implement the work phase by phase without relying on prior chat context.

The target outcome is one authoritative, auditable academic-session lifecycle that governs admissions, course delivery, registration, results, hostel activity, finance, and reporting while preserving historical records.

## Repositories and current implementation

- Frontend: `C:\DEV\Reatjs\maslaha\frontend`
- Backend: `C:\DEV\Reatjs\maslaha\backend`
- Backend framework: CodeIgniter/PHP
- Frontend framework: React/TypeScript/Vite
- Canonical session table: `academic_sessions`
- Current CRUD model: `backend/application/models/Courses_model.php`
- Current admin controller: `backend/application/controllers/Admin.php`
- Session UI: `frontend/src/pages/admin/AdminProgrammesPage.tsx`

## Non-negotiable rules

1. Do not let the client choose, create, or activate an academic session by sending a display name.
2. Use `academic_sessions.id` as the persistent reference. Names are display data and historical snapshots only.
3. A read request must not create, repair, activate, or otherwise modify a session.
4. Session mutation requires an explicit backend authorization check, not only a logged-in check.
5. Do not delete a session with historical dependencies. Archive it instead.
6. Do not remove legacy columns or fallback reads until migration reconciliation proves they are no longer needed.
7. Make each phase independently reviewable, tested, and deployable. Do not combine schema backfill with destructive cleanup.

## Decisions to confirm before coding

Obtain a product-owner decision for each item below. Do not guess if the answer changes institutional policy.

| Decision | Recommended default |
| --- | --- |
| Can more than one session be operational? | Yes: one `active` academic session, optionally one separately `admissions_open` session. |
| Can admission open for a future academic year? | Yes, without making that future session the active teaching/registration session. |
| Can sessions be renamed after records exist? | No. Treat `name` as immutable once referenced; create a correction/display-alias process if needed. |
| Can sessions be deleted? | Only if never referenced; otherwise archive. |
| Who may manage sessions? | Super admin or a dedicated `academic_sessions.manage` permission. |
| What session applies to an application? | The server-resolved open admission session at submission time. |
| What session applies to course registration? | A server-approved registration period for the student's eligible academic session/semester. |

## Target domain model

### Session state

Add a lifecycle field such as `status` with these values:

- `planned`: configured but unavailable to students.
- `admissions_open`: applications may be submitted if the application window is open.
- `active`: current academic delivery session.
- `closed`: no new operational activity except authorized corrections.
- `archived`: retained for history only.

Use explicit booleans/windows only where needed:

- `admissions_open_at`, `admissions_close_at`
- `registration_open_at`, `registration_close_at` should belong to a session-and-semester registration setting, not just the session.
- `activated_at`, `activated_by`, `archived_at`, `archived_by`, `archive_reason`

### Reference rules

| Domain | Required session reference |
| --- | --- |
| Applications and admissions | `application_session_id` / current `session_id`, FK to `academic_sessions.id` |
| Students | Immutable `entry_session_id`, FK |
| Course offerings | `session_id`, FK |
| Course registrations | `academic_session_id` for the teaching period and `entry_session_id` for cohort, both FK |
| Result batches | `academic_session_id` for the result period and `cohort_session_id` if cohort targeting is needed, both FK |
| Hostel bookings | `session_id`, FK |
| Invoices/payments or fee settings | `session_id`, FK when the charge/policy is session-specific |
| Reports/documents | ID for joins; copied session name only as an immutable rendering snapshot |

## Phase 0 — Baseline, safety, and decisions

### Goal

Create a factual deployment baseline and approve the policy decisions before changing behaviour.

### Steps

1. Read this entire document and inspect the current files listed above before editing anything.
2. Record the production/staging schema for `academic_sessions`, `applications`, `admissions`, `students`, `course_registrations`, `result_batches`, `hostel_bookings`, fee tables, and carryover tables.
3. Query and save counts for:
   - sessions with `is_active = 1`;
   - null/empty/unknown session references;
   - references stored by name rather than ID;
   - rows that would block a session archive/delete;
   - applications or registrations outside intended date windows.
4. Inventory all routes that create/update session-bearing records.
5. Confirm the decisions in the preceding table and add them to the implementation PR description.
6. Back up the database before applying any data migration.

### Deliverables

- A timestamped baseline SQL/report artifact outside source code or in approved operational documentation.
- Signed-off lifecycle and authorization decisions.
- A list of database environments and their actual migration levels.

### Exit criteria

- No coding begins until the production migration path and current data quality are known.
- The team can name the authorized role/permission for session management.

## Phase 1 — Immediate security and write-path fixes

### Goal

Stop unauthorized or client-controlled session mutations without breaking existing records.

### Backend changes

1. In `Admin.php`, require a dedicated authorization check for `get_sessions` if necessary and for all create/update/activate/archive operations. Authentication alone is insufficient.
2. Implement a reusable authorization guard rather than duplicating role checks in each endpoint.
3. Remove all read-side default creation:
   - `Admin::get_sessions()` must return an empty list or an explicit configuration error when no session exists.
   - `Student::programmes()` must not create `2026/2027`.
   - `Courses_model::get_active_session()` must report duplicate active sessions; it must not repair them during a read.
4. Replace `Student::resolve_session_id($payload)` behaviour:
   - Ignore client-supplied display session names for new applications.
   - Resolve the server's eligible `admissions_open` session.
   - Reject submission with a clear `409`/`422` response if no eligible session exists.
   - Never create a session from a student request.
5. Validate all student course-registration requests against an allowed registration period. Do not accept arbitrary `session_id` values merely because they are present.
6. Ensure controller failures exit/return consistently after unauthorized responses.

### Frontend changes

1. Continue displaying the server-provided active/admissions session, but treat it as read-only information.
2. Remove hard-coded session fallback values from user-facing flows.
3. Disable application submission with a clear message when the server reports no open admission session.
4. Show actionable admin errors for missing configuration rather than silently creating defaults.

### Tests

- Student submits a forged session name: rejected and no new session row exists.
- Student submits when no admission session is open: rejected.
- Authenticated non-authorized user attempts create/activate/archive: `403`.
- Authorized user can manage a session.
- GET endpoints never change the session-table row count or active flags.

### Exit criteria

- No unauthenticated or unauthorized account can change a session.
- No client request can create a session.
- No GET endpoint writes to `academic_sessions`.

## Phase 2 — Canonical migration pipeline and data repair

### Goal

Bring every environment to one compatible session schema without losing historical records.

### Steps

1. Choose one migration mechanism. Recommended: CodeIgniter timestamp migrations for all application schema changes. Do not leave mandatory migrations only in `backend/db/migrations/*.sql`.
2. Add forward-only migrations to:
   - add lifecycle/audit fields;
   - add `entry_session_id`, `academic_session_id`, and `cohort_session_id` where required;
   - add foreign keys only after the data is clean;
   - add indexes that match query patterns.
3. Update `application/config/migration.php` to the latest intended migration version and ensure deployment actually runs it.
4. Write a non-destructive backfill command that:
   - maps known legacy names to canonical IDs;
   - writes a reconciliation report for unmapped/ambiguous values;
   - does not guess mappings that cannot be proven.
5. Make the backfill idempotent and transaction-safe in batches.
6. Run the backfill first in a database copy, compare counts, then in staging.
7. Only after reconciliation is clean, add foreign keys and change new writes to populate canonical columns.
8. Maintain dual-read only for a stated deprecation period. Add telemetry/counts for legacy fallback use.

### Required checks

- Exactly zero orphaned session IDs before foreign keys are added.
- Exactly zero unmapped legacy names, or each exception has a documented manual resolution.
- Every new registration and result batch writes both required canonical fields.
- Migration can run twice without changing valid records on the second run.

### Exit criteria

- Staging and production schemas match the expected migration level.
- All new writes use canonical IDs.
- Legacy fallbacks are measurable and scheduled for removal.

## Phase 3 — Enforce lifecycle and integrity in the database

### Goal

Make invalid session state difficult or impossible to persist.

### Steps

1. Enforce valid lifecycle status with an enum/check constraint appropriate to the deployed MySQL version.
2. Enforce a single active academic session at the database level. If the database cannot support a partial unique index, use a transactional settings/lock row or a generated-column unique strategy; document the chosen approach.
3. Implement activation in one transaction with row locking. It must:
   - verify the actor permission;
   - verify the target is not archived;
   - close/deactivate the prior active session according to policy;
   - write audit fields.
4. Validate dates:
   - start must be before end;
   - admission/registration windows must be internally valid;
   - do not require academic year labels to infer dates silently.
5. Prevent transitions that violate dependencies, for example archiving/closing while an allowed workflow is intentionally still open.
6. Do not use `name` as a mutable business key. Keep it unique and immutable after references exist.

### Tests

- Two concurrent activation attempts always leave exactly one active session.
- Invalid state/date transitions fail atomically.
- Archived sessions cannot be reactivated without an explicit approved restore process.
- Database rejects invalid foreign keys.

### Exit criteria

- There is always at most one active session even under concurrent API calls or direct administrative scripts.

## Phase 4 — Integrate all operational modules

### Goal

Use the session lifecycle consistently throughout the system.

### Admissions and students

1. Bind every new application to the server-resolved admissions session ID.
2. Copy that ID to admission/student entry cohort at the correct lifecycle event.
3. Do not modify a student's entry cohort during later registration or promotion.

### Course offerings and registration

1. Require an active/allowed academic session when creating a course offering.
2. Scope registration settings by canonical academic-session ID plus semester.
3. Resolve eligible registration sessions server-side for the student.
4. Ensure registration writes the teaching-period `academic_session_id` and immutable `entry_session_id` where the schema supports them.

### Results and broadsheets

1. Create result batches using the canonical academic-session and cohort IDs.
2. Use the explicit fields in queries before any legacy `session_id` or name fallback.
3. Keep document snapshot names for rendering only, never for identity or filtering.

### Hostel and dashboards

1. Require a valid operational session for a booking.
2. Dashboard filters must use session ID, not a name or implicit latest row.

### Finance

1. Add backend-owned `session_fee_settings` with a session-ID FK, fee amounts, effective dates, status, and audit fields.
2. Add authenticated admin endpoints for list/read/create/update of those settings.
3. Remove local-storage persistence and hard-coded fallback sessions from `frontend/src/lib/fees.ts`.
4. Decide whether invoices/payments need a session ID. If fees can be reported or charged per session, add and populate it.

### Exit criteria

- Every module can explain which session applies and why.
- No business-critical workflow depends on a session display name or browser-local fee configuration.

## Phase 5 — Safe administration, history, and UX

### Goal

Make administration intentional, traceable, and safe for historical records.

### Steps

1. Create a dedicated session-management page or clearly separated admin section; do not bury lifecycle controls inside programme management.
2. Display status, active flag, all relevant windows, dependency counts, and last change actor/time.
3. Replace delete with archive by default.
4. Permit hard delete only when a comprehensive dependency query finds no references across:
   - applications;
   - admissions;
   - students and entry-session fields;
   - offerings;
   - registrations and envelope fields;
   - result batches, attempts, snapshots, and corrections;
   - hostel bookings;
   - invoices/payments/fee settings.
5. Disallow rename after references exist. If correction is required, use a separate display-label process with audit history.
6. Require a reason and confirmation for activation, closure, archival, or exceptional correction.
7. Add audit events for each lifecycle action.

### Exit criteria

- An administrator can understand the consequence of each action before committing it.
- History cannot be silently reclassified by a rename or delete.

## Phase 6 — Automated verification and release

### Goal

Prove the behaviour in tests and release without data regression.

### Minimum test matrix

| Area | Required scenarios |
| --- | --- |
| RBAC | Authorized manager succeeds; authenticated unauthorized user gets `403`; anonymous user gets `401`. |
| Application | Uses server-resolved open session; forged/closed/unknown session rejected; no auto-created sessions. |
| Lifecycle | Valid transitions succeed; invalid transitions fail; exactly one active session under concurrency. |
| Registration | Student can register only in an allowed session/semester; historical admin work follows explicit permission rules. |
| History | Prior applications, registrations, results, and documents still render after session rollover. |
| Delete/archive | Referenced session archives; unreferenced session may delete; dependency errors identify the blocker. |
| Migration | Fresh install, upgrade from legacy schema, idempotent rerun, and reconciliation exceptions. |
| Finance | Session fee settings survive refresh/browser/device and are applied to the intended session. |

### Deployment sequence

1. Deploy code that understands both old and new fields.
2. Run non-destructive schema migration.
3. Run backfill and capture reconciliation output.
4. Resolve all exceptions manually and rerun validation.
5. Add foreign keys/integrity enforcement.
6. Enable strict write-path rules.
7. Monitor legacy fallback use, errors, session activation events, and unmatched references.
8. Remove legacy fallbacks only after the agreed observation period and a final backup.

### Release gates

- All required tests pass.
- Baseline/reconciliation counts are approved.
- No unknown or orphaned canonical session references remain.
- A rollback plan and database backup are available.
- Production activation is performed by an authorized owner and audit logged.

## Agent handoff checklist

Before declaring any phase complete, the implementing agent must provide:

1. Changed-file list and concise rationale.
2. Migration name, up/down or rollback strategy, and whether it is idempotent.
3. Commands/tests run and their results.
4. Data assumptions and any unresolved records.
5. API contract changes, including error status codes.
6. Explicit confirmation that no read endpoint performs a write.
7. Explicit confirmation that no client-controlled display name determines the persisted session ID.

## Known current hotspots

- `backend/application/controllers/Admin.php`: session CRUD is authenticated but requires explicit RBAC enforcement.
- `backend/application/models/Courses_model.php`: active-session logic currently repairs data during reads.
- `backend/application/controllers/Student.php`: application session resolution currently accepts payload name and can create sessions.
- `backend/application/controllers/Student_course_registration.php`: supplied registration session IDs need eligibility validation.
- `backend/db/migrations/021_academic_session_envelope.sql` and `022_backfill_academic_session_envelopes.sql`: important but not part of the CodeIgniter timestamp migration chain.
- `frontend/src/lib/fees.ts`: session-fee settings currently use nonexistent/fallback API paths and local storage.
