<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class Salary_model extends CI_Model {
    private $table = 'salary';

    public function insert_batch($rows)
    {
        if (empty($rows)) {
            return 0;
        }

        $this->db->trans_start();
        $inserted = $this->db->insert_batch($this->table, $rows); // returns number of rows on success
        $this->db->trans_complete();

        if ($this->db->trans_status() === FALSE) {
            return 0;
        }

        if (is_int($inserted) && $inserted > 0) {
            return $inserted;
        }

        // Fallback: some drivers return 0 for multi-row insert affected_rows
        return count($rows);
    }

    public function update_by_id($id, $data)
    {
        if (empty($data) || $id <= 0) {
            return false;
        }

        $this->db->where('id', $id);
        $this->db->limit(1);
        $this->db->update($this->table, $data);

        return $this->db->affected_rows() > 0;
    }

    public function get_by_grade($grade)
    {
        if (!$grade) {
            return null;
        }
        $clean = strtolower(trim($grade));
        $normalized = preg_replace('/[^a-z0-9]/', '', $clean);

        // 1) Try exact (case-insensitive) match
        $this->db->from($this->table);
        $this->db->where('LOWER(TRIM(grade)) =', $clean);
        $this->db->limit(1);
        $row = $this->db->get()->row_array();
        if ($row) {
          return $row;
        }

        // 2) Try DB-side normalized match removing common separators
        $this->db->from($this->table);
        $this->db->where('REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(grade), " ", ""), "/", ""), "-", ""), "_", ""), ".", ""), "(", ""), ")", "") =', $normalized);
        $this->db->limit(1);
        $row = $this->db->get()->row_array();
        if ($row) {
          return $row;
        }

        // 3) Fallback: PHP-side normalization to catch any unusual characters
        $query = $this->db->select('*')->from($this->table)->get();
        foreach ($query->result_array() as $candidate) {
            $candidateGrade = isset($candidate['grade']) ? strtolower(trim($candidate['grade'])) : '';
            $candidateNorm = preg_replace('/[^a-z0-9]/', '', $candidateGrade);
            if ($candidateNorm === $normalized) {
                return $candidate;
            }
        }

        return null;
    }
}
