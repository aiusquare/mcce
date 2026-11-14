<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Broadsheet_model extends CI_Model {

    public function generate($session_id, $semester_id, $programme_id, $level = null, $options = [])
    {
        // 1. Resolve Academic Context via Period_resolver
        if (!$this->load->is_loaded('period_resolver')) {
            $this->load->library('period_resolver');
        }
        if (!$this->load->is_loaded('academic_policy')) {
            $this->load->library('academic_policy');
        }
        if (!$this->load->is_loaded('academic_calculator')) {
            $this->load->library('academic_calculator');
        }

        $context_res = $this->period_resolver->resolve($session_id, $semester_id, $level);
        $session = $context_res['session'];
        $semester = $context_res['semester'];
        $programme = $this->db->get_where('programmes', ['id' => $programme_id])->row_array();
        $department = null;
        if (!empty($programme['department_id'])) {
            $department = $this->db->get_where('departments', ['id' => $programme['department_id']])->row_array();
        }

        $target_session_ids = $context_res['session_ids'];
        $current_session_name = $context_res['session_name'];
        $current_semester_name = $context_res['semester_name'];
        $current_contact_num = $context_res['contact_number'];
        $is_contact_1 = $context_res['is_contact_1'];
        $target_semester_ids = $context_res['semester_ids'];
        $other_contact_sem_ids = $context_res['other_contact_semester_ids'] ?? [];

        // 2. Identify Students
        // Get all students in the programme who either have an active course registration for this period 
        // OR have published results in this period.
        $sess_ph = implode(',', array_fill(0, count($target_session_ids), '?'));
        $cr_sem_match = $this->period_resolver->build_semester_level_match_sql('cr.semester_id', 'cr.level', $target_semester_ids, $other_contact_sem_ids);
        $rb_sem_match = $this->period_resolver->build_semester_level_match_sql('rb.semester_id', 'rb.level', $target_semester_ids, $other_contact_sem_ids);
        $cr_sess_match = $this->period_resolver->build_dual_session_match_sql('cr', $target_session_ids, 's');
        $rb_sess_match = $this->period_resolver->build_dual_session_match_sql('rb', $target_session_ids);

        $sql = "
            SELECT DISTINCT s.id as student_id, u.full_name, ad.matric_number, ad.admission_number, s.programme_id,
                   s.entry_mode, s.session_name as session_of_entry, s.session_name as entry_session, COALESCE(cr.level, rb.level, s.current_level) as level
            FROM students s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN admissions ad ON ad.id = s.admission_id
            LEFT JOIN course_registrations cr ON cr.student_id = s.id 
                AND {$cr_sess_match['sql']}
                AND {$cr_sem_match['sql']}
                AND cr.status IN ('approved', 'submitted')
            LEFT JOIN result_attempts ra ON ra.student_id = s.id 
                AND ra.status = 'active'
            LEFT JOIN result_batches rb ON rb.id = ra.batch_id 
                AND {$rb_sess_match['sql']}
                AND {$rb_sem_match['sql']}
            WHERE s.programme_id = ?
              AND (
                  cr.id IS NOT NULL 
                  OR (
                      rb.id IS NOT NULL 
                      AND ra.id IS NOT NULL 
                      AND (
                          ra.total_score IS NOT NULL 
                          OR (ra.grade IS NOT NULL AND ra.grade != '')
                          OR rb.status IN ('submitted', 'approved', 'published')
                      )
                  )
              )
        ";

        $params = array_merge(
            $cr_sess_match['params'],
            $cr_sem_match['params'],
            $rb_sess_match['params'],
            $rb_sem_match['params'],
            [$programme_id]
        );

        if ($level) {
            $sql .= " AND (cr.level = ? OR rb.level = ? OR s.current_level = ?)";
            $params[] = $level;
            $params[] = $level;
            $params[] = $level;
        }

        if (!empty($options['cohort']) && strtolower((string)$options['cohort']) !== 'all') {
            $cohort_val = trim($options['cohort']);
            $has_st_entry = $this->db->field_exists('entry_session_id', 'students');
            if ($has_st_entry) {
                $sql .= " AND (s.session_name = ? OR s.session_name LIKE ? OR s.entry_session_id = ?)";
                $params[] = $cohort_val;
                $params[] = '%' . $cohort_val . '%';
                $params[] = $cohort_val;
            } else {
                $sql .= " AND (s.session_name = ? OR s.session_name LIKE ?)";
                $params[] = $cohort_val;
                $params[] = '%' . $cohort_val . '%';
            }
        }

        $sql .= " ORDER BY ad.matric_number ASC, u.full_name ASC";

        $students_raw = $this->db->query($sql, $params)->result_array();

        // Deduplicate students by student_id to prevent multi-level duplicate rows
        $deduped_students = [];
        foreach ($students_raw as $s_row) {
            $sid = $s_row['student_id'];
            if (!isset($deduped_students[$sid])) {
                $deduped_students[$sid] = $s_row;
            } else {
                $em = strtolower((string)($s_row['entry_mode'] ?? ''));
                if (strpos($em, 'direct') !== false || $em === 'de') {
                    $deduped_students[$sid]['entry_mode'] = $s_row['entry_mode'];
                }
            }
        }
        $students_raw = array_values($deduped_students);

        // A contact belongs to one entry route in a teaching session.  For example,
        // in the foundation session Contact 1 is fresh entrants and Contact 2 is DE.
        // Keep this server-side so an edited URL cannot mix the two cohorts.
        $required_entry_mode = $options['required_entry_mode'] ?? null;
        if ($required_entry_mode === 'fresh' || $required_entry_mode === 'direct_entry') {
            $students_raw = array_values(array_filter($students_raw, function($row) use ($required_entry_mode) {
                return $required_entry_mode === 'direct_entry'
                    ? $this->_is_direct_entry_student($row)
                    : !$this->_is_direct_entry_student($row);
            }));
        }

        $is_de_map = [];
        foreach ($students_raw as &$st) {
            if (!empty($st['full_name'])) {
                $st['full_name'] = $this->_normalize_student_name($st['full_name']);
            }
            $sid = $st['student_id'];
            $is_de_map[$sid] = $this->_is_direct_entry_student($st);
        }
        unset($st);

        // Compute true approval status from result batches in this period
        $rb_direct_match = $this->period_resolver->build_semester_level_match_sql('rb.semester_id', 'rb.level', $target_semester_ids, $other_contact_sem_ids);
        $batch_status_sql = "
            SELECT rb.status, MAX(COALESCE(rb.approved_at, rb.published_at, rb.updated_at, rb.created_at)) as last_updated
            FROM result_batches rb
            WHERE {$rb_sess_match['sql']}
              AND {$rb_direct_match['sql']}
              AND (rb.programme_id = ? OR rb.programme_id IS NULL OR rb.programme_id = '')
            GROUP BY rb.status
        ";
        $batch_status_rows = $this->db->query($batch_status_sql, array_merge(
            $rb_sess_match['params'],
            $rb_direct_match['params'],
            [$programme_id]
        ))->result_array();

        $total_batches_count = 0;
        $approved_batches_count = 0;
        $latest_batch_date = null;
        foreach ($batch_status_rows as $bsr) {
            $total_batches_count++;
            if (in_array(strtolower((string)$bsr['status']), ['approved', 'published'], true)) {
                $approved_batches_count++;
            }
            if (!empty($bsr['last_updated']) && ($latest_batch_date === null || $bsr['last_updated'] > $latest_batch_date)) {
                $latest_batch_date = $bsr['last_updated'];
            }
        }
        $approval_status = ($total_batches_count > 0 && $approved_batches_count === $total_batches_count)
            ? 'Approved'
            : ($approved_batches_count > 0 ? 'Partially Approved' : 'Draft');

        $context = [
            'session'          => $session,
            'academic_session' => $session,
            'semester'         => $semester,
            'programme'        => $programme,
            'department'       => $department,
            'level'            => $level,
            'generated_at'     => date('Y-m-d H:i:s'),
            'computed_at'      => $latest_batch_date ?: date('Y-m-d H:i:s'),
            'approval_status'  => $approval_status,
            'institution'      => 'Maslaha Community College of Education, Funtua',
            'affiliation'      => 'In Affiliation with Federal University Dutsin-Ma (FUDMA)'
        ];
        if (!empty($options['contact_eligibility'])) {
            $context['contact_eligibility'] = $options['contact_eligibility'];
        }

        if (empty($students_raw)) {
            return [
                'context' => $context,
                'students' => [],
                'current_courses' => [],
                'carryover_courses' => []
            ];
        }

        $student_ids = array_column($students_raw, 'student_id');

        // Check if any DE student explicitly has an active NORMAL registration in Contact 1
        $de_has_contact1_reg = [];
        if (!empty($student_ids)) {
            $st_ph_init = implode(',', array_fill(0, count($student_ids), '?'));
            $c1_sql = "
                SELECT cr.student_id, sem.name as semester_name, cr.level, cri.registration_type
                FROM course_registration_items cri
                JOIN course_registrations cr ON cr.id = cri.registration_id
                LEFT JOIN semesters sem ON (sem.id = cr.semester_id OR sem.name = cr.semester_id)
                WHERE cr.student_id IN ($st_ph_init)
                  AND cri.status = 'active'
                  AND cr.status IN ('approved', 'submitted')
                  AND LOWER(cri.registration_type) NOT IN ('carryover', 'repeat')
            ";
            foreach ($this->db->query($c1_sql, $student_ids)->result_array() as $c1_row) {
                if ($this->_is_contact_1_period($c1_row['semester_name'] ?? '', $c1_row['level'] ?? '')) {
                    $de_has_contact1_reg[$c1_row['student_id']] = true;
                }
            }
        }

        // 3. Resolve Current Courses for Cohort (STRICTLY courses with active course registrations > 0)
        $courses_map = [];
        $canonical_cid_by_code = [];

        // Registered CURRENT courses for this cohort (courses with zero registration are strictly excluded)
        $st_ph_curr = implode(',', array_fill(0, count($student_ids), '?'));
        $sql = "
            SELECT c.id as course_id, c.code as course_code, c.title as course_title, c.credit_units,
                   c.level as course_level, c.contact_number, COUNT(DISTINCT cr.student_id) as reg_count
            FROM courses c
            JOIN course_registration_items cri ON cri.course_id = c.id
            JOIN course_registrations cr ON cr.id = cri.registration_id
            JOIN students s ON s.id = cr.student_id
            WHERE cr.student_id IN ($st_ph_curr)
              AND {$cr_sess_match['sql']}
              AND {$cr_sem_match['sql']}
              AND s.programme_id = ? 
              AND cri.status = 'active'
              AND cr.status IN ('approved', 'submitted')
              AND LOWER(cri.registration_type) NOT IN ('carryover', 'repeat')
            GROUP BY c.id, c.code, c.title, c.credit_units, c.level, c.contact_number
            HAVING COUNT(DISTINCT cr.student_id) > 0
            ORDER BY c.code ASC
        ";
        $current_courses_params = array_merge(
            $student_ids,
            $cr_sess_match['params'],
            $cr_sem_match['params'],
            [$programme_id]
        );
        $courses_from_reg = $this->db->query($sql, $current_courses_params)->result_array();

        // Add registered courses ONLY (any course with zero registration is excluded from the broadsheet)
        // Allow courses from the current contact OR an earlier contact (e.g. Contact 1 GST111 registered as a
        // normal course by Direct Entry students in Contact 2), while blocking future-contact courses.
        foreach ($courses_from_reg as $cr) {
            if ((int)($cr['reg_count'] ?? 0) <= 0) {
                continue;
            }
            $cid = $cr['course_id'];
            $norm_code = strtoupper(trim((string)($cr['course_code'] ?? '')));
            if (isset($courses_map[$cid]) || ($norm_code !== '' && isset($canonical_cid_by_code[$norm_code]))) {
                continue;
            }
            if ($cr['contact_number'] !== null && $cr['contact_number'] !== '') {
                $c_num = (int)$cr['contact_number'];
                if ($current_contact_num !== null && $c_num > $current_contact_num) {
                    continue;
                }
            }
            if ($norm_code !== '') {
                $canonical_cid_by_code[$norm_code] = $cid;
            }
            $courses_map[$cid] = [
                'course_id' => $cr['course_id'],
                'course_code' => $cr['course_code'],
                'course_title' => $cr['course_title'],
                'credit_units' => $cr['credit_units']
            ];
        }

        usort($courses_map, function($a, $b) {
            return strcmp($a['course_code'], $b['course_code']);
        });
        $current_courses = array_values($courses_map);
        $current_course_ids_map = array_fill_keys(array_column($current_courses, 'course_id'), true);
        $current_course_codes_map = array_fill_keys(array_map('strtoupper', array_column($current_courses, 'course_code')), true);

        $this->load->model('Outstanding_course_model');

        // 4. Resolve Prior & Current Course Registrations for Cohort Students FIRST
        // (Only courses with active course registrations may be counted anywhere in the broadsheet)
        $student_prev_unique_courses = []; // student_id => [course_id => ['credit_units' => int, 'course_code' => string, 'course_title' => string]]
        $student_prev_contact_courses = []; // student_id => [contact_or_period_key => [course_key => credit_units]]
        $student_earliest_reg_contact = []; // student_id => [course_key => int]
        $student_co_reg_contacts = []; // student_id => [course_key => [contact_num => credit_units]]
        $this->_session_contact_map = [];
        $this->_current_contact_num = $current_contact_num;
        $this->_current_session_year = null;
        if ($current_contact_num !== null) {
            foreach ($target_session_ids as $tsid) {
                if ($tsid !== null && $tsid !== '') {
                    $this->_session_contact_map[(string)$tsid] = (int)$current_contact_num;
                }
            }
            if (!empty($current_session_name)) {
                $this->_session_contact_map[(string)$current_session_name] = (int)$current_contact_num;
                if (preg_match('/(20\d{2})/', (string)$current_session_name, $cym)) {
                    $this->_current_session_year = (int)$cym[1];
                }
            }
        }

        if (!empty($student_ids)) {
            $st_ph = implode(',', array_fill(0, count($student_ids), '?'));
            $has_cr_acad_sess = $this->db->field_exists('academic_session_id', 'course_registrations');
            $cr_acad_sel = $has_cr_acad_sess ? 'cr.academic_session_id,' : 'NULL as academic_session_id,';
            $prev_reg_sql = "
                SELECT cr.student_id, {$cr_acad_sel} cr.session_id, cr.semester_id, cr.level,
                       sess.name as session_name, sem.name as semester_name,
                       cri.course_id, cri.registration_type, c.credit_units, c.code as course_code, c.title as course_title,
                       c.contact_number, c.level as course_level
                FROM course_registration_items cri
                JOIN course_registrations cr ON cr.id = cri.registration_id
                JOIN courses c ON c.id = cri.course_id
                LEFT JOIN academic_sessions sess ON (sess.id = COALESCE(NULLIF(cr.academic_session_id, ''), cr.session_id) OR sess.name = cr.session_id)
                LEFT JOIN semesters sem ON (sem.id = cr.semester_id OR sem.name = cr.semester_id)
                WHERE cr.student_id IN ($st_ph)
                  AND (cri.status = 'active' OR cri.status IS NULL)
                  AND cr.status IN ('approved', 'submitted', 'draft')
            ";
            $prev_reg_rows = $this->db->query($prev_reg_sql, $student_ids)->result_array();

            // Build session -> contact map from explicit Contact X registration envelopes
            $sess_contact_votes = [];
            foreach ($prev_reg_rows as $r_map) {
                $exp_c = $this->_extract_explicit_contact($r_map['semester_name'] ?? '', $r_map['level'] ?? '', $r_map['semester_id'] ?? '');
                if ($exp_c !== null && $exp_c >= 1 && $exp_c <= 6) {
                    foreach ([$r_map['session_name'] ?? '', $r_map['academic_session_id'] ?? '', $r_map['session_id'] ?? ''] as $sk) {
                        $sk = trim((string)$sk);
                        if ($sk !== '') {
                            $sess_contact_votes[$sk][$exp_c] = ($sess_contact_votes[$sk][$exp_c] ?? 0) + 1;
                        }
                    }
                }
            }
            foreach ($sess_contact_votes as $sk => $votes) {
                if (!isset($this->_session_contact_map[$sk]) && count($votes) === 1) {
                    $this->_session_contact_map[$sk] = (int)array_key_first($votes);
                }
            }

            // Pass 1: Identify all genuine cohort normal curriculum courses for each contact
            $cohort_normal_courses_by_contact = [];
            $cohort_normal_codes_by_contact = [];
            foreach ($prev_reg_rows as $row) {
                $reg_type = strtolower((string)($row['registration_type'] ?? ''));
                if (in_array($reg_type, ['carryover', 'repeat'], true)) {
                    continue;
                }
                $row_c_num = $this->_resolve_row_contact(
                    $row['semester_name'] ?? '',
                    $row['level'] ?? '',
                    $row['semester_id'] ?? '',
                    $row['session_name'] ?? '',
                    $row['session_id'] ?? '',
                    $row['academic_session_id'] ?? ''
                );
                if ($row_c_num === null) {
                    continue;
                }
                if ($row['contact_number'] !== null && $row['contact_number'] !== '') {
                    if ((int)$row['contact_number'] > $row_c_num) {
                        continue;
                    }
                }
                $cid = $row['course_id'];
                $norm_code = strtoupper(trim((string)($row['course_code'] ?? '')));
                $cohort_normal_courses_by_contact[$row_c_num][$cid] = true;
                if ($norm_code !== '') {
                    $cohort_normal_codes_by_contact[$row_c_num][$norm_code] = true;
                    if (!isset($canonical_cid_by_code[$norm_code])) {
                        $canonical_cid_by_code[$norm_code] = $cid;
                    }
                }
            }

            if ($current_contact_num !== null) {
                foreach ($current_courses as $cc) {
                    $cohort_normal_courses_by_contact[$current_contact_num][$cc['course_id']] = true;
                    $norm_c = strtoupper(trim((string)($cc['course_code'] ?? '')));
                    if ($norm_c !== '') {
                        $cohort_normal_codes_by_contact[$current_contact_num][$norm_c] = true;
                    }
                }
            }

            // Sort prev_reg_rows by resolved contact number ascending so earliest normal registrations are processed first
            usort($prev_reg_rows, function($a, $b) {
                $ca = $this->_resolve_row_contact($a['semester_name'] ?? '', $a['level'] ?? '', $a['semester_id'] ?? '', $a['session_name'] ?? '', $a['session_id'] ?? '', $a['academic_session_id'] ?? '') ?? 99;
                $cb = $this->_resolve_row_contact($b['semester_name'] ?? '', $b['level'] ?? '', $b['semester_id'] ?? '', $b['session_name'] ?? '', $b['session_id'] ?? '', $b['academic_session_id'] ?? '') ?? 99;
                return $ca <=> $cb;
            });

            // Track earliest registration contact across entire career (including current contact) for every student+course
            foreach ($prev_reg_rows as $row) {
                $sid = $row['student_id'];
                $norm_code = strtoupper(trim((string)($row['course_code'] ?? '')));
                $cid = ($norm_code !== '' && isset($canonical_cid_by_code[$norm_code])) ? $canonical_cid_by_code[$norm_code] : $row['course_id'];
                $row_c_num = $this->_resolve_row_contact(
                    $row['semester_name'] ?? '',
                    $row['level'] ?? '',
                    $row['semester_id'] ?? '',
                    $row['session_name'] ?? '',
                    $row['session_id'] ?? '',
                    $row['academic_session_id'] ?? ''
                );
                if ($row_c_num === null) {
                    continue;
                }
                if (!empty($is_de_map[$sid]) && empty($de_has_contact1_reg[$sid]) && $row_c_num === 1) {
                    continue;
                }
                $ckey = $norm_code ?: $cid;
                if (!isset($student_earliest_reg_contact[$sid][$ckey]) || $row_c_num < $student_earliest_reg_contact[$sid][$ckey]) {
                    $student_earliest_reg_contact[$sid][$ckey] = (int)$row_c_num;
                }
                if (!isset($student_earliest_reg_contact[$sid][$cid]) || $row_c_num < $student_earliest_reg_contact[$sid][$cid]) {
                    $student_earliest_reg_contact[$sid][$cid] = (int)$row_c_num;
                }
                $reg_type = strtolower((string)($row['registration_type'] ?? ''));
                $is_earlier_reg = isset($student_earliest_reg_contact[$sid][$ckey]) && $student_earliest_reg_contact[$sid][$ckey] < $row_c_num;
                if (in_array($reg_type, ['carryover', 'repeat'], true) && $is_earlier_reg) {
                    $student_co_reg_contacts[$sid][$ckey][$row_c_num] = (int)$row['credit_units'];
                    $student_co_reg_contacts[$sid][$cid][$row_c_num] = (int)$row['credit_units'];
                }
            }

            // Pass 2: Populate student prior unique courses and bucketed contact loads
            foreach ($prev_reg_rows as $row) {
                $sid = $row['student_id'];
                $norm_code = strtoupper(trim((string)($row['course_code'] ?? '')));
                if ($norm_code !== '' && isset($canonical_cid_by_code[$norm_code])) {
                    $row['course_id'] = $canonical_cid_by_code[$norm_code];
                } elseif ($norm_code !== '') {
                    $canonical_cid_by_code[$norm_code] = $row['course_id'];
                }
                $cid = $row['course_id'];

                $row_sess_name = $row['session_name'] ?: $row['session_id'];
                $row_sem_name = $row['semester_name'] ?: ($row['level'] ?: $row['semester_id']);
                $row_c_num = $this->_resolve_row_contact(
                    $row['semester_name'] ?? '',
                    $row['level'] ?? '',
                    $row['semester_id'] ?? '',
                    $row['session_name'] ?? '',
                    $row['session_id'] ?? '',
                    $row['academic_session_id'] ?? ''
                );

                // Ignore Contact 1 registrations for DE students without Contact 1 normal presence
                if (!empty($is_de_map[$sid]) && empty($de_has_contact1_reg[$sid])) {
                    if ($row_c_num === 1 || $this->_is_contact_1_period($row_sem_name, $row['level'] ?? '')) {
                        continue;
                    }
                }

                // Contact 1 has zero prior registrations
                if ($is_contact_1) {
                    continue;
                }

                $is_prior = false;
                if ($current_contact_num !== null && $row_c_num !== null) {
                    $is_prior = ($row_c_num < $current_contact_num);
                } elseif ($current_contact_num === null) {
                    $is_prior = $this->_is_period_before($row_sess_name, $row_sem_name, $current_session_name, $current_semester_name);
                }

                if (!$is_prior) {
                    continue;
                }

                // Safely distinguish normal courses (even if flipped to carryover upon failure) from out-of-contact carryovers
                $reg_type = strtolower((string)($row['registration_type'] ?? ''));
                $course_c_num = ($row['contact_number'] !== null && $row['contact_number'] !== '') ? (int)$row['contact_number'] : null;
                if ($course_c_num === null) {
                    $course_c_num = $this->period_resolver->extract_contact_number($row['course_level'] ?? '');
                    if ($course_c_num === null && preg_match('/^[A-Z]{2,4}(\d)/i', $norm_code, $cm)) {
                        $course_c_num = (int)$cm[1];
                    }
                }
                $is_valid_earlier_co = ($row_c_num !== null && $course_c_num !== null && $course_c_num < $row_c_num);
                $is_cohort_normal = ($row_c_num !== null) && (
                    !empty($cohort_normal_courses_by_contact[$row_c_num][$cid]) ||
                    ($norm_code !== '' && !empty($cohort_normal_codes_by_contact[$row_c_num][$norm_code]))
                );

                if (in_array($reg_type, ['carryover', 'repeat'], true)) {
                    if (!$is_cohort_normal && !$is_valid_earlier_co && $current_contact_num !== null && $course_c_num !== null && $course_c_num >= $current_contact_num) {
                        continue;
                    }
                }

                // Enforce course contact_number match for non-cohort-normal courses
                if ($course_c_num !== null && !$is_cohort_normal) {
                    if (!$is_valid_earlier_co && $row_c_num !== null && $course_c_num !== $row_c_num && !in_array($reg_type, ['carryover', 'repeat'], true)) {
                        continue;
                    }
                    if ($current_contact_num !== null && $course_c_num >= $current_contact_num) {
                        continue;
                    }
                }

                $course_key = $norm_code ?: $cid;
                $already_in_earlier_contact = false;
                if ($row_c_num !== null && !empty($student_prev_contact_courses[$sid])) {
                    foreach ($student_prev_contact_courses[$sid] as $b_k => $b_courses) {
                        if (is_int($b_k) && $b_k < $row_c_num && isset($b_courses[$course_key])) {
                            $already_in_earlier_contact = true;
                            break;
                        }
                    }
                }

                $is_co_reg = in_array($reg_type, ['carryover', 'repeat'], true);
                if ($is_cohort_normal && !$already_in_earlier_contact) {
                    $is_co_reg = false;
                }

                $student_prev_unique_courses[$sid][$cid] = [
                    'credit_units' => (int)$row['credit_units'],
                    'course_code' => $row['course_code'],
                    'course_title' => $row['course_title']
                ];

                // Track prior registered courses bucketed by contact/period. Both normal curriculum
                // courses and registered carryover retakes constitute the official registered load (TCR)
                // for that contact period, ensuring preceding cumulative credits transition faithfully.
                $bucket_key = ($current_contact_num !== null && $row_c_num !== null) ? (int)$row_c_num : ($row_sess_name . '|' . $row_sem_name);
                $student_prev_contact_courses[$sid][$bucket_key][$course_key] = (int)$row['credit_units'];
            }

            // Also load prior courses from result_attempts for legacy cohorts where course registrations were not recorded online
            $has_rb_acad = $this->db->table_exists('result_batches') && $this->db->field_exists('academic_session_id', 'result_batches');
            $rb_acad_sel = $has_rb_acad ? 'rb.academic_session_id,' : 'NULL as academic_session_id,';
            $rb_sess_join = $has_rb_acad
                ? "LEFT JOIN academic_sessions sess ON sess.id = COALESCE(NULLIF(rb.academic_session_id, ''), rb.session_id)"
                : "LEFT JOIN academic_sessions sess ON sess.id = rb.session_id";

            $prev_att_sql = "
                SELECT ra.student_id, rb.course_id, {$rb_acad_sel} rb.session_id, rb.semester_id,
                       c.credit_units, c.code as course_code, c.title as course_title,
                       sess.name as session_name, sem.name as semester_name, rb.level as batch_level,
                       c.contact_number, c.level as course_level
                FROM result_attempts ra
                JOIN result_batches rb ON rb.id = ra.batch_id
                JOIN courses c ON c.id = rb.course_id
                {$rb_sess_join}
                LEFT JOIN semesters sem ON (sem.id = rb.semester_id OR sem.name = rb.semester_id)
                WHERE ra.student_id IN ($st_ph)
                  AND ra.status = 'active'
            ";
            $prev_att_rows = $this->db->query($prev_att_sql, $student_ids)->result_array();
            foreach ($prev_att_rows as $row) {
                $sid = $row['student_id'];
                $cid = $row['course_id'];
                $norm_code = strtoupper(trim((string)($row['course_code'] ?? '')));
                if ($norm_code !== '' && isset($canonical_cid_by_code[$norm_code])) {
                    $cid = $canonical_cid_by_code[$norm_code];
                }

                $row_c_num = $this->_resolve_row_contact(
                    $row['semester_name'] ?? '',
                    $row['batch_level'] ?? '',
                    $row['semester_id'] ?? '',
                    $row['session_name'] ?? '',
                    $row['session_id'] ?? '',
                    $row['academic_session_id'] ?? ''
                );
                $course_key = $norm_code ?: $cid;
                if (isset($student_earliest_reg_contact[$sid][$course_key]) && ($row_c_num === null || $row_c_num < $student_earliest_reg_contact[$sid][$course_key])) {
                    $row_c_num = $student_earliest_reg_contact[$sid][$course_key];
                }

                // Ignore Contact 1 for DE students without Contact 1 presence
                if (!empty($is_de_map[$sid]) && empty($de_has_contact1_reg[$sid])) {
                    if ($row_c_num === 1 || $this->_is_contact_1_period($row['semester_name'] ?? '', $row['batch_level'] ?? '')) {
                        continue;
                    }
                }

                $is_prior = false;
                if ($current_contact_num !== null && $row_c_num !== null) {
                    $is_prior = ($row_c_num < $current_contact_num);
                } elseif ($current_contact_num === null) {
                    $is_prior = $this->_is_period_before($row['session_name'] ?? '', $row['semester_name'] ?? '', $current_session_name, $current_semester_name);
                }

                $course_c_num = ($row['contact_number'] !== null && $row['contact_number'] !== '') ? (int)$row['contact_number'] : null;
                $is_cohort_norm = ($row_c_num !== null) && (
                    !empty($cohort_normal_courses_by_contact[$row_c_num][$cid]) ||
                    ($norm_code !== '' && !empty($cohort_normal_codes_by_contact[$row_c_num][$norm_code]))
                );
                if (!$is_cohort_norm && $current_contact_num !== null && $course_c_num !== null && $course_c_num >= $current_contact_num) {
                    continue;
                }

                if ($is_prior) {
                    $bucket_key = ($current_contact_num !== null && $row_c_num !== null) ? (int)$row_c_num : (($row['session_name'] ?? '') . '|' . ($row['semester_name'] ?? ''));
                    // Only fallback to result_attempts for legacy contacts where the cohort had no online course registrations
                    $cohort_has_online_reg = ($row_c_num !== null && !empty($cohort_normal_courses_by_contact[$row_c_num]));
                    if (!$cohort_has_online_reg) {
                        if (!isset($student_prev_unique_courses[$sid][$cid])) {
                            $student_prev_unique_courses[$sid][$cid] = [
                                'credit_units' => (int)$row['credit_units'],
                                'course_code' => $row['course_code'],
                                'course_title' => $row['course_title']
                            ];
                        }
                        if ($bucket_key !== '') {
                            $student_prev_contact_courses[$sid][$bucket_key][$course_key] = (int)$row['credit_units'];
                        }
                    }
                }
            }
        }

        // Fetch active course registrations for the current period
        $has_cri_origin = $this->db->field_exists('origin_result_attempt_id', 'course_registration_items');
        $cri_origin_sel = $has_cri_origin ? ', cri.origin_result_attempt_id, cri.origin_session_id' : '';

        $sql = "
            SELECT cr.student_id, cri.course_id, cri.registration_type, c.credit_units, c.code as course_code, c.title as course_title
                   {$cri_origin_sel}
            FROM course_registration_items cri
            JOIN course_registrations cr ON cr.id = cri.registration_id
            JOIN students s ON s.id = cr.student_id
            JOIN courses c ON c.id = cri.course_id
            WHERE {$cr_sess_match['sql']}
              AND {$cr_sem_match['sql']}
              AND s.programme_id = ? 
              AND (cri.status = 'active' OR cri.status IS NULL)
              AND cr.status IN ('approved', 'submitted', 'draft')
        ";
        $current_reg_params = array_merge(
            $cr_sess_match['params'],
            $cr_sem_match['params'],
            [$programme_id]
        );
        $current_registrations_raw = $this->db->query($sql, $current_reg_params)->result_array();

        $current_regs = [];
        foreach ($current_registrations_raw as $reg) {
            $sid = $reg['student_id'];
            $norm_code = strtoupper(trim((string)($reg['course_code'] ?? '')));
            if ($norm_code !== '' && isset($canonical_cid_by_code[$norm_code])) {
                $reg['course_id'] = $canonical_cid_by_code[$norm_code];
            } elseif ($norm_code !== '') {
                $canonical_cid_by_code[$norm_code] = $reg['course_id'];
            }
            $cid = $reg['course_id'];
            $is_co = in_array(strtolower($reg['registration_type'] ?? ''), ['carryover', 'repeat'], true);

            // A course in current_courses is a normal CURRENT course for this student if they have not
            // already registered for it in an earlier contact; if they already took it in a prior contact,
            // re-registering it in a later contact is a carryover.
            if (!empty($current_course_ids_map[$cid]) || !empty($current_course_codes_map[$norm_code])) {
                $is_co = isset($student_prev_unique_courses[$sid][$cid]);
            }

            // Contact 1 never has carryovers
            if ($is_contact_1) {
                $is_co = false;
            }

            // For DE students, ignore auto-synced CARRYOVER registrations for Contact 1 courses they never took
            if ($is_co && !empty($is_de_map[$sid]) && empty($de_has_contact1_reg[$sid])) {
                $course_c_num = $this->_extract_contact_number($reg['course_title'] ?? '', $norm_code);
                if ($course_c_num === null && preg_match('/^[A-Z]{2,4}(\d)/i', $norm_code, $cm)) {
                    $course_c_num = (int)$cm[1];
                }
                if ($course_c_num === 1) {
                    continue;
                }
            }

            // A carryover registration is valid if the student registered for the course in a prior contact,
            // OR has prior result history, OR has provenance links (origin_result_attempt_id / origin_session_id)
            if ($is_co && !isset($student_prev_unique_courses[$sid][$cid])) {
                $has_code_match = false;
                if ($norm_code !== '' && !empty($student_prev_unique_courses[$sid])) {
                    foreach ($student_prev_unique_courses[$sid] as $p_info) {
                        if (strtoupper(trim((string)($p_info['course_code'] ?? ''))) === $norm_code) {
                            $has_code_match = true;
                            break;
                        }
                    }
                }
                $has_provenance = !empty($reg['origin_result_attempt_id']) || !empty($reg['origin_session_id']);
                // If the student registered it online or via admin carryover sync, retain it
            }

            $current_regs[$sid][$cid] = [
                'is_carryover' => $is_co,
                'is_registered' => true,
                'credit_units' => (int)$reg['credit_units'],
                'course_code' => $reg['course_code'],
                'course_title' => $reg['course_title']
            ];
        }

        // 5. Resolve Historical & Current Results (STRICTLY filtered to registered courses only).
        // Result batches use the same teaching-session envelope as registrations.
        // Prefer academic_session_id, falling back to legacy session_id only when
        // the canonical field is empty.
        $has_batch_academic_session = $this->db->field_exists('academic_session_id', 'result_batches');
        $batch_academic_select = $has_batch_academic_session
            ? 'b.academic_session_id,'
            : 'NULL as academic_session_id,';
        $batch_session_label = $has_batch_academic_session
            ? 'COALESCE(sess_academic.name, sess_legacy.name, b.academic_session_id, b.session_id)'
            : 'COALESCE(sess_legacy.name, b.session_id)';
        $batch_academic_join = $has_batch_academic_session
            ? 'LEFT JOIN academic_sessions sess_academic ON (sess_academic.id = b.academic_session_id OR sess_academic.name = b.academic_session_id)'
            : '';
        $sql = "
            SELECT a.*, c.id as course_id, c.code as course_code, c.title as course_title, c.credit_units, 
                   {$batch_academic_select} b.session_id, b.semester_id, b.level as batch_level, 
                   {$batch_session_label} as session_name, 
                   COALESCE(sem.name, b.semester_id) as semester_name,
                   b.status as batch_status
            FROM result_attempts a
            JOIN result_batches b ON b.id = a.batch_id
            JOIN courses c ON c.id = b.course_id
            {$batch_academic_join}
            LEFT JOIN academic_sessions sess_legacy ON (sess_legacy.id = b.session_id OR sess_legacy.name = b.session_id)
            LEFT JOIN semesters sem ON (sem.id = b.semester_id OR sem.name = b.semester_id)
            JOIN students s ON s.id = a.student_id
            WHERE s.programme_id = ? AND a.status = 'active'
            ORDER BY 
                (CASE WHEN b.status = 'published' THEN 4 WHEN b.status = 'approved' THEN 3 WHEN b.status = 'submitted' THEN 2 ELSE 1 END) ASC,
                COALESCE(a.updated_at, a.created_at) ASC,
                a.id ASC
        ";

        $all_history_raw = $this->db->query($sql, [$programme_id])->result_array();

        // Normalize course_id across all_history_raw to unify duplicate courses rows with identical course_code
        $unfiltered_attempt_counts = [];
        foreach ($all_history_raw as &$h_row) {
            $norm_code = strtoupper(trim((string)($h_row['course_code'] ?? '')));
            if ($norm_code !== '' && isset($canonical_cid_by_code[$norm_code])) {
                $h_row['course_id'] = $canonical_cid_by_code[$norm_code];
            }
            $u_sid = $h_row['student_id'];
            $u_key = $norm_code ?: $h_row['course_id'];
            $unfiltered_attempt_counts[$u_sid][$u_key][$h_row['id']] = true;
        }
        unset($h_row);

        // Filter all_history_raw so that attempts for courses without course registration are completely excluded
        $registered_history_raw = [];
        foreach ($all_history_raw as $h_row) {
            $sid = $h_row['student_id'];
            $cid = $h_row['course_id'];
            $norm_c = strtoupper(trim((string)($h_row['course_code'] ?? '')));
            $ckey = $norm_c ?: $cid;
            $att_sess = $h_row['session_name'] ?: $h_row['session_id'];
            $att_sem = $h_row['semester_name'] ?: ($h_row['batch_level'] ?: $h_row['semester_id']);
            $att_c_num = $this->period_resolver->resolve_row_contact_number($h_row['semester_name'] ?? '', $h_row['batch_level'] ?? '', $h_row['semester_id'] ?? '');
            if ($att_c_num === null) {
                $att_c_num = $this->_resolve_row_contact(
                    $h_row['semester_name'] ?? '',
                    $h_row['batch_level'] ?? '',
                    $h_row['semester_id'] ?? '',
                    $h_row['session_name'] ?? '',
                    $h_row['session_id'] ?? '',
                    $h_row['academic_session_id'] ?? ''
                );
            }
            $h_row['_effective_contact'] = $att_c_num;

            $earliest_reg_c = $student_earliest_reg_contact[$sid][$ckey] ?? ($student_earliest_reg_contact[$sid][$cid] ?? null);
            $sess_match = $this->_matches_teaching_session($h_row, $target_session_ids);

            if ($current_contact_num !== null && $att_c_num !== null) {
                $sem_match = ($att_c_num === $current_contact_num);
            } else {
                $sem_match = in_array($h_row['semester_id'], $target_semester_ids) 
                    || (!empty($h_row['semester_name']) && in_array($h_row['semester_name'], $target_semester_ids))
                    || (!empty($h_row['batch_level']) && in_array($h_row['batch_level'], $target_semester_ids))
                    || (!empty($att_sem) && in_array($att_sem, $target_semester_ids));
            }

            $is_current_att = ($sess_match && $sem_match);
            $is_prior_att = !$is_current_att && (
                ($current_contact_num !== null && $att_c_num !== null && $att_c_num < $current_contact_num)
                || ($current_contact_num === null && $this->_is_period_before($att_sess, $att_sem, $current_session_name, $current_semester_name))
            );

            if ($is_current_att) {
                // In current contact, student MUST be registered for this course in current_regs (or registered in prior contact for carryover)
                if (!isset($current_regs[$sid][$cid]) && !isset($student_prev_unique_courses[$sid][$cid])) {
                    $has_reg = false;
                    if ($norm_c !== '') {
                        if (!empty($current_regs[$sid])) {
                            foreach ($current_regs[$sid] as $cr) {
                                if (strtoupper(trim((string)($cr['course_code'] ?? ''))) === $norm_c) {
                                    $has_reg = true;
                                    break;
                                }
                            }
                        }
                        if (!$has_reg && !empty($student_prev_unique_courses[$sid])) {
                            foreach ($student_prev_unique_courses[$sid] as $pr) {
                                if (strtoupper(trim((string)($pr['course_code'] ?? ''))) === $norm_c) {
                                    $has_reg = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (!$has_reg) {
                        continue;
                    }
                }
                // If it's a normal course in current_courses, student must be registered for it in current_regs
                if (!empty($current_course_ids_map[$cid]) && !isset($current_regs[$sid][$cid])) {
                    $has_reg = false;
                    if ($norm_c !== '' && !empty($current_regs[$sid])) {
                        foreach ($current_regs[$sid] as $cr) {
                            if (strtoupper(trim((string)($cr['course_code'] ?? ''))) === $norm_c) {
                                $has_reg = true;
                                break;
                            }
                        }
                    }
                    if (!$has_reg) {
                        continue;
                    }
                }
            } elseif ($is_prior_att) {
                // Reject attempts from contacts earlier than the student's earliest registration contact for this course
                if ($earliest_reg_c !== null && $att_c_num !== null && $att_c_num < $earliest_reg_c && !empty($cohort_normal_courses_by_contact[$earliest_reg_c])) {
                    continue;
                }
                // Reject legacy level-only batches whose session belongs to an earlier contact than $att_c_num (they were rejected by $sess_match in Contact $att_c_num)
                if ($att_c_num !== null && $this->_extract_explicit_contact($h_row['semester_name'] ?? '', $h_row['batch_level'] ?? '', $h_row['semester_id'] ?? '') === null) {
                    $batch_sess_c = $this->_resolve_row_contact('', '', '', $h_row['session_name'] ?? '', $h_row['session_id'] ?? '', $h_row['academic_session_id'] ?? '');
                    if ($batch_sess_c !== null && $batch_sess_c < $att_c_num) {
                        continue;
                    }
                }
                // In prior contacts, student registered for it, OR currently has it registered as a carryover
                $has_prior_reg = isset($student_prev_unique_courses[$sid][$cid]) || !empty($current_regs[$sid][$cid]['is_carryover']);
                if (!$has_prior_reg && $norm_c !== '') {
                    if (!empty($student_prev_unique_courses[$sid])) {
                        foreach ($student_prev_unique_courses[$sid] as $p_info) {
                            if (strtoupper(trim((string)($p_info['course_code'] ?? ''))) === $norm_c) {
                                $has_prior_reg = true;
                                break;
                            }
                        }
                    }
                    if (!$has_prior_reg && !empty($current_regs[$sid])) {
                        foreach ($current_regs[$sid] as $cr) {
                            if (!empty($cr['is_carryover']) && strtoupper(trim((string)($cr['course_code'] ?? ''))) === $norm_c) {
                                $has_prior_reg = true;
                                break;
                            }
                        }
                    }
                }
                if (!$has_prior_reg) {
                    continue;
                }
            } else {
                continue;
            }

            $registered_history_raw[] = $h_row;
        }
        $all_history_raw = $registered_history_raw;

        // Index raw attempts and prior failed/passed contacts per student+course to distinguish real carryover retakes from normal-attempt mirror rows
        $student_failed_contacts = [];
        $student_passed_contacts = [];
        $student_attempt_ids_by_course = [];
        foreach ($all_history_raw as $r_att) {
            $r_sid = $r_att['student_id'];
            $r_cid = $r_att['course_id'];
            $r_code = strtoupper(trim((string)($r_att['course_code'] ?? '')));
            $r_key = $r_code ?: $r_cid;
            $r_c = $r_att['_effective_contact'] ?? null;
            $r_grd = strtoupper(trim((string)($r_att['grade'] ?? '')));
            $r_sc = ($r_att['total_score'] !== null && $r_att['total_score'] !== '') ? (float)$r_att['total_score'] : null;
            $student_attempt_ids_by_course[$r_sid][$r_key][$r_att['id']] = $r_c;
            if (in_array($r_grd, ['F', 'ABS'], true) || ($r_sc !== null && $r_sc < 40)) {
                if ($r_c !== null) {
                    $student_failed_contacts[$r_sid][$r_key][(int)$r_c] = $r_att['id'];
                    $student_failed_contacts[$r_sid][$r_cid][(int)$r_c] = $r_att['id'];
                }
            } elseif (in_array($r_grd, ['A', 'B', 'C', 'D', 'E'], true) || ($r_sc !== null && $r_sc >= 40)) {
                if ($r_c !== null) {
                    $student_passed_contacts[$r_sid][$r_key][(int)$r_c] = $r_att['id'];
                    $student_passed_contacts[$r_sid][$r_cid][(int)$r_c] = $r_att['id'];
                }
            }
        }

        // Track carryover correction attempt IDs to prevent carryover retakes from contaminating first-time attempts,
        // while exempting a student's sole first-time normal attempt if it was mirrored into carryover_corrections with NULL source_result_attempt_id
        $correction_attempt_ids = [];
        if ($this->db->table_exists('carryover_corrections')) {
            $cc_attempts = $this->db->select('cc.result_attempt_id, cc.source_result_attempt_id, cc.student_id, cc.course_id, c.code as course_code')
                ->from('carryover_corrections cc')
                ->join('courses c', 'c.id = cc.course_id', 'left')
                ->get()->result_array();
            foreach ($cc_attempts as $cca) {
                $att_id = $cca['result_attempt_id'] ?? '';
                $src_id = $cca['source_result_attempt_id'] ?? '';
                if (empty($att_id)) {
                    continue;
                }
                if ($att_id !== $src_id) {
                    $c_sid = $cca['student_id'] ?? '';
                    $c_code = strtoupper(trim((string)($cca['course_code'] ?? '')));
                    $c_cid = ($c_code !== '' && isset($canonical_cid_by_code[$c_code])) ? $canonical_cid_by_code[$c_code] : ($cca['course_id'] ?? '');
                    $c_key = $c_code ?: $c_cid;
                    $raw_cnt = isset($unfiltered_attempt_counts[$c_sid][$c_key]) ? count($unfiltered_attempt_counts[$c_sid][$c_key]) : 0;
                    $ear_c = $student_earliest_reg_contact[$c_sid][$c_key] ?? ($student_earliest_reg_contact[$c_sid][$c_cid] ?? null);
                    $att_c = $student_attempt_ids_by_course[$c_sid][$c_key][$att_id] ?? null;
                    $is_sole_first_time_attempt = empty($src_id)
                        && $raw_cnt === 1
                        && ($ear_c === null || $att_c === null || $att_c === $ear_c);
                    if (!$is_sole_first_time_attempt) {
                        $correction_attempt_ids[$att_id] = true;
                    }
                }
            }
        }

        // Identify which batches have any scored results entered for registered students in the cohort,
        // and track which students already have a real score for a course in a period (to guard against duplicate unscored batches)
        $batches_with_scores = [];
        $student_course_has_real_score = [];
        foreach ($all_history_raw as $row) {
            $has_sc = ($row['total_score'] !== null && $row['total_score'] !== '');
            $grd = strtoupper(trim((string)($row['grade'] ?? '')));
            if ($has_sc || in_array($grd, ['A', 'B', 'C', 'D', 'E', 'F', 'ABS'], true)) {
                $batches_with_scores[$row['batch_id']] = true;
                $row_c_num = $row['_effective_contact'] ?? $this->_resolve_row_contact($row['semester_name'] ?? '', $row['batch_level'] ?? '', $row['semester_id'] ?? '', $row['session_name'] ?? '', $row['session_id'] ?? '', $row['academic_session_id'] ?? '');
                $period_key = ($row_c_num !== null) ? ('C' . $row_c_num) : (($row['session_id'] ?? '') . '_' . ($row['semester_id'] ?? ''));
                $student_course_has_real_score[$row['student_id'] . '_' . $row['course_id'] . '_' . $period_key] = true;
            }
        }

        $all_history = [];
        foreach ($all_history_raw as $att_row) {
            // Carryover retake attempts are managed exclusively via carryover_corrections
            if (!empty($correction_attempt_ids[$att_row['id']])) {
                continue;
            }

            $sid = $att_row['student_id'];
            // Direct Entry students join at Contact 2; ignore orphaned Contact 1 result_attempts
            if (!empty($is_de_map[$sid]) && empty($de_has_contact1_reg[$sid])) {
                $att_c_num_check = $att_row['_effective_contact'] ?? $this->_resolve_row_contact($att_row['semester_name'] ?? '', $att_row['batch_level'] ?? '', $att_row['semester_id'] ?? '', $att_row['session_name'] ?? '', $att_row['session_id'] ?? '', $att_row['academic_session_id'] ?? '');
                if ($att_c_num_check === 1 || $this->_is_contact_1_period($att_row['semester_name'] ?? '', $att_row['batch_level'] ?? '')) {
                    continue;
                }
            }

            $att_grade = strtoupper(trim((string)($att_row['grade'] ?? '')));
            $has_score = ($att_row['total_score'] !== null && $att_row['total_score'] !== '');

            // An unscored registered student enrolled in a batch that has results evaluated for the cohort was ABSENT,
            // UNLESS they already have a real scored attempt for this course in a duplicate batch for the same period!
            if (!$has_score && ($att_grade === '' || $att_grade === '-')) {
                $row_c_num = $att_row['_effective_contact'] ?? $this->_resolve_row_contact($att_row['semester_name'] ?? '', $att_row['batch_level'] ?? '', $att_row['semester_id'] ?? '', $att_row['session_name'] ?? '', $att_row['session_id'] ?? '', $att_row['academic_session_id'] ?? '');
                $period_key = ($row_c_num !== null) ? ('C' . $row_c_num) : (($att_row['session_id'] ?? '') . '_' . ($att_row['semester_id'] ?? ''));
                if (!empty($student_course_has_real_score[$sid . '_' . $att_row['course_id'] . '_' . $period_key])) {
                    continue;
                }
                if (!empty($batches_with_scores[$att_row['batch_id']])) {
                    $att_row['grade'] = 'ABS';
                    $att_row['grade_point'] = 0;
                    $att_row['quality_point'] = 0;
                } else {
                    // Empty draft batch without any scored results yet; skip placeholder
                    continue;
                }
            }

            $all_history[] = $att_row;
        }

        // Build latest prior attempts map (strictly before current period, and strictly for registered prior courses)
        $latest_prior_attempts = [];
        foreach ($all_history as $attempt) {
            $att_sess = $attempt['session_name'] ?: $attempt['session_id'];
            $att_sem = $attempt['semester_name'] ?: ($attempt['batch_level'] ?: $attempt['semester_id']);
            $att_c_num = $attempt['_effective_contact'] ?? $this->_resolve_row_contact($attempt['semester_name'] ?? '', $attempt['batch_level'] ?? '', $attempt['semester_id'] ?? '', $attempt['session_name'] ?? '', $attempt['session_id'] ?? '', $attempt['academic_session_id'] ?? '');

            if ($is_contact_1) {
                continue;
            }

            $is_prior = false;
            if ($current_contact_num !== null && $att_c_num !== null) {
                $is_prior = ($att_c_num < $current_contact_num);
            } elseif ($current_contact_num === null) {
                $is_prior = $this->_is_period_before($att_sess, $att_sem, $current_session_name, $current_semester_name);
            }

            if (!$is_prior) {
                continue;
            }

            $sid = $attempt['student_id'];
            $cid = $attempt['course_id'];
            $norm_att_c = strtoupper(trim((string)($attempt['course_code'] ?? '')));

            // Require prior course registration OR current carryover registration for this student
            $has_pr = isset($student_prev_unique_courses[$sid][$cid]) || !empty($current_regs[$sid][$cid]['is_carryover']);
            if (!$has_pr && $norm_att_c !== '') {
                if (!empty($student_prev_unique_courses[$sid])) {
                    foreach ($student_prev_unique_courses[$sid] as $p_info) {
                        if (strtoupper(trim((string)($p_info['course_code'] ?? ''))) === $norm_att_c) {
                            $has_pr = true;
                            break;
                        }
                    }
                }
                if (!$has_pr && !empty($current_regs[$sid])) {
                    foreach ($current_regs[$sid] as $cr) {
                        if (!empty($cr['is_carryover']) && strtoupper(trim((string)($cr['course_code'] ?? ''))) === $norm_att_c) {
                            $has_pr = true;
                            break;
                        }
                    }
                }
            }
            if (!$has_pr) {
                continue;
            }

            $previous = $latest_prior_attempts[$sid][$cid] ?? null;
            $prev_c_num = $previous ? ($previous['_effective_contact'] ?? $this->_resolve_row_contact($previous['semester_name'] ?? '', $previous['batch_level'] ?? '', $previous['semester_id'] ?? '', $previous['session_name'] ?? '', $previous['session_id'] ?? '', $previous['academic_session_id'] ?? '')) : null;
            $prev_sess = $previous ? ($previous['session_name'] ?: $previous['session_id']) : '';
            $prev_sem = $previous ? ($previous['semester_name'] ?: ($previous['batch_level'] ?: $previous['semester_id'])) : '';
            $is_later_period = $previous && (
                ($prev_c_num !== null && $att_c_num !== null)
                    ? ($prev_c_num < $att_c_num)
                    : $this->_is_period_before($prev_sess, $prev_sem, $att_sess, $att_sem)
            );
            $is_same_period = $previous && (
                ($prev_c_num !== null && $att_c_num !== null)
                    ? ($prev_c_num === $att_c_num)
                    : ($prev_sess === $att_sess && $prev_sem === $att_sem)
            );
            $previous_updated_at = $previous ? ($previous['updated_at'] ?: $previous['created_at']) : '';
            $attempt_updated_at = $attempt['updated_at'] ?: $attempt['created_at'];

            if ($is_same_period && $previous) {
                // Batch status rank: published (4) > approved (3) > submitted (2) > draft (1)
                $prev_status_rank = $this->_batch_status_rank($previous['batch_status'] ?? '');
                $curr_status_rank = $this->_batch_status_rank($attempt['batch_status'] ?? '');
                if ($curr_status_rank < $prev_status_rank) {
                    continue; // Draft or lower-status batch cannot overwrite submitted/approved batch
                }
                $prev_has_num = ($previous['total_score'] !== null && $previous['total_score'] !== '');
                $curr_has_num = ($attempt['total_score'] !== null && $attempt['total_score'] !== '');
                if ($curr_status_rank === $prev_status_rank && $prev_has_num && !$curr_has_num) {
                    continue;
                }
            }

            $prev_rank = $previous ? $this->_batch_status_rank($previous['batch_status'] ?? '') : 0;
            $curr_rank = $this->_batch_status_rank($attempt['batch_status'] ?? '');
            $should_replace = !$previous
                || $is_later_period
                || ($is_same_period && ($curr_rank > $prev_rank || ($curr_rank === $prev_rank && $attempt_updated_at >= $previous_updated_at)));

            if ($should_replace) {
                $latest_prior_attempts[$sid][$cid] = $attempt;
            }
        }

        // Resolve carryover_corrections and classify them into PREVIOUS (< current contact) vs CURRENT (== current contact)
        $carryover_corrections = [];       // all valid corrections up to current contact: [sid][cid] => row
        $prior_carryover_corrections = []; // corrections resolved strictly before current contact: [sid][cid] => row
        $prior_failed_correction_attempts = []; // corrections attempted in N-1 that failed again: [sid][cid] => attempt
        $current_carryover_corrections = []; // corrections active in current contact: [sid][cid] => row
        $resolved_carryovers = [];         // courses resolved before current contact: [sid][cid] => true
        $prev_contact_num = ($current_contact_num !== null) ? ($current_contact_num - 1) : null;

        if ($this->db->table_exists('carryover_corrections')) {
            $src_acad_sel = $has_batch_academic_session ? 'source_batch.academic_session_id as source_academic_session_id,' : 'NULL as source_academic_session_id,';
            $cur_acad_sel = $has_batch_academic_session ? 'cur_batch.academic_session_id as current_batch_academic_session_id,' : 'NULL as current_batch_academic_session_id,';
            $src_sess_label = $has_batch_academic_session
                ? 'COALESCE(source_sess_acad.name, source_sess.name, source_batch.academic_session_id, source_batch.session_id)'
                : 'COALESCE(source_sess.name, source_batch.session_id)';
            $cur_sess_label = $has_batch_academic_session
                ? 'COALESCE(cur_sess_acad.name, cur_sess.name, cur_batch.academic_session_id, cur_batch.session_id)'
                : 'COALESCE(cur_sess.name, cur_batch.session_id)';
            $src_acad_join = $has_batch_academic_session
                ? 'LEFT JOIN academic_sessions source_sess_acad ON (source_sess_acad.id = source_batch.academic_session_id OR source_sess_acad.name = source_batch.academic_session_id)'
                : '';
            $cur_acad_join = $has_batch_academic_session
                ? 'LEFT JOIN academic_sessions cur_sess_acad ON (cur_sess_acad.id = cur_batch.academic_session_id OR cur_sess_acad.name = cur_batch.academic_session_id)'
                : '';

            $sql = "
                SELECT cc.*, c.code as course_code, c.title as course_title, c.credit_units,
                       COALESCE(sess.name, cc.session_id) as session_name,
                       COALESCE(sem.name, cc.semester_id) as semester_name,
                       source_attempt.total_score as source_total_score,
                       source_attempt.grade as source_grade,
                       {$src_acad_sel}
                       source_batch.session_id as source_session_id,
                       source_batch.semester_id as source_semester_id,
                       {$src_sess_label} as source_session_name,
                       COALESCE(source_sem.name, source_batch.level, source_batch.semester_id) as source_semester_name,
                       source_batch.level as source_batch_level,
                       cur_attempt.total_score as cur_att_total_score,
                       cur_attempt.grade as cur_att_grade,
                       {$cur_acad_sel}
                       cur_batch.session_id as current_batch_session_id,
                       cur_batch.semester_id as current_batch_semester_id,
                       cur_batch.level as current_batch_level,
                       {$cur_sess_label} as current_batch_session_name,
                       COALESCE(cur_sem.name, cur_batch.semester_id) as current_batch_semester_name
                FROM carryover_corrections cc
                JOIN students s ON s.id = cc.student_id
                JOIN courses c ON c.id = cc.course_id
                LEFT JOIN academic_sessions sess ON (sess.id = cc.session_id OR sess.name = cc.session_id)
                LEFT JOIN semesters sem ON (sem.id = cc.semester_id OR sem.name = cc.semester_id)
                LEFT JOIN result_attempts source_attempt ON source_attempt.id = COALESCE(NULLIF(cc.source_result_attempt_id, ''), cc.result_attempt_id)
                LEFT JOIN result_batches source_batch ON source_batch.id = source_attempt.batch_id
                {$src_acad_join}
                LEFT JOIN academic_sessions source_sess ON (source_sess.id = source_batch.session_id OR source_sess.name = source_batch.session_id)
                LEFT JOIN semesters source_sem ON (source_sem.id = source_batch.semester_id OR source_sem.name = source_batch.semester_id OR source_sem.name = source_batch.level)
                LEFT JOIN result_attempts cur_attempt ON cur_attempt.id = cc.result_attempt_id
                LEFT JOIN result_batches cur_batch ON cur_batch.id = cur_attempt.batch_id
                {$cur_acad_join}
                LEFT JOIN academic_sessions cur_sess ON (cur_sess.id = cur_batch.session_id OR cur_sess.name = cur_batch.session_id)
                LEFT JOIN semesters cur_sem ON (cur_sem.id = cur_batch.semester_id OR cur_sem.name = cur_batch.semester_id OR cur_sem.name = cur_batch.level)
                WHERE s.programme_id = ?
                ORDER BY cc.created_at ASC
            ";
            $correction_rows = $this->db->query($sql, [$programme_id])->result_array();
            foreach ($correction_rows as $correction) {
                $sid = $correction['student_id'];
                $norm_code = strtoupper(trim((string)($correction['course_code'] ?? '')));
                if ($norm_code !== '' && isset($canonical_cid_by_code[$norm_code])) {
                    $correction['course_id'] = $canonical_cid_by_code[$norm_code];
                }
                $cid = $correction['course_id'];
                $ckey = $norm_code ?: $cid;

                // Filter out bogus mirror rows created on first-time normal attempts:
                // When source_result_attempt_id is empty or equals result_attempt_id, and the underlying attempt in result_attempts
                // has the exact same score/grade AND the student has no earlier failed attempt on this course, it is NOT a carryover correction!
                $has_distinct_source_id = !empty($correction['source_result_attempt_id'])
                    && $correction['source_result_attempt_id'] !== ($correction['result_attempt_id'] ?? '');
                if (!$has_distinct_source_id) {
                    $cc_grd = strtoupper(trim((string)($correction['grade'] ?? '')));
                    $src_grd = strtoupper(trim((string)($correction['source_grade'] ?? ($correction['cur_att_grade'] ?? ''))));
                    $cc_sc = (isset($correction['total_score']) && $correction['total_score'] !== null && $correction['total_score'] !== '') ? (float)$correction['total_score'] : null;
                    $raw_src_sc = $correction['source_total_score'] ?? ($correction['cur_att_total_score'] ?? null);
                    $src_sc = ($raw_src_sc !== null && $raw_src_sc !== '') ? (float)$raw_src_sc : null;
                    $same_score_and_grade = ($src_grd === '' && $src_sc === null) || ($cc_grd === $src_grd && $cc_sc === $src_sc);

                    $has_other_failed_attempt = false;
                    if (!empty($student_failed_contacts[$sid][$ckey])) {
                        foreach ($student_failed_contacts[$sid][$ckey] as $f_c => $f_att_id) {
                            if ($f_att_id !== ($correction['result_attempt_id'] ?? '')) {
                                $has_other_failed_attempt = true;
                                break;
                            }
                        }
                    }

                    if ($same_score_and_grade && !$has_other_failed_attempt) {
                        continue;
                    }
                }

                // If the student already passed this course in a normal attempt and has zero failed attempts on it, it cannot be a carryover correction
                if (empty($student_failed_contacts[$sid][$ckey]) && !empty($student_passed_contacts[$sid][$ckey])) {
                    continue;
                }

                // If this student is taking the course as a first-time normal current course in this contact, it is not a carryover for them
                if (isset($current_regs[$sid][$cid]) && empty($current_regs[$sid][$cid]['is_carryover'])) {
                    continue;
                }

                // A carryover correction is valid if the student registered for the course in a prior contact,
                // OR has it actively registered as carryover in current_regs, OR has provenance/prior attempts
                $has_prev_reg = isset($student_prev_unique_courses[$sid][$cid]);
                if (!$has_prev_reg && $norm_code !== '' && !empty($student_prev_unique_courses[$sid])) {
                    foreach ($student_prev_unique_courses[$sid] as $p_info) {
                        if (strtoupper(trim((string)($p_info['course_code'] ?? ''))) === $norm_code) {
                            $has_prev_reg = true;
                            break;
                        }
                    }
                }
                if (!$has_prev_reg) {
                    if (!empty($current_regs[$sid][$cid]['is_carryover'])) {
                        $has_prev_reg = true;
                    } elseif ($norm_code !== '' && !empty($current_regs[$sid])) {
                        foreach ($current_regs[$sid] as $reg_c) {
                            if (!empty($reg_c['is_carryover']) && strtoupper(trim((string)($reg_c['course_code'] ?? ''))) === $norm_code) {
                                $has_prev_reg = true;
                                break;
                            }
                        }
                    }
                }
                if (!$has_prev_reg && (!empty($correction['source_result_attempt_id']) || !empty($student_failed_contacts[$sid][$ckey]))) {
                    $has_prev_reg = true;
                }
                if (!$has_prev_reg) {
                    continue;
                }

                $earliest_reg_c = $student_earliest_reg_contact[$sid][$ckey] ?? ($student_earliest_reg_contact[$sid][$cid] ?? null);
                $source_c_num = $this->_resolve_row_contact(
                    $correction['source_semester_name'] ?? '',
                    $correction['source_batch_level'] ?? '',
                    $correction['source_semester_id'] ?? '',
                    $correction['source_session_name'] ?? '',
                    $correction['source_session_id'] ?? '',
                    $correction['source_academic_session_id'] ?? ''
                );
                if (!empty($student_failed_contacts[$sid][$ckey])) {
                    $failed_cs = array_keys($student_failed_contacts[$sid][$ckey]);
                    $min_failed_c = (int)min($failed_cs);
                    if ($source_c_num === null || !$has_distinct_source_id) {
                        $source_c_num = $min_failed_c;
                    }
                }
                if ($earliest_reg_c !== null && ($source_c_num === null || $source_c_num < $earliest_reg_c)) {
                    $source_c_num = $earliest_reg_c;
                }

                // Ignore Contact 1 carryover corrections for DE students who have no Contact 1 presence
                if (!empty($is_de_map[$sid]) && empty($de_has_contact1_reg[$sid])) {
                    if ($source_c_num === 1 || $this->_is_contact_1_period($correction['source_semester_name'] ?? '', $correction['source_batch_level'] ?? '')) {
                        continue;
                    }
                }

                // A course failed at or after the current contact cannot be a carryover at current contact!
                if ($current_contact_num !== null && $source_c_num !== null && $source_c_num >= $current_contact_num) {
                    continue;
                }

                // Determine intrinsic effective contact number where this correction was taken
                $corr_c_num = $this->_resolve_row_contact(
                    $correction['semester_name'] ?: ($correction['current_batch_semester_name'] ?? ''),
                    $correction['current_batch_level'] ?? '',
                    $correction['semester_id'] ?: ($correction['current_batch_semester_id'] ?? ''),
                    $correction['current_batch_session_name'] ?: ($correction['session_name'] ?? ''),
                    $correction['session_id'] ?: ($correction['current_batch_session_id'] ?? ''),
                    $correction['current_batch_academic_session_id'] ?? ''
                );

                // If the semester/level on the batch/correction merely echoed the course's original contact (<= $source_c_num),
                // resolve the contact directly from the batch/correction's teaching session!
                if ($corr_c_num === null || ($source_c_num !== null && $corr_c_num <= $source_c_num)) {
                    $sess_c_num = $this->_resolve_row_contact(
                        '',
                        '',
                        '',
                        $correction['current_batch_session_name'] ?: ($correction['session_name'] ?? ''),
                        $correction['session_id'] ?: ($correction['current_batch_session_id'] ?? ''),
                        $correction['current_batch_academic_session_id'] ?? ''
                    );
                    if ($sess_c_num !== null && ($source_c_num === null || $sess_c_num > $source_c_num)) {
                        $corr_c_num = $sess_c_num;
                    }
                }

                // If this row has no distinct source_result_attempt_id link and its resolved contact (including session) is not after $source_c_num,
                // it is an out-of-session/pre-registration row rather than a subsequent carryover retake
                if (!$has_distinct_source_id && ($corr_c_num === null || ($source_c_num !== null && $corr_c_num <= $source_c_num))) {
                    continue;
                }

                // A carryover retake for a failure in $source_c_num MUST occur in a subsequent contact (>= $source_c_num + 1)
                $effective_c_num = null;
                if ($corr_c_num !== null && ($source_c_num === null || $corr_c_num > $source_c_num)) {
                    $effective_c_num = $corr_c_num;
                } elseif (!empty($student_co_reg_contacts[$sid][$ckey])) {
                    foreach (array_keys($student_co_reg_contacts[$sid][$ckey]) as $co_c) {
                        if ($source_c_num === null || (int)$co_c > $source_c_num) {
                            $effective_c_num = (int)$co_c;
                            break;
                        }
                    }
                }
                if ($effective_c_num === null && $source_c_num !== null) {
                    $effective_c_num = $source_c_num + 1;
                }

                $is_corr_in_current_sess = in_array($correction['session_id'], $target_session_ids)
                    || (!empty($correction['session_name']) && in_array($correction['session_name'], $target_session_ids))
                    || (!empty($correction['current_batch_academic_session_id']) && in_array($correction['current_batch_academic_session_id'], $target_session_ids))
                    || (!empty($correction['current_batch_session_name']) && in_array($correction['current_batch_session_name'], $target_session_ids));
                $is_corr_in_current_batch = $is_corr_in_current_sess
                    || ($effective_c_num !== null && $current_contact_num !== null && $effective_c_num === $current_contact_num);

                if ($effective_c_num === null && $is_corr_in_current_batch) {
                    $effective_c_num = $current_contact_num;
                }

                // If viewing an earlier contact and the carryover correction happened in a later contact, skip it
                if ($current_contact_num !== null && $effective_c_num !== null && $effective_c_num > $current_contact_num) {
                    continue;
                }

                $correction['_effective_contact'] = $effective_c_num;

                // Index valid carryover corrections by sid and cid/norm_code:
                $carryover_corrections[$sid][$cid] = $correction;
                if ($norm_code !== '') {
                    $carryover_corrections[$sid][$norm_code] = $correction;
                }

                $grade = strtoupper(trim((string)($correction['grade'] ?? '')));
                $is_pass = ($grade !== '' && !in_array($grade, ['F', 'ABS', '-', '—'], true));

                // Prior contact correction (< current_contact_num)
                $is_prior = ($current_contact_num !== null && $effective_c_num !== null && $effective_c_num < $current_contact_num)
                    || ($current_contact_num === null && !$is_corr_in_current_batch && $this->_is_period_before(
                        $correction['session_name'],
                        $correction['semester_name'],
                        $current_session_name,
                        $current_semester_name
                    ));

                if ($is_prior && !isset($student_prev_unique_courses[$sid][$cid])) {
                    $student_prev_unique_courses[$sid][$cid] = [
                        'credit_units' => (int)($correction['credit_units'] ?? 0),
                        'course_code' => $correction['course_code'] ?? '',
                        'course_title' => $correction['course_title'] ?? ''
                    ];
                }

                if ($is_prior) {
                    if ($is_pass) {
                        // User Rule: "contact one carryover correction shall show on contact two broadsheet only, its shall not include contact 3, 4 and rest."
                        // It was resolved in a prior contact, so it is strictly RESOLVED and must not appear in future carryover columns!
                        $resolved_carryovers[$sid][$cid] = true;
                        if ($norm_code !== '') {
                            $resolved_carryovers[$sid][$norm_code] = true;
                        }
                        $prior_carryover_corrections[$sid][$cid] = $correction;
                        if (isset($current_regs[$sid][$cid])) {
                            unset($current_regs[$sid][$cid]);
                        }
                        if ($norm_code !== '' && !empty($current_regs[$sid])) {
                            foreach (array_keys($current_regs[$sid]) as $r_cid) {
                                if (strtoupper(trim((string)($current_regs[$sid][$r_cid]['course_code'] ?? ''))) === $norm_code && !empty($current_regs[$sid][$r_cid]['is_carryover'])) {
                                    unset($current_regs[$sid][$r_cid]);
                                }
                            }
                        }
                    } else if (in_array($grade, ['F', 'ABS'], true)) {
                        // User Rule: "while contact 3 broadshet can show contact 2 correct and correction of contact 1 that student failed again in contact two correction and so on"
                        // If it was attempted in a prior contact and failed again, record as prior failed correction attempt
                        $correction_att = $this->_correction_to_attempt($correction);
                        if ($effective_c_num !== null) {
                            $correction_att['semester_name'] = 'Contact ' . $effective_c_num;
                            $correction_att['_effective_contact'] = $effective_c_num;
                        }
                        $prior_carryover_corrections[$sid][$cid] = $correction;
                        if ($effective_c_num === $prev_contact_num) {
                            $prior_failed_correction_attempts[$sid][$cid] = $correction_att;
                        }
                    }
                    continue;
                }

                // Current contact correction (== current_contact_num)
                $is_current = ($current_contact_num !== null && $effective_c_num !== null && $effective_c_num === $current_contact_num)
                    || ($current_contact_num === null && $is_corr_in_current_batch);

                if ($is_current && !$is_contact_1) {
                    $current_carryover_corrections[$sid][$cid] = $correction;
                    if ($norm_code !== '') {
                        $current_carryover_corrections[$sid][$norm_code] = $correction;
                    }
                    $current_regs[$sid][$cid] = [
                        'is_carryover' => true,
                        'credit_units' => (int)($correction['credit_units'] ?? ($current_regs[$sid][$cid]['credit_units'] ?? 0)),
                        'course_code' => $correction['course_code'] ?? ($current_regs[$sid][$cid]['course_code'] ?? 'UNK'),
                        'course_title' => $correction['course_title'] ?? ($current_regs[$sid][$cid]['course_title'] ?? '')
                    ];
                }
            }
        }

        // Add Carryovers from the Immediate Previous Contact Base (N-1)
        $base_attempts = $latest_prior_attempts;
        if (!empty($prior_failed_correction_attempts)) {
            foreach ($prior_failed_correction_attempts as $sid => $c_atts) {
                foreach ($c_atts as $cid => $att) {
                    $base_attempts[$sid][$cid] = $att;
                }
            }
        }

        if (!$is_contact_1 && $prev_contact_num !== null) {
            foreach ($base_attempts as $sid => $course_attempts) {
                foreach ($course_attempts as $cid => $attempt) {
                    $att_norm_code = strtoupper(trim((string)($attempt['course_code'] ?? '')));
                    // If this student is taking this course as a first-time normal current course in this contact, it is not a carryover for them!
                    if (isset($current_regs[$sid][$cid]) && empty($current_regs[$sid][$cid]['is_carryover'])) {
                        continue;
                    }

                    // If resolved in a prior contact, skip!
                    if (!empty($resolved_carryovers[$sid][$cid]) || ($att_norm_code !== '' && !empty($resolved_carryovers[$sid][$att_norm_code]))) {
                        continue;
                    }

                    // User Rule: "carry over shall work on previous contact base not list the whole carry overs all at one."
                    // Check the contact number of this prior attempt:
                    $att_c_num = $attempt['_effective_contact'] ?? $this->_resolve_row_contact($attempt['semester_name'] ?? '', $attempt['batch_level'] ?? '', $attempt['semester_id'] ?? '', $attempt['session_name'] ?? '', $attempt['session_id'] ?? '', $attempt['academic_session_id'] ?? '');

                    // Strictly require this failure to have occurred in the immediate previous contact (N-1)!
                    if ($att_c_num !== $prev_contact_num) {
                        continue;
                    }

                    $grade = strtoupper((string)($attempt['grade'] ?? ''));
                    $sc = ($attempt['total_score'] !== null && $attempt['total_score'] !== '') ? (float)$attempt['total_score'] : null;
                    if (in_array($grade, ['F', 'ABS'], true) || ($sc !== null && $sc < 40)) {
                        $current_regs[$sid][$cid] = [
                            'is_carryover' => true,
                            'credit_units' => (int)($attempt['credit_units'] ?? ($current_regs[$sid][$cid]['credit_units'] ?? 0)),
                            'course_code' => $attempt['course_code'] ?? ($current_regs[$sid][$cid]['course_code'] ?? 'UNK'),
                            'course_title' => $attempt['course_title'] ?? ($current_regs[$sid][$cid]['course_title'] ?? '')
                        ];
                    }
                }
            }
        }

        // Also ensure carryovers declared in authoritative previous snapshot remarks (e.g. "CO: EAP331")
        // are included for this contact if not already resolved
        if (!$is_contact_1 && !empty($options['previous_snapshot_metrics'])) {
            foreach ($options['previous_snapshot_metrics'] as $sid => $p_snap) {
                $rem = (string)($p_snap['remark'] ?? '');
                if (stripos($rem, 'CO:') !== false || stripos($rem, 'Carryover') !== false) {
                    if (preg_match_all('/\b([A-Z]{2,4}\s*\d{3})\b/i', $rem, $co_matches)) {
                        foreach ($co_matches[1] as $raw_c_code) {
                            $c_code = strtoupper(str_replace(' ', '', trim($raw_c_code)));
                            if (!empty($resolved_carryovers[$sid][$c_code])) {
                                continue;
                            }
                            $cid = $canonical_cid_by_code[$c_code] ?? null;
                            if (!$cid) {
                                $c_row = $this->db->select('id, code, title, credit_units')->like('code', $c_code)->get('courses', 1)->row_array();
                                if ($c_row) {
                                    $cid = $c_row['id'];
                                    $canonical_cid_by_code[$c_code] = $cid;
                                }
                            }
                            if ($cid && !empty($resolved_carryovers[$sid][$cid])) {
                                continue;
                            }
                            if ($cid) {
                                $cu = 0;
                                if (isset($current_regs[$sid][$cid]['credit_units'])) {
                                    $cu = (int)$current_regs[$sid][$cid]['credit_units'];
                                } elseif (isset($student_prev_unique_courses[$sid][$cid]['credit_units'])) {
                                    $cu = (int)$student_prev_unique_courses[$sid][$cid]['credit_units'];
                                } else {
                                    $c_row = $this->db->select('credit_units, title')->where('id', $cid)->get('courses', 1)->row_array();
                                    $cu = (int)($c_row['credit_units'] ?? 2);
                                }
                                $current_regs[$sid][$cid] = [
                                    'is_carryover' => true,
                                    'credit_units' => $cu > 0 ? $cu : 2,
                                    'course_code' => $c_code,
                                    'course_title' => $c_row['title'] ?? $c_code
                                ];
                            }
                        }
                    }
                }
            }
        }

        // Sanitization: Ensure carryovers in $current_regs are clean:
        // - Drop if explicitly resolved/passed in a prior contact ($resolved_carryovers).
        // - Retain official registered carryovers from course_registration_items and active corrections.
        // - For purely auto-injected attempts (not officially registered), ensure they originated from an unpassed attempt in N-1.
        if (!$is_contact_1 && isset($current_regs)) {
            foreach ($current_regs as $sid => &$c_regs) {
                foreach ($c_regs as $cid => $reg_info) {
                    if (empty($reg_info['is_carryover'])) {
                        continue;
                    }
                    $reg_norm_code = strtoupper(trim((string)($reg_info['course_code'] ?? '')));
                    if (!empty($resolved_carryovers[$sid][$cid]) || ($reg_norm_code !== '' && !empty($resolved_carryovers[$sid][$reg_norm_code]))) {
                        unset($c_regs[$cid]);
                        continue;
                    }
                    // Retain official active course registrations and active corrections
                    if (!empty($reg_info['is_registered']) || isset($current_carryover_corrections[$sid][$cid]) || ($reg_norm_code !== '' && isset($current_carryover_corrections[$sid][$reg_norm_code]))) {
                        continue;
                    }
                    $from_prev_contact = false;
                    if (isset($base_attempts[$sid][$cid])) {
                        $b_att = $base_attempts[$sid][$cid];
                        $b_c_num = $b_att['_effective_contact'] ?? $this->_resolve_row_contact($b_att['semester_name'] ?? '', $b_att['batch_level'] ?? '', $b_att['semester_id'] ?? '', $b_att['session_name'] ?? '', $b_att['session_id'] ?? '', $b_att['academic_session_id'] ?? '');
                        if ($b_c_num === $prev_contact_num && in_array(strtoupper((string)($b_att['grade'] ?? '')), ['F', 'ABS'], true)) {
                            $from_prev_contact = true;
                        }
                    }
                    if (!$from_prev_contact) {
                        unset($c_regs[$cid]);
                    }
                }
            }
            unset($c_regs);
        }

        // Contact 1 strict guarantee: zero carryovers
        if ($is_contact_1 && isset($current_regs)) {
            foreach ($current_regs as $sid => &$c_regs) {
                foreach ($c_regs as $cid => $reg_info) {
                    if (!empty($reg_info['is_carryover'])) {
                        unset($c_regs[$cid]);
                    }
                }
            }
            unset($c_regs);
        }

        // 5. Process Student Metrics & Carryovers
        $carryover_union = []; // Distinct carryover courses for the cohort
        $processed_students = [];
        $current_course_codes_by_id = [];
        foreach ($current_courses as $cc_item) {
            if (!empty($cc_item['course_id']) && !empty($cc_item['course_code'])) {
                $current_course_codes_by_id[$cc_item['course_id']] = $cc_item['course_code'];
            }
        }

        foreach ($students_raw as $st) {
            $sid = $st['student_id'];
            $is_de = !empty($is_de_map[$sid]);

            // Extract history for THIS student
            $st_history = array_filter($all_history, function($h) use ($sid) {
                return $h['student_id'] == $sid;
            });

            // Bucket attempts into PREVIOUS vs CURRENT
            $previous_attempts = [];
            $current_attempts = [];

            foreach ($st_history as $att) {
                $att_cid = $att['course_id'];
                $att_norm_c = strtoupper(trim((string)($att['course_code'] ?? '')));
                $att_ckey = $att_norm_c ?: $att_cid;
                $att_sess = $att['session_name'] ?: $att['session_id'];
                $att_sem = $att['semester_name'] ?: ($att['batch_level'] ?: $att['semester_id']);
                $att_c_num = $att['_effective_contact'] ?? $this->period_resolver->resolve_row_contact_number($att['semester_name'] ?? '', $att['batch_level'] ?? '', $att['semester_id'] ?? '');
                if ($att_c_num === null) {
                    $att_c_num = $this->_resolve_row_contact($att['semester_name'] ?? '', $att['batch_level'] ?? '', $att['semester_id'] ?? '', $att['session_name'] ?? '', $att['session_id'] ?? '', $att['academic_session_id'] ?? '');
                }
                $att['_effective_contact'] = $att_c_num;

                $sess_match = $this->_matches_teaching_session($att, $target_session_ids);

                if ($current_contact_num !== null && $att_c_num !== null) {
                    $sem_match = ($att_c_num === $current_contact_num);
                } else {
                    $sem_match = in_array($att['semester_id'], $target_semester_ids) 
                        || (!empty($att['semester_name']) && in_array($att['semester_name'], $target_semester_ids))
                        || (!empty($att['batch_level']) && in_array($att['batch_level'], $target_semester_ids))
                        || (!empty($att_sem) && in_array($att_sem, $target_semester_ids));
                }

                $is_current = ($sess_match && $sem_match);

                $is_previous = !$is_current && (
                    ($current_contact_num !== null && $att_c_num !== null && $att_c_num < $current_contact_num)
                    || ($current_contact_num === null && $this->_is_period_before($att_sess, $att_sem, $current_session_name, $current_semester_name))
                );

                if ($is_current) {
                    $current_attempts[] = $att;
                } else if ($is_previous) {
                    $previous_attempts[] = $att;
                    // If this is a scored prior attempt in contact $att_c_num (e.g. a batch-recorded carryover retake), ensure its contact bucket includes its credits
                    if ($att_c_num !== null && $current_contact_num !== null) {
                        $student_prev_contact_courses[$sid][(int)$att_c_num][$att_ckey] = (int)$att['credit_units'];
                    }
                }
            }

            // Inject prior resolved carryover corrections into $previous_attempts so Previous CCE/CGP/CGPA include them
            if (!empty($prior_carryover_corrections[$sid])) {
                foreach ($prior_carryover_corrections[$sid] as $cid => $pcorr) {
                    $pcorr_att = $this->_correction_to_attempt($pcorr);
                    $pcorr_c_num = $pcorr['_effective_contact'] ?? null;
                    if ($pcorr_c_num !== null) {
                        $pcorr_att['semester_name'] = 'Contact ' . (int)$pcorr_c_num;
                        $pcorr_att['semester_id'] = 'Contact ' . (int)$pcorr_c_num;
                        $pcorr_att['batch_level'] = 'Contact ' . (int)$pcorr_c_num;
                        $pcorr_att['_effective_contact'] = (int)$pcorr_c_num;
                    }
                    $previous_attempts[] = $pcorr_att;
                    $student_prev_unique_courses[$sid][$cid] = [
                        'credit_units' => (int)$pcorr['credit_units'],
                        'course_code' => $pcorr['course_code'],
                        'course_title' => $pcorr['course_title']
                    ];
                    if ($current_contact_num !== null && $pcorr_c_num !== null) {
                        $pcorr_bucket = (int)$pcorr_c_num;
                        $pcorr_key = strtoupper(trim((string)($pcorr['course_code'] ?? ''))) ?: $cid;
                        $student_prev_contact_courses[$sid][$pcorr_bucket][$pcorr_key] = (int)$pcorr['credit_units'];
                    }
                }
            }

            // Inject active current carryover corrections into $current_attempts so Current TCE/TQP/GPA include them
            if (!empty($current_carryover_corrections[$sid])) {
                foreach ($current_carryover_corrections[$sid] as $cid => $ccorr) {
                    if ($cid !== ($ccorr['course_id'] ?? '')) {
                        continue; // Avoid duplicate injection when indexed by both cid and norm_code
                    }
                    $ccorr_att = $this->_correction_to_attempt($ccorr);
                    if ($current_contact_num !== null) {
                        $ccorr_att['_effective_contact'] = (int)$current_contact_num;
                    }
                    $current_attempts[] = $ccorr_att;
                }
            }

            // Verify student presence in this contact:
            // A student MUST have at least one active course registration (normal or registered carryover) in this contact.
            $has_registration = !empty($current_regs[$sid]);

            $sem_name = strtolower((string)($current_semester_name ?: ($semester['name'] ?? $semester_id)));
            $is_contact_1 = $this->_is_contact_1_period($sem_name, $level);

            if ($is_de && $is_contact_1 && empty($de_has_contact1_reg[$sid])) {
                continue;
            }

            if (!$has_registration) {
                continue;
            }

            // Strictly filter previous_attempts to courses the student actually registered for in prior contacts
            $registered_prev_codes = [];
            if (!empty($student_prev_unique_courses[$sid])) {
                foreach ($student_prev_unique_courses[$sid] as $pcid => $pinfo) {
                    $pc = strtoupper(trim((string)($pinfo['course_code'] ?? '')));
                    if ($pc !== '') {
                        $registered_prev_codes[$pc] = true;
                    }
                }
            }
            $previous_attempts = array_values(array_filter($previous_attempts, function($pa) use ($student_prev_unique_courses, $sid, $registered_prev_codes) {
                $pa_cid = $pa['course_id'] ?? '';
                $pa_code = strtoupper(trim((string)($pa['course_code'] ?? '')));
                return isset($student_prev_unique_courses[$sid][$pa_cid]) || ($pa_code !== '' && isset($registered_prev_codes[$pa_code]));
            }));

            // Build unified latest_attempts across all history + carryover corrections up to current contact
            $attempts_to_date = array_merge($previous_attempts, $current_attempts);
            $latest_attempts = [];
            foreach ($attempts_to_date as $att) {
                $cid = $att['course_id'];
                if (isset($latest_attempts[$cid]) && empty($att['_from_carryover_correction'])) {
                    $prev = $latest_attempts[$cid];
                    $prev_rank = $this->_batch_status_rank($prev['batch_status'] ?? '');
                    $curr_rank = $this->_batch_status_rank($att['batch_status'] ?? '');
                    if ($curr_rank < $prev_rank) {
                        continue;
                    }
                    $prev_has_num = ($prev['total_score'] !== null && $prev['total_score'] !== '');
                    $curr_has_num = ($att['total_score'] !== null && $att['total_score'] !== '');
                    $prev_c = $prev['_effective_contact'] ?? $this->_resolve_row_contact($prev['semester_name'] ?? '', $prev['batch_level'] ?? '', $prev['semester_id'] ?? '', $prev['session_name'] ?? '', $prev['session_id'] ?? '', $prev['academic_session_id'] ?? '');
                    $curr_c = $att['_effective_contact'] ?? $this->_resolve_row_contact($att['semester_name'] ?? '', $att['batch_level'] ?? '', $att['semester_id'] ?? '', $att['session_name'] ?? '', $att['session_id'] ?? '', $att['academic_session_id'] ?? '');
                    if ($prev_c === $curr_c && $prev_has_num && !$curr_has_num && $curr_rank <= $prev_rank) {
                        continue;
                    }
                }
                $latest_attempts[$cid] = $att;
            }

            // --- PREVIOUS METRICS (Contacts 1..N-1, accumulated by prior contact registered loads) ---
            $is_de_first_contact = ($is_de && empty($de_has_contact1_reg[$sid]) && ($current_contact_num === 2 || (empty($student_prev_unique_courses[$sid]) && empty($previous_attempts))));
            if (!empty($options['previous_snapshot_metrics'][$sid])) {
                $p_snap = $options['previous_snapshot_metrics'][$sid];
                $p_reg = (int)($p_snap['cumulative_registered_credits'] ?? $p_snap['cum_reg_credits'] ?? $p_snap['registered_credits'] ?? 0);
                $p_earn = (int)($p_snap['cumulative_earned_credits'] ?? $p_snap['cum_earned_credits'] ?? $p_snap['earned_credits'] ?? 0);
                $p_qp = (float)($p_snap['cumulative_quality_points'] ?? $p_snap['cum_quality_points'] ?? $p_snap['quality_points'] ?? 0);
                $p_cgpa = (float)($p_snap['cumulative_cgpa'] ?? $p_snap['cum_cgpa'] ?? $p_snap['cgpa'] ?? ($p_reg > 0 ? round($p_qp / $p_reg, 2) : 0.00));
                $previous_metrics = [
                    'registered_credits' => $p_reg,
                    'earned_credits'     => $p_earn,
                    'quality_points'     => $p_qp,
                    'gpa'                => number_format($p_cgpa, 2, '.', ''),
                    'cgpa'               => number_format($p_cgpa, 2, '.', ''),
                ];
            } elseif ($is_contact_1 || $is_de_first_contact) {
                $previous_metrics = [
                    'registered_credits' => 0,
                    'earned_credits'     => 0,
                    'quality_points'     => 0,
                    'gpa'                => '0.00',
                    'cgpa'               => '0.00',
                ];
                $student_prev_unique_courses[$sid] = [];
            } else {
                $previous_metrics = $this->_calculate_metrics($previous_attempts, false);
                $prev_reg_credits_sum = 0;
                if (!empty($student_prev_contact_courses[$sid])) {
                    foreach ($student_prev_contact_courses[$sid] as $p_key => $p_courses) {
                        $prev_reg_credits_sum += array_sum($p_courses);
                    }
                }
                $official_prev_ccr = max($prev_reg_credits_sum, (int)$previous_metrics['registered_credits']);
                $previous_metrics['registered_credits'] = $official_prev_ccr;
                if ($official_prev_ccr > 0) {
                    $prev_cgpa = round((float)$previous_metrics['quality_points'] / $official_prev_ccr, 2);
                    $previous_metrics['gpa'] = number_format($prev_cgpa, 2, '.', '');
                    $previous_metrics['cgpa'] = number_format($prev_cgpa, 2, '.', '');
                }
            }

            // --- CURRENT COURSE RESULTS (Mapped strictly by student course registration) ---
            $current_results = [];
            $student_curr_unique_courses = []; // course_id => ['credit_units' => int, 'course_code' => string]

            foreach ($current_courses as $c) {
                $cid = $c['course_id'];
                $c_norm_code = strtoupper(trim((string)($c['course_code'] ?? '')));

                // If student is NOT registered for this course as a normal current course, do not count or display in Current Courses
                if (!isset($current_regs[$sid][$cid]) || !empty($current_regs[$sid][$cid]['is_carryover'])) {
                    $current_results[$cid] = [
                        'display_value' => '-',
                        'status' => 'unregistered',
                        'ca_score' => null,
                        'exam_score' => null,
                        'total_score' => null,
                        'grade' => null,
                        'batch_status' => null,
                        'course_code' => $c['course_code']
                    ];
                    continue;
                }

                $attempt = null;
                $fallback_attempt = null;
                $sorted_ca = $current_attempts;
                usort($sorted_ca, function($a, $b) {
                    $ra = $this->_batch_status_rank($a['batch_status'] ?? '');
                    $rb = $this->_batch_status_rank($b['batch_status'] ?? '');
                    if ($ra !== $rb) return $rb <=> $ra;
                    $ha = ($a['total_score'] !== null && $a['total_score'] !== '') ? 1 : 0;
                    $hb = ($b['total_score'] !== null && $b['total_score'] !== '') ? 1 : 0;
                    if ($ha !== $hb) return $hb <=> $ha;
                    $ta = $a['updated_at'] ?: $a['created_at'];
                    $tb = $b['updated_at'] ?: $b['created_at'];
                    return strcmp($tb, $ta);
                });
                foreach ($sorted_ca as $ca) {
                    $ca_norm_code = strtoupper(trim((string)($ca['course_code'] ?? '')));
                    if (($ca['course_id'] == $cid || ($c_norm_code !== '' && $ca_norm_code === $c_norm_code)) && empty($ca['_from_carryover_correction'])) {
                        if ($ca['total_score'] !== null && $ca['total_score'] !== '') {
                            $attempt = $ca;
                            break;
                        }
                        if ($fallback_attempt === null) {
                            $fallback_attempt = $ca;
                        }
                    }
                }
                if ($attempt === null) {
                    $attempt = $fallback_attempt;
                }

                $student_curr_unique_courses[$cid] = [
                    'credit_units' => (int)$c['credit_units'],
                    'course_code' => $c['course_code']
                ];

                if ($attempt) {
                    $val = $this->_format_score_grade($attempt['total_score'], $attempt['grade']);
                    $status = 'scored';
                } else {
                    $val = 'NR'; // Not Reported
                    $status = 'missing';
                }

                $current_results[$cid] = [
                    'display_value' => $val,
                    'status' => $status,
                    'ca_score' => $attempt ? ($attempt['ca_score'] ?? null) : null,
                    'exam_score' => $attempt ? ($attempt['exam_score'] ?? null) : null,
                    'total_score' => $attempt ? ($attempt['total_score'] ?? null) : null,
                    'grade' => $attempt ? ($attempt['grade'] ?? null) : null,
                    'batch_status' => $attempt ? ($attempt['batch_status'] ?? null) : null,
                    'course_code' => $c['course_code']
                ];
            }

            // --- CARRYOVER DETERMINATION ---
            $student_carryovers = [];
            if (!$is_contact_1 && isset($current_regs[$sid])) {
                foreach ($current_regs[$sid] as $cid => $reg_info) {
                    if (!empty($reg_info['is_carryover'])) {
                        $attempt = $latest_attempts[$cid] ?? null;
                        // Look up ONLY current-contact carryover corrections (never prior-contact corrections)
                        $correction = $current_carryover_corrections[$sid][$cid] ?? null;

                        $course_code = $reg_info['course_code'] ?? ($correction['course_code'] ?? ($attempt ? $attempt['course_code'] : 'UNK'));
                        $course_title = $reg_info['course_title'] ?? ($correction['course_title'] ?? ($attempt ? $attempt['course_title'] : 'Unknown Course'));
                        $credit_units = (int)($reg_info['credit_units'] ?? ($correction['credit_units'] ?? ($attempt ? $attempt['credit_units'] : 0)));

                        if (!$attempt || $course_code === 'UNK' || $credit_units <= 0) {
                            $this->db->select('code, title, credit_units')->where('id', $cid);
                            $c_info = $this->db->get('courses')->row_array();
                            if ($c_info) {
                                $course_code = $c_info['code'];
                                $course_title = $c_info['title'];
                                $credit_units = (int)$c_info['credit_units'];
                            }
                        }

                        $norm_co_code = strtoupper(trim((string)$course_code));

                        // Check if student has ALREADY passed this course in previous contacts
                        $is_already_passed_prior = false;
                        foreach ($previous_attempts as $pa) {
                            $pa_code = strtoupper(trim((string)($pa['course_code'] ?? '')));
                            $pa_grd  = strtoupper(trim((string)($pa['grade'] ?? '')));
                            $pa_sc   = ($pa['total_score'] !== null && $pa['total_score'] !== '');
                            if (($pa['course_id'] == $cid || ($norm_co_code !== '' && $pa_code === $norm_co_code)) &&
                                (in_array($pa_grd, ['A', 'B', 'C', 'D', 'E'], true) || ($pa_sc && (float)$pa['total_score'] >= 40))) {
                                $is_already_passed_prior = true;
                                break;
                            }
                        }
                        if (!$is_already_passed_prior && !empty($prior_carryover_corrections[$sid])) {
                            foreach ($prior_carryover_corrections[$sid] as $pcorr) {
                                $pc_code = strtoupper(trim((string)($pcorr['course_code'] ?? '')));
                                $pc_grd  = strtoupper(trim((string)($pcorr['grade'] ?? '')));
                                $pc_sc   = ($pcorr['total_score'] !== null && $pcorr['total_score'] !== '');
                                if (($pcorr['course_id'] == $cid || ($norm_co_code !== '' && $pc_code === $norm_co_code)) &&
                                    (in_array($pc_grd, ['A', 'B', 'C', 'D', 'E'], true) || ($pc_sc && (float)$pcorr['total_score'] >= 40))) {
                                    $is_already_passed_prior = true;
                                    break;
                                }
                            }
                        }

                        // If already passed in a prior contact, skip this stale carryover registration completely
                        if ($is_already_passed_prior) {
                            continue;
                        }

                        $carryover_score = null;
                        $carryover_grade = null;

                        if (!$correction && $norm_co_code !== '' && !empty($current_carryover_corrections[$sid])) {
                            $correction = $current_carryover_corrections[$sid][$norm_co_code] ?? null;
                            if (!$correction) {
                                foreach ($current_carryover_corrections[$sid] as $cc_item) {
                                    if (strtoupper(trim((string)($cc_item['course_code'] ?? ''))) === $norm_co_code) {
                                        $correction = $cc_item;
                                        break;
                                    }
                                }
                            }
                        }

                        if ($correction && ($correction['total_score'] !== null || !empty($correction['grade']))) {
                            $carryover_score = $correction['total_score'];
                            $carryover_grade = $correction['grade'] ?? '';
                        } else {
                            foreach ($current_attempts as $ca) {
                                $ca_norm = strtoupper(trim((string)($ca['course_code'] ?? '')));
                                if (($ca['course_id'] == $cid || ($norm_co_code !== '' && $ca_norm === $norm_co_code)) && ($ca['total_score'] !== null || !empty($ca['grade']))) {
                                    $carryover_score = $ca['total_score'];
                                    $carryover_grade = $ca['grade'] ?? '';
                                    break;
                                }
                            }
                        }

                        // Every active carryover for this student in this contact is part of the student's
                        // registered curriculum load (TCR) for this contact, whether evaluated or pending ('NR')
                        $student_curr_unique_courses[$cid] = [
                            'credit_units' => $credit_units,
                            'course_code' => $course_code
                        ];

                        if ($carryover_score !== null || !empty($carryover_grade)) {
                            $display_val = $this->_format_score_grade($carryover_score, $carryover_grade);

                            // Ensure current_attempts contains this evaluated carryover so TCE and TQP reflect it
                            $has_ca = false;
                            foreach ($current_attempts as &$ca) {
                                $ca_norm = strtoupper(trim((string)($ca['course_code'] ?? '')));
                                if ($ca['course_id'] == $cid || ($norm_co_code !== '' && $ca_norm === $norm_co_code)) {
                                    $has_ca = true;
                                    if ($ca['total_score'] === null && empty($ca['grade'])) {
                                        $ca['total_score'] = $carryover_score;
                                        $ca['grade'] = $carryover_grade;
                                        $gp = $this->_grade_to_grade_point($carryover_grade);
                                        $ca['grade_point'] = $gp;
                                        $ca['quality_point'] = $gp * $credit_units;
                                    }
                                    break;
                                }
                            }
                            unset($ca);

                            if (!$has_ca) {
                                $gp = $this->_grade_to_grade_point($carryover_grade);
                                $current_attempts[] = [
                                    'id' => 'co_' . $sid . '_' . $cid,
                                    'student_id' => $sid,
                                    'course_id' => $cid,
                                    'course_code' => $course_code,
                                    'course_title' => $course_title,
                                    'credit_units' => $credit_units,
                                    'total_score' => $carryover_score,
                                    'grade' => $carryover_grade,
                                    'grade_point' => $gp,
                                    'quality_point' => $gp * $credit_units,
                                    'status' => 'active',
                                    '_from_carryover_correction' => true
                                ];
                            }
                        } else {
                            $display_val = 'NR';
                        }

                        $student_carryovers[$cid] = [
                            'course_id' => $cid,
                            'course_code' => $course_code,
                            'course_title' => $course_title,
                            'credit_units' => $credit_units,
                            'display_value' => $display_val,
                            'total_score' => $carryover_score,
                            'grade' => $carryover_grade
                        ];

                        $co_key = $norm_co_code ?: $cid;
                        if (!isset($carryover_union[$co_key])) {
                            $carryover_union[$co_key] = [
                                'course_id' => $cid,
                                'course_code' => $course_code,
                                'course_title' => $course_title,
                                'credit_units' => $credit_units
                            ];
                        }
                    }
                }
            }

            // --- CURRENT METRICS (Strictly Registered Normal + Active Evaluated Carryovers in Current Contact) ---
            $registered_curr_codes = [];
            foreach ($student_curr_unique_courses as $ccid => $cinfo) {
                $ccode = strtoupper(trim((string)($cinfo['course_code'] ?? '')));
                if ($ccode !== '') {
                    $registered_curr_codes[$ccode] = true;
                }
            }
            $current_attempts = array_values(array_filter($current_attempts, function($ca) use ($student_curr_unique_courses, $registered_curr_codes) {
                $ca_cid = $ca['course_id'] ?? '';
                $ca_code = strtoupper(trim((string)($ca['course_code'] ?? '')));
                return isset($student_curr_unique_courses[$ca_cid]) || ($ca_code !== '' && isset($registered_curr_codes[$ca_code]));
            }));

            $current_metrics = $this->_calculate_metrics($current_attempts, false);
            $curr_reg_credits_sum = 0;
            $seen_curr_codes = [];
            foreach ($student_curr_unique_courses as $ccid => $cinfo) {
                $ccode = strtoupper(trim((string)($cinfo['course_code'] ?? ''))) ?: $ccid;
                if (isset($seen_curr_codes[$ccode])) {
                    continue;
                }
                $seen_curr_codes[$ccode] = true;
                $curr_reg_credits_sum += (int)$cinfo['credit_units'];
            }
            $official_current_tcr = max($curr_reg_credits_sum, (int)$current_metrics['registered_credits']);
            $current_metrics['registered_credits'] = $official_current_tcr;
            if ($official_current_tcr > 0) {
                $curr_gpa = round((float)$current_metrics['quality_points'] / $official_current_tcr, 2);
                $current_metrics['gpa'] = number_format($curr_gpa, 2, '.', '');
                $current_metrics['cgpa'] = number_format($curr_gpa, 2, '.', '');
            }

            // --- CUMULATIVE METRICS (Additive Accumulation: Previous + Current = Cumulative) ---
            $all_career_attempts = array_merge($previous_attempts, $current_attempts);
            $career_unique_courses = ($student_prev_unique_courses[$sid] ?? []) + $student_curr_unique_courses;

            if ($is_contact_1 || $is_de_first_contact) {
                $cumulative_metrics = $current_metrics;
                $cumulative_ccr = (int)$current_metrics['registered_credits'];
            } else {
                $cum_reg_credits    = (int)$previous_metrics['registered_credits'] + (int)$current_metrics['registered_credits'];
                $cum_earned_credits = (int)$previous_metrics['earned_credits'] + (int)$current_metrics['earned_credits'];
                $cum_quality_points = (float)$previous_metrics['quality_points'] + (float)$current_metrics['quality_points'];
                $cum_cgpa           = ($cum_reg_credits > 0) ? round($cum_quality_points / $cum_reg_credits, 2) : 0.00;

                $cumulative_metrics = [
                    'registered_credits' => $cum_reg_credits,
                    'earned_credits'     => $cum_earned_credits,
                    'quality_points'     => $cum_quality_points,
                    'gpa'                => number_format($cum_cgpa, 2, '.', ''),
                    'cgpa'               => number_format($cum_cgpa, 2, '.', ''),
                ];
                $cumulative_ccr = $cum_reg_credits;
            }

            // Refresh $latest_attempts strictly from $all_career_attempts (registered courses only)
            $latest_attempts = [];
            foreach ($all_career_attempts as $att) {
                $cid = $att['course_id'];
                if (isset($latest_attempts[$cid]) && empty($att['_from_carryover_correction'])) {
                    $prev = $latest_attempts[$cid];
                    $prev_rank = $this->_batch_status_rank($prev['batch_status'] ?? '');
                    $curr_rank = $this->_batch_status_rank($att['batch_status'] ?? '');
                    if ($curr_rank < $prev_rank) {
                        continue;
                    }
                    $prev_has_num = ($prev['total_score'] !== null && $prev['total_score'] !== '');
                    $curr_has_num = ($att['total_score'] !== null && $att['total_score'] !== '');
                    $prev_c = $prev['_effective_contact'] ?? $this->_resolve_row_contact($prev['semester_name'] ?? '', $prev['batch_level'] ?? '', $prev['semester_id'] ?? '', $prev['session_name'] ?? '', $prev['session_id'] ?? '', $prev['academic_session_id'] ?? '');
                    $curr_c = $att['_effective_contact'] ?? $this->_resolve_row_contact($att['semester_name'] ?? '', $att['batch_level'] ?? '', $att['semester_id'] ?? '', $att['session_name'] ?? '', $att['session_id'] ?? '', $att['academic_session_id'] ?? '');
                    if ($prev_c === $curr_c && $prev_has_num && !$curr_has_num && $curr_rank <= $prev_rank) {
                        continue;
                    }
                }
                $latest_attempts[$cid] = $att;
            }

            // --- OUTSTANDING COURSES, PENDING COURSES & ACADEMIC STANDING REMARKS ---
            $failed_carryover_codes = [];
            $pending_codes = [];
            $passed_carryover_codes = [];

            // 0. Prior contacts: recognize courses already passed in student career
            foreach ($previous_attempts as $pa) {
                $p_code = strtoupper(trim((string)($pa['course_code'] ?? '')));
                $p_grade = strtoupper(trim((string)($pa['grade'] ?? '')));
                $p_has_sc = ($pa['total_score'] !== null && $pa['total_score'] !== '');
                if ($p_code !== '' && (in_array($p_grade, ['A', 'B', 'C', 'D', 'E'], true) || ($p_has_sc && (float)$pa['total_score'] >= 40))) {
                    $passed_carryover_codes[$p_code] = true;
                }
            }
            if (!empty($prior_carryover_corrections[$sid])) {
                foreach ($prior_carryover_corrections[$sid] as $pcorr) {
                    $pc_code = strtoupper(trim((string)($pcorr['course_code'] ?? '')));
                    $pc_grade = strtoupper(trim((string)($pcorr['grade'] ?? '')));
                    $pc_has_sc = ($pcorr['total_score'] !== null && $pcorr['total_score'] !== '');
                    if ($pc_code !== '' && (in_array($pc_grade, ['A', 'B', 'C', 'D', 'E'], true) || ($pc_has_sc && (float)$pcorr['total_score'] >= 40))) {
                        $passed_carryover_codes[$pc_code] = true;
                    }
                }
            }

            // 1. Current contact normal courses (from $current_results)
            foreach ($current_results as $cid => $cres) {
                if ($cres['status'] === 'unregistered' || $cres['display_value'] === '-') {
                    continue;
                }
                $code = $cres['course_code'] ?? ($student_curr_unique_courses[$cid]['course_code'] ?? ($current_course_codes_by_id[$cid] ?? ''));
                $norm_code = strtoupper(trim((string)$code));
                if ($norm_code === '') {
                    continue;
                }

                $grd = strtoupper(trim((string)($cres['grade'] ?? '')));
                $disp = trim((string)($cres['display_value'] ?? ''));

                if ($cres['status'] === 'missing' || $disp === 'NR' || ($cres['total_score'] === null && ($grd === '' || $grd === '-'))) {
                    if (!in_array($norm_code, $pending_codes, true)) {
                        $pending_codes[] = $norm_code;
                    }
                } elseif (in_array($grd, ['F', 'ABS'], true) || preg_match('/F$/i', $disp) || $disp === 'ABS') {
                    if (!in_array($norm_code, $failed_carryover_codes, true)) {
                        $failed_carryover_codes[] = $norm_code;
                    }
                } elseif (in_array($grd, ['A', 'B', 'C', 'D', 'E'], true) || ($cres['total_score'] !== null && (float)$cres['total_score'] >= 40)) {
                    $passed_carryover_codes[$norm_code] = true;
                }
            }

            // 2. Active registered carryovers retaken in current contact (from $student_carryovers)
            foreach ($student_carryovers as $cid => $co) {
                $code = $co['course_code'] ?? '';
                $norm_code = strtoupper(trim((string)$code));
                if ($norm_code === '') {
                    continue;
                }

                $grd = strtoupper(trim((string)($co['grade'] ?? '')));
                $disp = trim((string)($co['display_value'] ?? ''));

                if (in_array($grd, ['A', 'B', 'C', 'D', 'E'], true) || ($co['total_score'] !== null && (float)$co['total_score'] >= 40)) {
                    $passed_carryover_codes[$norm_code] = true;
                } elseif (in_array($grd, ['F', 'ABS'], true) || preg_match('/F$/i', $disp) || $disp === 'ABS') {
                    if (!isset($passed_carryover_codes[$norm_code]) && !in_array($norm_code, $failed_carryover_codes, true)) {
                        $failed_carryover_codes[] = $norm_code;
                    }
                } elseif ($disp === 'NR' || $co['total_score'] === null) {
                    if (!isset($passed_carryover_codes[$norm_code])) {
                        $has_prior_fail = false;
                        foreach ($previous_attempts as $pa) {
                            $pa_code = strtoupper(trim((string)($pa['course_code'] ?? '')));
                            $pa_grd  = strtoupper(trim((string)($pa['grade'] ?? '')));
                            if (($pa['course_id'] == $cid || $pa_code === $norm_code) && in_array($pa_grd, ['F', 'ABS'], true)) {
                                $has_prior_fail = true;
                                break;
                            }
                        }
                        if ($has_prior_fail) {
                            if (!in_array($norm_code, $failed_carryover_codes, true)) {
                                $failed_carryover_codes[] = $norm_code;
                            }
                        } else {
                            if (!in_array($norm_code, $pending_codes, true)) {
                                $pending_codes[] = $norm_code;
                            }
                        }
                    }
                }
            }

            // 3. Career prior courses: identify unresolved historical failures from previous contacts
            if (!$is_contact_1 && !empty($student_prev_unique_courses[$sid])) {
                foreach ($student_prev_unique_courses[$sid] as $pcid => $pinfo) {
                    $pcode = strtoupper(trim((string)($pinfo['course_code'] ?? '')));
                    if ($pcode === '' || isset($passed_carryover_codes[$pcode])) {
                        continue;
                    }

                    // A course from current contact or future contact cannot be an unresolved prior failure!
                    if ($current_contact_num !== null) {
                        $is_future_or_current = false;
                        for ($cn = $current_contact_num; $cn <= 6; $cn++) {
                            if (!empty($cohort_normal_codes_by_contact[$cn][$pcode])) {
                                $is_future_or_current = true;
                                break;
                            }
                        }
                        if ($is_future_or_current) {
                            continue;
                        }
                    }

                    // If retaken as carryover or normal course in this contact, already evaluated in Steps 1 & 2
                    $retaken_in_curr = false;
                    foreach ($student_carryovers as $co) {
                        if (strtoupper(trim((string)($co['course_code'] ?? ''))) === $pcode) {
                            $retaken_in_curr = true;
                            break;
                        }
                    }
                    if ($retaken_in_curr) {
                        continue;
                    }
                    foreach ($current_results as $cres) {
                        $cc = strtoupper(trim((string)($cres['course_code'] ?? '')));
                        if ($cc === $pcode && $cres['status'] !== 'unregistered') {
                            $retaken_in_curr = true;
                            break;
                        }
                    }
                    if ($retaken_in_curr) {
                        continue;
                    }

                    // Check prior attempts and prior carryover corrections
                    $p_att = $latest_prior_attempts[$sid][$pcid] ?? null;
                    if (!$p_att) {
                        foreach (($latest_prior_attempts[$sid] ?? []) as $lpa) {
                            if (strtoupper(trim((string)($lpa['course_code'] ?? ''))) === $pcode) {
                                $p_att = $lpa;
                                break;
                            }
                        }
                    }

                    $p_corr = $prior_carryover_corrections[$sid][$pcid] ?? ($prior_carryover_corrections[$sid][$pcode] ?? null);
                    if ($p_corr && (in_array(strtoupper(trim((string)($p_corr['grade'] ?? ''))), ['A', 'B', 'C', 'D', 'E'], true) || (isset($p_corr['total_score']) && (float)$p_corr['total_score'] >= 40))) {
                        continue; // Resolved via prior carryover correction
                    }

                    // Must have an actual prior attempt or prior carryover correction to be an unresolved prior debt
                    if ($p_att === null && $p_corr === null) {
                        continue;
                    }

                    $p_grade = strtoupper(trim((string)($p_corr['grade'] ?? ($p_att['grade'] ?? ''))));
                    $p_has_sc = ($p_corr && $p_corr['total_score'] !== null) || ($p_att && $p_att['total_score'] !== null);

                    if (in_array($p_grade, ['F', 'ABS'], true)) {
                        if (!in_array($pcode, $failed_carryover_codes, true)) {
                            $failed_carryover_codes[] = $pcode;
                        }
                    } elseif (!$p_has_sc && ($p_grade === 'NR' || $p_grade === '-')) {
                        if (!in_array($pcode, $pending_codes, true)) {
                            $pending_codes[] = $pcode;
                        }
                    }
                }
            }

            // Also check latest_attempts across career for any unregistered attempts that remain failed
            foreach ($latest_attempts as $cid => $att) {
                $code = strtoupper(trim((string)($att['course_code'] ?? '')));
                if ($code === '' || isset($passed_carryover_codes[$code]) || in_array($code, $failed_carryover_codes, true)) {
                    continue;
                }
                $att_c = $att['_effective_contact'] ?? $this->_resolve_row_contact($att['semester_name'] ?? '', $att['batch_level'] ?? '', $att['semester_id'] ?? '', $att['session_name'] ?? '', $att['session_id'] ?? '', $att['academic_session_id'] ?? '');
                if ($current_contact_num !== null && $att_c !== null && $att_c >= $current_contact_num) {
                    continue;
                }
                $is_registered_in_career = isset($career_unique_courses[$cid]);
                if (!$is_registered_in_career) {
                    foreach ($career_unique_courses as $cuc) {
                        if (strtoupper(trim((string)($cuc['course_code'] ?? ''))) === $code) {
                            $is_registered_in_career = true;
                            break;
                        }
                    }
                }
                if (!$is_registered_in_career) {
                    continue;
                }

                $correction = $carryover_corrections[$sid][$cid] ?? ($carryover_corrections[$sid][$code] ?? null);
                $grade = strtoupper(trim((string)($correction['grade'] ?? ($att['grade'] ?? ''))));
                if (in_array($grade, ['F', 'ABS'], true)) {
                    if (!in_array($code, $failed_carryover_codes, true)) {
                        $failed_carryover_codes[] = $code;
                    }
                }
            }

            // Clean up: remove passed courses from failures, and remove failed courses from pending
            $failed_carryover_codes = array_values(array_filter($failed_carryover_codes, function($c) use ($passed_carryover_codes) {
                return !isset($passed_carryover_codes[$c]);
            }));
            $pending_codes = array_values(array_filter($pending_codes, function($c) use ($failed_carryover_codes, $passed_carryover_codes) {
                return !in_array($c, $failed_carryover_codes, true) && !isset($passed_carryover_codes[$c]);
            }));

            sort($failed_carryover_codes);
            sort($pending_codes);

            $cgpa_num = (float)$cumulative_metrics['cgpa'];
            $standing_suffix = '';
            $academic_standing = 'NONE';
            $is_complete = empty($pending_codes);

            if ($cumulative_ccr > 0) {
                if (!$is_complete) {
                    $academic_standing = 'INCOMPLETE';
                } else {
                    $academic_standing = $this->academic_policy->standing($cgpa_num, $cumulative_ccr, true);
                    if ($academic_standing === 'WITHDRAWAL') {
                        $standing_suffix = '; (WITHDRAWAL)';
                    } elseif ($academic_standing === 'PROBATION') {
                        $standing_suffix = '; (PROBATION)';
                    }
                }
            }

            if ($cumulative_metrics['registered_credits'] == 0 && $current_metrics['registered_credits'] == 0) {
                $remark = "-";
            } else if (!empty($failed_carryover_codes) && !empty($pending_codes)) {
                $remark = "CO: " . implode(', ', $failed_carryover_codes) . "; PEND: " . implode(', ', $pending_codes) . $standing_suffix;
            } else if (!empty($failed_carryover_codes)) {
                $remark = "CO: " . implode(', ', $failed_carryover_codes) . $standing_suffix;
            } else if (!empty($pending_codes)) {
                $remark = "PEND: " . implode(', ', $pending_codes) . $standing_suffix;
            } else {
                $clean_suffix = trim(str_replace(';', '', $standing_suffix));
                $remark = "PASS" . ($clean_suffix !== '' ? ' ' . $clean_suffix : '');
            }

            // Progression metadata
            $entry_contact = ($is_de && empty($de_has_contact1_reg[$sid])) ? 2 : 1;
            $contacts_spent = ($current_contact_num !== null) ? max(1, ($current_contact_num - $entry_contact) + 1) : null;
            $normal_contacts = ($entry_contact === 2) ? 5 : 6;
            $max_contacts = $normal_contacts;

            $st['contacts_spent'] = $contacts_spent;
            $st['max_contacts']   = $max_contacts;
            $st['entry_contact']  = $entry_contact;
            $st['is_direct_entry'] = $is_de;

            $st['current_results'] = $current_results;
            $st['carryovers'] = $student_carryovers;
            $st['current'] = $current_metrics;
            $st['previous'] = $previous_metrics;
            $st['cumulative'] = $cumulative_metrics;
            $st['academic_standing'] = $academic_standing;
            $st['remark'] = $remark;
            $st['failed_carryover_codes'] = $failed_carryover_codes;
            $st['pending_codes'] = $pending_codes;
            
            $processed_students[] = $st;
        }
        
        // Strictly prune any course from $current_courses that has 0 registered students in $processed_students
        $active_current_courses = [];
        foreach ($current_courses as $c) {
            $cid = $c['course_id'];
            $has_any_reg = false;
            foreach ($processed_students as $pst) {
                if (isset($pst['current_results'][$cid]) && ($pst['current_results'][$cid]['status'] ?? 'unregistered') !== 'unregistered') {
                    $has_any_reg = true;
                    break;
                }
            }
            if ($has_any_reg) {
                $active_current_courses[] = $c;
            } else {
                foreach ($processed_students as &$pst_clean) {
                    unset($pst_clean['current_results'][$cid]);
                }
                unset($pst_clean);
            }
        }
        $current_courses = $active_current_courses;

        if ($is_contact_1) {
            $carryover_union = [];
        } else {
            // Ensure any prior course owed by any student in this cohort has a carryover grid column
            $current_course_codes_map = [];
            foreach ($current_courses as $cc) {
                $norm = strtoupper(trim((string)($cc['course_code'] ?? '')));
                if ($norm !== '') {
                    $current_course_codes_map[$norm] = true;
                }
            }

            foreach ($processed_students as $pst) {
                $owed_codes = array_merge(
                    $pst['failed_carryover_codes'] ?? [],
                    $pst['pending_codes'] ?? []
                );
                foreach ($owed_codes as $ocode) {
                    $norm_ocode = strtoupper(trim((string)$ocode));
                    if ($norm_ocode === '' || isset($current_course_codes_map[$norm_ocode])) {
                        continue;
                    }
                    if (!isset($carryover_union[$norm_ocode])) {
                        $c_details = null;
                        if (!empty($student_prev_unique_courses[$pst['student_id']])) {
                            foreach ($student_prev_unique_courses[$pst['student_id']] as $pcid => $pinfo) {
                                if (strtoupper(trim((string)($pinfo['course_code'] ?? ''))) === $norm_ocode) {
                                    $c_details = [
                                        'course_id' => $pcid,
                                        'course_code' => $pinfo['course_code'] ?? $norm_ocode,
                                        'course_title' => $pinfo['course_title'] ?? '',
                                        'credit_units' => (int)($pinfo['credit_units'] ?? 0)
                                    ];
                                    break;
                                }
                            }
                        }
                        if (!$c_details && isset($canonical_cid_by_code[$norm_ocode])) {
                            $cid = $canonical_cid_by_code[$norm_ocode];
                            $c_row = $this->db->select('id, code, title, credit_units')->where('id', $cid)->get('courses')->row_array();
                            if ($c_row) {
                                $c_details = [
                                    'course_id' => $c_row['id'],
                                    'course_code' => $c_row['code'],
                                    'course_title' => $c_row['title'],
                                    'credit_units' => (int)$c_row['credit_units']
                                ];
                            }
                        }
                        if (!$c_details) {
                            $c_row = $this->db->select('id, code, title, credit_units')->where('code', $norm_ocode)->get('courses')->row_array();
                            if ($c_row) {
                                $c_details = [
                                    'course_id' => $c_row['id'],
                                    'course_code' => $c_row['code'],
                                    'course_title' => $c_row['title'],
                                    'credit_units' => (int)$c_row['credit_units']
                                ];
                            }
                        }
                        if ($c_details) {
                            $carryover_union[$norm_ocode] = $c_details;
                        }
                    }
                }
            }

            // Sort carryover union by course code
            $carryover_union = array_values($carryover_union);
            usort($carryover_union, function($a, $b) {
                return strcmp($a['course_code'], $b['course_code']);
            });
        }

        // Finalize student carryover results mapping to union columns
        foreach ($processed_students as &$st) {
            $mapped_cos = [];
            foreach ($carryover_union as $co) {
                $cid = $co['course_id'];
                $co_code = strtoupper(trim((string)($co['course_code'] ?? '')));
                if (isset($st['carryovers'][$cid])) {
                    $mapped_cos[$cid] = $st['carryovers'][$cid]['display_value'];
                } else {
                    $found_val = '-';
                    if ($co_code !== '' && !empty($st['carryovers'])) {
                        foreach ($st['carryovers'] as $sc_info) {
                            if (strtoupper(trim((string)($sc_info['course_code'] ?? ''))) === $co_code) {
                                $found_val = $sc_info['display_value'];
                                break;
                            }
                        }
                    }
                    if ($found_val === '-') {
                        if (in_array($co_code, $st['failed_carryover_codes'] ?? [], true)) {
                            $found_val = 'NR';
                        } elseif (in_array($co_code, $st['pending_codes'] ?? [], true)) {
                            $found_val = 'NR';
                        }
                    }
                    $mapped_cos[$cid] = $found_val;
                }
                if ($co_code !== '') {
                    $mapped_cos[$co_code] = $mapped_cos[$cid];
                }
            }
            $st['carryover_results'] = (object)$mapped_cos;
            $st['current_results'] = (object)$st['current_results'];
            unset($st['carryovers']); // Clean up
            unset($st['failed_carryover_codes']);
            unset($st['pending_codes']);
        }
        unset($st);

        // Optional server-side filters
        if (!empty($options['entry_mode']) && $options['entry_mode'] !== 'all') {
            $is_de_target = ($options['entry_mode'] === 'direct_entry' || $options['entry_mode'] === 'de');
            $processed_students = array_values(array_filter($processed_students, function($st) use ($is_de_map, $is_de_target) {
                $is_de = !empty($is_de_map[$st['student_id']]);
                return $is_de_target ? $is_de : !$is_de;
            }));
        }

        if (!empty($options['standing']) && $options['standing'] !== 'all') {
            $target_standing = strtoupper($options['standing']);
            $processed_students = array_values(array_filter($processed_students, function($st) use ($target_standing) {
                return ($st['academic_standing'] ?? '') === $target_standing;
            }));
        }

        if (!empty($options['search'])) {
            $q = strtolower(trim($options['search']));
            $processed_students = array_values(array_filter($processed_students, function($st) use ($q) {
                return strpos(strtolower($st['full_name'] ?? ''), $q) !== false
                    || strpos(strtolower($st['matric_number'] ?? ''), $q) !== false;
            }));
        }

        // Build comprehensive summary block
        $context['summary'] = $this->_build_comprehensive_summary(
            $processed_students,
            $current_courses,
            $carryover_union,
            $context,
            $options
        );

        return [
            'context' => $context,
            'students' => $processed_students,
            'current_courses' => $current_courses,
            'carryover_courses' => $carryover_union
        ];
    }

    private $_semester_name_map = null;
    private $_session_contact_map = [];
    private $_current_contact_num = null;
    private $_current_session_year = null;

    private function _init_semester_map()
    {
        if ($this->_semester_name_map === null) {
            $this->_semester_name_map = [];
            if ($this->db->table_exists('semesters')) {
                $rows = $this->db->select('id, name')->get('semesters')->result_array();
                foreach ($rows as $r) {
                    $this->_semester_name_map[$r['id']] = $r['name'];
                    $this->_semester_name_map[$r['name']] = $r['name'];
                }
            }
        }
    }

    private function _extract_contact_number($label, $course_code = null)
    {
        return $this->period_resolver->extract_contact_number($label, $course_code);
    }

    /**
     * Extracts an explicit contact number ONLY from semester name, level label, or semester_id
     * without falling back to 100/200/300/400 numeric level codes unless explicitly formatted as Contact N.
     */
    private function _extract_explicit_contact($semester_name, $level_label, $semester_id)
    {
        $this->_init_semester_map();
        $sem_str = (string)$semester_name;
        if ($sem_str === '' && $semester_id !== '' && isset($this->_semester_name_map[$semester_id])) {
            $sem_str = $this->_semester_name_map[$semester_id];
        }
        if (preg_match('/contact\s*[-_:]?\s*([1-9]\d*)/i', $sem_str, $m)) {
            return (int)$m[1];
        }
        if (preg_match('/^c([1-9]\d*)$/i', trim($sem_str), $m)) {
            return (int)$m[1];
        }
        $lvl_str = trim((string)$level_label);
        if (preg_match('/contact\s*[-_:]?\s*([1-9]\d*)/i', $lvl_str, $m)) {
            return (int)$m[1];
        }
        if (preg_match('/^c([1-9]\d*)$/i', $lvl_str, $m)) {
            return (int)$m[1];
        }
        $sid_str = trim((string)$semester_id);
        if (preg_match('/contact\s*[-_:]?\s*([1-9]\d*)/i', $sid_str, $m)) {
            return (int)$m[1];
        }
        if (preg_match('/^c([1-9]\d*)$/i', $sid_str, $m)) {
            return (int)$m[1];
        }
        return null;
    }

    /**
     * Resolves the contact number of a row (registration, attempt, batch, or carryover correction),
     * prioritizing explicit "Contact N" labels and teaching session mapping before falling back
     * to Period_resolver (which maps 100/200/300/400 level labels).
     */
    private function _resolve_row_contact($semester_name, $level_label, $semester_id, $session_name = '', $session_id = '', $academic_session_id = '')
    {
        // 1. Explicit "Contact N" from semester_name, level_label, or semester_id
        $explicit = $this->_extract_explicit_contact($semester_name, $level_label, $semester_id);
        if ($explicit !== null) {
            return $explicit;
        }

        // 2. Teaching session mapping (canonical academic_session_id first, then session_name, then session_id)
        $acad_sid = trim((string)$academic_session_id);
        if ($acad_sid !== '' && isset($this->_session_contact_map[$acad_sid])) {
            return (int)$this->_session_contact_map[$acad_sid];
        }
        $sname = trim((string)$session_name);
        if ($sname !== '' && isset($this->_session_contact_map[$sname])) {
            return (int)$this->_session_contact_map[$sname];
        }
        $sid = trim((string)$session_id);
        if ($sid !== '' && isset($this->_session_contact_map[$sid])) {
            return (int)$this->_session_contact_map[$sid];
        }

        // 3. Relative session year difference from current broadsheet teaching session
        if ($this->_current_contact_num !== null && $this->_current_session_year !== null) {
            $sess_candidate = $sname !== '' ? $sname : ($acad_sid !== '' ? $acad_sid : $sid);
            if (preg_match('/(20\d{2})/', (string)$sess_candidate, $sym)) {
                $row_year = (int)$sym[1];
                if ($row_year > 0) {
                    $inferred = $this->_current_contact_num - ($this->_current_session_year - $row_year);
                    if ($inferred >= 1 && $inferred <= 8) {
                        return (int)$inferred;
                    }
                }
            }
        }

        // 4. Fallback to Period_resolver (handles 100->1, 200->2, 300->3, 400->4, etc.)
        return $this->period_resolver->resolve_row_contact_number($semester_name, $level_label, $semester_id);
    }

    private function _is_direct_entry_student($student)
    {
        $entry_mode = strtolower((string)($student['entry_mode'] ?? ''));
        $matric_number = (string)($student['matric_number'] ?? '');
        return strpos($entry_mode, 'direct') !== false
            || $entry_mode === 'de'
            || (bool)preg_match('/[A-Za-z]+2\/\d+\/\d+/', $matric_number);
    }

    /**
     * Matches a row to a teaching session without accidentally falling back to
     * its admission/cohort context.  A populated canonical value is authoritative.
     */
    private function _matches_teaching_session($row, array $target_session_ids)
    {
        $academic_session_id = trim((string)($row['academic_session_id'] ?? ''));
        if ($academic_session_id !== '') {
            return in_array($academic_session_id, $target_session_ids, true);
        }

        $legacy_session_id = $row['session_id'] ?? null;
        $session_name = $row['session_name'] ?? null;
        return in_array($legacy_session_id, $target_session_ids, true)
            || (!empty($session_name) && in_array($session_name, $target_session_ids, true));
    }

    private function _is_contact_1_period($sem_name, $level = null)
    {
        return $this->period_resolver->is_contact_1_period($sem_name, $level);
    }

    private function _is_period_before($sess_a, $sem_a, $sess_b, $sem_b, $course_code_a = null)
    {
        return $this->period_resolver->is_period_before($sess_a, $sem_a, $sess_b, $sem_b, $course_code_a);
    }

    private function _correction_to_attempt($correction)
    {
        return $this->academic_calculator->correction_to_attempt($correction);
    }

    private function _normalize_student_name($raw_name)
    {
        $name = str_replace(array("\xEF\xBF\xBD", "\u{FFFD}", "\xE2\x80\x99", "\xE2\x80\x98", '’', '‘', '`'), "'", trim((string)$raw_name));
        if ($name === '') {
            return '';
        }
        // 1. Split glued UPPERCASE + TitleCase transitions (e.g. NURAAbdurrahim -> NURA Abdurrahim)
        $name = preg_replace('/([A-Z\']{2,})([A-Z][a-z])/', '$1 $2', $name);
        // 2. Split glued all-caps compound names (e.g. AISHAABUBAKAR -> AISHA ABUBAKAR)
        $name = preg_replace('/^(AISHA|MUSA|NURA|UMAR|AMINU|HALIMA|KHADIJA|MURTALA|HASSANA|FATIMA|ZAINAB|HADIZA|MARYAM|HAUWA|BALKISU|USMAN|SANI|BELLO|IBRAHIM|MUHAMMAD|ABUBAKAR|ABDULLAHI)(ABUBAKAR|ABDULLAHI|ADAMU|ALIYU|IBRAHIM|MUHAMMAD|USMAN|SANI|BELLO|LAWAL|GARBA|MUSA|UMAR|AHMAD|AHMED|HASSAN|HUSSAINI|IDRIS|ISAH|KABIR|SALISU|SULEIMAN|YUSUF)$/i', '$1 $2', $name);

        $parts = preg_split('/\s+/', trim($name));
        $parts = array_values(array_filter($parts));
        if (empty($parts)) {
            return $name;
        }

        // Standardize to SURNAME Firstname Middlename
        $formatted = [];
        foreach ($parts as $idx => $part) {
            if ($idx === 0) {
                $formatted[] = strtoupper($part);
            } else {
                // Title-case each word while preserving apostrophes (e.g. Sama'ila)
                $lower = strtolower($part);
                $formatted[] = ucfirst($lower);
            }
        }
        return implode(' ', $formatted);
    }
    
    /**
     * Calculates GPA, CGPA, TCR, TCE, TQP
     * Same logic as Results_model calculate_cgpa
     */
    private function _calculate_metrics($attempts, $raw_sum = false)
    {
        $res = $this->academic_calculator->calculate($attempts, [], 'reported');
        return [
            'registered_credits' => $res['registered_credits'],
            'earned_credits'     => $res['earned_credits'],
            'quality_points'     => $res['quality_points'],
            'gpa'                => $res['gpa'],
            'cgpa'               => $res['cgpa'],
        ];
    }

    private function _format_score_grade($score, $grade)
    {
        return $this->academic_calculator->format_score_grade($score, $grade);
    }

    private function _batch_status_rank($status)
    {
        $s = strtolower(trim((string)$status));
        switch ($s) {
            case 'published': return 4;
            case 'approved':  return 3;
            case 'submitted': return 2;
            case 'draft':
            default:          return 1;
        }
    }

    private function _grade_to_grade_point($grade)
    {
        if (is_object($this->academic_policy) && method_exists($this->academic_policy, 'grade_point')) {
            return (float)$this->academic_policy->grade_point($grade);
        }
        $g = strtoupper(trim((string)$grade));
        if ($g === '' || in_array($g, ['ABS', 'NR', '-', '—', 'WITHHELD'], true)) {
            return 0.0;
        }
        if (is_object($this->academic_policy) && method_exists($this->academic_policy, 'grade_scale')) {
            $scale = $this->academic_policy->grade_scale();
            if (!empty($scale['ranges'])) {
                foreach ($scale['ranges'] as $r) {
                    if (strcasecmp($r['letter_grade'], $g) === 0) {
                        return (float)($r['grade_point'] ?? 0);
                    }
                }
            }
        }
        $map = [
            'A' => 5.0,
            'B' => 4.0,
            'C' => 3.0,
            'D' => 2.0,
            'E' => 1.0,
            'F' => 0.0
        ];
        return (float)($map[$g] ?? 0.0);
    }

    /**
     * Builds comprehensive academic summary:
     * - Top-level counters (backward compatible)
     * - Course-level statistics (sat, pass, fail, absent, pending, avg, grade distribution)
     * - GPA distribution bands
     * - Standing distribution
     * - Actionable lists (probation, withdrawal, pass, incomplete)
     */
    private function _build_comprehensive_summary($students, $current_courses, $carryover_courses, $context, $options = [])
    {
        $policy_settings = $this->academic_policy->get_all_settings();
        $bands = $this->academic_policy->get_classification_bands();

        $total_students = count($students);
        $total_passed = 0;
        $total_carryover = 0;
        $total_probation = 0;
        $total_withdrawn = 0;
        $total_incomplete = 0;
        $total_good_standing = 0;

        $gpa_band_counts = [];
        foreach ($bands as $idx => $band) {
            $gpa_band_counts[$idx] = [
                'band'       => $band['label'] ?? '',
                'label'      => ($band['label'] ?? '') . ' (' . number_format($band['min'], 2) . ' - ' . number_format($band['max'], 2) . ')',
                'min'        => (float)$band['min'],
                'max'        => (float)$band['max'],
                'min_gpa'    => (float)$band['min'],
                'max_gpa'    => (float)$band['max'],
                'count'      => 0,
                'percentage' => 0.0,
            ];
        }

        $probation_list = [];
        $withdrawal_list = [];
        $pass_list = [];
        $incomplete_list = [];

        foreach ($students as $st) {
            $cgpa = (float)($st['cumulative']['cgpa'] ?? 0);
            $standing = $st['academic_standing'] ?? 'NONE';
            $remark = $st['remark'] ?? '';

            if (strpos($remark, 'CO:') === 0 || strpos($remark, 'CO: ') !== false) {
                $total_carryover++;
            } elseif (strpos($remark, 'PASS') === 0) {
                $total_passed++;
            }

            if ($standing === 'PROBATION') {
                $total_probation++;
                $probation_list[] = [
                    'student_id'    => $st['student_id'],
                    'matric_number' => $st['matric_number'] ?? '',
                    'full_name'     => $st['full_name'] ?? '',
                    'cgpa'          => $st['cumulative']['cgpa'] ?? '0.00',
                    'remark'        => $remark
                ];
            } elseif ($standing === 'WITHDRAWAL') {
                $total_withdrawn++;
                $withdrawal_list[] = [
                    'student_id'    => $st['student_id'],
                    'matric_number' => $st['matric_number'] ?? '',
                    'full_name'     => $st['full_name'] ?? '',
                    'cgpa'          => $st['cumulative']['cgpa'] ?? '0.00',
                    'remark'        => $remark
                ];
            } elseif ($standing === 'INCOMPLETE') {
                $total_incomplete++;
                $incomplete_list[] = [
                    'student_id'    => $st['student_id'],
                    'matric_number' => $st['matric_number'] ?? '',
                    'full_name'     => $st['full_name'] ?? '',
                    'cgpa'          => $st['cumulative']['cgpa'] ?? '0.00',
                    'remark'        => $remark
                ];
            } elseif ($standing === 'GOOD_STANDING') {
                $total_good_standing++;
                if (strpos($remark, 'CO:') === false) {
                    $pass_list[] = [
                        'student_id'    => $st['student_id'],
                        'matric_number' => $st['matric_number'] ?? '',
                        'full_name'     => $st['full_name'] ?? '',
                        'cgpa'          => $st['cumulative']['cgpa'] ?? '0.00',
                        'class'         => $this->academic_policy->classify($cgpa)
                    ];
                }
            }

            if ($standing !== 'INCOMPLETE' && $cgpa > 0) {
                foreach ($bands as $idx => $band) {
                    if ($cgpa >= (float)$band['min'] && $cgpa <= (float)$band['max']) {
                        $gpa_band_counts[$idx]['count']++;
                        break;
                    }
                }
            }
        }

        $denom = max(1, $total_students);
        $evaluated_count = max(1, $total_students - $total_incomplete);
        foreach ($gpa_band_counts as &$gb) {
            $gb['percentage'] = round(($gb['count'] / $evaluated_count) * 100, 1);
        }
        unset($gb);

        // Course statistics calculation
        $course_stats = [];
        $all_eval_courses = array_merge($current_courses, $carryover_courses);

        foreach ($all_eval_courses as $c) {
            $cid = $c['course_id'];
            $is_co = !empty($c['is_carryover']);
            $reg_count = 0;
            $sat_count = 0;
            $abs_count = 0;
            $pending_count = 0;
            $pass_count = 0;
            $fail_count = 0;
            $score_sum = 0.0;
            $highest = null;
            $lowest = null;
            $grade_dist = ['A' => 0, 'B' => 0, 'C' => 0, 'D' => 0, 'E' => 0, 'F' => 0, 'ABS' => 0, 'NR' => 0];

            foreach ($students as $st) {
                $val = null;
                $direct_sc = null;
                $direct_grd = null;

                if ($is_co) {
                    if (isset($st['carryover_results']) && isset($st['carryover_results']->{$cid})) {
                        $val = $st['carryover_results']->{$cid};
                    }
                } else {
                    if (isset($st['current_results']) && isset($st['current_results']->{$cid})) {
                        $c_item = $st['current_results']->{$cid};
                        if (is_array($c_item)) {
                            $val = $c_item['display_value'] ?? null;
                            $direct_sc = (isset($c_item['total_score']) && is_numeric($c_item['total_score'])) ? (float)$c_item['total_score'] : null;
                            $direct_grd = !empty($c_item['grade']) ? strtoupper(trim((string)$c_item['grade'])) : null;
                        } elseif (is_object($c_item)) {
                            $val = $c_item->display_value ?? null;
                            $direct_sc = (isset($c_item->total_score) && is_numeric($c_item->total_score)) ? (float)$c_item->total_score : null;
                            $direct_grd = !empty($c_item->grade) ? strtoupper(trim((string)$c_item->grade)) : null;
                        }
                    }
                }

                if ($val === null || $val === '-' || $val === '—') {
                    continue;
                }

                $reg_count++;

                $trimmed_val = strtoupper(trim((string)$val));

                if ($trimmed_val === 'NR') {
                    $pending_count++;
                    $grade_dist['NR']++;
                    continue;
                }

                if ($trimmed_val === 'ABS') {
                    $abs_count++;
                    $fail_count++;
                    $grade_dist['ABS']++;
                    continue;
                }

                // Parse numeric score and letter grade from direct fields or formatted string (e.g. "67B", "67.5B", "26F", "67 B")
                $sc = $direct_sc;
                $grd = $direct_grd;

                if ($sc === null || $grd === null || $grd === '') {
                    if (preg_match('/^([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]+)?$/', $trimmed_val, $m)) {
                        if ($sc === null) {
                            $sc = (float)$m[1];
                        }
                        if (($grd === null || $grd === '') && !empty($m[2])) {
                            $grd = strtoupper(trim($m[2]));
                        }
                    } elseif (preg_match('/^([A-Za-z]+)$/', $trimmed_val, $m)) {
                        if ($grd === null || $grd === '') {
                            $grd = strtoupper(trim($m[1]));
                        }
                    }
                }

                if (($grd === null || $grd === '') && $sc !== null && is_object($this->academic_policy) && method_exists($this->academic_policy, 'score_to_grade')) {
                    $grd = $this->academic_policy->score_to_grade($sc);
                }
                $grd = strtoupper(trim((string)$grd));

                $sat_count++;
                if ($sc !== null) {
                    $score_sum += $sc;
                    if ($highest === null || $sc > $highest) $highest = $sc;
                    if ($lowest === null || $sc < $lowest) $lowest = $sc;
                }

                if ($grd !== '' && isset($grade_dist[$grd])) {
                    $grade_dist[$grd]++;
                }

                if (is_object($this->academic_policy) && method_exists($this->academic_policy, 'is_passing_grade')) {
                    $is_pass = $this->academic_policy->is_passing_grade($grd);
                } else {
                    $is_pass = in_array($grd, ['A', 'B', 'C', 'D', 'E'], true);
                }

                if ($is_pass) {
                    $pass_count++;
                } else {
                    $fail_count++;
                }
            }

            if ($reg_count === 0) {
                continue;
            }

            $pass_pct = $sat_count > 0 ? round(($pass_count / $sat_count) * 100, 1) : 0.0;
            $avg_score = $sat_count > 0 ? round($score_sum / $sat_count, 1) : null;

            $course_stats[] = [
                'course_id'          => $cid,
                'course_code'        => $c['course_code'],
                'course_title'       => $c['course_title'],
                'credit_units'       => (int)$c['credit_units'],
                'is_carryover'       => $is_co,
                'registered_count'   => $reg_count,
                'sat_count'          => $sat_count,
                'sat'                => $sat_count,
                'absent_count'       => $abs_count,
                'absent'             => $abs_count,
                'pending_count'      => $pending_count,
                'pending'            => $pending_count,
                'pass_count'         => $pass_count,
                'passed'             => $pass_count,
                'fail_count'         => $fail_count,
                'failed'             => $fail_count,
                'pass_percentage'    => $pass_pct,
                'average_score'      => $avg_score,
                'mean_score'         => $avg_score !== null ? $avg_score : '-',
                'highest_score'      => $highest,
                'lowest_score'       => $lowest,
                'grade_distribution' => $grade_dist,
            ];
        }

        if (!$this->load->is_loaded('reconciliation_model')) {
            $this->load->model('Reconciliation_model');
        }
        $sess_input = $context['session']['id'] ?? ($context['session']['name'] ?? '');
        $sem_input = $context['semester']['id'] ?? ($context['semester']['name'] ?? '');
        $prog_input = $context['programme']['id'] ?? '';
        $rec_report = $this->Reconciliation_model->check($sess_input, $sem_input, $prog_input, $context['level'] ?? null);

        return [
            // Backward-compatible counters
            'total_students'      => $total_students,
            'total_passed'        => $total_passed,
            'total_carryover'     => $total_carryover,
            'total_probation'     => $total_probation,
            'total_withdrawn'     => $total_withdrawn,
            'total_incomplete'    => $total_incomplete,
            'total_good_standing' => $total_good_standing,

            // Rich statistical blocks
            'standing_distribution' => [
                'good_standing' => ['count' => $total_good_standing, 'percentage' => round(($total_good_standing / $denom) * 100, 1)],
                'probation'     => ['count' => $total_probation,     'percentage' => round(($total_probation / $denom) * 100, 1)],
                'withdrawal'    => ['count' => $total_withdrawn,     'percentage' => round(($total_withdrawn / $denom) * 100, 1)],
                'incomplete'    => ['count' => $total_incomplete,    'percentage' => round(($total_incomplete / $denom) * 100, 1)],
            ],
            'gpa_distribution'   => array_values($gpa_band_counts),
            'course_statistics'  => $course_stats,
            'lists' => [
                'probation_list'  => $probation_list,
                'withdrawal_list' => $withdrawal_list,
                'pass_list'       => $pass_list,
                'incomplete_list' => $incomplete_list,
            ],
            'basis'              => $options['basis'] ?? 'published',
            'reconciliation'      => $rec_report['summary'],
            'policy'             => [
                'cgpa_denominator'     => $policy_settings['cgpa_denominator'] ?? 'reported',
                'withdrawal_below_cgpa'=> $policy_settings['withdrawal_below_cgpa'] ?? '1.00',
                'probation_upper_cgpa' => $policy_settings['probation_upper_cgpa'] ?? '1.50',
                'abs_policy'           => $policy_settings['abs_policy'] ?? 'fail',
            ]
        ];
    }
}
