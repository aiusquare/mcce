import React from "react";
import { createPortal } from "react-dom";
import { schoolLogoUrl, fudmaLogoUrl } from "./logoHelper";
import { cleanCorruptedChars } from "@/lib/api";

interface BroadsheetPrintProps {
  broadsheet: any;
}

export function BroadsheetPrintDocument({ broadsheet }: BroadsheetPrintProps) {
  if (!broadsheet) return null;

  const { context, current_courses, carryover_courses, students } = broadsheet;
  const summary = context.summary || {};
  const progStructure = context.programme?.programme_structure || "semester";
  const termLabel = progStructure === "semester" ? "Semester" : "Contact";
  const basis = context.basis || "published";
  const isWorking = basis === "working";
  const isApproved = context.approval_status === "Approved" || context.snapshot?.status === "approved";

  const watermarkText = isWorking
    ? "WORKING COPY (DRAFT)"
    : isApproved
    ? "OFFICIAL BROADSHEET"
    : "PROVISIONAL BROADSHEET";

  const printRoot =
    document.getElementById("print-root") ||
    (() => {
      const el = document.createElement("div");
      el.id = "print-root";
      document.body.appendChild(el);
      return el;
    })();

  return createPortal(
    <div className="broadsheet-print-only">
      <style type="text/css">
        {`
          @media screen {
            .broadsheet-print-only {
              display: none !important;
            }
          }
          @media print {
            body > #root {
              display: none !important;
            }
            body > #print-root {
              display: block !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
            .broadsheet-print-only {
              display: block !important;
              width: 100% !important;
              overflow: visible !important;
              background: white;
              font-family: 'Times New Roman', 'Liberation Serif', serif, sans-serif;
              color: black;
            }
            @page {
              size: A3 landscape;
              margin: 8mm;
            }
            .watermark-banner {
              text-align: right;
              font-size: 8pt;
              font-weight: bold;
              text-transform: uppercase;
              color: #555;
              border-bottom: 0.5pt solid #aaa;
              padding-bottom: 2px;
              margin-bottom: 6px;
            }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 7.5pt;
            }
            .print-table th, .print-table td {
              border: 0.75pt solid black;
              padding: 3px 2px;
              text-align: center;
              overflow: hidden;
              word-wrap: break-word;
            }
            .print-table th {
              font-weight: bold;
              background-color: #f3f4f6 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-table thead {
              display: table-header-group;
            }
            .print-table tr {
              page-break-inside: avoid;
            }
            .page-break {
              page-break-before: always;
              margin-top: 20px;
            }
            .summary-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 8pt;
              margin-top: 8px;
            }
            .summary-table th, .summary-table td {
              border: 0.75pt solid black;
              padding: 3px 4px;
            }
            .summary-table th {
              background-color: #e5e7eb !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .sig-block {
              display: flex;
              justify-content: space-between;
              margin-top: 40px;
              padding: 0 20px;
              font-size: 9pt;
              page-break-inside: avoid;
            }
            .sig-item {
              text-align: center;
              width: 22%;
            }
            .sig-line {
              border-bottom: 1pt solid black;
              margin-bottom: 6px;
              height: 35px;
            }
          }
        `}
      </style>

      {/* Watermark / Header Line */}
      <div className="watermark-banner">
        <span>STATUS: {watermarkText}</span> |{" "}
        <span>GENERATED: {new Date(context.computed_at || context.generated_at).toLocaleString()}</span>
      </div>

      {/* Official Institutional Header */}
      <div style={{ textAlign: "center", marginBottom: "12px", fontFamily: "Arial, sans-serif" }}>
        {/* Logos at the top: School Logo on left, FUDMA Logo on right hand side */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "24px",
            marginBottom: "8px",
          }}
        >
          <img
            src={schoolLogoUrl}
            alt="MCCE Logo"
            style={{ width: "56px", height: "56px", objectFit: "contain" }}
          />
          <img
            src={fudmaLogoUrl}
            alt="FUDMA Logo"
            style={{ width: "56px", height: "56px", objectFit: "contain" }}
          />
        </div>
        <h1 style={{ margin: 0, fontSize: "17pt", fontWeight: "bold", textTransform: "uppercase" }}>
          {context.institution || "Maslaha Community College of Education"}
        </h1>
        <div style={{ margin: "2px 0 4px 0", fontSize: "11pt", fontStyle: "italic", fontWeight: "600", color: "#1f2937" }}>
          (in Affiliation with Federal University Dutsinma)
        </div>
        <h2 style={{ margin: "2px 0", fontSize: "12.5pt", fontWeight: "bold" }}>
          EXAMINATIONS RESULT SHEET
        </h2>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "10pt",
            marginTop: "8px",
            borderBottom: "1pt solid black",
            paddingBottom: "4px",
          }}
        >
          <div>
            <strong>Programme:</strong> {context.programme?.name} ({context.programme?.code})
          </div>
          <div>
            <strong>Department:</strong> {context.programme?.department?.name || context.programme?.department_id || "—"}
          </div>
          <div>
            <strong>Session:</strong> {context.session?.name}
          </div>
          <div>
            <strong>{termLabel}:</strong> {context.semester?.name}
          </div>
          <div>
            <strong>Basis:</strong> {isWorking ? "Working Draft" : "Official Published"}
          </div>
        </div>
      </div>

      {/* Master Results Table */}
      <table className="print-table">
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: "26px" }}>S/N</th>
            <th rowSpan={2} style={{ width: "190px", textAlign: "left", paddingLeft: "4px" }}>
              Name / Matric No
            </th>

            {/* Current Courses */}
            {current_courses?.length > 0 && (
              <th colSpan={current_courses.length}>CURRENT {termLabel.toUpperCase()} COURSES</th>
            )}

            {/* Carryover Courses */}
            {carryover_courses?.length > 0 && (
              <th colSpan={carryover_courses.length}>CARRYOVER COURSES</th>
            )}

            <th colSpan={4}>CURRENT</th>
            <th colSpan={4}>PREVIOUS</th>
            <th colSpan={4}>CUMULATIVE</th>
            <th rowSpan={2} style={{ width: "80px" }}>REMARK & STANDING</th>
          </tr>

          <tr>
            {/* Current Courses subheaders */}
            {current_courses?.map((c: any) => (
              <th key={c.course_id || c.course_code} style={{ width: "45px" }}>
                <div>{c.course_code}</div>
                <div style={{ fontWeight: "normal", fontSize: "7pt" }}>({c.credit_units})</div>
              </th>
            ))}

            {/* Carryover Courses subheaders */}
            {carryover_courses?.map((c: any) => (
              <th key={c.course_id || c.course_code} style={{ width: "45px" }}>
                <div>{c.course_code}</div>
                <div style={{ fontWeight: "normal", fontSize: "7pt" }}>({c.credit_units})</div>
              </th>
            ))}

            {/* Current Stats */}
            <th style={{ width: "30px" }}>TCR</th>
            <th style={{ width: "30px" }}>TCE</th>
            <th style={{ width: "30px" }}>TQP</th>
            <th style={{ width: "35px" }}>GPA</th>

            {/* Previous Stats */}
            <th style={{ width: "30px" }}>CCR</th>
            <th style={{ width: "30px" }}>CCE</th>
            <th style={{ width: "30px" }}>CGP</th>
            <th style={{ width: "35px" }}>CGPA</th>

            {/* Cumulative Stats */}
            <th style={{ width: "30px" }}>CCR</th>
            <th style={{ width: "30px" }}>CCE</th>
            <th style={{ width: "30px" }}>CGP</th>
            <th style={{ width: "35px" }}>CGPA</th>
          </tr>
        </thead>

        <tbody>
          {students?.map((student: any, index: number) => {
            const isComplete = student.is_complete !== false;
            const cumCcr = Number(student.cumulative?.registered_credits ?? 0);
            const cumCgpaNum = parseFloat(String(student.cumulative?.cgpa ?? "0"));
            const standing: string =
              student.academic_standing ||
              (!isComplete
                ? "INCOMPLETE"
                : cumCcr > 0
                ? cumCgpaNum < 1.0
                  ? "WITHDRAWAL"
                  : cumCgpaNum < 1.5
                  ? "PROBATION"
                  : "GOOD_STANDING"
                : "NONE");

            return (
              <tr key={student.student_id || index}>
                <td>{index + 1}</td>
                <td style={{ textAlign: "left", paddingLeft: "4px", lineHeight: "1.25" }}>
                  <div style={{ fontWeight: "bold", fontSize: "9px" }}>
                    {cleanCorruptedChars(
                      student.full_name ||
                        `${student.last_name}, ${student.first_name} ${student.middle_name || ""}`
                    )}
                  </div>
                  <div style={{ fontSize: "8px", color: "#333", marginTop: "1px" }}>
                    {student.matric_number || student.admission_number || "—"}
                  </div>
                </td>

                {/* Current Courses */}
                {current_courses?.map((c: any) => {
                  const res =
                    student.current_results?.[c.course_id] ??
                    student.current_results?.[c.course_code];
                  const displayVal = !res
                    ? "—"
                    : res.status === "missing"
                    ? "NR"
                    : res.display_value || "—";
                  const isFailOrAbs =
                    res?.status === "scored" &&
                    (displayVal === "ABS" || displayVal.includes("ABS") || displayVal.includes("F"));
                  return (
                    <td key={c.course_id || c.course_code}>
                      {isFailOrAbs ? (
                        <strong style={{ color: "#b91c1c" }}>{displayVal}</strong>
                      ) : displayVal === "NR" ? (
                        <strong style={{ color: "#d97706" }}>NR</strong>
                      ) : (
                        displayVal
                      )}
                    </td>
                  );
                })}

                {/* Carryover Courses */}
                {carryover_courses?.map((c: any, cIdx: number) => {
                  let val = null;
                  if (Array.isArray(student.carryover_results)) {
                    val = student.carryover_results[cIdx];
                  } else if (
                    student.carryover_results &&
                    typeof student.carryover_results === "object"
                  ) {
                    val =
                      student.carryover_results[c.course_id] ??
                      student.carryover_results[c.course_code];
                  }
                  const valStr = String(val ?? "—");
                  const isFailOrAbs =
                    valStr === "ABS" || valStr.includes("ABS") || valStr.includes("F");
                  return (
                    <td key={c.course_id || c.course_code}>
                      {isFailOrAbs ? (
                        <strong style={{ color: "#b91c1c" }}>{valStr}</strong>
                      ) : (
                        valStr
                      )}
                    </td>
                  );
                })}

                {/* Current */}
                <td>{student.current.registered_credits}</td>
                <td>{student.current.earned_credits}</td>
                <td>{student.current.quality_points}</td>
                <td><strong>{student.current.gpa}</strong></td>

                {/* Previous */}
                <td>{student.previous.registered_credits}</td>
                <td>{student.previous.earned_credits}</td>
                <td>{student.previous.quality_points}</td>
                <td><strong>{student.previous.cgpa}</strong></td>

                {/* Cumulative */}
                <td>{student.cumulative.registered_credits}</td>
                <td>{student.cumulative.earned_credits}</td>
                <td>{student.cumulative.quality_points}</td>
                <td
                  style={{
                    backgroundColor:
                      standing === "WITHDRAWAL"
                        ? "#fee2e2"
                        : standing === "PROBATION"
                        ? "#fef3c7"
                        : "transparent",
                  }}
                >
                  <strong>
                    {student.cumulative.cgpa}
                    {!isComplete && "*"}
                  </strong>
                </td>

                {/* Remark & Standing */}
                <td>
                  <div style={{ fontSize: "7pt", lineHeight: 1.2 }}>
                    <div>{student.remark || "—"}</div>
                    {standing === "WITHDRAWAL" && (
                      <strong style={{ color: "#b91c1c" }}>[WITHDRAWAL]</strong>
                    )}
                    {standing === "PROBATION" && (
                      <strong style={{ color: "#d97706" }}>[PROBATION]</strong>
                    )}
                    {standing === "INCOMPLETE" && (
                      <strong style={{ color: "#7c3aed" }}>[INCOMPLETE]</strong>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* PAGE BREAK TO SUMMARY & SIGN-OFF PAGE */}
      <div className="page-break">
        <div style={{ textAlign: "center", marginBottom: "15px", borderBottom: "1.5pt solid black", paddingBottom: "6px" }}>
          <h2 style={{ fontSize: "14pt", fontWeight: "bold", margin: 0 }}>
            BROADSHEET RESULT SUMMARY & STATISTICAL ANALYSIS
          </h2>
          <p style={{ margin: "3px 0 0 0", fontSize: "9pt", color: "#444" }}>
            {context.programme?.name} | {context.session?.name} | {context.semester?.name}
          </p>
        </div>

        {/* 1. Candidate Counts Summary Table */}
        <div style={{ marginBottom: "14px" }}>
          <h3 style={{ fontSize: "10pt", fontWeight: "bold", margin: "0 0 4px 0" }}>
            1. CANDIDATE PERFORMANCE SUMMARY
          </h3>
          <table className="summary-table">
            <thead>
              <tr>
                <th>Total Candidates</th>
                <th>Clean Pass</th>
                <th>Carryover (CO)</th>
                <th>Academic Probation</th>
                <th>Withdrawal</th>
                <th>Incomplete (NR)</th>
                <th>Submission Completeness</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: "center", fontWeight: "bold" }}>{summary.total_students || 0}</td>
                <td style={{ textAlign: "center", color: "#15803d", fontWeight: "bold" }}>
                  {summary.total_passed || 0} ({summary.total_students ? ((summary.total_passed / summary.total_students) * 100).toFixed(1) : 0}%)
                </td>
                <td style={{ textAlign: "center", color: "#c2410c", fontWeight: "bold" }}>
                  {summary.total_carryover || 0} ({summary.total_students ? ((summary.total_carryover / summary.total_students) * 100).toFixed(1) : 0}%)
                </td>
                <td style={{ textAlign: "center", color: "#b45309", fontWeight: "bold" }}>
                  {summary.total_probation || 0}
                </td>
                <td style={{ textAlign: "center", color: "#b91c1c", fontWeight: "bold" }}>
                  {summary.total_withdrawn || 0}
                </td>
                <td style={{ textAlign: "center", color: "#6b21a8", fontWeight: "bold" }}>
                  {summary.total_incomplete || 0}
                </td>
                <td style={{ textAlign: "center", fontWeight: "bold" }}>
                  {summary.completeness_percentage || 100}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. Course Performance Statistics Table */}
        {summary.course_statistics?.length > 0 && (
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "10pt", fontWeight: "bold", margin: "0 0 4px 0" }}>
              2. COURSE PERFORMANCE STATISTICS
            </h3>
            <table className="summary-table">
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>Course Code</th>
                  <th>Course Title</th>
                  <th style={{ width: "50px", textAlign: "center" }}>Units</th>
                  <th style={{ width: "50px", textAlign: "center" }}>Sat</th>
                  <th style={{ width: "50px", textAlign: "center" }}>Passed</th>
                  <th style={{ width: "50px", textAlign: "center" }}>Failed</th>
                  <th style={{ width: "65px", textAlign: "center" }}>Pass %</th>
                  <th style={{ width: "70px", textAlign: "center" }}>Mean Score</th>
                </tr>
              </thead>
              <tbody>
                {summary.course_statistics.map((c: any) => (
                  <tr key={c.course_id || c.course_code}>
                    <td style={{ fontWeight: "bold" }}>{c.course_code}</td>
                    <td>{c.course_title}</td>
                    <td style={{ textAlign: "center" }}>{c.credit_units}</td>
                    <td style={{ textAlign: "center" }}>{c.sat ?? c.sat_count ?? 0}</td>
                    <td style={{ textAlign: "center", color: "#15803d", fontWeight: "bold" }}>{c.passed ?? c.pass_count ?? 0}</td>
                    <td style={{ textAlign: "center", color: "#b91c1c", fontWeight: "bold" }}>{c.failed ?? c.fail_count ?? 0}</td>
                    <td style={{ textAlign: "center", fontWeight: "bold" }}>{c.pass_percentage ?? 0}%</td>
                    <td style={{ textAlign: "center" }}>{c.mean_score ?? c.average_score ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. GPA Distribution Table */}
        {summary.gpa_distribution?.length > 0 && (
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ fontSize: "10pt", fontWeight: "bold", margin: "0 0 4px 0" }}>
              3. GPA & DEGREE CLASSIFICATION DISTRIBUTION
            </h3>
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Classification / Band</th>
                  <th style={{ width: "120px", textAlign: "center" }}>GPA Range</th>
                  <th style={{ width: "80px", textAlign: "center" }}>Candidates</th>
                  <th style={{ width: "80px", textAlign: "center" }}>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {summary.gpa_distribution.map((b: any, idx: number) => {
                  const minVal = Number(b?.min_gpa ?? b?.min ?? 0);
                  const maxVal = Number(b?.max_gpa ?? b?.max ?? 0);
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: "bold" }}>{b.label}</td>
                      <td style={{ textAlign: "center" }}>{minVal.toFixed(2)} – {maxVal.toFixed(2)}</td>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>{b.count}</td>
                      <td style={{ textAlign: "center" }}>{b.percentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Grading Scale & Abbreviations Key */}
        <div style={{ fontSize: "7.5pt", lineHeight: 1.4, border: "0.5pt solid #888", padding: "6px 8px", backgroundColor: "#fafafa" }}>
          <div style={{ marginBottom: "2px" }}>
            <strong>Official Grading Scale (5.00 Point System):</strong>{" "}
            A = 70–100% (5 pts) | B = 60–69% (4 pts) | C = 50–59% (3 pts) | D = 45–49% (2 pts) | E = 40–44% (1 pt) | F = 0–39% (0 pts)
          </div>
          <div>
            <strong>Abbreviations Key:</strong>{" "}
            TCR = Total Credits Registered | TCE = Total Credits Earned | TQP = Total Quality Points | GPA = Grade Point Average | CCR = Cumulative Credits Registered | CCE = Cumulative Credits Earned | CGP = Cumulative Grade Points | CGPA = Cumulative Grade Point Average | CO = Carryover Course | ABS = Absent from Examination | NR = Score Not Reported (Pending) | * = Provisional CGPA (Pending Results) | — = Course Not Registered
          </div>
        </div>

        {/* 5. Four Institutional Sign-Off Blocks */}
        <div className="sig-block">
          <div className="sig-item">
            <div className="sig-line"></div>
            <strong>Course Coordinator / Exam Officer</strong><br />
            <span>Name: ______________________</span><br />
            <span>Date: ______________________</span>
          </div>
          <div className="sig-item">
            <div className="sig-line"></div>
            <strong>Head of Department</strong><br />
            <span>Name: ______________________</span><br />
            <span>Date: ______________________</span>
          </div>
          <div className="sig-item">
            <div className="sig-line"></div>
            <strong>Dean / Director of School</strong><br />
            <span>Name: ______________________</span><br />
            <span>Date: ______________________</span>
          </div>
          <div className="sig-item">
            <div className="sig-line"></div>
            <strong>Senate / Academic Board Rep.</strong><br />
            <span>Name: ______________________</span><br />
            <span>Date: ______________________</span>
          </div>
        </div>

        {/* Verification Footer & QR Reference */}
        <div style={{ marginTop: "24px", textAlign: "center", fontSize: "7.5pt", color: "#444", borderTop: "0.5pt solid #aaa", paddingTop: "4px" }}>
          {context.snapshot?.verification_code && (
            <div style={{ fontWeight: "bold", fontSize: "8.5pt", marginBottom: "2px" }}>
              BROADSHEET VERIFICATION CODE: {context.snapshot.verification_code} | HASH: {context.snapshot.payload_hash?.substring(0, 24)}...
            </div>
          )}
          <div>
            Date Computed: {new Date(context.computed_at || context.generated_at).toLocaleString()} | Date Printed: {new Date().toLocaleString()} | Official Academic Document of {context.institution || "Maslaha Community College"}
          </div>
        </div>
      </div>
    </div>,
    printRoot
  );
}
