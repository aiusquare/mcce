<?php
define('BASEPATH', '1');
// Mock CI
class CI_Model {
    public \;
    public function __construct() {}
}
require_once 'application/models/Results_model.php';
\ = new Results_model();
\ = [
    ['min_score' => '70.00', 'max_score' => '100.00', 'letter_grade' => 'A', 'grade_point' => '5.00'],
    ['min_score' => '60.00', 'max_score' => '69.00', 'letter_grade' => 'B', 'grade_point' => '4.00'],
    ['min_score' => '50.00', 'max_score' => '59.00', 'letter_grade' => 'C', 'grade_point' => '3.00'],
    ['min_score' => '45.00', 'max_score' => '49.00', 'letter_grade' => 'D', 'grade_point' => '2.00'],
    ['min_score' => '40.00', 'max_score' => '44.00', 'letter_grade' => 'E', 'grade_point' => '1.00'],
    ['min_score' => '0.00', 'max_score' => '39.00', 'letter_grade' => 'F', 'grade_point' => '0.00'],
];
print_r(\->determine_grade(58.00, \));
