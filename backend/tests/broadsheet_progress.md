# Broadsheet Fix Progress Checklist

- [x] **Phase 0: Safety net (Golden tests & baseline)**
  - [x] P0.1 Test runner (`backend/tests/run.php`)
  - [x] P0.2 Golden generation script (`backend/tests/broadsheet_golden.php`) & baseline golden files
  - [x] P0.3 Golden comparison script (`backend/tests/compare_golden.php`)
  - [x] Verify: Golden files exist and 0 diffs on baseline

- [ ] **Phase 1: Shared foundation (Period resolver, Academic policy, Academic calculator)**
  - [ ] P1.1 `libraries/Period_resolver.php`
  - [ ] P1.2 `libraries/Academic_policy.php` & endpoints
  - [ ] P1.3 `libraries/Academic_calculator.php`
  - [ ] P1.4 Delegate `Broadsheet_model` & `Results_model` to libraries
  - [ ] Verify: `php -l` clean, 0 diffs on golden baseline in registered mode

- [ ] **Phase 2: Database migration `020_broadsheet_integrity.sql`**
  - [ ] P2.1 Schema updates (result_attempts, result_batches, indexes)
  - [ ] P2.2 Backfill script/SQL
  - [ ] P2.3 New tables (snapshots, approvals, amendments, audit log)
  - [ ] P2.4 Insert default academic_settings
  - [ ] Verify: Migration idempotent, backfill verified

- [ ] **Phase 3: Result-sheet side improvements**
  - [ ] P3.1 `save_attempts` snapshots and states
  - [ ] P3.2 `populate_batch_attempts` with Period_resolver & snapshots
  - [ ] P3.3 Ghost-row policy & result_amendments
  - [ ] P3.4 Roster-drop guard for locked results
  - [ ] P3.5 Grading scheme change detection & stale flag
  - [ ] P3.6 Credit unit change guard
  - [ ] P3.7 Atomic batch approval & lock
  - [ ] Verify: CLI test scenarios pass, `php -l` clean

- [ ] **Phase 4: Broadsheet engine rebuild**
  - [ ] P4.1 Broadsheet services structure & options
  - [ ] P4.2 Basis filter (published vs working)
  - [ ] P4.3 Pending state & accurate standing/completeness
  - [ ] P4.4 Metric calculations via Academic_calculator
  - [ ] P4.5 Registration-driven carryovers with reconciliation checks
  - [ ] P4.6 Inclusive course column rules (no hacky drop)
  - [ ] P4.7 Cohort resolution rule
  - [ ] P4.8 Server-side filtering & single DE detection
  - [ ] P4.9 Conservative name normalization
  - [ ] P4.10 Comprehensive summary block (courses, GPA bands, lists)
  - [ ] P4.11 Query performance optimizations (chunking & indexing)
  - [ ] P4.12 Metadata context
  - [ ] Verify: Golden compare differences documented & valid; performance verified

- [ ] **Phase 5: Single source of truth across all screens**
  - [ ] P5.1 GPA/CGPA across statements, student history, CGPA list, student portal
  - [ ] P5.2 Deprecate/cleanup dead legacy methods
  - [ ] P5.3 Standardize course roster & outstanding queries to Period_resolver
  - [ ] P5.4 Parity test script (`backend/tests/parity.php`)
  - [ ] Verify: Parity test reports 0 mismatches

- [ ] **Phase 6: Reconciliation report**
  - [ ] P6.1 `Reconciliation_model` with 8 core check types
  - [ ] P6.2 Admin API endpoint & CSV export
  - [ ] P6.3 Integration into Broadsheet generation summary
  - [ ] P6.4 UI Reconciliation panel
  - [ ] Verify: Test cases detected accurately

- [ ] **Phase 7: Frontend broadsheet (Tab, Print, Exports)**
  - [ ] P7.1 Split `BroadsheetTab.tsx` into modular components
  - [ ] P7.2 Official/Working Basis & server-driven filters
  - [ ] P7.3 Warning, completeness & reconciliation banners
  - [ ] P7.4 Grid enhancements (cell legend, search/sort/filter, drilldown)
  - [ ] P7.5 Result summary cards, course statistics table, GPA distribution
  - [ ] P7.6 Standard A3 landscape print document with Summary page & signatures
  - [ ] P7.7 Unified Excel, Word, and direct PDF generation
  - [ ] Verify: `npm run build` clean, print & export tested

- [ ] **Phase 8: Governance & Snapshots**
  - [ ] P8.1 Snapshot generation & immutable storage
  - [ ] P8.2 Approval workflow & role-based sign-off
  - [ ] P8.3 Public verification endpoint & QR code
  - [ ] P8.4 Frontend version drawer, approval actions & audit log
  - [ ] P8.5 Snapshot staleness detection on amendment
  - [ ] Verify: Complete snapshot, sign-off, and verify flow tested

- [ ] **Phase 9: Tests, documentation, and walkthrough**
  - [ ] P9.1 Comprehensive test suite
  - [ ] P9.2 Documentation in `docs/BROADSHEET.md`
  - [ ] P9.3 Final regression & acceptance checklist verification
  - [ ] P9.4 `walkthrough.md` generated
