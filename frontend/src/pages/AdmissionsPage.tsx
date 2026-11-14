import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import heroCampus from "@/assets/hero-campus.jpg";
import {
  ArrowRight,
  GraduationCap,
  Clock,
  FileText,
  CreditCard,
  CheckCircle2,
  Laptop,
  Building2,
  Library,
  Calculator,
  BookOpen,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { degreeProgrammeGroups } from "@/lib/academicProgrammes";
import { schoolConfig } from "@/config/schoolConfig";

const admissionSteps = [
  {
    step: 1,
    title: "Create Student Account",
    description:
      "Register your profile on the portal to begin your application journey",
    icon: Users,
  },
  {
    step: 2,
    title: "Pay Application Fee",
    description: `Complete payment of ${schoolConfig.academics.applicationFeeFormatted} via our secured gateway`,
    icon: CreditCard,
  },
  {
    step: 3,
    title: "Submit Application Form",
    description:
      "Complete your personal, O'Level details and upload required academic credentials",
    icon: FileText,
  },
  {
    step: 4,
    title: "Admission Decision",
    description:
      "Check your portal for official admission letter and print acceptance slips",
    icon: Clock,
  },
];

const programs = degreeProgrammeGroups.map((group, index) => ({
  ...group,
  icon: [Laptop, Building2, Library, BookOpen][index] || BookOpen,
}));

const requirements = [
  "WAEC, NECO, or NABTEB with at least 5 credit passes including English Language, Mathematics, and three relevant academic subjects",
  // "Valid National Identification Number (NIN)",
  "Recent passport photograph (white background strongly recommended)",
  "Birth certificate or statutory age declaration",
  "Local Government of Origin Identification Certificate",
  // "JAMB result slip or other approved direct entry credential where applicable",
];

const fees = [
  {
    item: "Application Fee",
    amount: schoolConfig.academics.applicationFeeFormatted,
  },
  {
    item: "Acceptance Fee",
    amount: schoolConfig.academics.acceptanceFeeFormatted,
  },
];

export default function AdmissionsPage() {
  return (
    <PublicLayout>
      {/* Hero Wrapper */}
      <div className="relative mb-32 lg:mb-40">
        {/* Hero Section */}
        <section className="relative pt-20 pb-36 md:pt-28 md:pb-48 text-center overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0">
            <img
              src={heroCampus}
              alt="MCCE Campus"
              className="h-full w-full object-cover"
            />
            <div className="hero-overlay absolute inset-0" />
            <div className="pattern-overlay absolute inset-0" />
          </div>

          <div className="container relative z-10">
            <div className="mx-auto max-w-3xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Badge variant="gold" className="mb-4 px-3 py-1">
                  <Clock className="mr-1.5 h-3.5 w-3.5" />
                  {schoolConfig.academics.currentSession} Session Now Open
                </Badge>
                <h1 className="mb-6 font-serif text-4xl font-bold text-primary-foreground md:text-5xl lg:text-6xl drop-shadow-lg">
                  Begin Your Academic Journey
                </h1>
                <p className="mb-8 text-lg text-primary-foreground/90 leading-relaxed drop-shadow-md">
                  Join {schoolConfig.name.full} and unlock your potential
                  through degree studies in arts, education, science, and
                  computing. Our streamlined online admissions process makes it
                  simple to get started.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    variant="hero"
                    size="xl"
                    className="shadow-gold shadow-lg hover:scale-105 transition-transform"
                    asChild
                  >
                    <Link to="/student/register">
                      Apply Now
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="xl"
                    className="bg-background/10 text-primary-foreground border-primary-foreground/20 hover:bg-background/20 backdrop-blur-md"
                    asChild
                  >
                    <a href="#steps">View Admission Steps</a>
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Floating Admission Steps Row */}
        <motion.div
          id="steps"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute -bottom-24 left-0 right-0 z-20 hidden lg:block"
        >
          <div className="container">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {admissionSteps.map((step, index) => (
                <div
                  key={step.step}
                  className="relative flex flex-col rounded-2xl bg-background/95 backdrop-blur-md p-6 shadow-xl border border-border/50 text-left hover:-translate-y-1 transition-transform h-full"
                >
                  <div className="absolute -top-4 left-6">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-serif font-bold text-secondary-foreground shadow-sm">
                      {step.step}
                    </div>
                  </div>
                  <div className="mb-4 mt-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-foreground !text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground !text-muted-foreground leading-relaxed flex-grow">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Mobile Admission Steps (Fallback) */}
      <section
        className="bg-background py-16 lg:hidden border-b"
        id="steps-mobile"
      >
        <div className="container">
          <div className="mb-10 text-center max-w-2xl mx-auto">
            <Badge variant="emerald" className="mb-3 px-3 py-1">
              Admission Pipeline
            </Badge>
            <h2 className="mb-4 font-serif text-3xl font-bold md:text-4xl text-foreground">
              4-Step Admission Process
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {admissionSteps.map((step, index) => (
              <Card
                key={step.step}
                className="card-elevated relative h-full flex flex-col justify-between"
              >
                <div className="absolute -top-3.5 left-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-serif font-bold text-secondary-foreground shadow-sm">
                    {step.step}
                  </div>
                </div>
                <CardHeader className="pt-8">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="font-serif text-lg text-foreground">
                    {step.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {step.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Academic Programs */}
      <section
        id="programs"
        className="bg-accent/30 py-16 md:py-24 border-y border-border/50"
      >
        <div className="container">
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <Badge variant="gold" className="mb-3 px-3 py-1">
              Academic Departments
            </Badge>
            <h2 className="mb-4 font-serif text-3xl font-bold md:text-4xl text-foreground">
              Available Degree Programmes
            </h2>
            <p className="text-muted-foreground text-base">
              Choose from accredited degree programmes across arts, education,
              science, and computing.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {programs.map((dept, index) => (
              <motion.div
                key={dept.department}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="card-elevated h-full">
                  <CardHeader>
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <dept.icon className="h-7 w-7" />
                    </div>
                    <CardTitle className="font-serif text-xl text-foreground">
                      {dept.department}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2.5">
                      {dept.courses.map((course) => (
                        <li
                          key={course}
                          className="flex items-center gap-2.5 text-sm"
                        >
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                          <span className="text-foreground/80 font-medium">
                            {course}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements & Fees */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Entry Requirements */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Card className="card-elevated h-full">
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <CardTitle className="font-serif text-2xl text-foreground">
                    Entry Requirements
                  </CardTitle>
                  <CardDescription>
                    Ensure you have the following credentials ready for upload
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3.5">
                    {requirements.map((req, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                        <span className="text-sm text-foreground/80 leading-relaxed">
                          {req}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            {/* Fees Structure */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Card className="card-elevated h-full flex flex-col justify-between">
                <div>
                  <CardHeader>
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                      <Calculator className="h-6 w-6" />
                    </div>
                    <CardTitle className="font-serif text-2xl text-foreground">
                      Fee Structure
                    </CardTitle>
                    <CardDescription>
                      Official application and acceptance charges
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {fees.map((fee) => (
                        <div
                          key={fee.item}
                          className="flex items-center justify-between border-b border-border/70 pb-3.5 last:border-0"
                        >
                          <span className="text-sm font-medium text-foreground/80">
                            {fee.item}
                          </span>
                          <span className="font-serif text-lg font-bold text-primary">
                            {fee.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-5 text-xs text-muted-foreground leading-relaxed">
                      * Tuition and departmental dues vary by degree pathway.
                      All payments are verified securely via Paystack with
                      instant digital receipts generated in your portal.
                    </p>
                  </CardContent>
                </div>
                <CardContent className="pt-0">
                  <Button
                    variant="portal"
                    asChild
                    className="w-full justify-center"
                  >
                    <Link to="/student/register">Pay & Apply Online</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="hero-gradient py-16 md:py-24 text-center">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <GraduationCap className="mx-auto mb-6 h-16 w-16 text-gold" />
            <h2 className="mb-4 font-serif text-3xl font-bold text-primary-foreground md:text-4xl">
              Ready to Join {schoolConfig.name.short}?
            </h2>
            <p className="mb-8 text-lg text-primary-foreground/90 leading-relaxed">
              Take the first step towards academic and professional distinction.
              Start your application today.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button variant="hero" size="xl" asChild>
                <Link to="/student/register">
                  Start Application
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="hero-outline" size="xl" asChild>
                <Link to="/contact">Contact Admissions Helpdesk</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
}
