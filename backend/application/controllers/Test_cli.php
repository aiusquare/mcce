<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Test_cli extends CI_Controller {

    public function __construct() {
        parent::__construct();
        if (!is_cli()) {
            exit('CLI only');
        }
    }

    public function index() {
        $this->load->database();
        
        $sessions = $this->db->order_by('name')->get('academic_sessions')->result_array();
        echo "Sessions:\n";
        foreach ($sessions as $s) {
            echo "{$s['id']} - {$s['name']}\n";
        }

        $semesters = $this->db->order_by('name')->get('semesters')->result_array();
        echo "\nSemesters:\n";
        foreach ($semesters as $s) {
            echo "{$s['id']} - {$s['name']}\n";
        }

        // Test the outstanding course logic for one student
        $this->load->model('Outstanding_course_model');
        
        // Find a student from B.A. Ed. English in 2021/2022
        $sql = "SELECT id FROM students WHERE entry_session = '2021/2022' AND programme_id IN (SELECT id FROM programmes WHERE name LIKE '%English%') LIMIT 1";
        $student = $this->db->query($sql)->row_array();
        
        if ($student) {
            $student_id = $student['id'];
            echo "\nTesting student: $student_id\n";
            
            // Get Target Session and Semester (Contact 2 of 2021/2022)
            $sess = $this->db->where('name', '2021/2022')->get('academic_sessions')->row_array();
            $sem = $this->db->where("name LIKE '%Contact 2%'")->get('semesters')->row_array();
            
            if ($sess && $sem) {
                echo "Target: {$sess['name']} - {$sem['name']}\n";
                $courses = $this->Outstanding_course_model->get_outstanding_courses_before($student_id, $sess['id'], $sem['id']);
                echo "Outstanding Courses Before:\n";
                print_r($courses);
                
                // Let's dump all their results
                echo "\nAll published results for student:\n";
                $sql_res = "
                    SELECT a.grade, a.status as attempt_status, b.status as batch_status, sess.name as session_name, sem.name as semester_name, c.code
                    FROM result_attempts a
                    JOIN result_batches b ON b.id = a.batch_id
                    JOIN courses c ON c.id = b.course_id
                    LEFT JOIN academic_sessions sess ON sess.id = b.session_id
                    LEFT JOIN semesters sem ON sem.id = b.semester_id
                    WHERE a.student_id = ?
                ";
                $res = $this->db->query($sql_res, [$student_id])->result_array();
                print_r($res);
            }
        }
    }
}

