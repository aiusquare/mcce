<?php
// Test script for Phase 8: Snapshots, Sign-Off & Verification
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_METHOD'] = 'GET';
chdir(__DIR__ . '/..');
ob_start();
require_once 'index.php';
ob_end_clean();

echo "=======================================================\n";
echo "TESTING PHASE 8: SNAPSHOTS, GOVERNANCE & VERIFICATION\n";
echo "=======================================================\n";

$CI =& get_instance();
$CI->load->model('Snapshot_model');

// 1. Create a snapshot for Case 1
echo "1. Testing snapshot creation...\n";
$snap = $CI->Snapshot_model->create_snapshot('sess-2021', 'sem-c1', 'prog-cs', 'Contact 1', 'test-actor');
assert($snap !== false, "Snapshot created");
assert(!empty($snap['verification_code']), "Verification code generated");
assert(!empty($snap['payload_hash']), "Payload hash generated");
assert($snap['version'] >= 1, "Version is 1 or greater");

echo "  Snapshot created: ID={$snap['id']}, Ver={$snap['version']}, Code={$snap['verification_code']}, Hash=" . substr($snap['payload_hash'], 0, 16) . "...\n";
echo "  [OK] Snapshot creation verified.\n";

// 2. Fetch snapshot by ID and verification code
echo "2. Testing snapshot retrieval...\n";
$fetched = $CI->Snapshot_model->get_snapshot_by_verification_code($snap['verification_code']);
assert($fetched !== null, "Snapshot fetched by verification code");
assert($fetched['id'] === $snap['id'], "Fetched snapshot ID matches");
assert(isset($fetched['payload']['students']), "Payload contains students");
echo "  [OK] Snapshot retrieval verified.\n";

// 3. Test multi-tier sign-off
echo "3. Testing multi-tier approval sign-off...\n";
$ok1 = $CI->Snapshot_model->sign_off($snap['id'], 'hod', 'user-hod-1', 'approve', 'Approved by HOD Computer Science');
assert($ok1 === true, "HOD sign-off recorded");

$ok2 = $CI->Snapshot_model->sign_off($snap['id'], 'dean', 'user-dean-1', 'approve', 'Approved by Dean of Faculty');
assert($ok2 === true, "Dean sign-off recorded");

$approved_snap = $CI->Snapshot_model->get_snapshot_by_id($snap['id']);
assert($approved_snap['status'] === 'approved', "Snapshot status changed to approved");
assert(!empty($approved_snap['approved_at']), "approved_at timestamp set");
assert(count($approved_snap['approvals']) === 2, "2 approvals recorded");

echo "  Approvals count: " . count($approved_snap['approvals']) . ", Final status: {$approved_snap['status']}\n";
echo "  [OK] Multi-tier approval workflow verified.\n";

// 4. Test audit log entry
echo "4. Testing audit log entries...\n";
$audit_rows = $CI->db->get_where('broadsheet_audit_log', ['snapshot_id' => $snap['id']])->result_array();
assert(count($audit_rows) >= 3, "Audit logs recorded for generate + 2 approves");
echo "  Audit logs recorded: " . count($audit_rows) . " entries.\n";
echo "  [OK] Broadsheet audit log verified.\n";

echo "=======================================================\n";
echo "SUCCESS: Phase 8 verified!\n";
