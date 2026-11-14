import React from "react";
import { GraduatingStudent, GraduationConfig } from "./types";
import { Button } from "@/components/ui/button";
import { Printer, Download, ArrowLeft } from "lucide-react";

interface GraduationPrintDocumentProps {
  students: GraduatingStudent[];
  config: GraduationConfig;
  sessionName: string;
  programmeName: string;
  semesterName?: string;
  onBack?: () => void;
}

export function GraduationPrintDocument({
  students,
  config,
  sessionName,
  programmeName,
  semesterName = "SECOND SEMESTER",
  onBack,
}: GraduationPrintDocumentProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-white text-black p-4 md:p-8 font-sans">
      {/* Top Toolbar (Hidden on Print) */}
      <div className="print:hidden mb-6 flex items-center justify-between bg-muted/60 p-4 rounded-xl border">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Console</span>
            </Button>
          )}
          <span className="text-sm font-medium text-muted-foreground ml-2">
            Print Preview • {students.length} Graduating Students Cleared
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span>Print Official Senate List</span>
          </Button>
        </div>
      </div>

      {/* Official Document Container */}
      <div className="max-w-full mx-auto print:max-w-none print:w-full print:p-0">
        {/* Document Header */}
        <div className="text-center pb-4 mb-4 border-b-2 border-black/80">
          <h1 className="text-xl md:text-2xl font-bold uppercase tracking-wider font-serif">
            {config.institution_name || "FEDERAL UNIVERSITY DUTSIN-MA"}
          </h1>
          <h2 className="text-sm md:text-base font-semibold tracking-wide uppercase text-gray-800">
            {config.institution_address || "P.M.B. 5001 KATSINA STATE"}
          </h2>
          {config.affiliate_name && (
            <h3 className="text-xs md:text-sm font-medium tracking-wide text-gray-700 mt-0.5">
              IN AFFILIATION WITH {config.affiliate_name}
            </h3>
          )}
          <div className="mt-2 text-sm md:text-base font-bold uppercase tracking-wide bg-gray-100 py-1 px-3 inline-block rounded border border-gray-300">
            GRADUATING STUDENTS LIST: {programmeName || "DEGREE PROGRAMME"}, {sessionName || "SESSION"}, {semesterName.toUpperCase()}
          </div>
        </div>

        {/* 15-Column Table Matching PDF */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-xs border-collapse border border-black table-auto print:text-[10px]">
            <thead>
              <tr className="bg-gray-100 uppercase text-center font-bold border-b border-black">
                <th className="border border-black px-1.5 py-1.5 w-8">S/N</th>
                <th className="border border-black px-2 py-1.5 whitespace-nowrap text-left">MATRIC NO.</th>
                <th className="border border-black px-2 py-1.5 text-left min-w-[180px]">NAMES</th>
                <th className="border border-black px-1.5 py-1.5">GENDER</th>
                <th className="border border-black px-2 py-1.5 whitespace-nowrap">JAMB REG. NO</th>
                <th className="border border-black px-2 py-1.5 whitespace-nowrap">DATE OF BIRTH</th>
                <th className="border border-black px-2 py-1.5">ORIGIN</th>
                <th className="border border-black px-1.5 py-1.5 whitespace-nowrap">CURRENT LEVEL</th>
                <th className="border border-black px-1.5 py-1.5 whitespace-nowrap">ENTERY LEVEL</th>
                <th className="border border-black px-1.5 py-1.5 whitespace-nowrap">ENTERY MODE</th>
                <th className="border border-black px-1.5 py-1.5 whitespace-nowrap">YEAR ADMITTED</th>
                <th className="border border-black px-1.5 py-1.5 font-bold">TCE</th>
                <th className="border border-black px-2 py-1.5 font-bold">CGPA</th>
                <th className="border border-black px-2 py-1.5 text-left min-w-[160px]">CLASS</th>
                <th className="border border-black px-2 py-1.5">REMARK</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={15} className="border border-black text-center py-8 text-gray-500 font-medium">
                    No students currently meet all graduation clearance criteria for this session and programme.
                  </td>
                </tr>
              ) : (
                students.map((st, idx) => (
                  <tr
                    key={st.student_id || idx}
                    className="border-b border-black hover:bg-gray-50/50 print:hover:bg-transparent"
                  >
                    <td className="border border-black px-1.5 py-1 text-center font-medium">
                      {st.sn || idx + 1}
                    </td>
                    <td className="border border-black px-2 py-1 font-mono whitespace-nowrap font-semibold">
                      {st.matric_number}
                    </td>
                    <td className="border border-black px-2 py-1 uppercase font-semibold">
                      {st.names}
                    </td>
                    <td className="border border-black px-1.5 py-1 text-center">
                      {st.gender}
                    </td>
                    <td className="border border-black px-2 py-1 text-center font-mono whitespace-nowrap">
                      {st.jamb_reg_no || "—"}
                    </td>
                    <td className="border border-black px-2 py-1 text-center whitespace-nowrap">
                      {st.dob || "—"}
                    </td>
                    <td className="border border-black px-2 py-1 text-center">
                      {st.origin || "—"}
                    </td>
                    <td className="border border-black px-1.5 py-1 text-center">
                      {st.current_level}
                    </td>
                    <td className="border border-black px-1.5 py-1 text-center font-medium">
                      {st.entry_level}
                    </td>
                    <td className="border border-black px-1.5 py-1 text-center font-medium">
                      {st.entry_mode}
                    </td>
                    <td className="border border-black px-1.5 py-1 text-center font-mono">
                      {st.year_admitted}
                    </td>
                    <td className="border border-black px-1.5 py-1 text-center font-bold">
                      {st.tce}
                    </td>
                    <td className="border border-black px-2 py-1 text-center font-bold font-mono">
                      {st.cgpa}
                    </td>
                    <td className="border border-black px-2 py-1 font-medium whitespace-nowrap">
                      {st.class}
                    </td>
                    <td className="border border-black px-2 py-1 text-center font-semibold text-emerald-800 print:text-black">
                      {st.remark || "Pass"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Signatures matching PDF */}
        <div className="mt-12 pt-6 border-t border-black/60 grid grid-cols-3 gap-8 text-center text-xs print:text-[10px] break-inside-avoid">
          <div className="space-y-8">
            <div>
              <span className="font-semibold block uppercase">
                {config.signatory_hod || "Name of H.O.D"}
              </span>
              <span className="text-gray-600 block text-[11px] print:text-[9px]">
                Head of Department
              </span>
            </div>
            <div className="border-t border-black w-48 mx-auto pt-1">
              <span className="italic font-medium">Signature & Date</span>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <span className="font-semibold block uppercase">
                {config.signatory_dean || "Name of Dean"}
              </span>
              <span className="text-gray-600 block text-[11px] print:text-[9px]">
                Dean of Faculty
              </span>
            </div>
            <div className="border-t border-black w-48 mx-auto pt-1">
              <span className="italic font-medium">Signature & Date</span>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <span className="font-semibold block uppercase">
                {config.signatory_vc || "Name of Vice Chancellor"}
              </span>
              <span className="text-gray-600 block text-[11px] print:text-[9px]">
                Vice Chancellor / Senate Chairman
              </span>
            </div>
            <div className="border-t border-black w-48 mx-auto pt-1">
              <span className="italic font-medium">Signature & Date</span>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm 6mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>
    </div>
  );
}

