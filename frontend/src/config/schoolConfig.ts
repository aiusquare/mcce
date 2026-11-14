/**
 * Maslaha Community College Advance Studies (MCCAS)
 * Central Institution Configuration
 *
 * This file is the single source of truth for all institutional information,
 * brand names, contact details, academic session defaults, and printable document letterheads.
 * Update values here to reflect changes across the entire web application and portals.
 */

export interface SchoolConfig {
  name: {
    full: string;
    short: string;
    acronym: string;
    official: string;
    motto: string;
    tagline: string;
    ownershipNote: string;
  };
  institution: {
    foundedYear: string;
    establishedYear: string;
  };
  contact: {
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    fullAddress: string;
    poBox: string;
    phones: string[];
    primaryPhone: string;
    emails: {
      general: string;
      admissions: string;
      registry: string;
      bursary: string;
      studentAffairs: string;
      ict: string;
      admin: string;
    };
    officeHours: {
      weekdays: string;
      saturdays: string;
      sundays: string;
    };
  };
  academics: {
    currentSession: string;
    nextSession: string;
    applicationOpenDate: string;
    applicationFeeAmount: number;
    applicationFeeFormatted: string;
    acceptanceFeeAmount: number;
    acceptanceFeeFormatted: string;
    regNumberPrefix: string;
    matricNumberPrefix: string;
    programCount: number;
    departmentCount: number;
  };
  payment: {
    applicationFeePrefix: string;
    acceptanceFeePrefix: string;
    invoicePrefix: string;
    walletName: string;
  };
  externalLinks: {
    website: string;
    portalDomain: string;
    hostelPortal: string;
    elibraryPortal: string;
  };
  socials: {
    facebook: string;
    twitter: string;
    instagram: string;
    linkedin: string;
  };
  documents: {
    letterheadTitle: string;
    letterheadSubtitle: string;
    admissionNoticeTitle: string;
    clearanceHeader: string;
    examCardHeader: string;
    invoiceHeader: string;
    receiptHeader: string;
    verificationNotice: string;
    registrarSignatureLabel: string;
    examOfficerSignatureLabel: string;
  };
}

export const schoolConfig: SchoolConfig = {
  name: {
    full: "Maslaha Community College of Education, Funtua",
    short: "Maslaha Community College",
    acronym: "MCCE",
    official: "Maslaha Community College of Education",
    motto: "Academic Performance & Behaviours",
    tagline:
      "Equipping students with advanced scholarship, professional competence, and community leadership.",
    ownershipNote:
      "Advancing higher education through Academic Performance, Competence, and Good Behaviours.",
  },
  institution: {
    foundedYear: "2022",
    establishedYear: "2022",
  },
  contact: {
    addressLine1: "Shuwaki road, Kasuwar mata",
    addressLine2: "Behind Karofi primary school, Funtua",
    city: "Funtua",
    state: "Katsina State",
    country: "Nigeria",
    fullAddress:
      "Shuwaki road, Kasuwar mata, Behind Karofi primary school, Funtua, Katsina State, Nigeria",
    poBox: "",
    phones: ["+234 8069810216", "+234 8065525649"],
    primaryPhone: "+234 8069810216",
    emails: {
      general: "info@maslaha.edu.ng",
      admissions: "admissions@maslaha.edu.ng",
      registry: "registry@maslaha.edu.ng",
      bursary: "bursary@maslaha.edu.ng",
      studentAffairs: "studentaffairs@maslaha.edu.ng",
      ict: "ict@maslaha.edu.ng",
      admin: "admin@maslaha.edu.ng",
    },
    officeHours: {
      weekdays: "Mon - Fri: 8:00 AM - 4:00 PM",
      saturdays: "Sat: 9:00 AM - 1:00 PM",
      sundays: "Closed",
    },
  },
  academics: {
    currentSession: "2026/2027",
    nextSession: "2027/2028",
    applicationOpenDate: "March 12, 2026",
    applicationFeeAmount: 6000,
    applicationFeeFormatted: "₦6,000",
    acceptanceFeeAmount: 5000,
    acceptanceFeeFormatted: "₦5,000",
    regNumberPrefix: "MCCE/",
    matricNumberPrefix: "MCCE/MAT/",
    programCount: 6,
    departmentCount: 6,
  },
  payment: {
    applicationFeePrefix: "MCCE-APP-FEE",
    acceptanceFeePrefix: "MCCE-ACC-FEE",
    invoicePrefix: "MCCE-INV-",
    walletName: "MCCE Student Wallet",
  },
  externalLinks: {
    website: "https://www.maslaha.edu.ng",
    portalDomain: "maslaha.edu.ng",
    hostelPortal: "https://hostels.maslaha.edu.ng",
    elibraryPortal: "https://library.maslaha.edu.ng",
  },
  socials: {
    facebook: "https://facebook.com/MaslahaCollege",
    twitter: "https://twitter.com/MaslahaCollege",
    instagram: "https://instagram.com/MaslahaCollege",
    linkedin: "https://linkedin.com/school/maslaha-college",
  },
  documents: {
    letterheadTitle: "MASLAHA COMMUNITY COLLEGE OF EDUCATION, FUNTUA",
    letterheadSubtitle: "Office of the Academic Registry & Student Admissions",
    admissionNoticeTitle: "PROVISIONAL ADMISSION OFFER",
    clearanceHeader:
      "MASLAHA COMMUNITY COLLEGE OF EDUCATION - CLEARANCE CERTIFICATE",
    examCardHeader: "MASLAHA COMMUNITY COLLEGE OF EDUCATION - EXAMINATION CARD",
    invoiceHeader: "MASLAHA COMMUNITY COLLEGE OF EDUCATION - STUDENT INVOICE",
    receiptHeader:
      "MASLAHA COMMUNITY COLLEGE OF EDUCATION - OFFICIAL PAYMENT RECEIPT",
    verificationNotice:
      "This document was electronically generated from the Maslaha Community College Student Portal. It is valid only with a verifiable database record and official institutional endorsement.",
    registrarSignatureLabel: "Registrar / Academic Secretary",
    examOfficerSignatureLabel: "Examination Office / Registry",
  },
};

export default schoolConfig;
