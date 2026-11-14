export type GraduationFramework = "CCMAS" | "BMAS";

export interface GraduatingStudent {
  sn: number;
  student_id: string;
  matric_number: string;
  names: string;
  gender: string;
  jamb_reg_no: string;
  dob: string;
  origin: string;
  current_level: string;
  entry_level: string;
  entry_mode: "UTME" | "DE" | string;
  year_admitted: string;
  tce: number;
  tcr: number;
  tqp: number;
  cgpa: string;
  class: string;
  remark: string;
}

export interface StudentDeficiency {
  category: "outstanding" | "pending" | "tce" | "cgpa" | "level" | "finance" | string;
  title: string;
  message: string;
  courses?: string[];
  earned?: number;
  required?: number;
  deficit?: number;
  cgpa?: number;
}

export interface IneligibleStudent {
  sn: number;
  student_id: string;
  matric_number: string;
  names: string;
  gender: string;
  jamb_reg_no: string;
  dob: string;
  origin: string;
  current_level: string;
  entry_level: string;
  entry_mode: string;
  year_admitted: string;
  tce: number;
  tcr: number;
  tqp: number;
  cgpa: string;
  degree_class?: string;
  deficiencies: StudentDeficiency[];
  outstanding_courses: string[];
  pending_courses: string[];
}

export interface GraduationSummaryStats {
  total_audited: number;
  cleared_count: number;
  cleared_percent: number;
  ineligible_count: number;
  ineligible_percent: number;
  class_breakdown: {
    "First Class Honours": number;
    "Second Class Honours (Upper Division)": number;
    "Second Class Honours (Lower Division)": number;
    "Third Class Honours": number;
    "Pass Degree": number;
    [key: string]: number;
  };
  deficiency_breakdown: {
    outstanding: number;
    pending: number;
    tce: number;
    cgpa: number;
    level: number;
    finance: number;
    [key: string]: number;
  };
}

export interface GraduationConfig {
  framework: GraduationFramework;
  min_cgpa_ccmas: string;
  min_cgpa_bmas: string;
  min_tce_utme: string;
  min_tce_de: string;
  final_contact: string;
  strict_zero_carryovers: string;
  strict_zero_pending: string;
  require_fee_clearance: string;
  institution_name: string;
  institution_address: string;
  affiliate_name: string;
  faculty_name: string;
  signatory_hod: string;
  signatory_dean: string;
  signatory_vc: string;
}

export interface GraduationAuditResponse {
  graduating_students: GraduatingStudent[];
  ineligible_students: IneligibleStudent[];
  summary_stats: GraduationSummaryStats;
  config: GraduationConfig;
  metadata: {
    session_name: string;
    programme_name: string;
    programme_code: string;
    generated_at: string;
  };
}

