import React from "react";
import { createPortal } from "react-dom";

interface StatementPrintProps {
  statementData: any;
}

export function StatementPrintDocument({ statementData }: StatementPrintProps) {
  if (!statementData) return null;

  const printRoot =
    document.getElementById("print-root") ||
    (() => {
      const el = document.createElement("div");
      el.id = "print-root";
      document.body.appendChild(el);
      return el;
    })();

  const { student, scope, current_cgpa, academic_periods } = statementData;

  return createPortal(
    <div className="print-only statement-print bg-white text-black p-8 font-serif text-sm w-full max-w-4xl mx-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-root, #print-root * {
            visibility: visible;
          }
          #print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4 portrait;
            margin: 20mm;
          }
          .statement-print table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .statement-print th, .statement-print td {
            border: 1px solid #000;
            padding: 4px 8px;
            text-align: left;
          }
          .statement-print th {
            font-weight: bold;
            background-color: #f8f8f8 !important;
            -webkit-print-color-adjust: exact;
          }
          .statement-print .text-center {
            text-align: center;
          }
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold uppercase mb-1">
          Giga College of Education
        </h1>
        <h2 className="text-xl font-bold uppercase mb-2">
          Examinations Result Sheet
        </h2>
        <div className="text-sm">
          <strong>PROGRAMME OF STUDY:</strong> {student.programme}
          <br />
          <strong>DEPARTMENT:</strong> {student.department}
          <br />
          <strong>STUDENT NAME:</strong> {student.student_name}
          <br />
          <strong>MATRICULATION NO:</strong>{" "}
          {student.matric_number || student.admission_number || "N/A"}
          <br />
          <strong>CURRENT LEVEL:</strong> {student.current_level}
        </div>
      </div>

      <div className="mb-6 font-bold text-lg text-center uppercase border-b-2 border-black pb-2">
        {scope === "full"
          ? "Full Academic History"
          : scope === "session"
            ? "Session Result Statement"
            : "Contact Result Statement"}
      </div>

      {academic_periods?.map((period: any, idx: number) => (
        <div key={idx} className="mb-8 avoid-page-break">
          <div className="font-bold mb-2">
            SESSION: {period.session} &nbsp;&nbsp;|&nbsp;&nbsp; CONTACT:{" "}
            {period.contact} &nbsp;&nbsp;|&nbsp;&nbsp; LEVEL: {period.level}
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: "15%" }}>Code</th>
                <th style={{ width: "40%" }}>Course Title</th>
                <th className="text-center">CU</th>
                <th className="text-center">Score</th>
                <th className="text-center">Grade</th>
                <th className="text-center">GP</th>
                <th className="text-center">QP</th>
                <th className="text-center">Remark</th>
              </tr>
            </thead>
            <tbody>
              {period.courses?.map((c: any) => (
                <tr key={c.course_id}>
                  <td>{c.course_code}</td>
                  <td>{c.course_title}</td>
                  <td className="text-center">{c.credit_unit}</td>
                  <td className="text-center">
                    {c.status === "missing" ? "NR" : c.score}
                  </td>
                  <td className="text-center">
                    {c.status === "missing" ? "—" : c.grade}
                  </td>
                  <td className="text-center">
                    {c.status === "missing" ? "—" : c.grade_point}
                  </td>
                  <td className="text-center">
                    {c.status === "missing" ? "—" : c.quality_point}
                  </td>
                  <td className="text-center">
                    {c.status === "missing"
                      ? "Missing"
                      : c.grade === "F"
                        ? "Carryover"
                        : "Passed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs border border-black p-2 mt-2">
            <div>
              <strong>TCR:</strong> {period.registered_credits}
            </div>
            <div>
              <strong>TCE:</strong> {period.earned_credits}
            </div>
            <div>
              <strong>TQP:</strong> {period.quality_points}
            </div>
            <div>
              <strong>GPA:</strong> {period.gpa?.toFixed(2)}
            </div>
            <div>
              <strong>Prev CGPA:</strong> {period.previous_cgpa?.toFixed(2)}
            </div>
            <div>
              <strong>Curr CGPA:</strong> {period.current_cgpa?.toFixed(2)}
            </div>
          </div>
          <div className="text-xs mt-1">
            <strong>Outstanding:</strong>{" "}
            {period.outstanding_courses.length > 0
              ? period.outstanding_courses.join(", ")
              : "None"}
          </div>
        </div>
      ))}

      {/* Footer Signatures */}
      <div className="mt-12 flex justify-between text-center pt-8">
        <div>
          ___________________________
          <br />
          Level Coordinator
        </div>
        <div>
          ___________________________
          <br />
          Head of Department
        </div>
        <div>
          ___________________________
          <br />
          Dean of Faculty
        </div>
      </div>

      <div className="mt-8 text-xs text-center text-gray-500">
        Generated on {statementData.generated_at} by MCCE Portal
      </div>

      {/* Utility to avoid page break inside period block */}
      <style>{`
        .avoid-page-break {
          page-break-inside: avoid;
        }
      `}</style>
    </div>,
    printRoot,
  );
}
