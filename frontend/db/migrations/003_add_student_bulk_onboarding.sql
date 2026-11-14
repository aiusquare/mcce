-- Bulk onboarding support for existing students
-- Allows management-created student records to require a student-side profile update.

ALTER TABLE users
  ADD COLUMN dob DATE DEFAULT NULL,
  ADD COLUMN gender VARCHAR(20) DEFAULT NULL,
  ADD COLUMN address TEXT DEFAULT NULL,
  ADD COLUMN state VARCHAR(100) DEFAULT NULL,
  ADD COLUMN lga VARCHAR(100) DEFAULT NULL,
  ADD COLUMN guardian_name VARCHAR(200) DEFAULT NULL,
  ADD COLUMN guardian_phone VARCHAR(50) DEFAULT NULL,
  ADD COLUMN guardian_relationship VARCHAR(100) DEFAULT NULL,
  ADD COLUMN guardian_address TEXT DEFAULT NULL,
  ADD COLUMN next_of_kin VARCHAR(200) DEFAULT NULL,
  ADD COLUMN next_of_kin_phone VARCHAR(50) DEFAULT NULL;

ALTER TABLE students
  MODIFY admission_id CHAR(36) DEFAULT NULL,
  ADD COLUMN session_name VARCHAR(100) DEFAULT NULL,
  ADD COLUMN entry_mode VARCHAR(50) DEFAULT NULL,
  ADD COLUMN onboarding_source VARCHAR(50) NOT NULL DEFAULT 'application',
  ADD COLUMN profile_completion_status VARCHAR(30) NOT NULL DEFAULT 'complete',
  ADD COLUMN account_update_required TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN imported_at DATETIME DEFAULT NULL,
  ADD COLUMN imported_by CHAR(36) DEFAULT NULL;

CREATE INDEX idx_students_onboarding_source ON students (onboarding_source);
CREATE INDEX idx_students_profile_completion ON students (profile_completion_status, account_update_required);

-- Backend contract expected by the frontend:
-- POST /api/admin/students/bulk-onboard-csv
--   Body: { csv, default_status, notify_students }
--   For each valid row, upsert user + student using email/matric/admission number,
--   set onboarding_source='bulk_upload', profile_completion_status='pending',
--   account_update_required=1, and create/reset a temporary password when provided.
--
-- PATCH /api/student/profile
--   Body includes phone, dob, gender, address, state, lga, guardian_*,
--   next_of_kin, next_of_kin_phone, profile_completion_status, account_update_required.
