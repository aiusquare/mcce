<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Check_db extends CI_Controller {
    public function index() {
        $this->load->database();
        
        $sql = "SELECT u.full_name, sess.name as sess_name, sem.name as sem_name, c.code, i.registration_type
                FROM course_registration_items i
                JOIN course_registrations r ON r.id = i.registration_id
                JOIN courses c ON c.id = i.course_id
                JOIN students s ON s.id = r.student_id
                JOIN users u ON u.id = s.user_id
                JOIN academic_sessions sess ON sess.id = r.session_id
                JOIN semesters sem ON sem.id = r.semester_id
                WHERE LOWER(i.registration_type) = 'carryover'
                ORDER BY i.created_at DESC LIMIT 10";

        $res = $this->db->query($sql)->result_array();
        
        header('Content-Type: application/json');
        echo json_encode($res, JSON_PRETTY_PRINT);
    }
}

