import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getLoadedLogos } from "./logoHelper";

export async function generatePdfBroadsheet(broadsheet: any) {
  if (!broadsheet) return;

  const { context, current_courses = [], carryover_courses = [], students = [] } = broadsheet;
  const summary = context.summary || {};
  const institution = context.institution || "Maslaha Community College of Education";
  const progName = context.programme?.name || "";
  const sessionName = context.session?.name || "";
  const semName = context.semester?.name || "";
  const basis = context.basis || "published";
  const isWorking = basis === "working";

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a3",
  });

  const logos = await getLoadedLogos();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  // Render Logos at the top center
  // School logo on left, FUDMA logo on right hand side
  const logoSize = 16;
  const logoGap = 6;
  const totalLogosWidth = logoSize * 2 + logoGap;
  const startLogoX = centerX - totalLogosWidth / 2;
  const logoY = 6;

  if (logos.schoolBase64) {
    try {
      doc.addImage(logos.schoolBase64, "PNG", startLogoX, logoY, logoSize, logoSize);
    } catch (e) {
      console.warn("Failed to add school logo to PDF", e);
    }
  }

  if (logos.fudmaBase64) {
    try {
      doc.addImage(logos.fudmaBase64, "PNG", startLogoX + logoSize + logoGap, logoY, logoSize, logoSize);
    } catch (e) {
      console.warn("Failed to add FUDMA logo to PDF", e);
    }
  }

  // Title & Header Text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(institution.toUpperCase(), centerX, 27, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10.5);
  doc.text("(in Affiliation with Federal University Dutsinma)", centerX, 32.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("EXAMINATIONS RESULT SHEET", centerX, 38, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const infoText = `Programme: ${progName}   |   Academic Session: ${sessionName}   |   Contact/Semester: ${semName}   |   Basis: ${
    isWorking ? "Working Copy (Drafts)" : "Official Published"
  }`;
  doc.text(infoText, centerX, 43.5, { align: "center" });

  // Build Table Columns
  // Level 1 Header
  const headRow1: any[] = [
    { content: "S/N", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
    { content: "NAME / MATRIC NO.", rowSpan: 2, styles: { halign: "left", valign: "middle" } },
  ];

  if (current_courses.length > 0) {
    headRow1.push({
      content: "CURRENT COURSES",
      colSpan: current_courses.length,
      styles: { halign: "center", fillColor: [240, 245, 255] },
    });
  }

  if (carryover_courses.length > 0) {
    headRow1.push({
      content: "CARRYOVER COURSES",
      colSpan: carryover_courses.length,
      styles: { halign: "center", fillColor: [255, 240, 240] },
    });
  }

  headRow1.push(
    { content: "CURRENT", colSpan: 4, styles: { halign: "center", fillColor: [235, 245, 255] } },
    { content: "PREVIOUS", colSpan: 4, styles: { halign: "center", fillColor: [255, 245, 235] } },
    { content: "CUMULATIVE", colSpan: 4, styles: { halign: "center", fillColor: [235, 255, 235] } },
    { content: "REMARK & STANDING", rowSpan: 2, styles: { halign: "center", valign: "middle" } }
  );

  // Level 2 Header
  const headRow2: any[] = [];
  current_courses.forEach((c: any) => {
    headRow2.push({
      content: `${c.course_code}\n(${c.credit_units})`,
      styles: { halign: "center" },
    });
  });
  carryover_courses.forEach((c: any) => {
    headRow2.push({
      content: `${c.course_code}\n(${c.credit_units})`,
      styles: { halign: "center" },
    });
  });

  // Current
  headRow2.push("TCR", "TCE", "TQP", "GPA");
  // Previous
  headRow2.push("CCR", "CCE", "CGP", "CGPA");
  // Cumulative
  headRow2.push("CCR", "CCE", "CGP", "CGPA");

  // Build Body Rows
  const bodyRows: any[] = [];
  students.forEach((student: any, idx: number) => {
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

    const studentName = (student.full_name || `${student.last_name || ""}, ${student.first_name || ""} ${student.middle_name || ""}`).trim();
    const matric = student.matric_number || student.admission_number || "—";
    const row: any[] = [
      idx + 1,
      `${studentName}\n${matric}`,
    ];

    // Current Courses
    current_courses.forEach((c: any) => {
      const res =
        student.current_results?.[c.course_id] ?? student.current_results?.[c.course_code];
      const displayVal = !res
        ? "—"
        : res.status === "missing"
        ? "NR"
        : res.display_value || "—";
      row.push(displayVal);
    });

    // Carryover Courses
    carryover_courses.forEach((c: any, cIdx: number) => {
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
      row.push(val ? String(val) : "—");
    });

    // Current
    row.push(
      student.current?.registered_credits ?? "0",
      student.current?.earned_credits ?? "0",
      student.current?.quality_points ?? "0",
      student.current?.gpa ?? "0.00"
    );

    // Previous
    row.push(
      student.previous?.registered_credits ?? "0",
      student.previous?.earned_credits ?? "0",
      student.previous?.quality_points ?? "0",
      student.previous?.cgpa ?? "0.00"
    );

    // Cumulative
    row.push(
      student.cumulative?.registered_credits ?? "0",
      student.cumulative?.earned_credits ?? "0",
      student.cumulative?.quality_points ?? "0",
      `${student.cumulative?.cgpa ?? "0.00"}${!isComplete ? "*" : ""}`
    );

    // Remark
    const remarkStr = `${student.remark || "—"}${
      standing === "WITHDRAWAL" ? " [WITHDRAWAL]" : standing === "PROBATION" ? " [PROBATION]" : standing === "INCOMPLETE" ? " [INCOMPLETE]" : ""
    }`;
    row.push(remarkStr);

    bodyRows.push(row);
  });

  // Render Table
  autoTable(doc, {
    startY: 48,
    head: [headRow1, headRow2],
    body: bodyRows,
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      halign: "center",
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineWidth: 0.2,
      lineColor: [100, 100, 100],
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 50, halign: "left" },
    },
    margin: { top: 46, left: 10, right: 10, bottom: 20 },
  });

  // Add Summary Page
  doc.addPage("a3", "landscape");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("BROADSHEET RESULT SUMMARY & STATISTICAL ANALYSIS", doc.internal.pageSize.getWidth() / 2, 20, {
    align: "center",
  });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${progName}  |  ${sessionName}  |  ${semName}`, doc.internal.pageSize.getWidth() / 2, 27, {
    align: "center",
  });

  // Summary Table
  const total = Number(summary.total_students || 0);
  const passed = Number(summary.total_passed || 0);
  const carryover = Number(summary.total_carryover || 0);
  const probation = Number(summary.total_probation || 0);
  const withdrawn = Number(summary.total_withdrawn || 0);
  const incomplete = Number(summary.total_incomplete || 0);

  autoTable(doc, {
    startY: 34,
    head: [
      [
        "Total Candidates",
        "Clean Pass",
        "Carryover (CO)",
        "Probation (1.00–1.49)",
        "Withdrawal (< 1.00)",
        "Incomplete (NR)",
        "Submission Completeness",
      ],
    ],
    body: [
      [
        total,
        `${passed} (${total ? ((passed / total) * 100).toFixed(1) : 0}%)`,
        `${carryover} (${total ? ((carryover / total) * 100).toFixed(1) : 0}%)`,
        probation,
        withdrawn,
        incomplete,
        `${summary.completeness_percentage || 100}%`,
      ],
    ],
    theme: "grid",
    styles: { fontSize: 9, halign: "center", cellPadding: 2.5 },
    headStyles: { fillColor: [230, 235, 245], textColor: [0, 0, 0], fontStyle: "bold" },
    margin: { left: 15, right: 15 },
  });

  // Course Statistics Table
  let currentY = (doc as any).lastAutoTable.finalY + 12;
  if (summary.course_statistics?.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("COURSE PERFORMANCE STATISTICS", 15, currentY);

    const courseRows = summary.course_statistics.map((c: any) => [
      c.course_code,
      c.course_title,
      c.credit_units,
      c.sat ?? c.sat_count ?? 0,
      c.passed ?? c.pass_count ?? 0,
      c.failed ?? c.fail_count ?? 0,
      `${c.pass_percentage ?? 0}%`,
      c.mean_score ?? c.average_score ?? "-",
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [["Course Code", "Course Title", "Units", "Sat", "Passed", "Failed", "Pass %", "Mean Score"]],
      body: courseRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 25 },
        1: { halign: "left" },
        2: { halign: "center", cellWidth: 15 },
        3: { halign: "center", cellWidth: 15 },
        4: { halign: "center", cellWidth: 15 },
        5: { halign: "center", cellWidth: 15 },
        6: { halign: "center", cellWidth: 20 },
        7: { halign: "center", cellWidth: 25 },
      },
      margin: { left: 15, right: 15 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // Four Institutional Signature Lines
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);

  const sigWidth = 70;
  const colSpacing = (doc.internal.pageSize.getWidth() - 30 - 4 * sigWidth) / 3;
  const startX = 15;
  const sigY = Math.max(currentY + 20, 220);

  const roles = [
    "Course Coordinator / Exam Officer",
    "Head of Department",
    "Dean / Director of School",
    "Senate / Academic Board Rep.",
  ];

  roles.forEach((role, rIdx) => {
    const x = startX + rIdx * (sigWidth + colSpacing);
    doc.line(x, sigY, x + sigWidth, sigY);
    doc.setFont("helvetica", "bold");
    doc.text(role, x + sigWidth / 2, sigY + 5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Date: ____________________", x + sigWidth / 2, sigY + 11, { align: "center" });
  });

  // Footer / Verification info
  doc.setFontSize(7);
  doc.text(
    `Date Computed: ${new Date(context.computed_at || context.generated_at).toLocaleString()}   |   Official Document of ${institution}`,
    doc.internal.pageSize.getWidth() / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: "center" }
  );

  // Save the PDF
  const filename = `Broadsheet_${context.programme?.code || "Result"}_${context.semester?.name || "Term"}_${context.session?.name || "Session"}.pdf`.replace(
    /\s+/g,
    "_"
  );
  doc.save(filename);
}
