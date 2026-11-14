import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  FileText,
  Upload,
  Check,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Calendar,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import { toast } from "sonner";

const personalInfoSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  middleName: z.string().optional(),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  maritalStatus: z.string().min(1, "Marital status is required"),
  nationality: z.string().min(1, "Nationality is required"),
  stateOfOrigin: z.string().min(1, "State of origin is required"),
  localGovernment: z.string().min(1, "Local government is required"),
});

const contactInfoSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().min(11, "Phone number must be at least 11 digits"),
  alternatePhone: z.string().optional(),
  address: z.string().min(10, "Address must be at least 10 characters"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().optional(),
});

const jambInfoSchema = z.object({
  jambNumber: z.string().min(4, "JAMB number is required"),
  jambScore: z.string().min(1, "JAMB score is required"),
});

// O'Level subject entry schema
const oLevelSubjectSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  grade: z.string().min(1, "Grade is required"),
});

const academicInfoSchema = z.object({
  program: z.string().min(1, "Program selection is required"),
  entryMode: z.string().min(1, "Entry mode is required"),
  previousInstitution: z.string().min(2, "Previous institution is required"),
  qualification: z.string().min(1, "Qualification is required"),
  graduationYear: z.string().min(4, "Graduation year is required"),
  gradeObtained: z.string().min(1, "Grade is required"),
  // O'Level specific fields
  examNumber: z.string().optional(),
  examCenter: z.string().optional(),
  examYear: z.string().optional(),
  // Higher qualification specific fields
  courseOfStudy: z.string().optional(),
  cgpa: z.string().optional(),
});

// O'Level subjects list
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
];

type OLevelSubject = z.infer<typeof oLevelSubjectSchema>;

const documentSchema = z.object({
  oLevelResult: z.string().optional(),
  birthCertificate: z.string().optional(),
  passport: z.string().optional(),
  localGovtId: z.string().optional(),
});

type PersonalInfo = z.infer<typeof personalInfoSchema>;
type ContactInfo = z.infer<typeof contactInfoSchema>;
type JAMBInfo = z.infer<typeof jambInfoSchema>;
type AcademicInfo = z.infer<typeof academicInfoSchema>;
type DocumentInfo = z.infer<typeof documentSchema>;

const steps = [
  { id: 1, name: "Personal Info", icon: User },
  { id: 2, name: "Contact Details", icon: Phone },
  { id: 3, name: "JAMB Info", icon: GraduationCap },
  { id: 4, name: "Academic History", icon: GraduationCap },
  { id: 5, name: "Documents", icon: FileText },
  { id: 6, name: "Review", icon: Check },
];

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
  "FCT",
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
];

const programs = [
  { code: "CSC", name: "Computer Science" },
  { code: "ACC", name: "Accountancy" },
  { code: "BUS", name: "Business Administration" },
  { code: "PAD", name: "Public Administration" },
  { code: "MKT", name: "Marketing" },
  { code: "ELE", name: "Electrical Engineering" },
  { code: "MEC", name: "Mechanical Engineering" },
  { code: "CIV", name: "Civil Engineering" },
];

export default function ApplicationPage() {
  const [currentStep, setCurrentStep] = useState(1);
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
    diplomaCertificate: null,
  });

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
      courseOfStudy: "",
      cgpa: "",
    },
  });

  const selectedQualification = academicForm.watch("qualification");
  const isOLevel = ["waec", "neco", "nabteb"].includes(selectedQualification);
  const isHigherQualification = ["ond", "nce", "diploma"].includes(
    selectedQualification,
  );

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
    if (sitting === 1) {
      setOLevelSubjects1((prev) =>
        prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
      );
    } else {
      setOLevelSubjects2((prev) =>
        prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
      );
    }
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

    if (selectedQualification === "diploma") {
      return [
        { key: "oLevelResult", label: "O'Level Result", required: true },
        {
          key: "diplomaCertificate",
          label: "Diploma Certificate/Statement of Result",
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

    switch (currentStep) {
      case 1:
        isValid = await personalForm.trigger();
        break;
      case 2:
        isValid = await contactForm.trigger();
        break;
      case 3:
        isValid = await jambForm.trigger();
        break;
      case 4:
        isValid = await academicForm.trigger();
        break;
      case 5:
        isValid = true; // Documents are optional for now
        break;
      default:
        isValid = true;
    }

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    const formData = {
      personal: personalForm.getValues(),
      contact: contactForm.getValues(),
      jamb: jambForm.getValues(),
      academic: academicForm.getValues(),
      documents: uploadedFiles,
    };
    console.log("Application submitted:", formData);
    toast.success("Application submitted successfully!", {
      description: "You will receive a confirmation email shortly.",
    });
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

        {/* Progress Steps */}
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

        {/* Form Content */}
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
                                    disabled
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
                                    disabled
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
                                    disabled
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
                                    disabled
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
                                    disabled
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
                                <FormLabel>Marital Status</FormLabel>
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
                                <FormLabel>Nationality</FormLabel>
                                <FormControl>
                                  <Input {...field} />
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
                                <FormLabel>State of Origin</FormLabel>
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
                                <FormLabel>Local Government</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Enter LGA" />
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
                              <FormLabel>Alternate Phone (Optional)</FormLabel>
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
                                  <Input {...field} placeholder="Enter city" />
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
                      Provide your JAMB registration number and score.
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
                                <FormLabel>JAMB Registration Number</FormLabel>
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
                                <FormLabel>JAMB Score</FormLabel>
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
                      Academic History
                    </CardTitle>
                    <CardDescription>
                      Provide information about your educational background and
                      program choice.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...academicForm}>
                      <form className="space-y-6">
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
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
                                      {programs.map((program) => (
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
                                      <SelectItem value="transfer">
                                        Transfer
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

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
                                  <FormLabel>Qualification Obtained</FormLabel>
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
                                      <SelectItem value="neco">NECO</SelectItem>
                                      <SelectItem value="nabteb">
                                        NABTEB
                                      </SelectItem>
                                      <SelectItem value="ond">OND</SelectItem>
                                      <SelectItem value="nce">NCE</SelectItem>
                                      <SelectItem value="diploma">
                                        Diploma
                                      </SelectItem>
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
                                Enter at least 5 subjects with their grades
                              </p>
                              <div className="space-y-3">
                                {oLevelSubjects1.map((subj, index) => (
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
                                            1,
                                          )
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select subject" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {oLevelSubjects.map((subject) => (
                                            <SelectItem
                                              key={subject}
                                              value={subject
                                                .toLowerCase()
                                                .replace(/\s+/g, "-")}
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
                                ))}
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

                            {/* O'Level Subjects - Second Sitting */}
                            {hasSecondSitting && (
                              <div className="rounded-lg border border-info/20 p-4">
                                <h4 className="mb-4 font-medium text-info">
                                  O'Level Subjects & Grades (Second Sitting)
                                </h4>
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
                                            {oLevelSubjects.map((subject) => (
                                              <SelectItem
                                                key={subject}
                                                value={subject
                                                  .toLowerCase()
                                                  .replace(/\s+/g, "-")}
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
                                      <FormLabel>CGPA / Final Grade</FormLabel>
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
                                      <SelectItem value="pass">Pass</SelectItem>
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
                                  O'Level result and academic transcript in the
                                  next step.
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
                                      <SelectItem value="pass">Pass</SelectItem>
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

              {/* Step 5: Document Upload */}
              {currentStep === 5 && (
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
                              {selectedQualification.toUpperCase()} Certificate:
                              Statement of result or certificate
                            </li>
                            <li>
                              Academic Transcript: Official transcript from your
                              institution
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </>
              )}

              {/* Step 6: Review & Submit */}
              {currentStep === 6 && (
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
                              {personalForm.getValues("stateOfOrigin") || "N/A"}
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
                              Program:
                            </span>{" "}
                            <span className="font-medium">
                              {programs.find(
                                (p) =>
                                  p.code === academicForm.getValues("program"),
                              )?.name || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Entry Mode:
                            </span>{" "}
                            <span className="font-medium capitalize">
                              {academicForm
                                .getValues("entryMode")
                                ?.replace("-", " ") || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Previous Institution:
                            </span>{" "}
                            <span className="font-medium">
                              {academicForm.getValues("previousInstitution") ||
                                "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Qualification:
                            </span>{" "}
                            <span className="font-medium uppercase">
                              {academicForm.getValues("qualification") || "N/A"}
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
                          {Object.entries(uploadedFiles).map(([key, file]) => (
                            <Badge
                              key={key}
                              variant={file ? "emerald" : "outline"}
                              className="text-xs"
                            >
                              {key.replace(/([A-Z])/g, " $1").trim()}
                              {file ? ` ✓` : " (missing)"}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Declaration */}
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <p className="text-sm">
                          By submitting this application, I declare that all
                          information provided is true and accurate to the best
                          of my knowledge. I understand that any false
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
                  disabled={currentStep === 1}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>

                {currentStep < steps.length ? (
                  <Button variant="gold" onClick={handleNext}>
                    Next Step
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="gold" onClick={handleSubmit}>
                    Submit Application
                    <Check className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </StudentLayout>
  );
}
