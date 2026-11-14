# Broadsheet Snapshot Implementation Plan

## Document status

- Status: Proposed
- Scope: Frontend, backend, database migration, governance, and regression tests
- Source of truth: Existing result batches, result attempts, course registrations, and carryover corrections
- Important note: Gemini 3.8 Flash was requested but is not installed or available in the current workspace/session. This plan was prepared from direct analysis of the existing codebase.

## 1. Objective

Implement snapshot-backed broadsheet generation so that:

1. The first Generate Broadsheet request for an exact academic scope creates and stores a snapshot.
2. Later requests for the same scope return the existing fresh snapshot.
3. Regular results continue to come from the result attempt recorded in the academic session/contact in which the student originally took the course.
4. Carryover results come from registrations and attempts in subsequent academic sessions/contacts.
5. A later contact obtains its previous CCR, CCE, CGP, and CGPA from the exact preceding snapshot version.
6. Score changes mark affected snapshots and dependent later snapshots stale.
7. Draft snapshots can be regenerated automatically, while approved snapshots remain immutable and are superseded by a new version.
8. Official exports reproduce the selected snapshot rather than recalculating live data.

## 2. Existing components to retain

The implementation must extend the current infrastructure rather than introduce a parallel broadsheet system:

- `broadsheet_snapshots`
- `broadsheet_approvals`
- `broadsheet_audit_log`
- `result_amendments`
- `result_attempts`
- `result_batches`
- `course_registrations` and `course_registration_items`
- `carryover_corrections`
- `Snapshot_model`
- `Broadsheet_model`
- `Academic_calculator`
- Existing Excel, PDF, Word, and print generators

## 3. Business rules

### 3.1 Regular attempts

A regular result belongs to the academic session/contact in which the student registered for and took the course. Its score remains in `result_attempts` and is not copied into the snapshot as an editable result.

### 3.2 Carryover attempts

A carryover is registered and scored in a subsequent academic session/contact. It must retain links to:

- Student
- Course
- Original failed attempt
- Carryover registration
- Retake attempt
- Original contact
- Retake contact

The carryover result contributes to the current metrics of the retake contact according to the existing academic policy.

### 3.3 Previous metrics

For Contact N:

- Previous CCR = Contact N-1 snapshot cumulative CCR
- Previous CCE = Contact N-1 snapshot cumulative CCE
- Previous CGP = Contact N-1 snapshot cumulative CGP
- Previous CGPA = Contact N-1 snapshot cumulative CGPA

Contact GPA is period-specific and must not be substituted for previous CGPA.

### 3.4 Cumulative metrics

For each student:

```text
Cumulative CCR  = Previous CCR + Current TCR
Cumulative CCE  = Previous CCE + Current TCE
Cumulative CGP  = Previous CGP + Current TQP
Cumulative CGPA = Cumulative CGP / Cumulative CCR
```

### 3.5 Snapshot immutability

- Draft snapshots may be automatically replaced by a new draft version.
- Approved snapshots must never be edited in place.
- A source-data change creates a new version linked through `supersedes_snapshot_id`.
- The previous approved version remains retrievable and verifiable.

### 3.6 NR results

- `NR` remains an administrative data-completeness state.
- It must not be converted automatically to zero, F, or ABS.
- Draft snapshots may contain NR results.
- Approval is blocked by default while NR results remain, unless an authorized exception is recorded.

## 4. Canonical snapshot scope

Snapshot identity must include only filters that change academic content:

- Academic session
- Semester/contact
- Contact number
- Programme
- Level
- Entry mode
- Cohort
- Result basis

Do not include display filters such as search text, standing filter, page, or sort order.

Normalize the scope and calculate:

```text
scope_hash = SHA-256(canonical JSON of scope fields)
```

The backend must own canonicalization so UI formatting differences cannot create duplicate scopes.

## 5. Database changes

Create a new additive migration. Do not edit an already deployed migration.

### 5.1 Extend `broadsheet_snapshots`

Add:

```sql
scope_hash             CHAR(64) NOT NULL
cohort                  VARCHAR(50) NOT NULL DEFAULT 'all'
contact_number          TINYINT NULL
previous_snapshot_id    CHAR(36) NULL
supersedes_snapshot_id  CHAR(36) NULL
source_watermark        DATETIME NULL
stale_at                DATETIME NULL
stale_reason            VARCHAR(255) NULL
rebuild_status          VARCHAR(20) NOT NULL DEFAULT 'ready'
revision_reason         TEXT NULL
updated_at              DATETIME NULL
```

Add indexes:

```sql
UNIQUE (scope_hash, version)
INDEX (scope_hash, status, stale_at)
INDEX (previous_snapshot_id)
INDEX (supersedes_snapshot_id)
INDEX (programme_id, contact_number, basis)
```

Do not add a single-row unique constraint on `scope_hash`; multiple immutable versions must be possible.

### 5.2 Create `broadsheet_snapshot_students`

Store normalized per-student metrics for fast previous-contact lookup and reconciliation:

```sql
id
snapshot_id
student_id
matric_number_snapshot
full_name_snapshot
current_registered_credits
current_earned_credits
current_quality_points
current_gpa
previous_registered_credits
previous_earned_credits
previous_quality_points
previous_cgpa
cumulative_registered_credits
cumulative_earned_credits
cumulative_quality_points
cumulative_cgpa
academic_standing
remark
is_complete
created_at
```

Constraints and indexes:

```sql
UNIQUE (snapshot_id, student_id)
INDEX (student_id, snapshot_id)
INDEX (snapshot_id, is_complete)
```

### 5.3 Create `broadsheet_snapshot_invalidations`

Use a durable invalidation queue instead of performing expensive broadsheet generation inside score-save transactions:

```sql
id
snapshot_id
source_type
source_id
reason
status
created_by
created_at
processed_at
```

Statuses: `pending`, `processing`, `processed`, `failed`.

This table provides auditability and retry support when rebuilding fails.

## 6. Backend services

### 6.1 Snapshot scope service

Add a small service/helper responsible for:

- Resolving canonical session/contact identifiers
- Normalizing level, cohort, entry mode, and basis
- Building canonical scope JSON
- Calculating `scope_hash`

All create, lookup, list, approval, export, and invalidation paths must use the same helper.

### 6.2 `Snapshot_model::resolve_or_create()`

Proposed signature:

```php
resolve_or_create(array $scope, array $options = [])
```

Algorithm:

1. Begin a database transaction.
2. Canonicalize scope and calculate `scope_hash`.
3. Lock the latest snapshot row for that scope.
4. If a fresh usable snapshot exists, return its stored payload.
5. If the latest snapshot is stale or absent, reserve the next version with `rebuild_status = rebuilding`.
6. Commit the short reservation transaction.
7. Generate the live current-contact data.
8. Load the exact authoritative previous snapshot.
9. Replace each student's generated previous metrics with previous-snapshot cumulative metrics.
10. Recalculate cumulative metrics.
11. Persist payload JSON and normalized student rows in one transaction.
12. Set `rebuild_status = ready`, calculate the payload hash, and write an audit entry.
13. Return the stored snapshot payload and metadata.

Never hold database locks during the full broadsheet calculation.

### 6.3 Previous-snapshot resolver

Resolve the preceding academic contact using canonical progression rules, not string sorting.

Requirements:

- Fresh-entry Contact 1 has no previous snapshot.
- Direct Entry begins at its configured entry contact.
- Contact N references the authoritative Contact N-1 version.
- The programme, cohort, entry route, and basis must match.
- Prefer an approved snapshot; allow a draft dependency only for a draft current snapshot.
- Store the chosen `previous_snapshot_id`.
- If no required previous snapshot exists, create/resolve it first or return a clear dependency error.

Include cycle detection and a maximum dependency depth.

### 6.4 Student matching

Match previous and current snapshot rows primarily by immutable `student_id`.

Use matric number only for diagnostics. Do not use student name as a key.

If a current student is absent from the previous snapshot:

- Permit a legitimate new/direct-entry student according to progression rules.
- Otherwise flag a reconciliation issue and prevent approval.

### 6.5 Invalidation service

Create a single service method:

```php
invalidate_for_result_change(array $change_context)
```

Call it after successful commits involving:

- Result score or grade changes
- ABS/NR/result-state changes
- Result publication-status changes
- Carryover result changes
- Carryover registration changes
- Credit-unit snapshot corrections
- Approved course-registration changes
- Result deletion or restoration

The invalidation service must:

1. Identify the directly affected scope/contact.
2. Mark its latest draft/materialized snapshot stale.
3. Traverse `previous_snapshot_id` dependencies and mark later snapshots stale.
4. Insert durable invalidation records.
5. Preserve approved payloads unchanged.

### 6.6 Source watermark

Calculate a source watermark from the latest relevant update timestamp across:

- Result attempts
- Result batches
- Carryover corrections
- Course registration items
- Result amendments

Use the watermark as a defensive freshness check in addition to explicit invalidation.

## 7. API changes

### 7.1 Generate/load broadsheet

Keep the existing endpoint but change its orchestration to snapshot resolution:

```http
GET /api/admin/results/broadsheet
```

Response metadata:

```json
{
  "source": "snapshot",
  "snapshot": {
    "id": "...",
    "version": 2,
    "status": "draft",
    "is_stale": false,
    "generated_at": "...",
    "previous_snapshot_id": "..."
  },
  "context": {},
  "students": [],
  "current_courses": [],
  "carryover_courses": []
}
```

### 7.2 Force refresh

Add a permission-protected endpoint or query option for rebuilding a stale draft. It must not overwrite an approved version.

### 7.3 Governance contract

Standardize snapshot creation/approval payloads. Reject unknown action values instead of silently defaulting.

Approval request:

```json
{
  "snapshot_id": "...",
  "role_key": "hod",
  "action": "approve",
  "comment": "Reviewed"
}
```

Allowed actions: `approve`, `reject`. Validate role permissions server-side.

### 7.4 Official exports

Official exports must identify a `snapshot_id` and load its stored payload. Live/draft exports must be visibly watermarked and must not carry an official verification code.

## 8. Frontend changes

### 8.1 Generate button behavior

Display the correct action based on backend metadata:

- `Load Broadsheet` for a fresh snapshot
- `Generate Broadsheet` when no snapshot exists
- `Refresh Stale Snapshot` when source data changed

### 8.2 Snapshot status panel

Show:

- Snapshot version
- Status
- Generated date
- Source freshness
- Previous snapshot version
- NR/incomplete count
- Verification code when approved

### 8.3 Export actions

PDF, Word, Excel, and print must use the currently displayed snapshot payload. Official export controls must be disabled unless the snapshot is approved.

### 8.4 Governance drawer

Align frontend fields with the backend contract:

- `role_key`
- `action`
- `comment`
- `generated_at`
- Approval `action`
- Approval `user_name`

Pass level, cohort, entry mode, and basis whenever listing or creating scope-specific snapshots.

## 9. Approval rules

Before approval, validate:

- Snapshot is fresh
- Previous-snapshot dependency is approved or valid under policy
- No unresolved reconciliation errors
- No missing required students
- No duplicate students
- No impossible contact progression
- No NR results unless an authorized exception exists
- Payload hash matches stored payload

Approval must fail with actionable validation details rather than a generic error.

## 10. Concurrency and failure handling

- Use a unique `(scope_hash, version)` constraint.
- Recheck freshness after acquiring the scope/version lock.
- Use `rebuild_status` to prevent duplicate generation.
- Do not delete the last valid snapshot before a replacement succeeds.
- If generation fails, set `rebuild_status = failed`, retain the previous version, and log the error.
- Add a timeout/recovery path for abandoned `rebuilding` records.

## 11. Migration and backfill strategy

1. Apply the additive schema migration.
2. Backfill canonical scope hashes for existing snapshots.
3. Mark existing snapshots as legacy until their scope is verified.
4. Populate `broadsheet_snapshot_students` from each valid payload JSON.
5. Resolve contact numbers through `Period_resolver` logic or an equivalent migration-safe mapping.
6. Link previous snapshots only when scope and progression are unambiguous.
7. Produce a migration report for unlinked or ambiguous snapshots.
8. Do not automatically approve backfilled snapshots.

## 12. Regression tests

### Database/model tests

1. First request creates version 1.
2. Repeated identical request returns version 1 without regeneration.
3. Presentation-only filters do not create a new scope.
4. Academic filter changes create a different scope.
5. Contact N previous metrics equal Contact N-1 snapshot cumulative metrics.
6. Carryover score contributes only in the retake contact.
7. Regular score remains associated with its original contact.
8. Score change marks the direct and dependent snapshots stale.
9. Approved snapshots remain unchanged after a score amendment.
10. Regeneration creates a superseding version.
11. Concurrent generation produces only one version reservation.
12. Failed generation preserves the prior valid snapshot.

### API tests

1. Generate endpoint returns snapshot metadata.
2. Invalid sign-off actions are rejected.
3. A rejection cannot be interpreted as approval.
4. Incomplete approval is blocked without authorization.
5. Official export rejects an unapproved snapshot.

### Frontend tests

1. Generate/load/refresh labels follow snapshot state.
2. Export uses the displayed snapshot ID and payload.
3. Governance requests use the canonical backend fields.
4. Stale and incomplete warnings are visible.

### Historical anomaly regression

Reproduce the identified failure:

1. Generate and approve Contact 3.
2. Generate Contact 4 and confirm its previous metrics match Contact 3.
3. Amend a Contact 3 or carryover score.
4. Confirm Contact 3 version 1 remains unchanged.
5. Confirm Contacts 3 and 4 become stale.
6. Generate Contact 3 version 2.
7. Generate Contact 4 version 2 and confirm it references Contact 3 version 2.

## 13. Implementation phases

### Phase 1: Schema and scope identity

- Add migration
- Add normalized student table
- Add invalidation table
- Implement scope canonicalization
- Add schema tests

### Phase 2: Snapshot resolver

- Implement `resolve_or_create`
- Implement previous-snapshot resolution
- Persist normalized student metrics
- Add concurrency protection

### Phase 3: Invalidation

- Integrate result-save and carryover-save hooks
- Implement dependent-snapshot traversal
- Add watermark fallback

### Phase 4: API and frontend integration

- Route Generate Broadsheet through snapshot resolution
- Correct governance contracts
- Bind exports to snapshot payloads
- Add status and stale indicators

### Phase 5: Governance and approval enforcement

- Add freshness and completeness validation
- Enforce NR policy
- Enforce immutable approved versions

### Phase 6: Backfill and verification

- Backfill existing snapshots
- Run historical continuity audit
- Compare regenerated results against existing workbook audit CSVs
- Obtain academic-office acceptance before deployment

## 14. Files expected to change

Backend:

- New migration under `backend/db/migrations/`
- `application/models/Snapshot_model.php`
- `application/models/Broadsheet_model.php`
- `application/models/Results_model.php`
- Carryover registration/correction model paths
- `application/controllers/Admin_results.php`
- New snapshot scope/invalidation service or library
- Backend tests

Frontend:

- `src/components/admin/results/BroadsheetTab.tsx`
- `src/components/admin/results/BroadsheetSnapshotsDrawer.tsx`
- `src/components/admin/results/BroadsheetBanners.tsx`
- Export orchestration and related types
- Frontend tests

## 15. Acceptance criteria

The implementation is complete only when:

1. Identical academic filters return the same fresh snapshot.
2. Official exports are byte-for-byte reproducible from stored payload data, apart from permitted export metadata such as download time.
3. Contact N previous metrics match the referenced Contact N-1 snapshot.
4. Approved snapshots are never mutated.
5. Score changes create a traceable invalidation and version chain.
6. Later dependent snapshots cannot remain falsely fresh.
7. Carryover attempts remain associated with their subsequent academic session/contact.
8. NR results remain visible and are governed as administrative incompleteness.
9. Reject and approve actions work according to the submitted action.
10. All new regression tests pass without weakening existing tests.

## 16. Deployment controls

- Do not modify production data during development.
- Test migration and rollback behavior on a database copy.
- Back up snapshot and result tables before production migration.
- Deploy schema before application code.
- Keep live generation available behind an administrator-only diagnostic option during transition.
- Do not mark backfilled snapshots approved automatically.
- Monitor failed rebuilds, stale-snapshot counts, and dependency-chain errors after release.

