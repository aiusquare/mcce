import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, VerticalAlign, ShadingType, PageOrientation } from 'docx';
import { saveAs } from 'file-saver';

export async function generateWordStatement(statementData: any) {
    const createCell = (text: string, options: any = {}) => {
        const { bold = false, align = AlignmentType.LEFT, colSpan = 1, bg, fontSize = 20 } = options;
        let shading = undefined;
        if (bg) shading = { type: ShadingType.CLEAR, color: "auto", fill: bg };

        return new TableCell({
            columnSpan: colSpan,
            shading,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
                new Paragraph({
                    alignment: align,
                    children: [new TextRun({ text: text || '', bold, size: fontSize })],
                }),
            ],
        });
    };

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
                    size: { orientation: PageOrientation.PORTRAIT } // A4 Portrait
                }
            },
            children: buildDocumentChildren(statementData, createCell)
        }]
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, `Statement_${statementData.student.matric_number || 'Student'}.docx`);
}

function buildDocumentChildren(data: any, createCell: any) {
    const children: any[] = [];
    const { student, scope, academic_periods } = data;

    // Header Title
    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "MALAM CIROMA COLLEGE OF EDUCATION", bold: true, size: 28 })],
            spacing: { after: 100 }
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "EXAMINATIONS RESULT SHEET", bold: true, size: 24 })],
            spacing: { after: 300 }
        })
    );

    // Profile Info
    const pInfo = (label: string, val: string) => {
        return new Paragraph({
            children: [
                new TextRun({ text: label + ": ", bold: true, size: 20 }),
                new TextRun({ text: val || '-', size: 20 })
            ],
            spacing: { after: 100 }
        });
    };

    children.push(pInfo("PROGRAMME OF STUDY", student.programme));
    children.push(pInfo("DEPARTMENT", student.department));
    children.push(pInfo("STUDENT NAME", student.student_name));
    children.push(pInfo("MATRICULATION NO", student.matric_number || student.admission_number));
    children.push(pInfo("CURRENT LEVEL", student.current_level));
    
    children.push(new Paragraph({ spacing: { before: 200, after: 200 } }));

    // Periods
    academic_periods.forEach((period: any) => {
        children.push(
            new Paragraph({
                children: [new TextRun({ text: `SESSION: ${period.session}  |  CONTACT: ${period.contact}  |  LEVEL: ${period.level}`, bold: true, size: 20 })],
                spacing: { before: 200, after: 100 }
            })
        );

        // Period Table
        const tableRows = [];
        // Header Row
        tableRows.push(new TableRow({
            children: [
                createCell("Code", { bold: true, bg: "F0F0F0" }),
                createCell("Course Title", { bold: true, bg: "F0F0F0" }),
                createCell("CU", { bold: true, bg: "F0F0F0", align: AlignmentType.CENTER }),
                createCell("Score", { bold: true, bg: "F0F0F0", align: AlignmentType.CENTER }),
                createCell("Grade", { bold: true, bg: "F0F0F0", align: AlignmentType.CENTER }),
                createCell("GP", { bold: true, bg: "F0F0F0", align: AlignmentType.CENTER }),
                createCell("QP", { bold: true, bg: "F0F0F0", align: AlignmentType.CENTER }),
                createCell("Remark", { bold: true, bg: "F0F0F0", align: AlignmentType.CENTER })
            ]
        }));

        period.courses.forEach((c: any) => {
            tableRows.push(new TableRow({
                children: [
                    createCell(c.course_code),
                    createCell(c.course_title),
                    createCell(c.credit_unit?.toString(), { align: AlignmentType.CENTER }),
                    createCell(c.status === 'missing' ? 'NR' : c.score?.toString(), { align: AlignmentType.CENTER }),
                    createCell(c.status === 'missing' ? '—' : c.grade, { align: AlignmentType.CENTER }),
                    createCell(c.status === 'missing' ? '—' : c.grade_point?.toString(), { align: AlignmentType.CENTER }),
                    createCell(c.status === 'missing' ? '—' : c.quality_point?.toString(), { align: AlignmentType.CENTER }),
                    createCell(c.status === 'missing' ? 'Missing' : c.grade === 'F' ? 'Carryover' : 'Passed', { align: AlignmentType.CENTER })
                ]
            }));
        });

        const table = new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE }
        });
        children.push(table);

        // Metrics string
        const metricsStr = `TCR: ${period.registered_credits}    TCE: ${period.earned_credits}    TQP: ${period.quality_points}    GPA: ${period.gpa?.toFixed(2)}    Prev CGPA: ${period.previous_cgpa?.toFixed(2)}    Curr CGPA: ${period.current_cgpa?.toFixed(2)}`;
        children.push(new Paragraph({
            children: [new TextRun({ text: metricsStr, bold: true, size: 18 })],
            spacing: { before: 100, after: 50 }
        }));
        
        const outStr = period.outstanding_courses.length > 0 ? period.outstanding_courses.join(", ") : "None";
        children.push(new Paragraph({
            children: [
                new TextRun({ text: "Outstanding: ", bold: true, size: 18 }),
                new TextRun({ text: outStr, size: 18 })
            ],
            spacing: { after: 300 }
        }));
    });

    return children;
}
