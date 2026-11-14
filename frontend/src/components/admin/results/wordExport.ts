import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, BorderStyle, AlignmentType, WidthType, VerticalAlign, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { getLoadedLogos } from "./logoHelper";

export async function generateWordBroadsheet(broadsheet: any) {
    const institution = broadsheet.context.institution || 'Maslaha Community College of Education';
    const deptName = broadsheet.context.programme?.department?.name || '';
    const progName = broadsheet.context.programme?.name || '';
    const sessionName = broadsheet.context.session?.name || '';
    const semesterName = broadsheet.context.semester?.name || '';
    const levelName = broadsheet.context.level || '';

    const curCourses = broadsheet.current_courses || [];
    const carCourses = broadsheet.carryover_courses || [];

    const createCell = (text: string, options: any = {}) => {
        const { bold = false, align = AlignmentType.CENTER, colSpan = 1, rowSpan = 1, bg, borderBottom, color } = options;
        
        let shading = undefined;
        if (bg) {
            shading = { type: ShadingType.CLEAR, color: "auto", fill: bg };
        }

        const border = {
            top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
            bottom: { style: borderBottom || BorderStyle.SINGLE, size: 4, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "000000" }
        };

        const runs = text.split('\n').map((line: string, i: number, arr: any[]) => 
            new TextRun({ 
                text: line, 
                bold: bold, 
                size: 14, // 7pt to fit tight spaces
                color: color || "000000",
                break: i > 0 ? 1 : 0
            })
        );

        return new TableCell({
            children: [new Paragraph({ children: runs, alignment: align })],
            verticalAlign: VerticalAlign.CENTER,
            columnSpan: colSpan,
            rowSpan: rowSpan,
            shading,
            borders: border,
            margins: { top: 40, bottom: 40, left: 40, right: 40 }
        });
    };

    const curCols = curCourses.length > 0 ? curCourses : [{ course_id: 'dummy', course_code: '—', credit_units: '—' }];
    const carCols = carCourses.length > 0 ? carCourses : [{ course_id: 'dummy', course_code: '—', credit_units: '—' }];

    const parts: any[] = [
        { title: "Part 1 of 3 (Current Courses)", columns: curCols, type: 'current' },
        { title: "Part 2 of 3 (Carryover Courses)", columns: carCols, type: 'carryover' },
        { title: "Part 3 of 3 (Summary & Remarks)", columns: [], type: 'stats' }
    ];

    const createTableForPart = (part: any) => {
        const rows: TableRow[] = [];
        
        // Header Row 1: Groups
        const header1Cells = [
            createCell('S/N', { bold: true, rowSpan: 3 }),
            createCell('NAME / MATRIC NO.', { bold: true, align: AlignmentType.LEFT, rowSpan: 3 }),
            createCell('MAX\nCONTACTS', { bold: true, rowSpan: 3 }),
            createCell('CONTACTS\nSPENT', { bold: true, rowSpan: 3 })
        ];

        if (part.type === 'current') {
            header1Cells.push(createCell('CURRENT CONTACT COURSES', { bold: true, colSpan: part.columns.length, bg: "F3F4F6" }));
        } else if (part.type === 'carryover') {
            header1Cells.push(createCell('CARRYOVER COURSES', { bold: true, colSpan: part.columns.length, bg: "F3F4F6" }));
        } else if (part.type === 'stats') {
            header1Cells.push(createCell('CURRENT', { bold: true, colSpan: 4, bg: "F3F4F6" }));
            header1Cells.push(createCell('PREVIOUS', { bold: true, colSpan: 4, bg: "F3F4F6" }));
            header1Cells.push(createCell('CUMULATIVE', { bold: true, colSpan: 4, bg: "F3F4F6" }));
            header1Cells.push(createCell('REMARK', { bold: true, rowSpan: 3, bg: "F3F4F6" }));
        }
        rows.push(new TableRow({ children: header1Cells, tableHeader: true }));

        // Header Row 2: Credit Units
        const header2Cells = [];
        if (part.type === 'current' || part.type === 'carryover') {
            part.columns.forEach((c: any) => {
                header2Cells.push(createCell(c.credit_units === '—' ? '—' : `(${c.credit_units})`, { bold: true }));
            });
        } else if (part.type === 'stats') {
            // Stats columns don't have credit units, so we merge rows 2 & 3
            header2Cells.push(createCell('TCR', {bold:true, rowSpan: 2}), createCell('TCE', {bold:true, rowSpan: 2}), createCell('TGP', {bold:true, rowSpan: 2}), createCell('GPA', {bold:true, rowSpan: 2}));
            header2Cells.push(createCell('CCR', {bold:true, rowSpan: 2}), createCell('CCE', {bold:true, rowSpan: 2}), createCell('CGP', {bold:true, rowSpan: 2}), createCell('CGPA', {bold:true, rowSpan: 2}));
            header2Cells.push(createCell('CCR', {bold:true, rowSpan: 2}), createCell('CCE', {bold:true, rowSpan: 2}), createCell('CGP', {bold:true, rowSpan: 2}), createCell('CGPA', {bold:true, rowSpan: 2}));
        }
        rows.push(new TableRow({ children: header2Cells, tableHeader: true }));

        // Header Row 3: Course Codes
        const header3Cells = [];
        if (part.type === 'current' || part.type === 'carryover') {
            part.columns.forEach((c: any) => {
                header3Cells.push(createCell(c.course_code, { bold: true }));
            });
            rows.push(new TableRow({ children: header3Cells, tableHeader: true }));
        } else if (part.type === 'stats') {
            rows.push(new TableRow({ children: [], tableHeader: true }));
        }

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

            const dataCells = [
                createCell(String(idx + 1)),
                createCell(`${studentName}\n${matric}`, { align: AlignmentType.LEFT }),
                createCell(String(maxContacts)), // MAX CONTACTS
                createCell(String(contactsSpent))  // CONTACTS SPENT
            ];
            
            if (part.type === 'current') {
                part.columns.forEach((c: any) => {
                    if (c.course_id === 'dummy') {
                        dataCells.push(createCell('—'));
                        return;
                    }
                    const res = student.current_results?.[c.course_id];
                    if (!res) {
                        dataCells.push(createCell('-'));
                    } else if (res.status === 'missing') {
                        dataCells.push(createCell('NR'));
                    } else {
                        dataCells.push(createCell(res.display_value || '-'));
                    }
                });
            } else if (part.type === 'carryover') {
                part.columns.forEach((c: any, cIdx: number) => {
                    if (c.course_id === 'dummy') {
                        dataCells.push(createCell('—'));
                        return;
                    }
                    let val = null;
                    if (Array.isArray(student.carryover_results)) {
                        val = student.carryover_results[cIdx];
                    } else if (student.carryover_results && typeof student.carryover_results === 'object') {
                        val = student.carryover_results[c.course_id] ?? student.carryover_results[c.course_code];
                    }
                    dataCells.push(createCell(val || '-'));
                });
            } else if (part.type === 'stats') {
                dataCells.push(
                    createCell(String(student.current?.registered_credits ?? 0)),
                    createCell(String(student.current?.earned_credits ?? 0)),
                    createCell(String(student.current?.quality_points ?? 0)),
                    createCell(String(student.current?.gpa ?? 0), { bold: true }),
                    createCell(String(student.previous?.registered_credits ?? 0)),
                    createCell(String(student.previous?.earned_credits ?? 0)),
                    createCell(String(student.previous?.quality_points ?? 0)),
                    createCell(String(student.previous?.cgpa ?? 0), { bold: true }),
                    createCell(String(student.cumulative?.registered_credits ?? 0)),
                    createCell(String(student.cumulative?.earned_credits ?? 0)),
                    createCell(String(student.cumulative?.quality_points ?? 0)),
                    createCell(String(student.cumulative?.cgpa ?? 0), { bold: true }),
                    createCell(student.remark || '', { bold: true, color: student.remark === 'PASS' ? "008000" : "B22222" })
                );
            }
            rows.push(new TableRow({ children: dataCells }));
        });

        return new Table({ rows: rows, width: { size: 100, type: WidthType.PERCENTAGE } });
    };

    const summary = broadsheet.context?.summary;
    const approvalStatus = broadsheet.context?.approval_status || 'Draft';
    const computedDate = broadsheet.context?.computed_at
        ? new Date(broadsheet.context.computed_at).toLocaleDateString()
        : new Date().toLocaleDateString();
    const printedDate = broadsheet.context?.generated_at
        ? new Date(broadsheet.context.generated_at).toLocaleDateString()
        : new Date().toLocaleDateString();

    const logos = await getLoadedLogos();
    const logoRuns: any[] = [];
    if (logos.schoolBuffer && logos.schoolBuffer.byteLength > 0) {
        logoRuns.push(new ImageRun({
            data: logos.schoolBuffer,
            transformation: { width: 55, height: 55 }
        }));
    }
    if (logos.fudmaBuffer && logos.fudmaBuffer.byteLength > 0) {
        if (logoRuns.length > 0) {
            logoRuns.push(new TextRun({ text: "    " }));
        }
        logoRuns.push(new ImageRun({
            data: logos.fudmaBuffer,
            transformation: { width: 55, height: 55 }
        }));
    }

    const sections = parts.map((part, index) => {
        return {
            properties: {
                page: {
                    size: { width: 16838, height: 11906 },
                    margin: { top: 720, right: 720, bottom: 720, left: 720 }
                }
            },
            children: [
                ...(logoRuns.length > 0 ? [
                    new Paragraph({
                        children: logoRuns,
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 120 }
                    })
                ] : []),
                new Paragraph({ children: [new TextRun({ text: institution, bold: true, size: 30 })], alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
                new Paragraph({ children: [new TextRun({ text: "(in Affiliation with Federal University Dutsinma)", italics: true, bold: true, size: 22, color: "333333" })], alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
                new Paragraph({ children: [new TextRun({ text: "EXAMINATIONS RESULT SHEET", bold: true, size: 26 })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
                
                // Academic Context Header using a borderless table
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE } },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Department: ", bold: true }), new TextRun(deptName)] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Academic Session: ", bold: true }), new TextRun(sessionName)] })] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Programme of Study: ", bold: true }), new TextRun(progName)] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Contact / Level: ", bold: true }), new TextRun(semesterName)] })] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Level: ", bold: true }), new TextRun(levelName)] })] }),
                            ]
                        })
                    ]
                }),

                new Paragraph({ children: [new TextRun({ text: "Broadsheet - " + part.title, italics: true, size: 20 })], alignment: AlignmentType.RIGHT, spacing: { before: 240, after: 120 } }),
                
                createTableForPart(part),

                ...(index === parts.length - 1 ? [
                    ...(summary ? [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Summary: ", bold: true, size: 16 }),
                                new TextRun({
                                    text: `Total Candidates: ${summary.total_students} | Clean Pass: ${summary.total_passed} | Carryover (CO): ${summary.total_carryover} | Probation: ${summary.total_probation} | Withdrawal: ${summary.total_withdrawn}`,
                                    size: 16
                                })
                            ],
                            spacing: { before: 120, after: 60 }
                        })
                    ] : []),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Grading Scale (5.00 Point System): ", bold: true, size: 16 }),
                            new TextRun({ text: "A = 70–100% (5 pts) | B = 60–69% (4 pts) | C = 50–59% (3 pts) | D = 45–49% (2 pts) | E = 40–44% (1 pt) | F = 0–39% (0 pts)", size: 16 })
                        ],
                        spacing: { before: 60, after: 60 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Legend: TCR = Total Credits Registered, TCE = Total Credits Earned, TGP = Total Grade Points, CCR = Cumulative Credits Registered, CCE = Cumulative Credits Earned, CGP = Cumulative Grade Points, CGPA = Cumulative Grade Point Average, CO = Carryover, (F) = Failed course, ABS = Absent, NR = Not Reported, - = Not Registered",
                                italics: true,
                                size: 16
                            })
                        ],
                        spacing: { before: 60, after: 360 }
                    }),
                    
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "H.O.D:\n____________________________________\nSignature & Date" })], alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Exam Officer:\n____________________________________\nSignature & Date" })], alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Appropriate Academic Authority:\n____________________________________\nSignature & Date" })], alignment: AlignmentType.CENTER })] })
                                ]
                            })
                        ]
                    }),
                    
                    new Paragraph({ spacing: { before: 360 } }),
                    
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Date Computed: ${computedDate}` })] })] }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Date Exported: ${printedDate}` })], alignment: AlignmentType.CENTER })] }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Approval Status: ${approvalStatus}` })], alignment: AlignmentType.RIGHT })] })
                                ]
                            })
                        ]
                    })
                ] : [])
            ]
        };
    });

    const doc = new Document({ sections: sections });
    const blob = await Packer.toBlob(doc);
    
    const safeProg = progName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeSess = sessionName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeSem = semesterName.replace(/[^a-zA-Z0-9]/g, '_');
    
    saveAs(blob, `MCCE_Broadsheet_${safeProg}_${safeSess}_${safeSem}.docx`);
}
