export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  title: string;
  description: string;
  amount: number;
  items?: InvoiceItem[];
  dueDate: string;
  status: "draft" | "published" | "paid" | "overdue";
  createdAt: string;
}

export interface GeneralInvoice extends Invoice {
  type: "general";
  targetPrograms: string[];
  targetLevels: string[];
  semester: string;
  academicYear: string;
  studentsAffected: number;
}

export interface SpecificInvoice extends Invoice {
  type: "specific";
  targetProgram: string;
  targetLevel: string;
  targetDepartment: string;
  semester: string;
  studentsAffected: number;
}

export interface IndividualInvoice extends Invoice {
  type: "individual";
  studentId: string;
  studentName: string;
  studentEmail: string;
  program: string;
  level: string;
}

export type InvoiceType = GeneralInvoice | SpecificInvoice | IndividualInvoice;
