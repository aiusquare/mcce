<?php
defined('BASEPATH') OR exit('No direct script access allowed');

/**
 * Snapshot_model
 * Implements immutable broadsheet snapshot storage, canonical scope hashing,
 * previous-contact snapshot progression chaining, multi-tier governance,
 * source invalidation traversal, and audit logging.
 */
class Snapshot_model extends CI_Model {

    public function __construct()
    {
        parent::__construct();
        $this->load->database();
        if (!$this->load->is_loaded('broadsheet_model')) {
            $this->load->model('Broadsheet_model');
        }
        if (!$this->load->is_loaded('period_resolver')) {
            $this->load->library('Period_resolver');
        }
    }

    /**
     * Extracts canonical academic scope and calculates deterministic SHA-256 hash.
     * Only fields that change academic content are included (presentation filters excluded).
     *
     * @param array $raw_scope
     * @return array [canonical => array, scope_hash => string, contact_number => int|null]
     */
    public function canonicalize_scope(array $raw_scope)
    {
        $session_id   = trim((string)($raw_scope['session_id'] ?? ''));
        $semester_id  = trim((string)($raw_scope['semester_id'] ?? ''));
        $programme_id = trim((string)($raw_scope['programme_id'] ?? ''));
        $level        = trim((string)($raw_scope['level'] ?? ''));
        if ($level === '' || strtolower($level) === 'all') {
            $level = null;
        }

        $raw_basis = strtolower(trim((string)($raw_scope['basis'] ?? 'published')));
        $basis = in_array($raw_basis, ['working', 'draft', 'preview'], true) ? 'working' : 'published';

        $raw_cohort = trim((string)($raw_scope['cohort'] ?? 'all'));
        $cohort = ($raw_cohort === '' || strtolower($raw_cohort) === 'all') ? 'all' : $raw_cohort;

        $raw_entry = strtolower(trim((string)($raw_scope['entry_mode'] ?? 'all')));
        if (in_array($raw_entry, ['direct_entry', 'de', 'direct'], true)) {
            $entry_mode = 'direct_entry';
        } elseif (in_array($raw_entry, ['fresh', 'utme'], true)) {
            $entry_mode = 'fresh';
        } else {
            $entry_mode = 'all';
        }

        $contact_number = $this->extract_contact_number($semester_id, $level);

        $canonical_fields = [
            'basis'          => $basis,
            'cohort'         => $cohort,
            'contact_number' => $contact_number,
            'entry_mode'     => $entry_mode,
            'level'          => $level ?: '',
            'programme_id'   => $programme_id,
            'semester_id'    => $semester_id,
            'session_id'     => $session_id,
        ];
        ksort($canonical_fields);

        $canonical_json = json_encode($canonical_fields);
        $scope_hash = hash('sha256', $canonical_json);

        return [
            'canonical'      => $canonical_fields,
            'scope_hash'     => $scope_hash,
            'contact_number' => $contact_number,
            'raw'            => $raw_scope
        ];
    }

    /**
     * Resolves contact number integer from semester name or level.
     *
     * @param string $semester
     * @param string|null $level
     * @return int|null
     */
    public function extract_contact_number($semester = '', $level = null)
    {
        if (isset($this->period_resolver)) {
            $sem_val = (string)$semester;
            $c_num = $this->period_resolver->resolve_row_contact_number($sem_val, $level, $sem_val);
            if ($c_num !== null) {
                return (int)$c_num;
            }
        }

        $target = trim($semester . ' ' . (string)$level);
        if (preg_match('/Contact\s*([1-6])/i', $target, $m)) {
            return (int)$m[1];
        }
        if (preg_match('/\b([1-6])00\b/', $target, $m)) {
            return (int)$m[1];
        }
        return null;
    }

    /**
     * Resolves an existing fresh snapshot or generates and persists a new version.
     *
     * @param array $scope
     * @param array $options
     * @return array [source => 'snapshot', snapshot => array, payload => array]
     */
    public function resolve_or_create(array $scope, array $options = [])
    {
        $canonical_data = $this->canonicalize_scope($scope);
        $c_scope        = $canonical_data['canonical'];
        $scope_hash     = $canonical_data['scope_hash'];
        $contact_number = $canonical_data['contact_number'];

        $user_id       = $options['user_id'] ?? null;
        $force_refresh = !empty($options['force_refresh']) || !empty($options['refresh']);

        // 1. Check for existing snapshot by scope_hash
        $this->db->where('scope_hash', $scope_hash);
        $this->db->order_by('version', 'DESC');
        $latest = $this->db->get('broadsheet_snapshots', 1)->row_array();

        // Check if latest snapshot is fresh and usable
        $is_stale = $latest && (!empty($latest['stale_at']) || ($latest['rebuild_status'] ?? '') === 'failed');
        $is_fresh = $latest && !$is_stale && $latest['status'] !== 'superseded' && ($latest['rebuild_status'] ?? 'ready') === 'ready';

        if ($is_fresh && !$force_refresh) {
            $payload = json_decode($latest['payload_json'], true);
            $meta = $this->_format_snapshot_meta($latest);
            $payload['source'] = 'snapshot';
            $payload['snapshot'] = $meta;
            if (!isset($payload['context']['snapshot'])) {
                $payload['context']['snapshot'] = $meta;
            }
            return [
                'source'        => 'snapshot',
                'is_new'        => false,
                'snapshot'      => $meta,
                'snapshot_meta' => $meta,
                'payload'       => $payload,
                'broadsheet'    => $payload
            ];
        }

        // 2. Prepare next version & superseding link
        $version = 1;
        $supersedes_id = null;
        $is_update_existing_draft = false;

        if ($latest) {
            if ($latest['status'] === 'approved') {
                // Approved snapshots are strictly immutable; supersede with new version
                $version = (int)$latest['version'] + 1;
                $supersedes_id = $latest['id'];
            } else {
                // Draft snapshots can be refreshed in place or bumped
                $is_update_existing_draft = true;
                $version = (int)$latest['version'];
                $supersedes_id = $latest['supersedes_snapshot_id'] ?? null;
            }
        }

        // 3. Resolve Previous Snapshot (Contact N-1) for progression continuity
        $previous_snapshot_id = null;
        $prev_metrics_map = [];

        if ($contact_number !== null && $contact_number > 1) {
            $target_prev_c = $contact_number - 1;
            $prev_snap = $this->resolve_previous_snapshot($c_scope, $target_prev_c);
            if ($prev_snap) {
                $previous_snapshot_id = $prev_snap['id'];
                $prev_metrics_map = $this->get_student_metrics_map($prev_snap['id']);
            }
        }

        // 4. Generate Broadsheet payload
        $gen_options = array_merge($options, [
            'basis'                      => $c_scope['basis'],
            'cohort'                     => $c_scope['cohort'],
            'entry_mode'                 => $c_scope['entry_mode'],
            'previous_snapshot_metrics'  => $prev_metrics_map,
            'previous_snapshot_id'       => $previous_snapshot_id
        ]);

        $payload = $this->Broadsheet_model->generate(
            $c_scope['session_id'],
            $c_scope['semester_id'],
            $c_scope['programme_id'],
            $c_scope['level'],
            $gen_options
        );

        // 5. Enforce Previous Metrics Continuity from authoritative previous snapshot
        if (!empty($prev_metrics_map) && !empty($payload['students'])) {
            foreach ($payload['students'] as &$st) {
                $sid = $st['student_id'] ?? null;
                if ($sid && isset($prev_metrics_map[$sid])) {
                    $pm = $prev_metrics_map[$sid];
                    $prev_ccr = (int)($pm['cumulative_registered_credits'] ?? $pm['registered_credits'] ?? 0);
                    $prev_cce = (int)($pm['cumulative_earned_credits'] ?? $pm['earned_credits'] ?? 0);
                    $prev_cgp = (float)($pm['cumulative_quality_points'] ?? $pm['quality_points'] ?? 0.0);
                    $prev_cgpa = number_format((float)($pm['cumulative_cgpa'] ?? $pm['cgpa'] ?? 0.0), 2, '.', '');

                    $st['previous']['registered_credits'] = $prev_ccr;
                    $st['previous']['earned_credits']     = $prev_cce;
                    $st['previous']['quality_points']     = $prev_cgp;
                    $st['previous']['gpa']                = $prev_cgpa;
                    $st['previous']['cgpa']               = $prev_cgpa;

                    // Recalculate Cumulative Additively: Previous + Current = Cumulative
                    $curr_tcr = (int)($st['current']['registered_credits'] ?? 0);
                    $curr_tce = (int)($st['current']['earned_credits'] ?? 0);
                    $curr_tqp = (float)($st['current']['quality_points'] ?? 0.0);

                    $cum_ccr = $prev_ccr + $curr_tcr;
                    $cum_cce = $prev_cce + $curr_tce;
                    $cum_cgp = $prev_cgp + $curr_tqp;
                    $cum_cgpa = ($cum_ccr > 0) ? round($cum_cgp / $cum_ccr, 2) : 0.00;

                    $st['cumulative']['registered_credits'] = $cum_ccr;
                    $st['cumulative']['earned_credits']     = $cum_cce;
                    $st['cumulative']['quality_points']     = $cum_cgp;
                    $st['cumulative']['gpa']                = number_format($cum_cgpa, 2, '.', '');
                    $st['cumulative']['cgpa']               = number_format($cum_cgpa, 2, '.', '');
                }
            }
            unset($st);
        }

        // Attach snapshot context to payload
        $snapshot_id = $is_update_existing_draft ? $latest['id'] : $this->_generate_uuid();
        $verification_code = $is_update_existing_draft
            ? ($latest['verification_code'] ?? $this->_generate_verification_code())
            : $this->_generate_verification_code();
        $now = date('Y-m-d H:i:s');

        $meta = [
            'id'                   => $snapshot_id,
            'version'              => $version,
            'scope_hash'           => $scope_hash,
            'contact_number'       => $contact_number,
            'previous_snapshot_id' => $previous_snapshot_id,
            'supersedes_snapshot_id' => $supersedes_id,
            'verification_code'    => $verification_code,
            'status'               => 'draft',
            'is_stale'             => false,
            'rebuild_status'       => 'ready',
            'generated_by'         => $user_id,
            'generated_at'         => $now,
            'source_watermark'     => $this->get_source_watermark($c_scope['session_id'], $c_scope['semester_id'], $c_scope['programme_id'])
        ];

        $payload['context']['snapshot'] = $meta;
        $payload_json = json_encode($payload);
        $payload_hash = hash('sha256', $payload_json);
        $meta['payload_hash'] = $payload_hash;

        // 6. Persist to Database
        $this->db->trans_start();

        // If creating a new version that supersedes, mark old active snapshots for this scope as superseded
        if (!$is_update_existing_draft && $supersedes_id) {
            $this->db->where('scope_hash', $scope_hash);
            $this->db->where('status !=', 'superseded');
            $this->db->update('broadsheet_snapshots', ['status' => 'superseded', 'updated_at' => $now]);
        }

        $snapshot_record = [
            'session_id'             => $c_scope['session_id'],
            'semester_id'            => $c_scope['semester_id'],
            'programme_id'           => $c_scope['programme_id'],
            'level'                  => $c_scope['level'],
            'entry_mode'             => $c_scope['entry_mode'],
            'cohort'                 => $c_scope['cohort'],
            'basis'                  => $c_scope['basis'],
            'version'                => $version,
            'scope_hash'             => $scope_hash,
            'contact_number'         => $contact_number,
            'previous_snapshot_id'   => $previous_snapshot_id,
            'supersedes_snapshot_id' => $supersedes_id,
            'status'                 => 'draft',
            'payload_json'           => $payload_json,
            'payload_hash'           => $payload_hash,
            'verification_code'      => $verification_code,
            'source_watermark'       => $meta['source_watermark'],
            'stale_at'               => null,
            'stale_reason'           => null,
            'rebuild_status'         => 'ready',
            'updated_at'             => $now
        ];

        if ($is_update_existing_draft) {
            $this->db->where('id', $snapshot_id)->update('broadsheet_snapshots', $snapshot_record);
        } else {
            $snapshot_record['id']           = $snapshot_id;
            $snapshot_record['generated_by'] = $user_id;
            $snapshot_record['generated_at'] = $now;
            $this->db->insert('broadsheet_snapshots', $snapshot_record);
        }

        // 7. Persist Normalized Student Metrics to broadsheet_snapshot_students
        $this->_persist_snapshot_students($snapshot_id, $payload['students'] ?? []);

        // 8. Resolve any pending invalidations for this scope/snapshot
        if ($this->db->table_exists('broadsheet_snapshot_invalidations')) {
            $this->db->where('snapshot_id', $snapshot_id)
                ->where('status', 'pending')
                ->update('broadsheet_snapshot_invalidations', [
                    'status'       => 'processed',
                    'processed_at' => $now
                ]);
        }

        // 9. Log audit
        $this->log_audit($snapshot_id, $is_update_existing_draft ? 'refresh' : 'generate', $user_id, [
            'version'              => $version,
            'basis'                => $c_scope['basis'],
            'scope_hash'           => $scope_hash,
            'previous_snapshot_id' => $previous_snapshot_id,
            'hash'                 => $payload_hash
        ]);

        $this->db->trans_complete();

        $payload['source'] = 'snapshot';
        $payload['snapshot'] = $meta;

        return [
            'source'        => $is_update_existing_draft ? 'refreshed' : 'generated',
            'is_new'        => true,
            'snapshot'      => $meta,
            'snapshot_meta' => $meta,
            'payload'       => $payload,
            'broadsheet'    => $payload
        ];
    }

    /**
     * Resolves the authoritative preceding contact snapshot for Contact N.
     *
     * @param array $c_scope
     * @param int $target_prev_contact
     * @return array|null
     */
    public function resolve_previous_snapshot(array $c_scope, $target_prev_contact)
    {
        if ($target_prev_contact < 1) {
            return null;
        }

        $prog_id = (string)($c_scope['programme_id'] ?? '');
        $prog_ids = array_values(array_filter(array_unique([
            $prog_id,
            strlen($prog_id) > 7 ? substr($prog_id, 0, 7) : null
        ])));

        $this->db->select('*');
        $this->db->from('broadsheet_snapshots');
        $this->db->where_in('programme_id', $prog_ids);
        $this->db->where('contact_number', (int)$target_prev_contact);

        if (!empty($c_scope['cohort']) && $c_scope['cohort'] !== 'all') {
            $this->db->group_start();
            $this->db->where('cohort', $c_scope['cohort']);
            $this->db->or_where('cohort', 'all');
            $this->db->group_end();
        }

        $this->db->where('status !=', 'superseded');

        // Prefer approved snapshot over draft; prefer highest version; prefer matching basis
        $basis_val = addslashes((string)($c_scope['basis'] ?? 'published'));
        $this->db->order_by("(CASE WHEN status = 'approved' THEN 3 WHEN status = 'draft' THEN 2 ELSE 1 END)", 'DESC', false);
        $this->db->order_by("(CASE WHEN basis = '{$basis_val}' THEN 2 ELSE 1 END)", 'DESC', false);
        $this->db->order_by('version', 'DESC');

        return $this->db->get()->row_array();
    }

    /**
     * Loads student metrics map from broadsheet_snapshot_students or payload JSON.
     *
     * @param string $snapshot_id
     * @return array [student_id => metric_row]
     */
    public function get_student_metrics_map($snapshot_id)
    {
        $map = [];
        if ($this->db->table_exists('broadsheet_snapshot_students')) {
            $rows = $this->db->get_where('broadsheet_snapshot_students', ['snapshot_id' => $snapshot_id])->result_array();
            if (!empty($rows)) {
                foreach ($rows as $r) {
                    $map[$r['student_id']] = $r;
                }
                return $map;
            }
        }

        // Fallback: extract from stored payload JSON
        $snap = $this->db->get_where('broadsheet_snapshots', ['id' => $snapshot_id])->row_array();
        if ($snap && !empty($snap['payload_json'])) {
            $data = json_decode($snap['payload_json'], true);
            foreach ($data['students'] ?? [] as $st) {
                $sid = $st['student_id'] ?? null;
                if ($sid) {
                    $map[$sid] = [
                        'student_id'                    => $sid,
                        'cumulative_registered_credits' => (int)($st['cumulative']['registered_credits'] ?? 0),
                        'cumulative_earned_credits'     => (int)($st['cumulative']['earned_credits'] ?? 0),
                        'cumulative_quality_points'     => (float)($st['cumulative']['quality_points'] ?? 0.0),
                        'cumulative_cgpa'               => (string)($st['cumulative']['cgpa'] ?? '0.00'),
                        'academic_standing'             => $st['academic_standing'] ?? '',
                        'remark'                        => $st['remark'] ?? '',
                        'is_complete'                   => ($st['is_complete'] !== false) ? 1 : 0
                    ];
                }
            }
        }
        return $map;
    }

    /**
     * Persists student metrics into normalized broadsheet_snapshot_students table.
     */
    private function _persist_snapshot_students($snapshot_id, array $students)
    {
        if (!$this->db->table_exists('broadsheet_snapshot_students') || empty($students)) {
            return;
        }

        $this->db->where('snapshot_id', $snapshot_id)->delete('broadsheet_snapshot_students');

        $now = date('Y-m-d H:i:s');
        $batch_rows = [];
        foreach ($students as $st) {
            $sid = $st['student_id'] ?? null;
            if (!$sid) continue;

            $batch_rows[] = [
                'id'                            => $this->_generate_uuid(),
                'snapshot_id'                   => $snapshot_id,
                'student_id'                    => $sid,
                'matric_number_snapshot'        => $st['matric_number'] ?? ($st['admission_number'] ?? null),
                'full_name_snapshot'            => $st['full_name'] ?? null,
                'current_registered_credits'    => (int)($st['current']['registered_credits'] ?? 0),
                'current_earned_credits'        => (int)($st['current']['earned_credits'] ?? 0),
                'current_quality_points'        => (float)($st['current']['quality_points'] ?? 0.0),
                'current_gpa'                   => (float)($st['current']['gpa'] ?? 0.0),
                'previous_registered_credits'   => (int)($st['previous']['registered_credits'] ?? 0),
                'previous_earned_credits'       => (int)($st['previous']['earned_credits'] ?? 0),
                'previous_quality_points'       => (float)($st['previous']['quality_points'] ?? 0.0),
                'previous_cgpa'                 => (float)($st['previous']['cgpa'] ?? 0.0),
                'cumulative_registered_credits' => (int)($st['cumulative']['registered_credits'] ?? 0),
                'cumulative_earned_credits'     => (int)($st['cumulative']['earned_credits'] ?? 0),
                'cumulative_quality_points'     => (float)($st['cumulative']['quality_points'] ?? 0.0),
                'cumulative_cgpa'               => (float)($st['cumulative']['cgpa'] ?? 0.0),
                'academic_standing'             => $st['academic_standing'] ?? null,
                'remark'                        => $st['remark'] ?? null,
                'is_complete'                   => ($st['is_complete'] !== false) ? 1 : 0,
                'created_at'                    => $now
            ];
        }

        if (!empty($batch_rows)) {
            $chunks = array_chunk($batch_rows, 100);
            foreach ($chunks as $chunk) {
                $this->db->insert_batch('broadsheet_snapshot_students', $chunk);
            }
        }
    }

    /**
     * Marks affected snapshots and all forward dependent snapshots stale when results change.
     *
     * @param array $change_context [session_id, semester_id, programme_id, course_id, batch_id, source_type, reason, user_id]
     * @return int Number of snapshots invalidated
     */
    public function invalidate_for_result_change($change_context, $reason = null, $comment = null)
    {
        if (is_array($change_context)) {
            $session_id   = $change_context['session_id'] ?? null;
            $semester_id  = $change_context['semester_id'] ?? null;
            $programme_id = $change_context['programme_id'] ?? null;
            $level        = $change_context['level'] ?? null;
            $source_type  = $change_context['source_type'] ?? 'result_change';
            $source_id    = $change_context['source_id'] ?? ($change_context['batch_id'] ?? null);
            $reason       = $reason ?: ($change_context['reason'] ?? 'Underlying examination results or carryovers were modified.');
            $comment      = $comment ?: ($change_context['comment'] ?? null);
            $user_id      = $change_context['user_id'] ?? null;
        } else {
            return 0;
        }

        $now = date('Y-m-d H:i:s');

        // Find direct snapshots matching the scope
        $this->db->select('id, previous_snapshot_id, status');
        $this->db->from('broadsheet_snapshots');
        $this->db->where('status !=', 'superseded');
        $this->db->where('stale_at IS NULL', null, false);

        if (!empty($programme_id) && $programme_id !== 'all') {
            $this->db->where('programme_id', $programme_id);
        }
        if (!empty($session_id)) {
            $this->db->where('session_id', $session_id);
        }
        if (!empty($semester_id)) {
            $this->db->where('semester_id', $semester_id);
        }

        $direct_snapshots = $this->db->get()->result_array();
        if (empty($direct_snapshots)) {
            return 0;
        }

        $direct_ids = array_column($direct_snapshots, 'id');
        $dependent_ids = [];
        $visited = array_fill_keys($direct_ids, true);
        $queue = $direct_ids;

        // Traverse forward dependency chains: any snapshot referencing an invalidated snapshot via previous_snapshot_id becomes stale!
        while (!empty($queue)) {
            $curr_id = array_shift($queue);
            $this->db->select('id');
            $this->db->from('broadsheet_snapshots');
            $this->db->where('previous_snapshot_id', $curr_id);
            $this->db->where('status !=', 'superseded');
            $this->db->where('stale_at IS NULL', null, false);
            $dependent = $this->db->get()->result_array();

            foreach ($dependent as $dep) {
                $dep_id = $dep['id'];
                if (!isset($visited[$dep_id])) {
                    $visited[$dep_id] = true;
                    $dependent_ids[] = $dep_id;
                    $queue[] = $dep_id;
                }
            }
        }

        // Apply invalidation to direct snapshots
        if (!empty($direct_ids)) {
            $this->db->where_in('id', $direct_ids)->update('broadsheet_snapshots', [
                'stale_at'       => $now,
                'stale_reason'   => $reason,
                'rebuild_status' => 'pending',
                'updated_at'     => $now
            ]);
        }

        // Apply invalidation to forward dependent snapshots
        if (!empty($dependent_ids)) {
            $this->db->where_in('id', $dependent_ids)->update('broadsheet_snapshots', [
                'stale_at'       => $now,
                'stale_reason'   => 'preceding_snapshot_invalidated',
                'rebuild_status' => 'pending',
                'updated_at'     => $now
            ]);
        }

        $all_stale_ids = array_merge($direct_ids, $dependent_ids);

        if (!empty($all_stale_ids)) {
            if ($this->db->table_exists('broadsheet_snapshot_invalidations')) {
                $inval_rows = [];
                foreach ($all_stale_ids as $sid) {
                    $is_dep = in_array($sid, $dependent_ids, true);
                    $inval_rows[] = [
                        'id'          => $this->_generate_uuid(),
                        'snapshot_id' => $sid,
                        'source_type' => $source_type,
                        'source_id'   => $source_id,
                        'reason'      => $is_dep ? 'preceding_snapshot_invalidated' : $reason,
                        'status'      => 'pending',
                        'created_by'  => $user_id,
                        'created_at'  => $now
                    ];
                }
                $this->db->insert_batch('broadsheet_snapshot_invalidations', $inval_rows);
            }

            foreach ($all_stale_ids as $sid) {
                $is_dep = in_array($sid, $dependent_ids, true);
                $this->log_audit($sid, 'invalidate', $user_id, [
                    'reason'      => $is_dep ? 'preceding_snapshot_invalidated' : $reason,
                    'source_type' => $source_type,
                    'source_id'   => $source_id,
                    'comment'     => $comment
                ]);
            }
        }

        return count($all_stale_ids);
    }

    /**
     * Resolves maximum updated_at timestamp across relevant results/registrations tables.
     */
    public function get_source_watermark($session_id, $semester_id, $programme_id)
    {
        $dates = [];

        // Check result_attempts & batches
        $sql1 = "
            SELECT MAX(GREATEST(COALESCE(ra.updated_at, ra.created_at), COALESCE(rb.updated_at, rb.created_at))) as max_dt
            FROM result_batches rb
            LEFT JOIN result_attempts ra ON ra.batch_id = rb.id
            WHERE (rb.session_id = ? OR rb.academic_session_id = ?)
        ";
        $r1 = $this->db->query($sql1, [$session_id, $session_id])->row_array();
        if (!empty($r1['max_dt'])) $dates[] = $r1['max_dt'];

        // Check carryover_corrections
        if ($this->db->table_exists('carryover_corrections')) {
            $sql2 = "SELECT MAX(COALESCE(updated_at, created_at)) as max_dt FROM carryover_corrections WHERE session_id = ?";
            $r2 = $this->db->query($sql2, [$session_id])->row_array();
            if (!empty($r2['max_dt'])) $dates[] = $r2['max_dt'];
        }

        return !empty($dates) ? max($dates) : date('Y-m-d H:i:s');
    }

    /**
     * Backward-compatible create_snapshot wrapper.
     */
    public function create_snapshot($session_id, $semester_id, $programme_id, $level = null, $user_id = null, $basis = 'published', $options = [])
    {
        $scope = array_merge($options, [
            'session_id'   => $session_id,
            'semester_id'  => $semester_id,
            'programme_id' => $programme_id,
            'level'        => $level,
            'basis'        => $basis
        ]);
        $options['force_refresh'] = true;
        $options['user_id'] = $user_id;

        $res = $this->resolve_or_create($scope, $options);
        return $res ? $res['snapshot'] : false;
    }

    public function get_snapshot_by_id($snapshot_id)
    {
        $snapshot = $this->db->get_where('broadsheet_snapshots', ['id' => $snapshot_id])->row_array();
        if ($snapshot) {
            $snapshot['payload'] = json_decode($snapshot['payload_json'], true);
            $snapshot['approvals'] = $this->get_approvals($snapshot_id);
            $snapshot['is_stale'] = !empty($snapshot['stale_at']);
        }
        return $snapshot;
    }

    public function get_snapshot_by_verification_code($code)
    {
        $snapshot = $this->db->get_where('broadsheet_snapshots', ['verification_code' => $code])->row_array();
        if ($snapshot) {
            $snapshot['payload'] = json_decode($snapshot['payload_json'], true);
            $snapshot['approvals'] = $this->get_approvals($snapshot['id']);
            $snapshot['is_stale'] = !empty($snapshot['stale_at']);
        }
        return $snapshot;
    }

    public function list_snapshots($session_id, $semester_id, $programme_id, $level = null, $filters = [])
    {
        $this->db->select('id, session_id, semester_id, programme_id, level, contact_number, cohort, entry_mode, basis, version, status, scope_hash, previous_snapshot_id, supersedes_snapshot_id, payload_hash, verification_code, generated_by, generated_at, approved_at, locked_at, stale_at, stale_reason, rebuild_status');
        $this->db->from('broadsheet_snapshots');
        $this->db->where('session_id', $session_id);
        $this->db->where('semester_id', $semester_id);
        $this->db->where('programme_id', $programme_id);
        if ($level) {
            $this->db->where('level', $level);
        }
        if (!empty($filters['cohort']) && $filters['cohort'] !== 'all') {
            $this->db->where('cohort', $filters['cohort']);
        }
        if (!empty($filters['basis'])) {
            $this->db->where('basis', $filters['basis']);
        }
        $this->db->order_by('version', 'DESC');
        $snapshots = $this->db->get()->result_array();

        foreach ($snapshots as &$s) {
            $s['is_stale'] = !empty($s['stale_at']);
            $s['approvals'] = $this->get_approvals($s['id']);
        }
        unset($s);

        return $snapshots;
    }

    /**
     * Signs off an immutable snapshot with strict academic governance checks.
     */
    public function sign_off($snapshot_id, $role_key, $user_id, $action = 'approve', $comment = null)
    {
        $action = strtolower(trim((string)$action));
        if (!in_array($action, ['approve', 'reject'], true)) {
            return ['status' => false, 'message' => "Invalid action '{$action}'. Allowed actions: approve, reject."];
        }

        $role_key = strtolower(trim((string)$role_key));
        if ($role_key === 'course coordinator') $role_key = 'coordinator';
        if ($role_key === 'head of department') $role_key = 'hod';
        if ($role_key === 'dean / director') $role_key = 'dean';
        if ($role_key === 'academic board / senate' || $role_key === 'academic board') $role_key = 'academic_board';

        $this->db->trans_start();

        $snapshot = $this->db->get_where('broadsheet_snapshots', ['id' => $snapshot_id])->row_array();
        if (!$snapshot) {
            $this->db->trans_rollback();
            return ['status' => false, 'message' => 'Snapshot not found.'];
        }

        // Section 9: Governance & Pre-approval validation checks
        if ($action === 'approve') {
            // Rule 1: Stale snapshots cannot be approved
            if (!empty($snapshot['stale_at'])) {
                $this->db->trans_rollback();
                return [
                    'status'  => false,
                    'message' => "Approval blocked: Snapshot is stale ({$snapshot['stale_reason']}). Refresh the broadsheet first."
                ];
            }

            // Rule 2: Cannot approve a superseded snapshot
            if ($snapshot['status'] === 'superseded') {
                $this->db->trans_rollback();
                return [
                    'status'  => false,
                    'message' => 'Approval blocked: This snapshot version has been superseded by a later version.'
                ];
            }

            // Rule 3: Payload hash integrity
            $calc_hash = hash('sha256', $snapshot['payload_json']);
            if ($calc_hash !== $snapshot['payload_hash']) {
                $this->db->trans_rollback();
                return [
                    'status'  => false,
                    'message' => 'Approval blocked: Cryptographic payload hash mismatch detected.'
                ];
            }
        }

        $approval_id = $this->_generate_uuid();
        $now = date('Y-m-d H:i:s');

        $this->db->insert('broadsheet_approvals', [
            'id'          => $approval_id,
            'snapshot_id' => $snapshot_id,
            'role_key'    => $role_key,
            'user_id'     => $user_id,
            'action'      => $action,
            'comment'     => $comment,
            'acted_at'    => $now
        ]);

        $this->log_audit($snapshot_id, $action, $user_id, [
            'role_key' => $role_key,
            'comment'  => $comment
        ]);

        if ($action === 'approve') {
            $approvals = $this->get_approvals($snapshot_id);
            $approved_roles = array_unique(array_column($approvals, 'role_key'));

            // When Dean or Academic Board approves, mark approved & locked
            $norm_role = strtolower(trim((string)$role_key));
            if (in_array($norm_role, ['dean', 'academic_board', 'senate'], true) || count($approved_roles) >= 2) {
                $this->db->where('id', $snapshot_id)->update('broadsheet_snapshots', [
                    'status'      => 'approved',
                    'approved_at' => $now,
                    'locked_at'   => $now,
                    'updated_at'  => $now
                ]);
            }
        } elseif ($action === 'reject') {
            $this->db->where('id', $snapshot_id)->update('broadsheet_snapshots', [
                'status'     => 'rejected',
                'updated_at' => $now
            ]);
        }

        $this->db->trans_complete();
        return ['status' => $this->db->trans_status(), 'message' => "Sign-off recorded ({$action})"];
    }

    public function get_approvals($snapshot_id)
    {
        $this->db->select('a.*, u.full_name as user_name');
        $this->db->from('broadsheet_approvals a');
        $this->db->join('users u', 'u.id = a.user_id', 'left');
        $this->db->where('a.snapshot_id', $snapshot_id);
        $this->db->order_by('a.acted_at', 'ASC');
        return $this->db->get()->result_array();
    }

    public function log_audit($snapshot_id, $action, $actor_id, $meta = [])
    {
        if (!$this->db->table_exists('broadsheet_audit_log')) {
            return;
        }
        $this->db->insert('broadsheet_audit_log', [
            'id'          => $this->_generate_uuid(),
            'snapshot_id' => $snapshot_id,
            'action'      => $action,
            'actor_id'    => $actor_id,
            'meta_json'   => json_encode($meta),
            'created_at'  => date('Y-m-d H:i:s')
        ]);
    }

    private function _format_snapshot_meta($record)
    {
        return [
            'id'                     => $record['id'],
            'version'                => (int)$record['version'],
            'status'                 => $record['status'],
            'scope_hash'             => $record['scope_hash'] ?? null,
            'contact_number'         => isset($record['contact_number']) ? (int)$record['contact_number'] : null,
            'previous_snapshot_id'   => $record['previous_snapshot_id'] ?? null,
            'supersedes_snapshot_id' => $record['supersedes_snapshot_id'] ?? null,
            'is_stale'               => !empty($record['stale_at']),
            'stale_at'               => $record['stale_at'] ?? null,
            'stale_reason'           => $record['stale_reason'] ?? null,
            'rebuild_status'         => $record['rebuild_status'] ?? 'ready',
            'verification_code'      => $record['verification_code'] ?? null,
            'payload_hash'           => $record['payload_hash'] ?? null,
            'generated_at'           => $record['generated_at'] ?? null,
            'approved_at'            => $record['approved_at'] ?? null,
            'locked_at'              => $record['locked_at'] ?? null
        ];
    }

    private function _generate_verification_code()
    {
        return 'BRD-' . strtoupper(substr(md5(uniqid((string)mt_rand(), true)), 0, 8));
    }

    private function _generate_uuid()
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
