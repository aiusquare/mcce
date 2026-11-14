import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Upload,
  User,
} from "lucide-react";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import logo from "@/assets/logo.png";
import schoolConfig from "@/config/schoolConfig";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getApplicationProgress,
  getSubmittedApplication,
  getSubmittedApplicationPdfUrl,
  getStudentProfile,
  submitApplication,
  updateApplicationProgressStep,
  api,
} from "@/lib/api";
import { degreeProgrammeCatalogue } from "@/lib/academicProgrammes";
import { toast } from "sonner";
const stateToLGAs: Record<string, string[]> = {
  abia: [
    "aba north",
    "aba south",
    "arochukwu",
    "bende",
    "ikwuano",
    "isiala ngwa north",
    "isiala ngwa south",
    "isuikwuato",
    "obi ngwa",
    "ohafia",
    "osisioma ngwa",
    "ugwunagbo",
    "ukwa east",
    "ukwa west",
    "umuahia north",
    "umuahia south",
    "umu nneochi",
  ],
  adamawa: [
    "demsa",
    "fufore",
    "ganye",
    "girei",
    "gombi",
    "guyuk",
    "hong",
    "jada",
    "lamurde",
    "madagali",
    "maiha",
    "mayo belwa",
    "michika",
    "mubi north",
    "mubi south",
    "numan",
    "shelleng",
    "song",
    "toungo",
    "yola north",
    "yola south",
  ],
  "akwa ibom": [
    "abak",
    "eastern obolo",
    "eket",
    "esit eket",
    "essien udim",
    "etim ekpo",
    "etinan",
    "ibeno",
    "ibesikpo asutan",
    "ibiono ibom",
    "ika",
    "ikono",
    "ikot abasi",
    "ikot ekpene",
    "ini",
    "itu",
    "mbo",
    "mkpat enin",
    "nsit atai",
    "nsit ibom",
    "nsit ubium",
    "obot akara",
    "okobo",
    "onna",
    "oron",
    "oruk anam",
    "udung uko",
    "ukanafun",
    "uruan",
    "urue offong oruko",
    "uyo",
  ],
  anambra: [
    "aguata",
    "anambra east",
    "anambra west",
    "anaocha",
    "awka north",
    "awka south",
    "ayamelum",
    "dunukofia",
    "ekwusigo",
    "idemili north",
    "idemili south",
    "ihiala",
    "njikoka",
    "nnewi north",
    "nnewi south",
    "ogbaru",
    "onitsha north",
    "onitsha south",
    "orumba north",
    "orumba south",
    "oyi",
  ],
  bauchi: [
    "alkaleri",
    "bauchi",
    "bogoro",
    "damban",
    "darazo",
    "dass",
    "gamawa",
    "ganjuwa",
    "giade",
    "itas/gadau",
    "jama'are",
    "katagum",
    "kirfi",
    "misau",
    "ningi",
    "shira",
    "tafawa balewa",
    "toro",
    "warji",
    "zaki",
  ],
  bayelsa: [
    "brass",
    "ekeremor",
    "kolokuma/opokuma",
    "nembe",
    "ogbia",
    "sagbama",
    "southern ijaw",
    "yenagoa",
  ],
  benue: [
    "ado",
    "agatu",
    "apa",
    "buruku",
    "gboko",
    "guma",
    "gwer east",
    "gwer west",
    "katsina-ala",
    "konshisha",
    "kwande",
    "logo",
    "makurdi",
    "obi",
    "ohimini",
    "oju",
    "okpokwu",
    "otukpo",
    "tarka",
    "ukum",
    "ushongo",
    "vandeikya",
  ],
  borno: [
    "abadam",
    "askira/uba",
    "bama",
    "bayo",
    "biu",
    "chibok",
    "damboa",
    "dikwa",
    "gubio",
    "guzamala",
    "gwoza",
    "hawul",
    "jere",
    "kaga",
    "kala/balge",
    "konduga",
    "kukawa",
    "kwaya kusar",
    "mafa",
    "magumeri",
    "maiduguri",
    "marte",
    "mobbar",
    "monguno",
    "ngala",
    "nganzai",
    "shani",
  ],
  "cross river": [
    "abi",
    "akamkpa",
    "akpabuyo",
    "bekwarra",
    "biase",
    "boki",
    "calabar municipal",
    "calabar south",
    "etung",
    "ikom",
    "obanliku",
    "obubra",
    "obudu",
    "odukpani",
    "ogoja",
    "yakurr",
    "yala",
  ],
  delta: [
    "aniocha north",
    "aniocha south",
    "bomadi",
    "burutu",
    "ethiope east",
    "ethiope west",
    "ika north east",
    "ika south",
    "isoko north",
    "isoko south",
    "ndokwa east",
    "ndokwa west",
    "okpe",
    "oshimili north",
    "oshimili south",
    "patani",
    "sapele",
    "udu",
    "ughelli north",
    "ughelli south",
    "ukwuani",
    "uvwie",
    "warri north",
    "warri south",
    "warri south west",
  ],
  ebonyi: [
    "abakaliki",
    "afikpo north",
    "afikpo south",
    "ebonyi",
    "ezza north",
    "ezza south",
    "ikwo",
    "ishielu",
    "ivo",
    "izzi",
    "ohaozara",
    "ohaukwu",
    "onicha",
  ],
  edo: [
    "akoko-edo",
    "egor",
    "esan central",
    "esan north-east",
    "esan south-east",
    "esan west",
    "etsako central",
    "etsako east",
    "etsako west",
    "igueben",
    "ikpoba-okha",
    "orhionmwon",
    "ovia north-east",
    "ovia south-west",
    "owan east",
    "owan west",
    "uhunmwonde",
  ],
  ekiti: [
    "ado-ekiti",
    "efon",
    "ekiti east",
    "ekiti south-west",
    "ekiti west",
    "emure",
    "gbonyin",
    "ido/osi",
    "ijero",
    "ikere",
    "ikole",
    "ilejemeje",
    "irepodun/ifelodun",
    "ise/orun",
    "moba",
    "oye",
  ],
  enugu: [
    "aninri",
    "awgu",
    "enugu east",
    "enugu north",
    "enugu south",
    "ezeagu",
    "igbo etiti",
    "igbo eze north",
    "igbo eze south",
    "isi uzo",
    "nkanu east",
    "nkanu west",
    "nsukka",
    "oji river",
    "udenu",
    "udi",
    "uzo-uwani",
  ],
  fct: ["abaji", "bwari", "gwagwalada", "kuje", "kwali", "abuja municipal"],
  gombe: [
    "akko",
    "balanga",
    "billiri",
    "dukku",
    "funakaye",
    "gombe",
    "kaltungo",
    "kwami",
    "nafada",
    "shongom",
    "yamaltu/deba",
  ],
  imo: [
    "aboh mbaise",
    "ahiazu mbaise",
    "ehime mbano",
    "ezinihitte mbaise",
    "ideato north",
    "ideato south",
    "ihitte/uboma",
    "ikeduru",
    "isiala mbano",
    "isu",
    "mbaitoli",
    "ngor okpala",
    "njaba",
    "nkwerre",
    "nwangele",
    "obowo",
    "oguta",
    "ohaji/egbema",
    "okigwe",
    "orlu",
    "orsu",
    "oru east",
    "oru west",
    "owerri municipal",
    "owerri north",
    "owerri west",
  ],
  jigawa: [
    "auyo",
    "babura",
    "biriniwa",
    "birnin kudu",
    "buji",
    "dutse",
    "gagarawa",
    "garki",
    "gumel",
    "guri",
    "gwaram",
    "gwiwa",
    "hadejia",
    "jahun",
    "kafin hausa",
    "kaugama",
    "kazaure",
    "kiri kasama",
    "kiyawa",
    "maigatari",
    "malam madori",
    "miga",
    "ringim",
    "roni",
    "sule tankarkar",
    "taura",
    "yankwashi",
  ],
  kaduna: [
    "birnin gwari",
    "chikun",
    "giwa",
    "igabi",
    "ikara",
    "jaba",
    "jemaa",
    "kachia",
    "kaduna north",
    "kaduna south",
    "kagarko",
    "kajuru",
    "kaura",
    "kauru",
    "kubau",
    "kudan",
    "lere",
    "makarfi",
    "sabon gari",
    "sanga",
    "soba",
    "zangon kataf",
    "zaria",
  ],
  kano: [
    "ajingi",
    "albasu",
    "bagwai",
    "bebeji",
    "bichi",
    "bunkure",
    "dala",
    "dambatta",
    "dawakin kudu",
    "dawakin tofa",
    "doguwa",
    "fagge",
    "gabasawa",
    "garko",
    "garun mallam",
    "gaya",
    "gezawa",
    "gwale",
    "gwarzo",
    "kabo",
    "kano municipal",
    "karaye",
    "kibiya",
    "kiru",
    "kumbotso",
    "kunchi",
    "kura",
    "madobi",
    "makoda",
    "minjibir",
    "nasarawa",
    "rano",
    "rimin gado",
    "rogo",
    "shanono",
    "sumaila",
    "takai",
    "tarauni",
    "tofa",
    "tsanyawa",
    "tudun wada",
    "ungogo",
    "warawa",
    "wudil",
  ],
  katsina: [
    "bakori",
    "batagarawa",
    "batsari",
    "baure",
    "bindawa",
    "charanchi",
    "dan musa",
    "dandume",
    "danja",
    "daura",
    "dutsi",
    "dutsin-ma",
    "faskari",
    "funtua",
    "ingawa",
    "jibia",
    "kafur",
    "kaita",
    "kankara",
    "kankia",
    "katsina",
    "kurfi",
    "kusada",
    "mai'adua",
    "malumfashi",
    "mani",
    "mashi",
    "matazu",
    "musawa",
    "rimi",
    "sabuwa",
    "safana",
    "sandamu",
    "zango",
  ],
  kebbi: [
    "aleiro",
    "arewa dandi",
    "argungu",
    "augie",
    "bagudo",
    "birnin kebbi",
    "bunza",
    "dandi",
    "fakai",
    "gwandu",
    "jega",
    "kalgo",
    "koko/besse",
    "maiyama",
    "ngaski",
    "sakaba",
    "shanga",
    "suru",
    "wasagu/danko",
    "yauri",
    "zuru",
  ],
  kogi: [
    "adavi",
    "ajaokuta",
    "ankpa",
    "bassa",
    "dekina",
    "ibaji",
    "idah",
    "igalamela",
    "ijumu",
    "kabba/bunu",
    "kogi",
    "lokoja",
    "mopa-muro",
    "ofu",
    "ogori/magongo",
    "okehi",
    "okene",
    "olamaboro",
    "omala",
    "yagba east",
    "yagba west",
  ],
  kwara: [
    "asa",
    "baruten",
    "edu",
    "ekiti",
    "ifelodun",
    "ilorin east",
    "ilorin south",
    "ilorin west",
    "irepodun",
    "isin",
    "kaiama",
    "moro",
    "offa",
    "oke ero",
    "oyun",
    "pategi",
  ],
  lagos: [
    "agege",
    "ajeromi-ifelodun",
    "alimosho",
    "amuwo odofin",
    "apapa",
    "badagry",
    "epe",
    "eti-osa",
    "ibeju-lekki",
    "ifako-ijaiye",
    "ikeja",
    "ikorodu",
    "kosofe",
    "lagos island",
    "lagos mainland",
    "mushin",
    "ojo",
    "oshodi-isolo",
    "shomolu",
    "surulere",
  ],
  nasarawa: [
    "akwanga",
    "awe",
    "doma",
    "karu",
    "keana",
    "keffi",
    "kokona",
    "lafia",
    "nasarawa",
    "nasarawa eggon",
    "obi",
    "toto",
    "waku",
  ],
  niger: [
    "agaie",
    "agwara",
    "bida",
    "borgu",
    "bosso",
    "chanchaga",
    "edati",
    "gbako",
    "gurara",
    "katcha",
    "kontagora",
    "lapai",
    "lavun",
    "magama",
    "mariga",
    "mashegu",
    "mokwa",
    "munya",
    "paikoro",
    "rafi",
    "rijau",
    "shiroro",
    "suleja",
    "tafa",
    "wushishi",
  ],
  ogun: [
    "abeokuta north",
    "abeokuta south",
    "ado-odo/ota",
    "ewekoro",
    "ifo",
    "ijebu east",
    "ijebu north",
    "ijebu north east",
    "ijebu ode",
    "ikenne",
    "imeko afon",
    "ipokia",
    "obafemi-owode",
    "odeda",
    "odogbolu",
    "ogun waterside",
    "remo north",
    "sagamu",
    "yewa north",
    "yewa south",
  ],
  ondo: [
    "akoko north east",
    "akoko north west",
    "akoko south east",
    "akoko south west",
    "akure north",
    "akure south",
    "ese-odo",
    "idanre",
    "ifedore",
    "ilaje",
    "ile-oluji/okeigbo",
    "irele",
    "odigbo",
    "okitipupa",
    "ose",
    "owo",
  ],
  osun: [
    "atakunmosa east",
    "atakunmosa west",
    "ayedaade",
    "ayedire",
    "boluwaduro",
    "boripe",
    "ede north",
    "ede south",
    "egbedore",
    "ejigbo",
    "ife central",
    "ife east",
    "ife north",
    "ife south",
    "ifedayo",
    "ifelodun",
    "ila",
    "ilesa east",
    "ilesa west",
    "irepodun",
    "irewole",
    "isokan",
    "iwo",
    "obokun",
    "odo otin",
    "ola oluwa",
    "olorunda",
    "oriade",
    "orolu",
    "osogbo",
  ],
  oyo: [
    "afijio",
    "akinyele",
    "atiba",
    "atisbo",
    "egbeda",
    "ibadan north",
    "ibadan north east",
    "ibadan north west",
    "ibadan south east",
    "ibadan south west",
    "ibarapa central",
    "ibarapa east",
    "ibarapa north",
    "ido",
    "irepo",
    "iseyin",
    "itesiwaju",
    "iwajowa",
    "kajola",
    "lagelu",
    "ogbomosho north",
    "ogbomosho south",
    "ogo oluwa",
    "olorunsogo",
    "oluyole",
    "ona ara",
    "orelope",
    "ori ire",
    "oyo east",
    "oyo west",
    "saki east",
    "saki west",
    "surulere",
  ],
  plateau: [
    "barkin ladi",
    "bassa",
    "bokkos",
    "jos east",
    "jos north",
    "jos south",
    "kanam",
    "kanke",
    "langtang north",
    "langtang south",
    "mangu",
    "mikang",
    "pankshin",
    "qua'an pan",
    "riyom",
    "shendam",
    "wase",
  ],
  rivers: [
    "abua/odual",
    "ahoada east",
    "ahoada west",
    "akuku-toru",
    "andoni",
    "asari-toru",
    "bonny",
    "degema",
    "eleme",
    "emohua",
    "etche",
    "gokana",
    "ikwerre",
    "khana",
    "obio/akpor",
    "ogba/egbema/ndoni",
    "okrika",
    "omuma",
    "opobo/nkoro",
    "oyigbo",
    "port harcourt",
    "tai",
  ],
  sokoto: [
    "binji",
    "bodinga",
    "dange/shuni",
    "gada",
    "goronyo",
    "gudu",
    "gwadabawa",
    "illela",
    "isa",
    "kebbe",
    "kware",
    "rabah",
    "sabon birni",
    "shagari",
    "silame",
    "sokoto north",
    "sokoto south",
    "tambuwal",
    "tangaza",
    "tureta",
    "wamako",
    "wurno",
    "yabo",
  ],
  taraba: [
    "ardokola",
    "bali",
    "donga",
    "gashaka",
    "gassol",
    "ibi",
    "jalingo",
    "karim lamido",
    "kurmi",
    "lau",
    "sardauna",
    "takum",
    "ussa",
    "wukari",
    "yorro",
    "zing",
  ],
  yobe: [
    "bade",
    "bursari",
    "damaturu",
    "fika",
    "fune",
    "geidam",
    "gulani",
    "jakusko",
    "karasuwa",
    "machina",
    "nangere",
    "nguru",
    "potiskum",
    "tarmuwa",
    "yunusari",
    "yusufari",
  ],
  zamfara: [
    "anka",
    "bakura",
    "birnin magaji/kaura",
    "bukkuyum",
    "bungudu",
    "gummi",
    "gusau",
    "kaura namoda",
    "maradun",
    "maru",
    "shinkafi",
    "talata mafara",
    "tsafe",
    "zurmi",
  ],
};

const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  maritalStatus: z
    .string()
    .min(1, "Marital status is required")
    .refine((val) => val.length > 0, "Marital status is required"),
  nationality: z.string().min(1, "Nationality is required"),
  stateOfOrigin: z.string().min(1, "State of origin is required"),
  localGovernment: z.string().min(1, "Local government is required"),
});

const contactInfoSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().min(7, "Phone number is required"),
  alternatePhone: z.string().optional(),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().optional(),
});

const jambInfoSchema = z.object({
  jambNumber: z.string().optional(),
  jambScore: z.string().optional(),
});

const academicInfoSchema = z.object({
  program: z.string().optional(),
  entryMode: z.string().optional(),
  previousInstitution: z.string().optional(),
  qualification: z.string().min(1, "Qualification is required"),
  graduationYear: z.string().optional(),
  gradeObtained: z.string().optional(),
  examNumber: z.string().optional(),
  examCenter: z.string().optional(),
  examYear: z.string().optional(),
  examNumber2: z.string().optional(),
  examCenter2: z.string().optional(),
  examYear2: z.string().optional(),
  previousInstitution2: z.string().optional(),
  qualification2: z.string().optional(),
  graduationYear2: z.string().optional(),
  applicationSession: z.string().min(1, "Session is required"),
  applicationLevel: z.string().optional(),
  applicationModeOfEntry: z.string().min(1, "Mode of entry is required"),
  firstChoiceDepartment: z.string().min(1, "Department is required"),
  firstChoiceProgram: z.string().min(1, "Program is required"),
  secondChoiceDepartment: z.string().optional(),
  secondChoiceProgram: z.string().optional(),
  courseOfStudy: z.string().optional(),
  cgpa: z.string().optional(),
});

const guardianInfoSchema = z.object({
  guardianName: z.string().min(1, "Parent/Guardian name is required"),
  guardianEmail: z.string().email("Invalid email address").optional(),
  guardianPhone: z.string().min(7, "Parent/Guardian phone is required"),
  guardianAddress: z.string().min(5, "Parent/Guardian address is required"),
});

const oLevelSubjectSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  grade: z.string().min(1, "Grade is required"),
});

type OLevelSubject = z.infer<typeof oLevelSubjectSchema>;
type PersonalInfo = z.infer<typeof personalInfoSchema>;
type ContactInfo = z.infer<typeof contactInfoSchema>;
type JAMBInfo = z.infer<typeof jambInfoSchema>;
type AcademicInfo = z.infer<typeof academicInfoSchema>;
type GuardianInfo = z.infer<typeof guardianInfoSchema>;

type StudentProfile = {
  id?: string;
  full_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  state_of_origin?: string;
  lga?: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  nationality?: string;
};

type ApplicationProgress = {
  current_step?: number;
  is_submitted?: boolean;
  status?: string;
  application_no?: string;
};

type ApplicationDraft = {
  personal: PersonalInfo;
  contact: ContactInfo;
  jamb: JAMBInfo;
  academic: AcademicInfo;
  guardian: GuardianInfo;
};

const nigerianStates = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
  "FCT",
];

const applicationEntryModes = [
  { value: "fresh", label: "Fresh" },
  { value: "direct-entry", label: "Direct Entry" },
];

type ProgrammeCatalogueItem = {
  department_id: string;
  department: string;
  department_code?: string | null;
  programmes: Array<{ id: string; code: string; name: string }>; // backend already filters active
};

type AcademicSession = {
  id?: string | null;
  name: string;
  is_active?: number | boolean;
};

const programCatalogue: ProgrammeCatalogueItem[] = degreeProgrammeCatalogue;

const oLevelSubjects = [
  "English Language",
  "Mathematics",
  "Civic Education",
  "Biology",
  "Chemistry",
  "Physics",
  "Geography",
  "Economics",
  "Government",
  "Literature in English",
  "Agricultural Science",
  "Further Mathematics",
  "Computer Studies",
  "Commerce",
  "Accounting/Book Keeping",
  "History",
  "Christian Religious Studies",
  "Islamic Religious Studies",
  "French",
  "Yoruba",
  "Igbo",
  "Hausa",
  "Technical Drawing",
  "Health Education",
];

const normalizeSubjectValue = (val: string) => {
  const lower = (val || "").toLowerCase();
  const match = oLevelSubjects.find(
    (subj) =>
      subj.toLowerCase() === lower ||
      subj.toLowerCase().replace(/\s+/g, "-") === lower,
  );
  return match || val;
};

const normalizeKey = (val: string) => normalizeSubjectValue(val).toLowerCase();

const oLevelGrades = [
  { value: "A1", label: "A1 (Excellent)" },
  { value: "B2", label: "B2 (Very Good)" },
  { value: "B3", label: "B3 (Good)" },
  { value: "C4", label: "C4 (Credit)" },
  { value: "C5", label: "C5 (Credit)" },
  { value: "C6", label: "C6 (Credit)" },
  { value: "D7", label: "D7 (Pass)" },
  { value: "E8", label: "E8 (Pass)" },
  { value: "F9", label: "F9 (Fail)" },
  { value: "AWAITING", label: "Awaiting Result" },
];

const requiredOLevelSubjects = [
  { key: "english language", label: "English Language" },
  { key: "mathematics", label: "Mathematics" },
];

const legacyScienceCoreSubjects = new Set(["chemistry", "physics", "biology"]);

const steps = [
  { id: 1, name: "Personal Info", icon: User },
  { id: 2, name: "Contact", icon: Phone },
  { id: 3, name: "JAMB Details", icon: FileText },
  { id: 4, name: "Educational History", icon: GraduationCap },
  { id: 5, name: "Programme Application", icon: GraduationCap },
  { id: 6, name: "Other Details", icon: User },
  { id: 7, name: "Documents", icon: Upload },
  { id: 8, name: "Review & Submit", icon: Check },
];

const DRAFT_KEY = "mccas_application_draft";
const DRAFT_OWNER_KEY = "mccas_application_draft_owner";
const DRAFT_STEP_KEY = "mccas_application_step";

export default function ApplicationPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [applicationProgress, setApplicationProgress] =
    useState<ApplicationProgress | null>(null);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<string, File | null>
  >({
    oLevelResult: null,
    oLevelResult2: null,
    birthCertificate: null,
    passport: null,
    localGovtId: null,
    transcript: null,
    ondCertificate: null,
    nceCertificate: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const isSubmitted = Boolean(
    applicationProgress?.is_submitted ||
    (applicationProgress?.status && applicationProgress.status !== "draft"),
  );
  const applicationNo = applicationProgress?.application_no || "Pending";
  const applicationStatus = applicationProgress?.status || "submitted";

  // Normalize any pre-existing subject values (e.g., from older drafts) to full names
  useEffect(() => {
    setOLevelSubjects1((prev) =>
      prev.map((s) => ({ ...s, subject: normalizeSubjectValue(s.subject) })),
    );
    setOLevelSubjects2((prev) =>
      prev.map((s) => ({ ...s, subject: normalizeSubjectValue(s.subject) })),
    );
  }, []);

  // O'Level subjects state (for first and second sitting)
  const [oLevelSubjects1, setOLevelSubjects1] = useState<OLevelSubject[]>([
    { subject: "", grade: "" },
    { subject: "", grade: "" },
    { subject: "", grade: "" },
    { subject: "", grade: "" },
    { subject: "", grade: "" },
    { subject: "", grade: "" },
    { subject: "", grade: "" },
    { subject: "", grade: "" },
    { subject: "", grade: "" },
  ]);

  const [oLevelSubjects2, setOLevelSubjects2] = useState<OLevelSubject[]>([
    { subject: "", grade: "" },
    { subject: "", grade: "" },
    { subject: "", grade: "" },
    { subject: "", grade: "" },
    { subject: "", grade: "" },
  ]);

  const [hasSecondSitting, setHasSecondSitting] = useState(false);

  // Simulated NIN data (would come from registration)
  const ninData = {
    firstName: "Aminu",
    middleName: "Ibrahim",
    lastName: "Mohammed",
    dateOfBirth: "1998-05-15",
    gender: "male",
  };

  const personalForm = useForm<PersonalInfo>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: ninData.firstName,
      middleName: ninData.middleName,
      lastName: ninData.lastName,
      dateOfBirth: ninData.dateOfBirth,
      gender: ninData.gender,
      maritalStatus: "",
      nationality: "Nigerian",
      stateOfOrigin: "",
      localGovernment: "",
    },
  });

  const contactForm = useForm<ContactInfo>({
    resolver: zodResolver(contactInfoSchema),
    defaultValues: {
      email: "",
      phone: "",
      alternatePhone: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
    },
  });

  const jambForm = useForm<JAMBInfo>({
    resolver: zodResolver(jambInfoSchema),
    defaultValues: {
      jambNumber: "",
      jambScore: "",
    },
  });

  const academicForm = useForm<AcademicInfo>({
    resolver: zodResolver(academicInfoSchema),
    defaultValues: {
      program: "",
      entryMode: "",
      previousInstitution: "",
      qualification: "",
      graduationYear: "",
      gradeObtained: "",
      examNumber: "",
      examCenter: "",
      examYear: "",
      applicationSession: "",
      applicationLevel: "",
      applicationModeOfEntry: "",
      firstChoiceDepartment: "",
      firstChoiceProgram: "",
      secondChoiceDepartment: "",
      secondChoiceProgram: "",
      courseOfStudy: "",
      cgpa: "",
    },
  });

  const guardianForm = useForm<GuardianInfo>({
    resolver: zodResolver(guardianInfoSchema),
    defaultValues: {
      guardianName: "",
      guardianEmail: "",
      guardianPhone: "",
      guardianAddress: "",
    },
  });

  const selectedQualification = academicForm.watch("qualification");
  const isOLevel = ["waec", "neco", "nabteb"].includes(selectedQualification);
  const isHigherQualification = ["ond", "nce"].includes(selectedQualification);

  // Auto-fill core subjects for O'Level paths
  useEffect(() => {
    if (!isOLevel) return;

    setOLevelSubjects1((prev) => {
      const next = [...prev];
      requiredOLevelSubjects.forEach((req, idx) => {
        if (!next[idx]) {
          next[idx] = { subject: req.label, grade: "" };
        } else {
          next[idx] = { ...next[idx], subject: req.label };
        }
      });

      for (let idx = requiredOLevelSubjects.length; idx < next.length; idx++) {
        const key = normalizeKey(next[idx]?.subject || "");
        if (legacyScienceCoreSubjects.has(key) && !next[idx]?.grade) {
          next[idx] = { ...next[idx], subject: "" };
        }
      }
      return next;
    });
  }, [isOLevel]);

  const selectedModeValue = academicForm.watch("applicationModeOfEntry");
  const selectedFirstDept = academicForm.watch("firstChoiceDepartment");
  const selectedSecondDept = academicForm.watch("secondChoiceDepartment");
  const selectedFirstProgram = academicForm.watch("firstChoiceProgram");

  const selectedStateValue = personalForm.watch("stateOfOrigin");
  const lgaOptions = useMemo(() => {
    if (!selectedStateValue) return [];
    const key = selectedStateValue.toLowerCase();
    return stateToLGAs[key] || [];
  }, [selectedStateValue]);

  const [programmeCatalogue, setProgrammeCatalogue] =
    useState<ProgrammeCatalogueItem[]>(programCatalogue);
  const [activeSession, setActiveSession] = useState<AcademicSession | null>(
    null,
  );

  const filteredProgrammeCatalogue = useMemo(() => {
    return programmeCatalogue;
  }, [programmeCatalogue]);

  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    filteredProgrammeCatalogue.forEach((item) => {
      if (item.programmes && item.programmes.length > 0) {
        depts.add(item.department);
      }
    });
    return Array.from(depts);
  }, [filteredProgrammeCatalogue]);

  const getProgramsByDepartment = (dept?: string) => {
    if (!dept) return [] as Array<{ code: string; name: string }>;
    const programs: Array<{ code: string; name: string }> = [];
    filteredProgrammeCatalogue
      .filter((item) => item.department === dept)
      .forEach((item) => {
        item.programmes.forEach((p) =>
          programs.push({ code: p.code, name: p.name }),
        );
      });
    return programs;
  };

  const firstChoicePrograms = useMemo(
    () => getProgramsByDepartment(selectedFirstDept),
    [selectedFirstDept, filteredProgrammeCatalogue],
  );

  const secondChoicePrograms = useMemo(() => {
    const programs = getProgramsByDepartment(selectedSecondDept);
    return programs.filter((p) => p.code !== selectedFirstProgram);
  }, [selectedSecondDept, filteredProgrammeCatalogue, selectedFirstProgram]);

  useEffect(() => {
    const lga = personalForm.getValues("localGovernment");
    if (!selectedStateValue) {
      if (lga) personalForm.setValue("localGovernment", "");
      return;
    }

    const options = stateToLGAs[selectedStateValue.toLowerCase()] || [];
    if (lga && !options.includes(lga)) {
      personalForm.setValue("localGovernment", "");
    }
  }, [selectedStateValue, personalForm]);

  // Reset programme selections when context changes
  useEffect(() => {
    academicForm.setValue("firstChoiceDepartment", "");
    academicForm.setValue("firstChoiceProgram", "");
    academicForm.setValue("secondChoiceDepartment", "");
    academicForm.setValue("secondChoiceProgram", "");
  }, [activeSession?.name, selectedModeValue, academicForm]);

  useEffect(() => {
    academicForm.setValue("firstChoiceProgram", "");
  }, [selectedFirstDept, academicForm]);

  useEffect(() => {
    academicForm.setValue("secondChoiceProgram", "");
  }, [selectedSecondDept, academicForm]);

  // Load active departments/programmes from backend for selection
  useEffect(() => {
    const loadProgrammes = async () => {
      try {
        const res = await api.get("/api/student/programmes");
        if (res && typeof res === "object" && "data" in res) {
          const payload = res as {
            data?: ProgrammeCatalogueItem[];
            meta?: { active_session?: AcademicSession | null };
            active_session?: AcademicSession | null;
          };
          const active =
            payload.meta?.active_session || payload.active_session || null;
          if (active?.name) {
            setActiveSession(active);
            academicForm.setValue("applicationSession", active.name);
          }

          const data = payload.data;
          const mapped = Array.isArray(data)
            ? data.map((item) => ({
                department_id: item.department_id,
                department: (item as any).department_name || item.department,
                department_code: item.department_code,
                programmes: item.programmes || [],
              }))
            : [];
          setProgrammeCatalogue(mapped.length > 0 ? mapped : programCatalogue);
        } else {
          setProgrammeCatalogue(programCatalogue);
        }
      } catch (error) {
        setProgrammeCatalogue(programCatalogue);
      }
    };

    void loadProgrammes();
  }, [academicForm]);

  useEffect(() => {
    if (activeSession?.name) {
      academicForm.setValue("applicationSession", activeSession.name);
    }
  }, [activeSession, academicForm]);

  // Load profile, progress, and user-specific draft on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const profileRes = await getStudentProfile();
        const profileData = ((profileRes as { data?: StudentProfile })?.data ||
          profileRes ||
          null) as StudentProfile | null;
        const progressRes = await getApplicationProgress();
        const progressData = ((progressRes as { data?: ApplicationProgress })
          ?.data ||
          progressRes ||
          null) as ApplicationProgress | null;
        if (!isMounted) return;

        setProfile(profileData);
        setApplicationProgress(progressData);

        const ownerSource = profileData?.id || profileData?.email || "";
        const ownerKey = ownerSource ? `user:${ownerSource}` : "anonymous";
        const storedOwner = localStorage.getItem(DRAFT_OWNER_KEY);

        if (storedOwner && storedOwner !== ownerKey) {
          localStorage.removeItem(`${DRAFT_KEY}:${storedOwner}`);
          localStorage.removeItem(`${DRAFT_STEP_KEY}:${storedOwner}`);
          localStorage.removeItem(DRAFT_KEY);
        }

        localStorage.setItem(DRAFT_OWNER_KEY, ownerKey);
        const userDraftKey = `${DRAFT_KEY}:${ownerKey}`;
        const userDraftStepKey = `${DRAFT_STEP_KEY}:${ownerKey}`;
        setDraftKey(userDraftKey);
        localStorage.removeItem(userDraftStepKey);
        setCurrentStep(1);

        const savedDraft = localStorage.getItem(userDraftKey);
        if (savedDraft) {
          try {
            const draft = JSON.parse(savedDraft) as ApplicationDraft;
            if (draft.personal) {
              personalForm.reset({
                ...personalForm.getValues(),
                ...draft.personal,
              });
            }
            if (draft.contact) {
              contactForm.reset({
                ...contactForm.getValues(),
                ...draft.contact,
              });
            }
            if (draft.jamb) {
              jambForm.reset({ ...jambForm.getValues(), ...draft.jamb });
            }
            if (draft.academic) {
              academicForm.reset({
                ...academicForm.getValues(),
                ...draft.academic,
              });
            }
            if (draft.guardian) {
              guardianForm.reset({
                ...guardianForm.getValues(),
                ...draft.guardian,
              });
            }
          } catch (err) {
            console.error("Failed to parse draft", err);
          }
        } else if (localStorage.getItem(DRAFT_KEY)) {
          localStorage.removeItem(DRAFT_KEY);
        }

        const normalizeDate = (val?: string | null) => {
          if (!val) return "";
          if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
          const parsed = new Date(val);
          if (Number.isNaN(parsed.getTime())) return "";
          return parsed.toISOString().slice(0, 10);
        };

        const extractNameParts = (data?: StudentProfile) => {
          if (!data) return { first: "", middle: "", last: "" };
          const directFirst = data.first_name || "";
          const directMiddle = data.middle_name || "";
          const directLast = data.last_name || "";

          if (directFirst || directLast || directMiddle) {
            return {
              first: directFirst,
              middle: directMiddle,
              last: directLast,
            };
          }

          const full = (data.full_name || "").trim();
          if (!full) return { first: "", middle: "", last: "" };

          const parts = full.split(/\s+/);
          if (parts.length === 1)
            return { first: parts[0], middle: "", last: "" };
          if (parts.length === 2)
            return { first: parts[0], middle: "", last: parts[1] };

          return {
            first: parts[0],
            middle: parts.slice(1, -1).join(" "),
            last: parts[parts.length - 1],
          };
        };

        const personalValues = personalForm.getValues();
        const contactValues = contactForm.getValues();

        const defaultPersonal = {
          firstName: ninData.firstName,
          middleName: ninData.middleName,
          lastName: ninData.lastName,
          dateOfBirth: ninData.dateOfBirth,
          gender: ninData.gender,
        } as Record<string, string | undefined>;

        const setPersonalIfEmpty = (
          field: keyof PersonalInfo,
          value?: string,
        ) => {
          if (!value) return;
          const current = personalValues[field];
          const defaultVal = defaultPersonal[field as string];
          if (!current || current === defaultVal || current === "") {
            personalForm.setValue(field, value);
            personalValues[field] = value as PersonalInfo[typeof field];
          }
        };

        const setContactIfEmpty = (
          field: keyof ContactInfo,
          value?: string,
        ) => {
          if (!value) return;
          const current = contactValues[field];
          if (!current || current === "") {
            contactForm.setValue(field, value);
            contactValues[field] = value as ContactInfo[typeof field];
          }
        };

        const names = extractNameParts(profileData);
        setPersonalIfEmpty("firstName", names.first);
        setPersonalIfEmpty("middleName", names.middle);
        setPersonalIfEmpty("lastName", names.last);

        setPersonalIfEmpty(
          "dateOfBirth",
          normalizeDate(profileData?.date_of_birth),
        );
        setPersonalIfEmpty("gender", (profileData?.gender || "").toLowerCase());
        setPersonalIfEmpty(
          "maritalStatus",
          (profileData?.marital_status || "").toLowerCase(),
        );
        setPersonalIfEmpty(
          "nationality",
          profileData?.nationality || personalValues.nationality,
        );

        if (profileData?.state_of_origin) {
          const stateVal = profileData.state_of_origin.toLowerCase();
          const currentState = personalValues.stateOfOrigin;
          if (!currentState || currentState === "") {
            personalForm.setValue("stateOfOrigin", stateVal);
            personalValues.stateOfOrigin = stateVal;
          }
        }
        if (profileData?.lga) {
          const lgaVal = profileData.lga.toLowerCase();
          const currentLga = personalValues.localGovernment;
          if (!currentLga || currentLga === "") {
            personalForm.setValue("localGovernment", lgaVal);
            personalValues.localGovernment = lgaVal;
          }
        }

        setContactIfEmpty("email", profileData?.email);
        setContactIfEmpty("phone", profileData?.phone);
      } catch (err) {
        console.error("Failed to load profile/progress", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [personalForm, contactForm, jambForm, academicForm, guardianForm]);

  // Persist draft on change
  useEffect(() => {
    if (!draftKey) {
      return;
    }
    const persist = () => {
      const draft: ApplicationDraft = {
        personal: personalForm.getValues(),
        contact: contactForm.getValues(),
        jamb: jambForm.getValues(),
        academic: academicForm.getValues(),
        guardian: guardianForm.getValues(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    };

    const subscriptions = [
      personalForm.watch(persist),
      contactForm.watch(persist),
      jambForm.watch(persist),
      academicForm.watch(persist),
      guardianForm.watch(persist),
    ];

    return () => {
      subscriptions.forEach((sub) => sub?.unsubscribe?.());
    };
  }, [
    draftKey,
    personalForm,
    contactForm,
    jambForm,
    academicForm,
    guardianForm,
  ]);

  const progressPercentage = (currentStep / steps.length) * 100;

  const handleFileUpload = (fieldName: string, file: File | null) => {
    setUploadedFiles((prev) => ({ ...prev, [fieldName]: file }));
  };

  const updateOLevelSubject = (
    index: number,
    field: "subject" | "grade",
    value: string,
    sitting: 1 | 2,
  ) => {
    const nextValue =
      field === "subject" ? normalizeSubjectValue(value) : value;
    if (sitting === 1) {
      setOLevelSubjects1((prev) =>
        prev.map((s, i) => (i === index ? { ...s, [field]: nextValue } : s)),
      );
    } else {
      setOLevelSubjects2((prev) =>
        prev.map((s, i) => (i === index ? { ...s, [field]: nextValue } : s)),
      );
    }
  };

  const copySubjectsFromFirstSitting = () => {
    // Copy first 5 subjects from first sitting to second sitting
    const copiedSubjects = oLevelSubjects1.slice(0, 5).map((subj) => ({
      subject: subj.subject,
      grade: "", // Keep grades empty for second sitting
    }));
    setOLevelSubjects2(copiedSubjects);
    toast.success("Subjects copied from first sitting!");
  };

  const getAvailableSubjects = (sitting: 1 | 2, index: number) => {
    const list = sitting === 1 ? oLevelSubjects1 : oLevelSubjects2;
    const current = normalizeKey(list[index]?.subject || "");
    const used = new Set<string>();
    list.forEach((row, i) => {
      if (i === index) return;
      const key = normalizeKey(row.subject || "");
      if (key) used.add(key);
    });

    return oLevelSubjects.filter((subj) => {
      const key = subj.toLowerCase();
      return key === current || !used.has(key);
    });
  };

  const findSelectedWithoutGrades = () => {
    const combined = [
      ...oLevelSubjects1,
      ...(hasSecondSitting ? oLevelSubjects2 : []),
    ];

    return combined.filter(
      (row) => normalizeKey(row.subject || "") && !row.grade,
    );
  };

  const findMissingRequiredOLevelSubjects = () => {
    if (!isOLevel) return [] as string[];

    const combined = [
      ...oLevelSubjects1,
      ...(hasSecondSitting ? oLevelSubjects2 : []),
    ];

    const present = new Set<string>();
    combined.forEach((row) => {
      const subj = normalizeSubjectValue(row.subject || "").toLowerCase();
      if (subj && row.grade) {
        present.add(subj);
      }
    });

    return requiredOLevelSubjects
      .map((item) => item.key)
      .filter((req) => !present.has(req));
  };

  // Get dynamic document requirements based on qualification
  const getRequiredDocuments = () => {
    const baseDocuments = [
      { key: "passport", label: "Passport Photograph", required: true },
      { key: "birthCertificate", label: "Birth Certificate", required: true },
      {
        key: "localGovtId",
        label: "Local Govt. Identification",
        required: false,
      },
    ];

    if (isOLevel) {
      return [
        {
          key: "oLevelResult",
          label: `${selectedQualification.toUpperCase()} Result (First Sitting)`,
          required: true,
        },
        ...(hasSecondSitting
          ? [
              {
                key: "oLevelResult2",
                label: `${selectedQualification.toUpperCase()} Result (Second Sitting)`,
                required: true,
              },
            ]
          : []),
        ...baseDocuments,
      ];
    }

    if (selectedQualification === "ond") {
      return [
        { key: "oLevelResult", label: "O'Level Result", required: true },
        {
          key: "ondCertificate",
          label: "OND Certificate/Statement of Result",
          required: true,
        },
        { key: "transcript", label: "Academic Transcript", required: true },
        ...baseDocuments,
      ];
    }

    if (selectedQualification === "nce") {
      return [
        { key: "oLevelResult", label: "O'Level Result", required: true },
        {
          key: "nceCertificate",
          label: "NCE Certificate/Statement of Result",
          required: true,
        },
        { key: "transcript", label: "Academic Transcript", required: true },
        ...baseDocuments,
      ];
    }

    return [
      { key: "oLevelResult", label: "O'Level Result", required: true },
      ...baseDocuments,
    ];
  };

  const handleNext = async () => {
    let isValid = false;
    let validationToastShown = false;

    switch (currentStep) {
      case 1:
        isValid = await personalForm.trigger();
        break;
      case 2:
        isValid = await contactForm.trigger();
        break;
      case 3:
        isValid = true;
        break;
      case 4:
        // Validate only fields shown in the Educational History step
        isValid = await academicForm.trigger(["qualification"]);

        if (isValid && isOLevel) {
          const missingGrades = findSelectedWithoutGrades();
          if (missingGrades.length > 0) {
            isValid = false;
            toast.error("Add grades for selected subjects", {
              description:
                "Every chosen subject needs a grade before proceeding.",
            });
          }
        }
        break;
      case 5:
        isValid = await academicForm.trigger([
          "applicationSession",
          "applicationModeOfEntry",
          "firstChoiceDepartment",
          "firstChoiceProgram",
        ]);

        if (isValid && isOLevel) {
          const missingGrades = findSelectedWithoutGrades();
          if (missingGrades.length > 0) {
            isValid = false;
            toast.error("Add grades for selected subjects", {
              description:
                "Every chosen subject needs a grade before proceeding.",
            });
          }
        }
        break;
      case 6:
        isValid = await guardianForm.trigger();
        break;
      case 7:
        isValid = true; // Documents are optional for now
        break;
      default:
        isValid = true;
    }

    if (!isValid && !validationToastShown) {
      const stepName = steps[currentStep - 1]?.name || "this step";
      toast.error("Please complete the required fields", {
        description: `Check the highlighted inputs in ${stepName}.`,
      });
    }

    const persistStepToBackend = async (
      targetStep: number,
      status?: string,
    ) => {
      try {
        await updateApplicationProgressStep({
          current_step: targetStep,
          status: status || applicationProgress?.status || "draft",
        });
        setApplicationProgress((prev) => ({
          ...(prev || {}),
          current_step: targetStep,
          status: status || prev?.status || "draft",
        }));
      } catch (error) {
        console.warn("Failed to sync application step to backend", error);
      }
    };

    if (isValid) {
      const nextStep = Math.min(currentStep + 1, steps.length);
      setCurrentStep(nextStep);
      void persistStepToBackend(nextStep);
    }
  };

  const handlePrevious = () => {
    const previousStep = Math.max(currentStep - 1, 1);
    setCurrentStep(previousStep);
    void updateApplicationProgressStep({
      current_step: previousStep,
      status: applicationProgress?.status || "draft",
    }).catch((error) => {
      console.warn("Failed to sync application step to backend", error);
    });
  };

  const handleSubmit = async () => {
    if (!activeSession?.id) {
      toast.error("Applications are not open", {
        description:
          "No active academic session is configured. Please contact the admissions office.",
      });
      return;
    }

    setIsSubmitting(true);

    const [
      personalValid,
      contactValid,
      jambValid,
      academicValid,
      guardianValid,
    ] = await Promise.all([
      personalForm.trigger(),
      contactForm.trigger(),
      jambForm.trigger(),
      academicForm.trigger(),
      guardianForm.trigger(),
    ]);

    const allValid =
      personalValid &&
      contactValid &&
      jambValid &&
      academicValid &&
      guardianValid;

    if (!allValid) {
      toast.error("Please complete the required fields", {
        description: "Check the highlighted inputs across all steps.",
      });
      setIsSubmitting(false);
      return;
    }

    const missingSubjects = findMissingRequiredOLevelSubjects();
    if (missingSubjects.length > 0) {
      const labels = requiredOLevelSubjects
        .filter((item) => missingSubjects.includes(item.key))
        .map((item) => item.label)
        .join(", ");
      toast.error("Add required O'Level subjects", {
        description: `Include ${labels} with grades for your selected qualification.`,
      });
      setIsSubmitting(false);
      return;
    }

    const requiredDocs = getRequiredDocuments().filter((doc) => doc.required);
    const missingDocs = requiredDocs.filter((doc) => !uploadedFiles[doc.key]);

    if (missingDocs.length > 0) {
      toast.error("Required documents missing", {
        description: `Please upload: ${missingDocs
          .map((d) => d.label)
          .join(", ")}.`,
      });
      setIsSubmitting(false);
      return;
    }

    const payload = {
      personal: personalForm.getValues(),
      contact: contactForm.getValues(),
      jamb: jambForm.getValues(),
      academic: academicForm.getValues(),
      guardian: guardianForm.getValues(),
      oLevel: {
        firstSitting: oLevelSubjects1,
        secondSitting: hasSecondSitting ? oLevelSubjects2 : [],
        hasSecondSitting,
      },
      documents: Object.fromEntries(
        Object.entries(uploadedFiles).map(([key, file]) => [
          key,
          file ? file.name : null,
        ]),
      ),
    };

    try {
      const response = (await submitApplication(payload)) as {
        data?: { application_no?: string; status?: string };
      };
      toast.success("Application submitted successfully!", {
        description: "You will receive a confirmation email shortly.",
      });
      setApplicationProgress((prev) => ({
        ...prev,
        is_submitted: true,
        status: response?.data?.status || "submitted",
        application_no: response?.data?.application_no || prev?.application_no,
      }));
      if (draftKey) {
        localStorage.removeItem(draftKey);
      }
      localStorage.removeItem(
        `${DRAFT_STEP_KEY}:${localStorage.getItem(DRAFT_OWNER_KEY) || ""}`,
      );
      setCurrentStep(steps.length);
      void updateApplicationProgressStep({
        current_step: steps.length,
        status: response?.data?.status || "submitted",
      }).catch((error) => {
        console.warn(
          "Failed to sync submitted application step to backend",
          error,
        );
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Submission failed. Please try again.";
      toast.error("Submission failed", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);

    try {
      const response = (await getSubmittedApplication()) as {
        data?: {
          application_no?: string;
          status?: string;
          applied_at?: string;
          payload?: Record<string, unknown>;
        };
      };

      const fallbackPayload = {
        personal: personalForm.getValues(),
        contact: contactForm.getValues(),
        jamb: jambForm.getValues(),
        academic: academicForm.getValues(),
        guardian: guardianForm.getValues(),
        oLevel: {
          firstSitting: oLevelSubjects1,
          secondSitting: hasSecondSitting ? oLevelSubjects2 : [],
          hasSecondSitting,
        },
        documents: Object.fromEntries(
          Object.entries(uploadedFiles).map(([key, file]) => [
            key,
            file ? file.name : null,
          ]),
        ),
      };

      const submittedPayload =
        response?.data?.payload && typeof response.data.payload === "object"
          ? response.data.payload
          : fallbackPayload;

      const applicationNoForPrint =
        response?.data?.application_no || applicationNo || "Pending";
      const applicationStatusForPrint =
        response?.data?.status || applicationStatus || "submitted";
      const appliedAt = response?.data?.applied_at;
      const appliedAtLabel = appliedAt
        ? new Date(appliedAt).toLocaleString()
        : "N/A";

      const escapeHtml = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const toTitle = (key: string) =>
        key
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .replace(/^./, (char) => char.toUpperCase());

      const renderValue = (value: unknown): string => {
        if (
          value === null ||
          value === undefined ||
          (typeof value === "string" && value.trim() === "")
        ) {
          return '<span class="muted">N/A</span>';
        }

        if (typeof value === "boolean") {
          return value ? "Yes" : "No";
        }

        if (Array.isArray(value)) {
          if (!value.length) return '<span class="muted">N/A</span>';
          return `<ol>${value
            .map((item) => `<li>${renderValue(item)}</li>`)
            .join("")}</ol>`;
        }

        if (typeof value === "object") {
          const entries = Object.entries(value as Record<string, unknown>);
          if (!entries.length) return '<span class="muted">N/A</span>';
          return `<table>${entries
            .map(
              ([k, v]) =>
                `<tr><th>${escapeHtml(toTitle(k))}</th><td>${renderValue(v)}</td></tr>`,
            )
            .join("")}</table>`;
        }

        return escapeHtml(String(value));
      };

      const payloadObject = submittedPayload as Record<string, unknown>;
      const preferredSectionOrder = [
        "personal",
        "contact",
        "jamb",
        "academic",
        "guardian",
        "oLevel",
        "documents",
      ];

      const allSections = Object.keys(payloadObject);
      const orderedSections = [
        ...preferredSectionOrder.filter((key) => key in payloadObject),
        ...allSections.filter((key) => !preferredSectionOrder.includes(key)),
      ];

      const sectionsHtml = orderedSections
        .map(
          (key) => `
          <section>
            <h2>${escapeHtml(toTitle(key))}</h2>
            ${renderValue(payloadObject[key])}
          </section>
        `,
        )
        .join("");

      const fullName = [
        personalForm.getValues("firstName"),
        personalForm.getValues("middleName"),
        personalForm.getValues("lastName"),
      ]
        .filter(Boolean)
        .join(" ");

      const printWindow = window.open(
        "",
        "_blank",
        "width=1000,height=1200,noopener,noreferrer",
      );

      if (!printWindow) {
        toast.error("Unable to open print window", {
          description: "Please allow pop-ups and try again.",
        });
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Application Record - ${escapeHtml(applicationNoForPrint)}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
              .brand-header { background: #1f65c2; color: #fff; border-bottom: 4px solid #f59e0b; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
              .brand-left { display: flex; align-items: center; gap: 14px; }
              .brand-left img { width: 64px; height: 64px; object-fit: contain; background: #fff; border-radius: 999px; padding: 4px; }
              .brand-name { font-size: 15px; font-weight: 700; letter-spacing: 0.04em; }
              h1 { margin: 4px 0 0; font-size: 28px; }
              .tagline { margin: 4px 0 0; font-size: 12px; opacity: 0.9; }
              .brand-meta { text-align: right; font-size: 13px; line-height: 1.6; }
              .meta { margin: 18px 0; font-size: 14px; color: #374151; border: 1px solid #dbeafe; background: #eff6ff; padding: 12px 14px; }
              .meta strong { color: #111827; }
              section { margin: 18px 0; page-break-inside: avoid; }
              h2 { margin: 0 0 8px; font-size: 15px; background: #2e7d32; color: #fff; padding: 8px 10px; text-transform: uppercase; }
              table { width: 100%; border-collapse: collapse; margin-top: 6px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; text-align: left; }
              th { width: 32%; background: #eff6ff; font-weight: 600; }
              ol { margin: 0; padding-left: 18px; }
              li { margin: 4px 0; }
              .muted { color: #6b7280; font-style: italic; }
              .generated { margin-top: 24px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="brand-header">
              <div class="brand-left">
                <img src="${logo}" alt="${schoolConfig.name.acronym} logo" />
                <div>
                  <div class="brand-name">${schoolConfig.name.full.toUpperCase()}</div>
                  <h1>Application Form Summary</h1>
                  <p class="tagline">${schoolConfig.name.motto}</p>
                </div>
              </div>
              <div class="brand-meta">
                ${schoolConfig.name.acronym} Student Portal<br/>
                Email: ${escapeHtml(contactForm.getValues("email") || "N/A")}<br/>
                Generated: ${escapeHtml(new Date().toLocaleString())}
              </div>
            </div>
            <p class="meta">
              <strong>Applicant:</strong> ${escapeHtml(fullName || "N/A")}<br/>
              <strong>Email:</strong> ${escapeHtml(contactForm.getValues("email") || "N/A")}<br/>
              <strong>Application No:</strong> ${escapeHtml(applicationNoForPrint)}<br/>
              <strong>Status:</strong> ${escapeHtml(applicationStatusForPrint)}<br/>
              <strong>Submitted At:</strong> ${escapeHtml(appliedAtLabel)}
            </p>
            ${sectionsHtml}
            <p class="generated">Generated on ${escapeHtml(new Date().toLocaleString())}</p>
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to prepare printable application record.";
      toast.error("Print failed", { description: message });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = () => {
    const url = getSubmittedApplicationPdfUrl();
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      toast.error("Unable to open PDF", {
        description: "Please allow pop-ups and try again.",
      });
    }
  };

  return (
    <StudentLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="hero-gradient border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-foreground/10">
                  <FileText className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <Badge variant="gold" className="mb-2">
                    2024/2025 Admission
                  </Badge>
                  <h1 className="font-serif text-2xl font-bold text-primary-foreground">
                    Application Form
                  </h1>
                  <p className="text-primary-foreground/80">
                    Complete all sections to submit your application
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {isSubmitted ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif">
                  <Check className="h-5 w-5 text-success" />
                  Application Submitted
                </CardTitle>
                <CardDescription>
                  Your application has been received and is now locked for
                  review.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="emerald">{applicationStatus}</Badge>
                  <span className="text-sm text-muted-foreground">
                    Application No:{" "}
                    <span className="font-medium">{applicationNo}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      void handlePrint();
                    }}
                    disabled
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {isPrinting ? "Preparing print..." : "Print Application"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled
                    onClick={handleDownloadPdf}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button
                    variant="gold"
                    onClick={() => navigate("/student/admission-status")}
                  >
                    <GraduationCap className="mr-2 h-4 w-4" />
                    Track Admission
                  </Button>
                </div>
                <div className="rounded-lg border p-4 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Applicant:</span>{" "}
                      <span className="font-medium">
                        {personalForm.getValues("firstName")}{" "}
                        {personalForm.getValues("lastName")}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      <span className="font-medium">
                        {contactForm.getValues("email") || "N/A"}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">
                        First Choice:
                      </span>{" "}
                      <span className="font-medium">
                        {academicForm.getValues("firstChoiceDepartment") ||
                          "N/A"}
                        {academicForm.getValues("firstChoiceProgram")
                          ? ` — ${academicForm.getValues("firstChoiceProgram")}`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="card-elevated">
              <CardContent className="p-4">
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Step {currentStep} of {steps.length}
                    </span>
                    <span className="font-medium">
                      {Math.round(progressPercentage)}% Complete
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>
                <div className="flex justify-between">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className={`flex flex-col items-center gap-1 ${
                        step.id === currentStep
                          ? "text-primary"
                          : step.id < currentStep
                            ? "text-success"
                            : "text-muted-foreground"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                          step.id === currentStep
                            ? "border-primary bg-primary text-primary-foreground"
                            : step.id < currentStep
                              ? "border-success bg-success text-success-foreground"
                              : "border-muted bg-muted"
                        }`}
                      >
                        {step.id < currentStep ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <step.icon className="h-5 w-5" />
                        )}
                      </div>
                      <span className="hidden text-xs font-medium sm:block">
                        {step.name}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!isSubmitted && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-elevated">
                {/* Step 1: Personal Information */}
                {currentStep === 1 && (
                  <>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-serif">
                        <User className="h-5 w-5 text-secondary" />
                        Personal Information
                      </CardTitle>
                      <CardDescription>
                        Your personal details from NIN verification. Some fields
                        are pre-filled.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...personalForm}>
                        <form className="space-y-6">
                          <div className="rounded-lg border border-info/30 bg-info/5 p-4">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="mt-0.5 h-4 w-4 text-info" />
                              <p className="text-sm text-info">
                                Fields marked with * are verified from your NIN
                                and cannot be edited.
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-3">
                            <FormField
                              control={personalForm.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First Name *</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      // disabled
                                      required
                                      className="bg-muted"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={personalForm.control}
                              name="middleName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Middle Name</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      // disabled
                                      className="bg-muted"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={personalForm.control}
                              name="lastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last Name *</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      required
                                      className="bg-muted"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid gap-4 sm:grid-cols-3">
                            <FormField
                              control={personalForm.control}
                              name="dateOfBirth"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Date of Birth *</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      required
                                      className="bg-muted"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={personalForm.control}
                              name="gender"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Gender *</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      required
                                      className="bg-muted capitalize"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={personalForm.control}
                              name="maritalStatus"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Marital Status *</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="single">
                                        Single
                                      </SelectItem>
                                      <SelectItem value="married">
                                        Married
                                      </SelectItem>
                                      <SelectItem value="divorced">
                                        Divorced
                                      </SelectItem>
                                      <SelectItem value="widowed">
                                        Widowed
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid gap-4 sm:grid-cols-3">
                            <FormField
                              control={personalForm.control}
                              name="nationality"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nationality *</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      required
                                      aria-required="true"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={personalForm.control}
                              name="stateOfOrigin"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>State of Origin *</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select state" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {nigerianStates.map((state) => (
                                        <SelectItem
                                          key={state}
                                          value={state.toLowerCase()}
                                        >
                                          {state}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={personalForm.control}
                              name="localGovernment"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Local Government *</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    disabled={
                                      !selectedStateValue ||
                                      lgaOptions.length === 0
                                    }
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue
                                          placeholder={
                                            selectedStateValue
                                              ? "Select local government"
                                              : "Select state first"
                                          }
                                        />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {lgaOptions.map((lga) => (
                                        <SelectItem key={lga} value={lga}>
                                          {lga}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </>
                )}

                {/* Step 2: Contact Information */}
                {currentStep === 2 && (
                  <>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-serif">
                        <Phone className="h-5 w-5 text-secondary" />
                        Contact Details
                      </CardTitle>
                      <CardDescription>
                        Provide your contact information for communication
                        purposes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...contactForm}>
                        <form className="space-y-6">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              control={contactForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email Address</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                      <Input
                                        {...field}
                                        type="email"
                                        className="pl-10"
                                        placeholder="your@email.com"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={contactForm.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Phone Number</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                      <Input
                                        {...field}
                                        className="pl-10"
                                        placeholder="08012345678"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={contactForm.control}
                            name="alternatePhone"
                            render={({ field }) => (
                              <FormItem className="sm:w-1/2">
                                <FormLabel>
                                  Alternate Phone (Optional)
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="08098765432" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={contactForm.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Residential Address</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Textarea
                                      {...field}
                                      className="pl-10 min-h-[80px]"
                                      placeholder="Enter your full address"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid gap-4 sm:grid-cols-3">
                            <FormField
                              control={contactForm.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>City</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Enter city"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={contactForm.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>State</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select state" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {nigerianStates.map((state) => (
                                        <SelectItem
                                          key={state}
                                          value={state.toLowerCase()}
                                        >
                                          {state}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={contactForm.control}
                              name="postalCode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Postal Code (Optional)</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="100001" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </>
                )}

                {/* Step 3: JAMB Information */}
                {currentStep === 3 && (
                  <>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-serif">
                        <GraduationCap className="h-5 w-5 text-secondary" />
                        JAMB Information
                      </CardTitle>
                      <CardDescription>
                        Provide your JAMB registration number and score if
                        available.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...jambForm}>
                        <form className="space-y-6">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              control={jambForm.control}
                              name="jambNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    JAMB Registration Number (optional)
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Enter JAMB number"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={jambForm.control}
                              name="jambScore"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>JAMB Score (optional)</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      min="0"
                                      max="400"
                                      placeholder="0 - 400"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </>
                )}

                {/* Step 4: Academic Information */}
                {currentStep === 4 && (
                  <>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-serif">
                        <GraduationCap className="h-5 w-5 text-secondary" />
                        Educational History
                      </CardTitle>
                      <CardDescription>
                        Provide information about your educational background
                        and program choice.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...academicForm}>
                        <form className="space-y-6">
                          {/* <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                          <h4 className="mb-3 font-medium text-primary">
                            Program Selection
                          </h4>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              control={academicForm.control}
                              name="program"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Desired Program</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select program" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {programOptions.map((program) => (
                                        <SelectItem
                                          key={program.code}
                                          value={program.code}
                                        >
                                          {program.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={academicForm.control}
                              name="entryMode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Entry Mode</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select entry mode" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="utme">UTME</SelectItem>
                                      <SelectItem value="direct-entry">
                                        Direct Entry
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div> */}

                          <div className="space-y-4">
                            <h4 className="font-medium">Previous Education</h4>
                            <FormField
                              control={academicForm.control}
                              name="previousInstitution"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Previous Institution</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                      <Input
                                        {...field}
                                        className="pl-10"
                                        placeholder="Name of school/institution"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="grid gap-4 sm:grid-cols-2">
                              <FormField
                                control={academicForm.control}
                                name="qualification"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Qualification Obtained
                                    </FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select qualification" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="waec">
                                          WAEC/SSCE
                                        </SelectItem>
                                        <SelectItem value="neco">
                                          NECO
                                        </SelectItem>
                                        <SelectItem value="nabteb">
                                          NABTEB
                                        </SelectItem>
                                        <SelectItem value="ond">OND</SelectItem>
                                        <SelectItem value="nce">NCE</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={academicForm.control}
                                name="graduationYear"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Year of Graduation</FormLabel>
                                    <FormControl>
                                      <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                          {...field}
                                          className="pl-10"
                                          placeholder="2023"
                                        />
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>

                          {/* O'Level Specific Fields */}
                          {isOLevel && (
                            <div className="space-y-6">
                              <div className="rounded-lg border border-secondary/20 bg-secondary/5 p-4">
                                <h4 className="mb-3 font-medium text-secondary">
                                  Examination Details
                                </h4>
                                <div className="grid gap-4 sm:grid-cols-3">
                                  <FormField
                                    control={academicForm.control}
                                    name="examNumber"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Exam Number</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            placeholder="e.g., 4123456789"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={academicForm.control}
                                    name="examCenter"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Exam Center</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            placeholder="Center name/number"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={academicForm.control}
                                    name="examYear"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Exam Year</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            placeholder="e.g., 2022"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>

                              {/* O'Level Subjects - First Sitting */}
                              <div className="rounded-lg border p-4">
                                <h4 className="mb-4 font-medium">
                                  O'Level Subjects & Grades (First Sitting)
                                </h4>
                                <p className="mb-4 text-sm text-muted-foreground">
                                  You must include English Language and
                                  Mathematics. Other subjects are optional and
                                  can be selected as needed.
                                </p>
                                <div className="space-y-3">
                                  {oLevelSubjects1.map((subj, index) => {
                                    const isRequiredCore =
                                      isOLevel &&
                                      index < requiredOLevelSubjects.length;
                                    const enforcedSubject = isRequiredCore
                                      ? requiredOLevelSubjects[index].label
                                      : subj.subject;

                                    return (
                                      <div
                                        key={index}
                                        className="grid gap-3 sm:grid-cols-2"
                                      >
                                        <div>
                                          <Label className="text-xs text-muted-foreground flex items-center gap-2">
                                            <span>Subject {index + 1}</span>
                                            {isRequiredCore && (
                                              <Badge
                                                variant="outline"
                                                className="text-[10px]"
                                              >
                                                Core
                                              </Badge>
                                            )}
                                          </Label>
                                          <Select
                                            value={enforcedSubject}
                                            disabled={isRequiredCore}
                                            onValueChange={(value) =>
                                              updateOLevelSubject(
                                                index,
                                                "subject",
                                                value,
                                                1,
                                              )
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select subject" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {getAvailableSubjects(
                                                1,
                                                index,
                                              ).map((subject) => (
                                                <SelectItem
                                                  key={subject}
                                                  value={subject}
                                                >
                                                  {subject}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <Label className="text-xs text-muted-foreground">
                                            Grade
                                          </Label>
                                          <Select
                                            value={subj.grade}
                                            onValueChange={(value) =>
                                              updateOLevelSubject(
                                                index,
                                                "grade",
                                                value,
                                                1,
                                              )
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select grade" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {oLevelGrades.map((grade) => (
                                                <SelectItem
                                                  key={grade.value}
                                                  value={grade.value}
                                                >
                                                  {grade.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Second Sitting Toggle */}
                              <div className="flex items-center gap-3 rounded-lg border border-info/20 bg-info/5 p-4">
                                <input
                                  type="checkbox"
                                  id="secondSitting"
                                  checked={hasSecondSitting}
                                  onChange={(e) =>
                                    setHasSecondSitting(e.target.checked)
                                  }
                                  className="h-4 w-4 rounded border-input"
                                />
                                <Label
                                  htmlFor="secondSitting"
                                  className="cursor-pointer"
                                >
                                  I have a second sitting result (combination of
                                  two sittings)
                                </Label>
                              </div>

                              {/* Second Sitting Exam Details */}

                              {/* Second Sitting Education Details */}
                              {hasSecondSitting && (
                                <div className="space-y-4">
                                  <h4 className="font-medium text-secondary">
                                    Second Sitting Education
                                  </h4>
                                  <FormField
                                    control={academicForm.control}
                                    name="previousInstitution2"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>
                                          Previous Institution
                                        </FormLabel>
                                        <FormControl>
                                          <div className="relative">
                                            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                              {...field}
                                              className="pl-10"
                                              placeholder="Name of school/institution"
                                            />
                                          </div>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField
                                      control={academicForm.control}
                                      name="qualification2"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>
                                            Qualification Obtained
                                          </FormLabel>
                                          <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                          >
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Select qualification" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              <SelectItem value="waec">
                                                WAEC/SSCE
                                              </SelectItem>
                                              <SelectItem value="neco">
                                                NECO
                                              </SelectItem>
                                              <SelectItem value="nabteb">
                                                NABTEB
                                              </SelectItem>
                                              <SelectItem value="ond">
                                                OND
                                              </SelectItem>
                                              <SelectItem value="nce">
                                                NCE
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={academicForm.control}
                                      name="graduationYear2"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>
                                            Year of Graduation
                                          </FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                              <Input
                                                {...field}
                                                className="pl-10"
                                                placeholder="2023"
                                              />
                                            </div>
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>
                              )}

                              {hasSecondSitting && (
                                <div className="rounded-lg border border-secondary/20 bg-secondary/5 p-4">
                                  <h4 className="mb-3 font-medium text-secondary">
                                    Second Sitting Examination Details
                                  </h4>
                                  <div className="grid gap-4 sm:grid-cols-3">
                                    <FormField
                                      control={academicForm.control}
                                      name="examNumber2"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Exam Number</FormLabel>
                                          <FormControl>
                                            <Input
                                              {...field}
                                              placeholder="e.g., 4123456789"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={academicForm.control}
                                      name="examCenter2"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Exam Center</FormLabel>
                                          <FormControl>
                                            <Input
                                              {...field}
                                              placeholder="Center name/number"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={academicForm.control}
                                      name="examYear2"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Exam Year</FormLabel>
                                          <FormControl>
                                            <Input
                                              {...field}
                                              placeholder="e.g., 2023"
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* O'Level Subjects - Second Sitting */}
                              {hasSecondSitting && (
                                <div className="rounded-lg border border-info/20 p-4">
                                  <div className="mb-4 flex items-center justify-between">
                                    <h4 className="font-medium text-info">
                                      O'Level Subjects & Grades (Second Sitting)
                                    </h4>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={copySubjectsFromFirstSitting}
                                      className="text-xs"
                                    >
                                      Copy from First Sitting
                                    </Button>
                                  </div>
                                  <div className="space-y-3">
                                    {oLevelSubjects2.map((subj, index) => (
                                      <div
                                        key={index}
                                        className="grid gap-3 sm:grid-cols-2"
                                      >
                                        <div>
                                          <Label className="text-xs text-muted-foreground">
                                            Subject {index + 1}
                                          </Label>
                                          <Select
                                            value={subj.subject}
                                            onValueChange={(value) =>
                                              updateOLevelSubject(
                                                index,
                                                "subject",
                                                value,
                                                2,
                                              )
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select subject" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {getAvailableSubjects(
                                                2,
                                                index,
                                              ).map((subject) => (
                                                <SelectItem
                                                  key={subject}
                                                  value={subject}
                                                >
                                                  {subject}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <Label className="text-xs text-muted-foreground">
                                            Grade
                                          </Label>
                                          <Select
                                            value={subj.grade}
                                            onValueChange={(value) =>
                                              updateOLevelSubject(
                                                index,
                                                "grade",
                                                value,
                                                2,
                                              )
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select grade" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {oLevelGrades.map((grade) => (
                                                <SelectItem
                                                  key={grade.value}
                                                  value={grade.value}
                                                >
                                                  {grade.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Higher Qualification Specific Fields */}
                          {isHigherQualification && (
                            <div className="space-y-4">
                              <div className="rounded-lg border border-secondary/20 bg-secondary/5 p-4">
                                <h4 className="mb-3 font-medium text-secondary">
                                  {selectedQualification.toUpperCase()} Details
                                </h4>
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <FormField
                                    control={academicForm.control}
                                    name="courseOfStudy"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Course of Study</FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            placeholder="e.g., Computer Science"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={academicForm.control}
                                    name="cgpa"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>
                                          CGPA / Final Grade
                                        </FormLabel>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            placeholder="e.g., 3.50 or Upper Credit"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>

                              <FormField
                                control={academicForm.control}
                                name="gradeObtained"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Class of Degree/Grade</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select grade" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="distinction">
                                          Distinction
                                        </SelectItem>
                                        <SelectItem value="upper-credit">
                                          Upper Credit
                                        </SelectItem>
                                        <SelectItem value="lower-credit">
                                          Lower Credit
                                        </SelectItem>
                                        <SelectItem value="pass">
                                          Pass
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <div className="rounded-lg border border-info/20 bg-info/5 p-4">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="mt-0.5 h-4 w-4 text-info" />
                                  <p className="text-sm text-info">
                                    As a {selectedQualification.toUpperCase()}{" "}
                                    holder, you will also need to provide your
                                    O'Level result and academic transcript in
                                    the next step.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Show grade selection only if not higher qualification */}
                          {!isHigherQualification &&
                            !isOLevel &&
                            selectedQualification && (
                              <FormField
                                control={academicForm.control}
                                name="gradeObtained"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Grade Obtained</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select grade" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="distinction">
                                          Distinction
                                        </SelectItem>
                                        <SelectItem value="upper-credit">
                                          Upper Credit
                                        </SelectItem>
                                        <SelectItem value="lower-credit">
                                          Lower Credit
                                        </SelectItem>
                                        <SelectItem value="pass">
                                          Pass
                                        </SelectItem>
                                        <SelectItem value="5-credits">
                                          5+ Credits (O'Level)
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                        </form>
                      </Form>
                    </CardContent>
                  </>
                )}

                {/* Step 5: Programme Application */}
                {currentStep === 5 && (
                  <>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-serif">
                        <GraduationCap className="h-5 w-5 text-secondary" />
                        Programme Application
                      </CardTitle>
                      <CardDescription>
                        Choose your mode of entry and preferred programmes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...academicForm}>
                        <form className="space-y-6">
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                            <h4 className="mb-2 font-medium text-primary">
                              Programme Application
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              The active admission session is set by the admin.
                              Choose your mode of entry, then select your first
                              and second choice programmes.
                            </p>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <Label>Active Session</Label>
                                <Input
                                  value={
                                    activeSession?.name ||
                                    academicForm.getValues(
                                      "applicationSession",
                                    ) ||
                                    "No active session set"
                                  }
                                  disabled
                                  className="mt-2"
                                />
                              </div>
                              <FormField
                                control={academicForm.control}
                                name="applicationModeOfEntry"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Mode of Entry</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select mode" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {applicationEntryModes.map((mode) => (
                                          <SelectItem
                                            key={mode.value}
                                            value={mode.value}
                                          >
                                            {mode.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="rounded-lg border bg-background p-4">
                              <div className="mb-3 flex items-center justify-between">
                                <h5 className="font-medium">First Choice</h5>
                                <p className="text-xs text-muted-foreground">
                                  Choose your primary option
                                </p>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                  control={academicForm.control}
                                  name="firstChoiceDepartment"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Department</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={
                                          availableDepartments.length === 0
                                        }
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select department" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {availableDepartments.map((dept) => (
                                            <SelectItem key={dept} value={dept}>
                                              {dept}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {availableDepartments.length === 0 && (
                                        <p className="text-xs text-muted-foreground">
                                          No active programmes are currently
                                          available for application.
                                        </p>
                                      )}
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={academicForm.control}
                                  name="firstChoiceProgram"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Programme</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={
                                          firstChoicePrograms.length === 0
                                        }
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select programme" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {firstChoicePrograms.map((prog) => (
                                            <SelectItem
                                              key={prog.code}
                                              value={prog.code}
                                            >
                                              {prog.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {firstChoicePrograms.length === 0 && (
                                        <p className="text-xs text-muted-foreground">
                                          No active programme available in this
                                          department.
                                        </p>
                                      )}
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>

                            <div className="rounded-lg border bg-background p-4">
                              <div className="mb-3 flex items-center justify-between">
                                <h5 className="font-medium">Second Choice</h5>
                                <p className="text-xs text-muted-foreground">
                                  Optional: choose an alternative
                                </p>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                  control={academicForm.control}
                                  name="secondChoiceDepartment"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Department (Optional)
                                      </FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={
                                          availableDepartments.length === 0
                                        }
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select department" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {availableDepartments.map((dept) => (
                                            <SelectItem key={dept} value={dept}>
                                              {dept}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={academicForm.control}
                                  name="secondChoiceProgram"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Programme (Optional)
                                      </FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={
                                          secondChoicePrograms.length === 0
                                        }
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select programme" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {secondChoicePrograms.map((prog) => (
                                            <SelectItem
                                              key={prog.code}
                                              value={prog.code}
                                            >
                                              {prog.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </>
                )}

                {/* Step 6: Other Details */}
                {currentStep === 6 && (
                  <>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-serif">
                        <User className="h-5 w-5 text-secondary" />
                        Other Details
                      </CardTitle>
                      <CardDescription>
                        Provide parent or guardian contact details. Email is
                        optional.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...guardianForm}>
                        <form className="space-y-6">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              control={guardianForm.control}
                              name="guardianName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Parent/Guardian Name</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                      <Input
                                        {...field}
                                        className="pl-10"
                                        placeholder="Full name"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={guardianForm.control}
                              name="guardianPhone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Parent/Guardian Phone</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                      <Input
                                        {...field}
                                        className="pl-10"
                                        placeholder="08012345678"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={guardianForm.control}
                            name="guardianEmail"
                            render={({ field }) => (
                              <FormItem className="sm:w-1/2">
                                <FormLabel>
                                  Parent/Guardian Email (Optional)
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                      {...field}
                                      className="pl-10"
                                      type="email"
                                      placeholder="guardian@email.com"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={guardianForm.control}
                            name="guardianAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Parent/Guardian Address</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Textarea
                                      {...field}
                                      className="pl-10 min-h-[80px]"
                                      placeholder="Enter full address"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </form>
                      </Form>
                    </CardContent>
                  </>
                )}

                {/* Step 7: Document Upload */}
                {currentStep === 7 && (
                  <>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-serif">
                        <Upload className="h-5 w-5 text-secondary" />
                        Document Upload
                      </CardTitle>
                      <CardDescription>
                        Upload required documents based on your qualification.
                        Accepted formats: PDF, JPG, PNG (Max 5MB each)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-4 w-4 text-warning" />
                            <p className="text-sm text-warning">
                              Please ensure all documents are clear and legible.
                              Incomplete or unclear documents may delay your
                              application.
                            </p>
                          </div>
                        </div>

                        {!selectedQualification && (
                          <div className="rounded-lg border border-info/30 bg-info/5 p-4 text-center">
                            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-info" />
                            <p className="text-sm text-info">
                              Please go back to Step 4 and select your
                              qualification to see the required documents.
                            </p>
                          </div>
                        )}

                        {selectedQualification && (
                          <div className="grid gap-4 sm:grid-cols-2">
                            {getRequiredDocuments().map((doc) => (
                              <div
                                key={doc.key}
                                className="relative rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 transition-colors hover:border-primary/50"
                              >
                                <div className="flex flex-col items-center gap-2 text-center">
                                  <div
                                    className={`flex h-12 w-12 items-center justify-center rounded-full ${
                                      uploadedFiles[doc.key]
                                        ? "bg-success/10"
                                        : "bg-muted"
                                    }`}
                                  >
                                    {uploadedFiles[doc.key] ? (
                                      <Check className="h-6 w-6 text-success" />
                                    ) : (
                                      <Upload className="h-6 w-6 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      {doc.label}
                                      {doc.required && (
                                        <span className="text-destructive">
                                          {" "}
                                          *
                                        </span>
                                      )}
                                    </p>
                                    {uploadedFiles[doc.key] ? (
                                      <p className="text-xs text-success">
                                        {uploadedFiles[doc.key]?.name}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">
                                        Click to upload
                                      </p>
                                    )}
                                  </div>
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="absolute inset-0 cursor-pointer opacity-0"
                                    onChange={(e) =>
                                      handleFileUpload(
                                        doc.key,
                                        e.target.files?.[0] || null,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {isHigherQualification && (
                          <div className="rounded-lg border border-info/20 bg-info/5 p-4">
                            <h5 className="mb-2 font-medium text-info">
                              Document Guidelines for{" "}
                              {selectedQualification.toUpperCase()} Holders:
                            </h5>
                            <ul className="list-inside list-disc space-y-1 text-sm text-info">
                              <li>
                                O'Level Result: Your WAEC/NECO/NABTEB result
                              </li>
                              <li>
                                {selectedQualification.toUpperCase()}{" "}
                                Certificate: Statement of result or certificate
                              </li>
                              <li>
                                Academic Transcript: Official transcript from
                                your institution
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </>
                )}

                {/* Step 8: Review & Submit */}
                {currentStep === 8 && (
                  <>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-serif">
                        <Check className="h-5 w-5 text-secondary" />
                        Review & Submit
                      </CardTitle>
                      <CardDescription>
                        Please review all information before submitting your
                        application.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {/* Personal Info Summary */}
                        <div className="rounded-lg border p-4">
                          <h4 className="mb-3 flex items-center gap-2 font-medium">
                            <User className="h-4 w-4 text-primary" />
                            Personal Information
                          </h4>
                          <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <span className="text-muted-foreground">
                                Full Name:
                              </span>{" "}
                              <span className="font-medium">
                                {personalForm.getValues("firstName")}{" "}
                                {personalForm.getValues("middleName")}{" "}
                                {personalForm.getValues("lastName")}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Date of Birth:
                              </span>{" "}
                              <span className="font-medium">
                                {personalForm.getValues("dateOfBirth")}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Gender:
                              </span>{" "}
                              <span className="font-medium capitalize">
                                {personalForm.getValues("gender")}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                State of Origin:
                              </span>{" "}
                              <span className="font-medium capitalize">
                                {personalForm.getValues("stateOfOrigin") ||
                                  "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Contact Info Summary */}
                        <div className="rounded-lg border p-4">
                          <h4 className="mb-3 flex items-center gap-2 font-medium">
                            <Phone className="h-4 w-4 text-primary" />
                            Contact Details
                          </h4>
                          <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <span className="text-muted-foreground">
                                Email:
                              </span>{" "}
                              <span className="font-medium">
                                {contactForm.getValues("email") || "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Phone:
                              </span>{" "}
                              <span className="font-medium">
                                {contactForm.getValues("phone") || "N/A"}
                              </span>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">
                                Address:
                              </span>{" "}
                              <span className="font-medium">
                                {contactForm.getValues("address") || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Guardian Info Summary */}
                        <div className="rounded-lg border p-4">
                          <h4 className="mb-3 flex items-center gap-2 font-medium">
                            <User className="h-4 w-4 text-primary" />
                            Parent/Guardian
                          </h4>
                          <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <span className="text-muted-foreground">
                                Name:
                              </span>{" "}
                              <span className="font-medium">
                                {guardianForm.getValues("guardianName") ||
                                  "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Phone:
                              </span>{" "}
                              <span className="font-medium">
                                {guardianForm.getValues("guardianPhone") ||
                                  "N/A"}
                              </span>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">
                                Email:
                              </span>{" "}
                              <span className="font-medium">
                                {guardianForm.getValues("guardianEmail") ||
                                  "N/A"}
                              </span>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">
                                Address:
                              </span>{" "}
                              <span className="font-medium">
                                {guardianForm.getValues("guardianAddress") ||
                                  "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* JAMB Info Summary */}
                        <div className="rounded-lg border p-4">
                          <h4 className="mb-3 flex items-center gap-2 font-medium">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            JAMB Information
                          </h4>
                          <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <span className="text-muted-foreground">
                                JAMB Number:
                              </span>{" "}
                              <span className="font-medium">
                                {jambForm.getValues("jambNumber") || "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                JAMB Score:
                              </span>{" "}
                              <span className="font-medium">
                                {jambForm.getValues("jambScore") || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Academic Info Summary */}
                        <div className="rounded-lg border p-4">
                          <h4 className="mb-3 flex items-center gap-2 font-medium">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            Academic Information
                          </h4>
                          <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <span className="text-muted-foreground">
                                Previous Institution:
                              </span>{" "}
                              <span className="font-medium">
                                {academicForm.getValues(
                                  "previousInstitution",
                                ) || "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Qualification:
                              </span>{" "}
                              <span className="font-medium uppercase">
                                {academicForm.getValues("qualification") ||
                                  "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Programme Application Summary */}
                        <div className="rounded-lg border p-4">
                          <h4 className="mb-3 flex items-center gap-2 font-medium">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            Programme Application
                          </h4>
                          <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <span className="text-muted-foreground">
                                Session:
                              </span>{" "}
                              <span className="font-medium">
                                {academicForm.getValues("applicationSession") ||
                                  "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Mode of Entry:
                              </span>{" "}
                              <span className="font-medium capitalize">
                                {academicForm.getValues(
                                  "applicationModeOfEntry",
                                ) || "N/A"}
                              </span>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">
                                First Choice:
                              </span>{" "}
                              <span className="font-medium">
                                {academicForm.getValues(
                                  "firstChoiceDepartment",
                                ) || "N/A"}
                                {academicForm.getValues("firstChoiceProgram")
                                  ? ` — ${academicForm.getValues("firstChoiceProgram")}`
                                  : ""}
                              </span>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-muted-foreground">
                                Second Choice:
                              </span>{" "}
                              <span className="font-medium">
                                {academicForm.getValues(
                                  "secondChoiceDepartment",
                                ) || "N/A"}
                                {academicForm.getValues("secondChoiceProgram")
                                  ? ` — ${academicForm.getValues("secondChoiceProgram")}`
                                  : ""}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Documents Summary */}
                        <div className="rounded-lg border p-4">
                          <h4 className="mb-3 flex items-center gap-2 font-medium">
                            <FileText className="h-4 w-4 text-primary" />
                            Uploaded Documents
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(uploadedFiles).map(
                              ([key, file]) => (
                                <Badge
                                  key={key}
                                  variant={file ? "emerald" : "outline"}
                                  className="text-xs"
                                >
                                  {key.replace(/([A-Z])/g, " $1").trim()}
                                  {file ? ` ✓` : " (missing)"}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>

                        {/* Declaration */}
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                          <p className="text-sm">
                            By submitting this application, I declare that all
                            information provided is true and accurate to the
                            best of my knowledge. I understand that any false
                            information may result in the rejection of my
                            application or dismissal from the institution.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between border-t p-4">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentStep === 1 || isSubmitting}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>

                  {currentStep < steps.length ? (
                    <Button
                      variant="gold"
                      onClick={handleNext}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Validating..." : "Next Step"}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="gold"
                      onClick={handleSubmit}
                      disabled={isSubmitting || !activeSession?.id}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Application"}
                      <Check className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </StudentLayout>
  );
}
