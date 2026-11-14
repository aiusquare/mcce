# Examination Broadsheet & Academic Result Engine

This document provides a comprehensive architectural and operational guide to the Maslaha Examination Broadsheet, Course Registration synchronization, and Result Management engine.

---

## 1. Architectural Overview & Single Source of Truth

The academic result engine bridges three critical subsystems:
1. **Course Registration (Roster & Curriculum)**: Defines which courses each student is registered for in each semester/contact.
2. **Result Sheets & Batches**: Captures Continuous Assessment (CA) and Examination marks entered by lecturers and approved through institutional workflows.
3. **Broadsheets & Statements of Result**: Renders cumulative transcripts, master broadsheets, GPA/CGPA computations, and degree classifications.

```
+---------------------------+        +--------------------------+
|    Course Registration    |        |       Result Sheets      |
| (admin_course_roster,     |        | (result_batches,         |
|  course_registrations)    |        |  result_attempts)        |
+-------------+-------------+        +------------+-------------+
              |                                   |
              +-----------------+-----------------+
                                |
                                v
                +-------------------------------+
                |     Shared Foundation Libs    |
                |  - Period_resolver            |
                |  - Academic_policy            |
                |  - Academic_calculator        |
                +---------------+---------------+
                                |
        +-----------------------+-----------------------+
        |                                               |
        v                                               v
+-------------------------------+       +-------------------------------+
|       Broadsheet Engine       |       | Statements & Student Portals  |
|  - Broadsheet_model           |       |  - Statement_model            |
|  - Reconciliation_model       |       |  - Results_model (GPA/CGPA)   |
|  - Snapshot_model             |       +-------------------------------+
+---------------+---------------+
                |
                v
+-------------------------------+
|      Frontend UI / Print      |
|  - BroadsheetTab & Grid       |
|  - BroadsheetSummaryPanel     |
|  - A3 Print Document          |
|  - Excel, Word & PDF Exports  |
+-------------------------------+
```

### Core Foundation Libraries
- **`Period_resolver.php`** (`backend/application/libraries/Period_resolver.php`):
  Canonical resolver for academic terms across semester-based and contact-based (sandwich) programmes. Normalizes `"Contact 2"`, `"2"`, `"Second Semester"` into uniform database filter criteria without fragile string matching.
- **`Academic_policy.php`** (`backend/application/libraries/Academic_policy.php`):
  Central repository for institutional grading scales, pass marks (40%), probation thresholds (1.00–1.49 CGPA), withdrawal thresholds (< 1.00 CGPA), ABS calculation policies, and degree classification bands. Reads institutional overrides from `academic_settings`.
- **`Academic_calculator.php`** (`backend/application/libraries/Academic_calculator.php`):
  Single authoritative calculator for Total Credits Registered (TCR), Total Credits Earned (TCE), Total Quality Points (TQP), Grade Point Average (GPA), and Cumulative Grade Point Average (CGPA). Used identically across Broadsheet, Statement, Student History, and CGPA lists.

---

## 2. Database Schema & Migration 020

Database migration `020_broadsheet_integrity.sql` established atomic locking and immutable snapshot storage:

### Added Snapshot Columns in `result_attempts`:
- `result_state`: `draft` | `entered` | `locked` | `published`
- `credit_units_snapshot`: Preserves credit unit weight at examination time against subsequent curriculum alterations.
- `contact_number`: Normalized integer representation of the term.
- `grading_scheme_id`: Foreign key tracking the grading policy in effect when the score was recorded.

### New Governance Tables:
1. **`broadsheet_snapshots`**:
   Stores immutable copies of published broadsheet payloads with SHA-256 digests (`payload_hash`), unique verification codes (e.g. `BRD-A45324E7`), status (`draft`, `pending_approval`, `approved`, `superseded`), and institutional metadata.
2. **`broadsheet_approvals`**:
   Multi-tier digital sign-off records tracking approval by:
   - Course Coordinator / Exam Officer
   - Head of Department (HOD)
   - Dean / Director of School
   - Senate / Academic Board Representative
3. **`result_amendments`**:
   Audit log tracking every post-publication modification, score change, or roster drop. Automatically flags approved snapshots as stale if amendments occur after approval.
4. **`broadsheet_audit_log`**:
   Complete chronological activity trail tracking broadsheet generations, exports, prints, sign-offs, and verification queries.

---

## 3. Academic Policy & Calculation Rules

### Result Basis
- **Official (Published)**: Includes only approved, published examination attempts. Used for Senate approval, degree conferment, and official transcripts.
- **Working Copy (Drafts)**: Includes draft and unapproved scores for internal review and mark auditing. Displays an amber warning banner.

### Pending Scores (`NR`) vs. Carryovers (`CO`)
- **Not Reported (`NR`)**: An unscored registered course is classified as `PEND: [CODE]`. It does NOT trigger carryover status, because the candidate has not failed—the score is simply missing.
- **Carryover (`CO`)**: A student is only assigned a carryover if they sat and failed (`F`) or were recorded as absent (`ABS`).

### Provisional Standings on Incomplete Results
- Academic Standing (`GOOD_STANDING`, `PROBATION`, `WITHDRAWAL`) is strictly withheld if any candidate score is missing (`is_complete === false`).
- Incomplete candidates display `INCOMPLETE` with a provisional CGPA marked by an asterisk (`*`). This prevents students from being mistakenly placed on probation or withdrawn while grades are still being entered.

### Carryover Retakes & Single Source of Truth
- When a student retakes a carryover course in a subsequent semester, the new passing grade is recorded in `carryover_corrections`.
- The cumulative calculations in `Broadsheet_model`, `Statement_model`, and `Results_model` apply these corrections uniformly, replacing historical failed attempts with the updated grade and units.

---

## 4. Reconciliation Engine (8 Integrity Checks)

The reconciliation engine (`backend/application/models/Reconciliation_model.php`) detects and alerts on data discrepancies between registration and result sheets:
1. **`unscored_registration`**: Candidate registered for course, but no score row exists.
2. **`unregistered_score`**: Result row recorded for a candidate who has no active course registration.
3. **`missing_carryover`**: Candidate failed course in Contact $N-1$, but has no carryover registration in Contact $N$.
4. **`orphan_carryover`**: Candidate registered for a carryover course without a prior failed attempt.
5. **`credit_unit_drift`**: `result_attempts.credit_units_snapshot` differs from current `courses.credit_units`.
6. **`unapproved_lock`**: Score marked as locked, but parent batch is still draft/pending.
7. **`batch_contact_mismatch`**: Batch contact number does not match course contact number.
8. **`scale_inconsistency`**: Recorded letter grade does not match total score under active grading scale.

### Reconciliation Endpoints:
- `GET /api/admin/results/reconciliation?session_id&semester_id&programme_id`: JSON report with severity breakdown and issue list.
- `GET /api/admin/results/reconciliation/export?session_id&semester_id&programme_id`: Downloadable CSV report for exam officers.

---

## 5. Broadsheet UI, Print & Exports

### Frontend Architecture (`frontend/src/components/admin/results/`)
- **`BroadsheetTab.tsx`**: Main orchestration container.
- **`BroadsheetFilters.tsx`**: Session, Department, Programme, Contact/Semester, Basis, Mode of Entry, Standing, and Search.
- **`BroadsheetBanners.tsx`**: Working copy warning, completeness progress, reconciliation alert, and snapshot status chip.
- **`BroadsheetSummaryPanel.tsx`**:
  - 6 Key Performance Metric cards (Total, Pass, Carryover, Probation, Withdrawal, Incomplete).
  - Course Performance Statistics Table (Sat, Passed, Failed, Pass %, Mean Score).
  - GPA Distribution Table with graphical progress indicators.
  - Actionable Candidate Lists (Carryover, Probation, Withdrawal, Incomplete).
- **`BroadsheetGrid.tsx`**: Master table with sticky identifiers, cell hover tooltips (CA, Exam, Total, Grade, Batch Status), carryover highlighting, standing chips, and provisional CGPA markers.
- **`ReconciliationModal.tsx`**: Interactive discrepancy inspector.
- **`BroadsheetSnapshotsDrawer.tsx`**: Version history, snapshot creation, multi-tier sign-off form, verification links, and audit trail.
- **`BroadsheetPrintDocument.tsx`**: A3 Landscape print document with institutional header, full table, summary statistics page, and 4 formal signature blocks.
- **`pdfExport.ts`**: Native client-side A3 Landscape PDF export via `jspdf` and `jspdf-autotable`.
- **`excelExport.ts`**: Multi-sheet workbook including master broadsheet and dedicated summary & statistics sheet.
- **`wordExport.ts`**: Multi-part Word document formatted for high-density academic results.

---

## 6. Automated Testing & Verification

Run the entire test suite from the backend directory:
```bash
php ../backend/tests/run.php
```

### Test Suites:
1. `test_policy_api.php`: Verifies academic policy defaults and configuration endpoints.
2. `test_phase3.php`: Verifies result-sheet snapshots, atomic locks, drop guards, and amendment tracking.
3. `test_phase4.php`: Verifies broadsheet generation, summary blocks, server-side filtering, and options.
4. `test_phase6.php`: Verifies the 8-point reconciliation engine.
5. `test_phase8.php`: Verifies immutable snapshot creation, SHA-256 hashing, multi-tier approvals, and audit logging.
6. `parity.php`: Verifies single source of truth across Broadsheet, Statement, Student History, and direct calculations (0 mismatches required).
7. `compare_golden.php`: Compares fresh engine output against golden test fixtures (0 diffs required).
