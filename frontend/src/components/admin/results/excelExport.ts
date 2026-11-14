import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getLoadedLogos } from "./logoHelper";

export async function generateExcelBroadsheet(broadsheet: any) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Broadsheet');

    // Page Setup
    sheet.pageSetup = {
        paperSize: 9, // A3
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
            left: 0.25, right: 0.25,
            top: 0.5, bottom: 0.5,
            header: 0.2, footer: 0.2
        }
    };

    // Header values
    const institution = broadsheet.context.institution || 'Maslaha Community College of Education';
    const deptName = broadsheet.context.department?.name || broadsheet.context.programme?.department?.name || '';
    const progName = broadsheet.context.programme?.name || '';
    const sessionName = broadsheet.context.session?.name || '';
    const semesterName = broadsheet.context.semester?.name || '';
    const levelName = broadsheet.context.level || '';

    const curCourses = broadsheet.current_courses || [];
    const carCourses = broadsheet.carryover_courses || [];

    const curCols = Math.max(1, curCourses.length);
    const carCols = Math.max(1, carCourses.length);

    // Calculate total columns
    const totalCols = 4 + curCols + carCols + 12 + 1;

    const getColLetter = (colIndex: number) => {
        let temp, letter = '';
        while (colIndex > 0) {
            temp = (colIndex - 1) % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            colIndex = (colIndex - temp - 1) / 26;
        }
        return letter;
    };
    const lastColLetter = getColLetter(totalCols);

    const logos = await getLoadedLogos();

    // Row 1: Reserved for Logos
    sheet.addRow([]);
    sheet.getRow(1).height = 55;

    const centerCol = Math.max(2, Math.floor(totalCols / 2));
    if (logos.schoolBase64) {
        try {
            const schoolLogoId = workbook.addImage({
                base64: logos.schoolBase64,
                extension: 'png',
            });
            sheet.addImage(schoolLogoId, {
                tl: { col: centerCol - 1.2, row: 0.1 },
                ext: { width: 55, height: 55 },
            });
        } catch (e) {
            console.warn('Failed to embed school logo in Excel', e);
        }
    }

    if (logos.fudmaBase64) {
        try {
            const fudmaLogoId = workbook.addImage({
                base64: logos.fudmaBase64,
                extension: 'png',
            });
            sheet.addImage(fudmaLogoId, {
                tl: { col: centerCol + 0.3, row: 0.1 },
                ext: { width: 55, height: 55 },
            });
        } catch (e) {
            console.warn('Failed to embed FUDMA logo in Excel', e);
        }
    }

    // Row 2: Institution
    const row2 = sheet.addRow([institution]);
    sheet.mergeCells(`A2:${lastColLetter}2`);
    row2.getCell(1).font = { bold: true, size: 18 };
    row2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Affiliation
    const row3 = sheet.addRow(['(in Affiliation with Federal University Dutsinma)']);
    sheet.mergeCells(`A3:${lastColLetter}3`);
    row3.getCell(1).font = { italic: true, bold: true, size: 12, color: { argb: 'FF333333' } };
    row3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 4: Examinations Result Sheet
    const row4 = sheet.addRow(['EXAMINATIONS RESULT SHEET']);
    sheet.mergeCells(`A4:${lastColLetter}4`);
    row4.getCell(1).font = { bold: true, size: 15 };
    row4.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.addRow([]); // empty row 5
    
    // Left side context
    sheet.getCell('A6').value = 'Department:';
    sheet.getCell('A6').font = { bold: true };
    sheet.getCell('B6').value = deptName;
    sheet.mergeCells('B6:D6');
    
    sheet.getCell('A7').value = 'Programme of Study:';
    sheet.getCell('A7').font = { bold: true };
    sheet.getCell('B7').value = progName;
    sheet.mergeCells('B7:D7');
    
    // Right side context
    const rightCol = 5; 
    sheet.getCell(`${getColLetter(rightCol)}6`).value = 'Academic Session:';
    sheet.getCell(`${getColLetter(rightCol)}6`).font = { bold: true };
    sheet.getCell(`${getColLetter(rightCol + 1)}6`).value = sessionName;
    
    sheet.getCell(`${getColLetter(rightCol)}7`).value = 'Contact / Level:';
    sheet.getCell(`${getColLetter(rightCol)}7`).font = { bold: true };
    sheet.getCell(`${getColLetter(rightCol + 1)}7`).value = semesterName;

    if (levelName) {
        sheet.getCell(`${getColLetter(rightCol)}8`).value = 'Level:';
        sheet.getCell(`${getColLetter(rightCol)}8`).font = { bold: true };
        sheet.getCell(`${getColLetter(rightCol + 1)}8`).value = levelName;
    }

    sheet.addRow([]); // empty spacing row 9

    // Table Headers (Row 10, 11, 12)
    // Row 10: Group Headers
    const groupRow = sheet.addRow(['S/N', 'NAME / MATRIC NO.', 'MAX CONTACTS', 'CONTACTS SPENT']);
    const groupRowNum = groupRow.number;
    let colIndex = 5;

    groupRow.getCell(colIndex).value = 'CURRENT CONTACT COURSES';
    sheet.mergeCells(groupRowNum, colIndex, groupRowNum, colIndex + curCols - 1);
    colIndex += curCols;
    
    groupRow.getCell(colIndex).value = 'CARRYOVER COURSES';
    sheet.mergeCells(groupRowNum, colIndex, groupRowNum, colIndex + carCols - 1);
    colIndex += carCols;
    
    groupRow.getCell(colIndex).value = 'CURRENT';
    sheet.mergeCells(groupRowNum, colIndex, groupRowNum, colIndex + 3);
    colIndex += 4;
    
    groupRow.getCell(colIndex).value = 'PREVIOUS';
    sheet.mergeCells(groupRowNum, colIndex, groupRowNum, colIndex + 3);
    colIndex += 4;
    
    groupRow.getCell(colIndex).value = 'CUMULATIVE';
    sheet.mergeCells(groupRowNum, colIndex, groupRowNum, colIndex + 3);
    colIndex += 4;
    
    groupRow.getCell(colIndex).value = 'REMARK';

    // Row 11: Credit Units
    const creditsRowData: any[] = ['', '', '', '']; // skip 4
    if (curCourses.length > 0) curCourses.forEach((c: any) => { creditsRowData.push(`(${c.credit_units})`); });
    else creditsRowData.push('—');
    
    if (carCourses.length > 0) carCourses.forEach((c: any) => { creditsRowData.push(`(${c.credit_units})`); });
    else creditsRowData.push('—');
    
    const creditsRow = sheet.addRow(creditsRowData);
    const creditsRowNum = creditsRow.number;

    // Row 12: Course Codes and Stat Labels
    const codesRowData: any[] = ['', '', '', ''];
    if (curCourses.length > 0) curCourses.forEach((c: any) => { codesRowData.push(c.course_code); });
    else codesRowData.push('—');
    
    if (carCourses.length > 0) carCourses.forEach((c: any) => { codesRowData.push(c.course_code); });
    else codesRowData.push('—');
    
    // CURRENT
    codesRowData.push('TCR', 'TCE', 'TGP', 'GPA');
    // PREVIOUS
    codesRowData.push('CCR', 'CCE', 'CGP', 'CGPA');
    // CUMULATIVE
    codesRowData.push('CCR', 'CCE', 'CGP', 'CGPA');

    const codesRow = sheet.addRow(codesRowData);
    const codesRowNum = codesRow.number;

    // Merge identity and remark vertically across rows 10, 11, 12
    sheet.mergeCells(groupRowNum, 1, codesRowNum, 1);
    sheet.mergeCells(groupRowNum, 2, codesRowNum, 2);
    sheet.mergeCells(groupRowNum, 3, codesRowNum, 3);
    sheet.mergeCells(groupRowNum, 4, codesRowNum, 4);
    sheet.mergeCells(groupRowNum, colIndex, codesRowNum, colIndex);

    let statCol = 5 + curCols + carCols;
    for(let i=0; i<12; i++) {
        sheet.mergeCells(creditsRowNum, statCol + i, codesRowNum, statCol + i);
    }

    // Style headers
    [groupRowNum, creditsRowNum, codesRowNum].forEach(r => {
        sheet.getRow(r).eachCell({ includeEmpty: true }, (cell, cNumber) => {
            if (cNumber > totalCols) return;
            cell.font = { bold: true, size: 9 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            
            if (r === groupRowNum && cNumber >= 5 && cNumber < totalCols) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            }
        });
    });

    // Freeze Panes
    sheet.views = [
        { state: 'frozen', xSplit: 4, ySplit: codesRowNum }
    ];

    sheet.pageSetup.printTitlesRow = `${groupRowNum}:${codesRowNum}`;

    // Column Widths
    sheet.getColumn(1).width = 5;  // S/N
    sheet.getColumn(2).width = 28; // NAME/MATRIC
    sheet.getColumn(3).width = 9; // MAX CONTACTS
    sheet.getColumn(4).width = 9; // CONTACTS SPENT
    
    let wCol = 5;
    if (curCourses.length > 0) curCourses.forEach(() => { sheet.getColumn(wCol++).width = 8; });
    else sheet.getColumn(wCol++).width = 8;
    if (carCourses.length > 0) carCourses.forEach(() => { sheet.getColumn(wCol++).width = 8; });
    else sheet.getColumn(wCol++).width = 8;
    
    for(let i=0; i<12; i++) { sheet.getColumn(wCol++).width = 6.5; }
    sheet.getColumn(wCol).width = 30; // Remark

    // Data Rows
    broadsheet.students.forEach((student: any, idx: number) => {
        let studentName = student.full_name || `${student.last_name || ''}, ${student.first_name || ''} ${student.middle_name || ''}`;
        studentName = studentName.replace(/[\uFFFD]/g, "'").replace(/^[,\s]+|[,\s]+$/g, '').trim();
        const matric = student.matric_number || student.admission_number || '-';
        
        const isDE = student.is_direct_entry ?? (
            student.entry_mode?.toLowerCase().includes('direct') || 
            student.entry_mode?.toLowerCase() === 'de' || 
            /[A-Za-z]+2\/\d+\/\d+/.test(matric)
        );
        const currentContactNum = broadsheet.context?.contact_number ?? null;
        const entryContact = student.entry_contact ?? (isDE ? 2 : 1);
        const contactsSpent = student.contacts_spent ?? 
                              (currentContactNum ? Math.max(1, (currentContactNum - entryContact) + 1) : '-');
        const maxContacts = student.max_contacts ?? 
                            (isDE ? 5 : (broadsheet.context.programme?.duration_years || 6));
        
        const rowData: any[] = [
            idx + 1,
            `${studentName}\n${matric}`,
            maxContacts, // MAX CONTACTS
            contactsSpent // CONTACTS SPENT
        ];

        if (curCourses.length > 0) {
            curCourses.forEach((c: any) => {
                const res = student.current_results?.[c.course_id];
                if (!res) {
                    rowData.push('-');
                } else if (res.status === 'missing') {
                    rowData.push('NR');
                } else {
                    rowData.push(res.display_value || '-');
                }
            });
        } else {
            rowData.push('—');
        }

        if (carCourses.length > 0) {
            carCourses.forEach((c: any, cIdx: number) => {
                let val = null;
                if (Array.isArray(student.carryover_results)) {
                    val = student.carryover_results[cIdx];
                } else if (student.carryover_results && typeof student.carryover_results === 'object') {
                    val = student.carryover_results[c.course_id] ?? student.carryover_results[c.course_code];
                }
                rowData.push(val || '-');
            });
        } else {
            rowData.push('—');
        }

        rowData.push(
            student.current?.registered_credits ?? 0,
            student.current?.earned_credits ?? 0,
            student.current?.quality_points ?? 0,
            student.current?.gpa ?? 0,
            
            student.previous?.registered_credits ?? 0,
            student.previous?.earned_credits ?? 0,
            student.previous?.quality_points ?? 0,
            student.previous?.cgpa ?? 0,
            
            student.cumulative?.registered_credits ?? 0,
            student.cumulative?.earned_credits ?? 0,
            student.cumulative?.quality_points ?? 0,
            student.cumulative?.cgpa ?? 0,
            
            student.remark || ''
        );

        const row = sheet.addRow(rowData);
        
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (colNumber > totalCols) return;
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            cell.font = { size: 9 };
            
            if (colNumber === 2) {
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            } else if (colNumber === totalCols) {
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }
        });
    });

    // Summary, Grading Scale & Legend
    sheet.addRow([]);
    const summary = broadsheet.context?.summary;
    if (summary) {
        const summaryRow = sheet.addRow([
            `Summary: Total Candidates: ${summary.total_students} | Clean Pass: ${summary.total_passed} | Carryover (CO): ${summary.total_carryover} | Probation: ${summary.total_probation} | Withdrawal: ${summary.total_withdrawn}`
        ]);
        sheet.mergeCells(`A${summaryRow.number}:${lastColLetter}${summaryRow.number}`);
        summaryRow.getCell(1).font = { bold: true, size: 9 };
    }

    const scaleRow = sheet.addRow([
        'Grading Scale (5.00 Point System): A = 70–100% (5 pts) | B = 60–69% (4 pts) | C = 50–59% (3 pts) | D = 45–49% (2 pts) | E = 40–44% (1 pt) | F = 0–39% (0 pts)'
    ]);
    sheet.mergeCells(`A${scaleRow.number}:${lastColLetter}${scaleRow.number}`);
    scaleRow.getCell(1).font = { size: 9 };

    const legendRow = sheet.addRow([
        'Legend: TCR = Total Credits Registered, TCE = Total Credits Earned, TGP = Total Grade Points, CCR = Cumulative Credits Registered, CCE = Cumulative Credits Earned, CGP = Cumulative Grade Points, CGPA = Cumulative Grade Point Average, CO = Carryover, (F) = Failed course, ABS = Absent, NR = Not Reported, - = Not Registered'
    ]);
    sheet.mergeCells(`A${legendRow.number}:${lastColLetter}${legendRow.number}`);
    legendRow.getCell(1).font = { italic: true, size: 9 };

    // Footer Signatures
    sheet.addRow([]);
    sheet.addRow([]);
    const sigRow1 = sheet.addRow([]);
    sigRow1.getCell(2).value = 'H.O.D:\n____________________________________\nSignature & Date';
    sigRow1.getCell(2).alignment = { wrapText: true, horizontal: 'center' };
    
    const midSigCol = Math.floor(totalCols / 2);
    sigRow1.getCell(midSigCol).value = 'Exam Officer:\n____________________________________\nSignature & Date';
    sigRow1.getCell(midSigCol).alignment = { wrapText: true, horizontal: 'center' };

    sigRow1.getCell(totalCols - 3).value = 'Appropriate Academic Authority:\n____________________________________\nSignature & Date';
    sigRow1.getCell(totalCols - 3).alignment = { wrapText: true, horizontal: 'center' };
    
    sigRow1.height = 50;

    const approvalStatus = broadsheet.context?.approval_status || 'Draft';
    const computedDate = broadsheet.context?.computed_at
        ? new Date(broadsheet.context.computed_at).toLocaleDateString()
        : new Date().toLocaleDateString();
    const exportedDate = broadsheet.context?.generated_at
        ? new Date(broadsheet.context.generated_at).toLocaleDateString()
        : new Date().toLocaleDateString();

    sheet.addRow([]);
    const metaRow = sheet.addRow([]);
    metaRow.getCell(2).value = `Date Computed: ${computedDate}`;
    metaRow.getCell(midSigCol).value = `Date Exported: ${exportedDate}`;
    metaRow.getCell(totalCols - 3).value = `Approval Status: ${approvalStatus}`;

    sheet.pageSetup.printArea = `A1:${lastColLetter}${metaRow.number}`;

    // Add dedicated Summary worksheet
    if (summary) {
        const sumSheet = workbook.addWorksheet('Summary & Statistics');
        const sRow1 = sumSheet.addRow([institution]);
        sRow1.font = { bold: true, size: 14 };
        const sRowAff = sumSheet.addRow(['(in Affiliation with Federal University Dutsinma)']);
        sRowAff.font = { italic: true, size: 10 };
        const sRow2 = sumSheet.addRow(['EXAMINATION RESULT SUMMARY & PERFORMANCE STATISTICS']);
        sRow2.font = { bold: true, size: 12 };
        sumSheet.addRow([`${progName} | ${sessionName} | ${semesterName}`]);
        sumSheet.addRow([]);

        // Candidate counts table
        const cHead = sumSheet.addRow(['CANDIDATE PERFORMANCE METRICS']);
        cHead.font = { bold: true };
        const cColHead = sumSheet.addRow(['Metric', 'Candidates', 'Percentage']);
        cColHead.font = { bold: true };
        sumSheet.addRow(['Total Candidates', summary.total_students || 0, '100%']);
        sumSheet.addRow(['Clean Pass', summary.total_passed || 0, `${summary.total_students ? ((summary.total_passed / summary.total_students) * 100).toFixed(1) : 0}%`]);
        sumSheet.addRow(['Carryover (CO)', summary.total_carryover || 0, `${summary.total_students ? ((summary.total_carryover / summary.total_students) * 100).toFixed(1) : 0}%`]);
        sumSheet.addRow(['Academic Probation (1.00 - 1.49)', summary.total_probation || 0, '']);
        sumSheet.addRow(['Withdrawal (< 1.00)', summary.total_withdrawn || 0, '']);
        sumSheet.addRow(['Incomplete Results (Pending)', summary.total_incomplete || 0, '']);
        sumSheet.addRow(['Submission Completeness', `${summary.completeness_percentage ?? 100}%`, '']);
        sumSheet.addRow([]);

        // Course Statistics table
        if (summary.course_statistics && summary.course_statistics.length > 0) {
            const crsHead = sumSheet.addRow(['COURSE PERFORMANCE STATISTICS']);
            crsHead.font = { bold: true };
            const crsColHead = sumSheet.addRow(['Course Code', 'Course Title', 'Credit Units', 'Sat', 'Passed', 'Failed', 'Pass %', 'Mean Score']);
            crsColHead.font = { bold: true };
            summary.course_statistics.forEach((c: any) => {
                const sat = c.sat_count ?? c.sat ?? 0;
                const passed = c.pass_count ?? c.passed ?? 0;
                const failed = c.fail_count ?? c.failed ?? 0;
                const passPct = c.pass_percentage ?? 0;
                const meanScore = c.average_score ?? c.mean_score ?? '-';
                sumSheet.addRow([c.course_code, c.course_title, c.credit_units, sat, passed, failed, `${passPct}%`, meanScore]);
            });
            sumSheet.addRow([]);
        }

        // GPA Distribution table
        if (summary.gpa_distribution && summary.gpa_distribution.length > 0) {
            const gpaHead = sumSheet.addRow(['GPA & DEGREE CLASSIFICATION DISTRIBUTION']);
            gpaHead.font = { bold: true };
            const gpaColHead = sumSheet.addRow(['Classification / Band', 'GPA Range', 'Candidates', 'Percentage']);
            gpaColHead.font = { bold: true };
            summary.gpa_distribution.forEach((b: any) => {
                const minVal = Number(b?.min_gpa ?? b?.min ?? 0);
                const maxVal = Number(b?.max_gpa ?? b?.max ?? 0);
                sumSheet.addRow([b.label, `${minVal.toFixed(2)} - ${maxVal.toFixed(2)}`, b.count, `${b.percentage}%`]);
            });
            sumSheet.addRow([]);
        }

        sumSheet.columns.forEach((column) => {
            let maxLen = 15;
            column.eachCell?.({ includeEmpty: true }, (cell) => {
                const val = cell.value ? String(cell.value) : '';
                if (val.length > maxLen) maxLen = Math.min(val.length + 2, 40);
            });
            column.width = maxLen;
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const safeProg = progName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeSess = sessionName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeSem = semesterName.replace(/[^a-zA-Z0-9]/g, '_');
    
    saveAs(blob, `MCCE_Broadsheet_${safeProg}_${safeSess}_${safeSem}.xlsx`);
}
