import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import { requiresStudentProfileUpdate } from "@/lib/onboarding";
import { NIGERIAN_STATES } from "@/lib/nigerian-states";
import { toast } from "sonner";

type StudentProfile = {
  id?: string;
  full_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  nin?: string | null;
  session?: string | null;
  application_id?: string | null;
  address?: string | null;
  state?: string | null;
  lga?: string | null;
  dob?: string | null;
  gender?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_relationship?: string | null;
  guardian_address?: string | null;
  next_of_kin?: string | null;
  next_of_kin_phone?: string | null;
  onboarding_source?: string | null;
  profile_completion_status?: string | null;
  account_update_required?: boolean | number | string | null;
  education?: {
    primarySchool?: string | null;
    primaryYear?: string | null;
    secondarySchool?: string | null;
    secondaryYear?: string | null;
  } | null;
  academic?: {
    qualification?: string | null;
    graduationYear?: string | null;
    examNumber?: string | null;
    examCenter?: string | null;
    examYear?: string | null;
    qualification2?: string | null;
    examNumber2?: string | null;
    examCenter2?: string | null;
    examYear2?: string | null;
    jambNumber?: string | null;
    jambScore?: string | null;
  } | null;
  oLevel?: {
    firstSitting?: OLevelSubject[];
    secondSitting?: OLevelSubject[];
  } | null;
};

type AdmissionStatus = {
  status?: string;
  appliedDate?: string | null;
  programApplied?: string | null;
  department?: string | null;
  qualificationUsed?: string | null;
};

type ProfileCompletionForm = {
  phone: string;
  dob: string;
  gender: string;
  address: string;
  state: string;
  lga: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_relationship: string;
  guardian_address: string;
  next_of_kin: string;
  next_of_kin_phone: string;
  primary_school: string;
  primary_year: string;
  secondary_school: string;
  secondary_year: string;
  qualification: string;
  graduation_year: string;
  exam_number: string;
  exam_center: string;
  exam_year: string;
  qualification2: string;
  exam_number2: string;
  exam_center2: string;
  exam_year2: string;
  jamb_number: string;
  jamb_score: string;
};

type OLevelSubject = {
  subject: string;
  grade: string;
};

const EMPTY_PROFILE_FORM: ProfileCompletionForm = {
  phone: "",
  dob: "",
  gender: "",
  address: "",
  state: "",
  lga: "",
  guardian_name: "",
  guardian_phone: "",
  guardian_relationship: "",
  guardian_address: "",
  next_of_kin: "",
  next_of_kin_phone: "",
  primary_school: "",
  primary_year: "",
  secondary_school: "",
  secondary_year: "",
  qualification: "",
  graduation_year: "",
  exam_number: "",
  exam_center: "",
  exam_year: "",
  qualification2: "",
  exam_number2: "",
  exam_center2: "",
  exam_year2: "",
  jamb_number: "",
  jamb_score: "",
};

const emptyOLevelRows = (): OLevelSubject[] => [
  { subject: "English Language", grade: "" },
  { subject: "Mathematics", grade: "" },
  { subject: "", grade: "" },
  { subject: "", grade: "" },
  { subject: "", grade: "" },
];

const oLevelSubjects = [
  "English Language",
  "Mathematics",
  "Civic Education",
  "Biology",
  "Chemistry",
  "Physics",
  "Agricultural Science",
  "Economics",
  "Government",
  "Geography",
  "Literature in English",
  "Islamic Studies",
  "Christian Religious Studies",
  "Hausa",
  "Arabic",
  "Commerce",
  "Financial Accounting",
  "Computer Studies",
];

const oLevelGrades = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];

const formatStatus = (status?: string) =>
  (status || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-NG", { dateStyle: "medium" });
};

const valueOrEmpty = (value?: string | null) => String(value || "");

const buildCompletionForm = (
  profile: StudentProfile | null,
): ProfileCompletionForm => ({
  phone: valueOrEmpty(profile?.phone),
  dob: valueOrEmpty(profile?.dob),
  gender: valueOrEmpty(profile?.gender),
  address: valueOrEmpty(profile?.address),
  state: valueOrEmpty(profile?.state),
  lga: valueOrEmpty(profile?.lga),
  guardian_name: valueOrEmpty(profile?.guardian_name),
  guardian_phone: valueOrEmpty(profile?.guardian_phone),
  guardian_relationship: valueOrEmpty(profile?.guardian_relationship),
  guardian_address: valueOrEmpty(profile?.guardian_address),
  next_of_kin: valueOrEmpty(profile?.next_of_kin),
  next_of_kin_phone: valueOrEmpty(profile?.next_of_kin_phone),
  primary_school: valueOrEmpty(profile?.education?.primarySchool),
  primary_year: valueOrEmpty(profile?.education?.primaryYear),
  secondary_school: valueOrEmpty(profile?.education?.secondarySchool),
  secondary_year: valueOrEmpty(profile?.education?.secondaryYear),
  qualification: valueOrEmpty(profile?.academic?.qualification),
  graduation_year: valueOrEmpty(profile?.academic?.graduationYear),
  exam_number: valueOrEmpty(profile?.academic?.examNumber),
  exam_center: valueOrEmpty(profile?.academic?.examCenter),
  exam_year: valueOrEmpty(profile?.academic?.examYear),
  qualification2: valueOrEmpty(profile?.academic?.qualification2),
  exam_number2: valueOrEmpty(profile?.academic?.examNumber2),
  exam_center2: valueOrEmpty(profile?.academic?.examCenter2),
  exam_year2: valueOrEmpty(profile?.academic?.examYear2),
  jamb_number: valueOrEmpty(profile?.academic?.jambNumber),
  jamb_score: valueOrEmpty(profile?.academic?.jambScore),
});

const requiredCompletionFields: Array<keyof ProfileCompletionForm> = [
  "phone",
  "address",
  "state",
  "lga",
  "guardian_name",
  "guardian_phone",
  "guardian_relationship",
  "primary_school",
  "primary_year",
  "secondary_school",
  "secondary_year",
  "qualification",
  "exam_number",
  "exam_year",
];

const isCompletionFormValid = (form: ProfileCompletionForm) =>
  requiredCompletionFields.every((field) => form[field].trim());

const normalizeOLevelRows = (rows?: OLevelSubject[] | null) => {
  const base = emptyOLevelRows();
  if (!Array.isArray(rows)) return base;
  rows.slice(0, 8).forEach((row, index) => {
    if (!base[index]) {
      base[index] = { subject: "", grade: "" };
    }
    base[index] = {
      subject: valueOrEmpty(row?.subject),
      grade: valueOrEmpty(row?.grade),
    };
  });
  return base;
};

const hasEnoughOLevelRows = (rows: OLevelSubject[]) =>
  rows.filter((row) => row.subject.trim() && row.grade.trim()).length >= 5;

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(() => {
    try {
      const raw =
        localStorage.getItem("mccas_profile") ||
        localStorage.getItem("MCCAS_profile");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  });
  const [admission, setAdmission] = useState<AdmissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [completionForm, setCompletionForm] =
    useState<ProfileCompletionForm>(EMPTY_PROFILE_FORM);
  const [firstSittingRows, setFirstSittingRows] =
    useState<OLevelSubject[]>(emptyOLevelRows);
  const [secondSittingRows, setSecondSittingRows] = useState<OLevelSubject[]>(
    [],
  );

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const [profileRes, admissionRes] = await Promise.allSettled([
          api.getStudentProfile(),
          api.getAdmissionStatus(),
        ]);

        if (!mounted) return;

        if (profileRes.status === "fulfilled") {
          const nextProfile =
            profileRes.value?.data || profileRes.value || null;
          setProfile(nextProfile);
          try {
            const json = JSON.stringify(nextProfile);
            localStorage.setItem("mccas_profile", json);
            localStorage.setItem("MCCAS_profile", json);
          } catch (error) {
            // ignore storage failures
          }
        }

        if (admissionRes.status === "fulfilled") {
          setAdmission(admissionRes.value?.data || null);
        }
      } catch (error) {
        toast.error("Failed to load profile");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setCompletionForm(buildCompletionForm(profile));
    setFirstSittingRows(normalizeOLevelRows(profile?.oLevel?.firstSitting));
    setSecondSittingRows(
      Array.isArray(profile?.oLevel?.secondSitting)
        ? profile.oLevel.secondSitting
        : [],
    );
  }, [profile]);

  const displayName = useMemo(() => {
    if (profile?.full_name) return profile.full_name;
    return [profile?.first_name, profile?.middle_name, profile?.last_name]
      .filter(Boolean)
      .join(" ");
  }, [profile]);

  const initials = useMemo(() => {
    const source = displayName || profile?.email || "Student";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [displayName, profile?.email]);

  const status = admission?.status || "pending";
  const isAdmitted = status === "admitted";
  const profileUpdateRequired = requiresStudentProfileUpdate(profile);
  const completionPercent = Math.round(
    ((requiredCompletionFields.filter((field) => completionForm[field].trim())
      .length +
      (hasEnoughOLevelRows(firstSittingRows) ? 1 : 0)) /
      (requiredCompletionFields.length + 1)) *
      100,
  );

  const updateCompletionField = (
    field: keyof ProfileCompletionForm,
    value: string,
  ) => {
    setCompletionForm((current) => ({ ...current, [field]: value }));
  };

  const updateOLevelRow = (
    sitting: "first" | "second",
    index: number,
    field: keyof OLevelSubject,
    value: string,
  ) => {
    const setter =
      sitting === "first" ? setFirstSittingRows : setSecondSittingRows;
    setter((current) => {
      const next = [...current];
      if (!next[index]) {
        next[index] = { subject: "", grade: "" };
      }
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addSecondSittingRows = () => {
    setSecondSittingRows((current) =>
      current.length ? current : emptyOLevelRows(),
    );
  };

  const handleCompleteProfile = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isCompletionFormValid(completionForm)) {
      toast.error(
        "Complete the required contact, address, education, and exam fields",
      );
      return;
    }

    if (!hasEnoughOLevelRows(firstSittingRows)) {
      toast.error("Add at least five O'Level subjects with grades");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...completionForm,
        education: {
          primarySchool: completionForm.primary_school,
          primaryYear: completionForm.primary_year,
          secondarySchool: completionForm.secondary_school,
          secondaryYear: completionForm.secondary_year,
        },
        academic: {
          qualification: completionForm.qualification,
          graduationYear: completionForm.graduation_year,
          examNumber: completionForm.exam_number,
          examCenter: completionForm.exam_center,
          examYear: completionForm.exam_year,
          qualification2: completionForm.qualification2,
          examNumber2: completionForm.exam_number2,
          examCenter2: completionForm.exam_center2,
          examYear2: completionForm.exam_year2,
          jambNumber: completionForm.jamb_number,
          jambScore: completionForm.jamb_score,
        },
        oLevel: {
          firstSitting: firstSittingRows.filter(
            (row) => row.subject.trim() || row.grade.trim(),
          ),
          secondSitting: secondSittingRows.filter(
            (row) => row.subject.trim() || row.grade.trim(),
          ),
        },
        profile_completion_status: "complete",
        account_update_required: false,
      };
      const res = await api.updateStudentProfile(payload);
      const nextProfile = (res && typeof res === "object" && "data" in res
        ? (res as { data?: StudentProfile }).data
        : null) || {
        ...profile,
        ...payload,
      };

      setProfile(nextProfile);
      try {
        const json = JSON.stringify(nextProfile);
        localStorage.setItem("mccas_profile", json);
        localStorage.setItem("MCCAS_profile", json);
      } catch (error) {
        // ignore storage failures
      }
      toast.success("Profile update completed");
    } catch (error) {
      const err = error as { body?: { message?: string }; message?: string };
      toast.error(
        err?.body?.message || err?.message || "Failed to update profile",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StudentLayout profile={profile}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">
              Profile
            </h1>
            <p className="text-muted-foreground">
              Your student portal identity and application details.
            </p>
          </div>
          <Badge variant={isAdmitted ? "emerald" : "secondary"}>
            {formatStatus(status)}
          </Badge>
        </div>

        {profileUpdateRequired && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Account update required</AlertTitle>
            <AlertDescription>
              Your student record has been created from management data.
              Complete the required contact, address, and guardian details to
              continue using the portal.
            </AlertDescription>
          </Alert>
        )}

        <Card className="overflow-hidden">
          <div className="h-24 bg-primary" />
          <CardContent className="-mt-12 flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-background bg-primary-foreground text-2xl font-bold text-primary shadow-sm">
                {initials || "ST"}
              </div>
              <div className="pb-2">
                <h2 className="font-serif text-2xl font-bold">
                  {displayName || "Student"}
                </h2>
                <p className="text-muted-foreground">
                  Application ID: {profile?.application_id || "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>Basic account information.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoItem label="Full Name" value={displayName || "--"} />
                <InfoItem label="Student ID" value={profile?.id || "--"} />
                <InfoItem
                  icon={Mail}
                  label="Email"
                  value={profile?.email || "--"}
                />
                <InfoItem
                  icon={Phone}
                  label="Phone"
                  value={profile?.phone || "--"}
                />

                <InfoItem
                  label="Session"
                  value={profile?.session || admission?.appliedDate || "--"}
                />
                <InfoItem
                  icon={MapPin}
                  label="Address"
                  value={profile?.address || "Not provided"}
                />
                <InfoItem
                  label="State / LGA"
                  value={
                    [profile?.state, profile?.lga]
                      .filter(Boolean)
                      .join(" / ") || "Not provided"
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                {isAdmitted ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-warning" />
                )}
                Admission
              </CardTitle>
              <CardDescription>Current application state.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoItem label="Status" value={formatStatus(status)} />
              <InfoItem
                label="Applied Date"
                value={formatDate(admission?.appliedDate)}
              />
              <InfoItem
                label="Qualification"
                value={admission?.qualificationUsed || "--"}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 font-serif">
                  <Users className="h-5 w-5 text-primary" />
                  Account Update
                </CardTitle>
                <CardDescription>
                  Complete the details that only you can provide.
                </CardDescription>
              </div>
              <Badge
                variant={completionPercent === 100 ? "emerald" : "warning"}
              >
                {completionPercent}% complete
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCompleteProfile} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="profilePhone">Phone number</Label>
                  <Input
                    id="profilePhone"
                    value={completionForm.phone}
                    onChange={(event) =>
                      updateCompletionField("phone", event.target.value)
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profileDob">Date of birth</Label>
                  <Input
                    id="profileDob"
                    type="date"
                    value={completionForm.dob}
                    onChange={(event) =>
                      updateCompletionField("dob", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profileGender">Gender</Label>
                  <Select
                    value={completionForm.gender}
                    onValueChange={(value) =>
                      updateCompletionField("gender", value)
                    }
                  >
                    <SelectTrigger id="profileGender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="profileAddress">Residential address</Label>
                  <Textarea
                    id="profileAddress"
                    value={completionForm.address}
                    onChange={(event) =>
                      updateCompletionField("address", event.target.value)
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profileState">State</Label>
                  <Select
                    value={completionForm.state}
                    onValueChange={(value) => {
                      updateCompletionField("state", value);
                      // Reset LGA when state changes
                      updateCompletionField("lga", "");
                    }}
                  >
                    <SelectTrigger id="profileState">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(NIGERIAN_STATES).sort().map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profileLga">LGA</Label>
                  <Select
                    value={completionForm.lga}
                    onValueChange={(value) =>
                      updateCompletionField("lga", value)
                    }
                    disabled={!completionForm.state}
                  >
                    <SelectTrigger id="profileLga">
                      <SelectValue placeholder="Select LGA" />
                    </SelectTrigger>
                    <SelectContent>
                      {completionForm.state && NIGERIAN_STATES[completionForm.state] ? (
                        NIGERIAN_STATES[completionForm.state].sort().map((lga) => (
                          <SelectItem key={lga} value={lga}>
                            {lga}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>Select a state first</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="guardianName">Guardian name</Label>
                  <Input
                    id="guardianName"
                    value={completionForm.guardian_name}
                    onChange={(event) =>
                      updateCompletionField("guardian_name", event.target.value)
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianPhone">Guardian phone</Label>
                  <Input
                    id="guardianPhone"
                    value={completionForm.guardian_phone}
                    onChange={(event) =>
                      updateCompletionField(
                        "guardian_phone",
                        event.target.value,
                      )
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianRelationship">Relationship</Label>
                  <Input
                    id="guardianRelationship"
                    value={completionForm.guardian_relationship}
                    onChange={(event) =>
                      updateCompletionField(
                        "guardian_relationship",
                        event.target.value,
                      )
                    }
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="guardianAddress">Guardian address</Label>
                  <Textarea
                    id="guardianAddress"
                    value={completionForm.guardian_address}
                    onChange={(event) =>
                      updateCompletionField(
                        "guardian_address",
                        event.target.value,
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <h3 className="flex items-center gap-2 font-medium">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    Educational Information
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Previous schools and examination details.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primarySchool">Primary school</Label>
                    <Input
                      id="primarySchool"
                      value={completionForm.primary_school}
                      onChange={(event) =>
                        updateCompletionField(
                          "primary_school",
                          event.target.value,
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primaryYear">Primary graduation year</Label>
                    <Input
                      id="primaryYear"
                      value={completionForm.primary_year}
                      onChange={(event) =>
                        updateCompletionField(
                          "primary_year",
                          event.target.value,
                        )
                      }
                      placeholder="2016"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondarySchool">Secondary school</Label>
                    <Input
                      id="secondarySchool"
                      value={completionForm.secondary_school}
                      onChange={(event) =>
                        updateCompletionField(
                          "secondary_school",
                          event.target.value,
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryYear">
                      Secondary graduation year
                    </Label>
                    <Input
                      id="secondaryYear"
                      value={completionForm.secondary_year}
                      onChange={(event) =>
                        updateCompletionField(
                          "secondary_year",
                          event.target.value,
                        )
                      }
                      placeholder="2022"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="jambNumber">JAMB Registration Number (Optional)</Label>
                    <Input
                      id="jambNumber"
                      value={completionForm.jamb_number}
                      onChange={(event) =>
                        updateCompletionField("jamb_number", event.target.value)
                      }
                      placeholder="e.g. 12345678AB"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jambScore">JAMB Score (Optional)</Label>
                    <Input
                      id="jambScore"
                      type="number"
                      value={completionForm.jamb_score}
                      onChange={(event) =>
                        updateCompletionField("jamb_score", event.target.value)
                      }
                      placeholder="e.g. 210"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="qualification">Exam body</Label>
                    <Select
                      value={completionForm.qualification}
                      onValueChange={(value) =>
                        updateCompletionField("qualification", value)
                      }
                    >
                      <SelectTrigger id="qualification">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="waec">WAEC/SSCE</SelectItem>
                        <SelectItem value="neco">NECO</SelectItem>
                        <SelectItem value="nabteb">NABTEB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="examNumber">Exam number</Label>
                    <Input
                      id="examNumber"
                      value={completionForm.exam_number}
                      onChange={(event) =>
                        updateCompletionField("exam_number", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="examCenter">Exam center</Label>
                    <Input
                      id="examCenter"
                      value={completionForm.exam_center}
                      onChange={(event) =>
                        updateCompletionField("exam_center", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="examYear">Exam year</Label>
                    <Input
                      id="examYear"
                      value={completionForm.exam_year}
                      onChange={(event) =>
                        updateCompletionField("exam_year", event.target.value)
                      }
                      placeholder="2022"
                      required
                    />
                  </div>
                </div>

                <OLevelRowsEditor
                  title="O'Level Subjects & Grades (First Sitting)"
                  rows={firstSittingRows}
                  onChange={(index, field, value) =>
                    updateOLevelRow("first", index, field, value)
                  }
                />

                {secondSittingRows.length === 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addSecondSittingRows}
                  >
                    Add second sitting
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="qualification2">Second exam body</Label>
                        <Select
                          value={completionForm.qualification2}
                          onValueChange={(value) =>
                            updateCompletionField("qualification2", value)
                          }
                        >
                          <SelectTrigger id="qualification2">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="waec">WAEC/SSCE</SelectItem>
                            <SelectItem value="neco">NECO</SelectItem>
                            <SelectItem value="nabteb">NABTEB</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="examNumber2">Second exam number</Label>
                        <Input
                          id="examNumber2"
                          value={completionForm.exam_number2}
                          onChange={(event) =>
                            updateCompletionField(
                              "exam_number2",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="examCenter2">Second exam center</Label>
                        <Input
                          id="examCenter2"
                          value={completionForm.exam_center2}
                          onChange={(event) =>
                            updateCompletionField(
                              "exam_center2",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="examYear2">Second exam year</Label>
                        <Input
                          id="examYear2"
                          value={completionForm.exam_year2}
                          onChange={(event) =>
                            updateCompletionField(
                              "exam_year2",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                    <OLevelRowsEditor
                      title="O'Level Subjects & Grades (Second Sitting)"
                      rows={secondSittingRows}
                      onChange={(index, field, value) =>
                        updateOLevelRow("second", index, field, value)
                      }
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nextOfKin">Next of kin</Label>
                  <Input
                    id="nextOfKin"
                    value={completionForm.next_of_kin}
                    onChange={(event) =>
                      updateCompletionField("next_of_kin", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextOfKinPhone">Next of kin phone</Label>
                  <Input
                    id="nextOfKinPhone"
                    value={completionForm.next_of_kin_phone}
                    onChange={(event) =>
                      updateCompletionField(
                        "next_of_kin_phone",
                        event.target.value,
                      )
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Account Update"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <FileText className="h-5 w-5 text-primary" />
              Programme Application
            </CardTitle>
            <CardDescription>
              Programme details from your submitted application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <InfoItem
                label="Programme"
                value={admission?.programApplied || "--"}
              />
              <InfoItem
                label="Department"
                value={admission?.department || "--"}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </StudentLayout>
  );
}

function OLevelRowsEditor({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: OLevelSubject[];
  onChange: (index: number, field: keyof OLevelSubject, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="grid gap-3">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Subject {index + 1}</Label>
              <Select
                value={row.subject}
                onValueChange={(value) => onChange(index, "subject", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {oLevelSubjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Grade</Label>
              <Select
                value={row.grade}
                onValueChange={(value) => onChange(index, "grade", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {oLevelGrades.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-1 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}
