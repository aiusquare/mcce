import { motion } from "framer-motion";
import heroCampus from "@/assets/hero-campus.jpg";
import {
  GraduationCap,
  Target,
  Eye,
  Users,
  Award,
  BookOpen,
  Heart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { schoolConfig } from "@/config/schoolConfig";

const values = [
  {
    icon: Heart,
    title: "God-Conscious Service",
    description:
      "We serve with faith, compassion, and principled responsibility to community needs.",
  },
  {
    icon: Award,
    title: "Discipline & Diligence",
    description:
      "We uphold high standards of personal conduct, academic rigor, and professional ethics.",
  },
  {
    icon: Users,
    title: "Community Impact (Maslaha)",
    description:
      "We dedicate our knowledge to public welfare, social upliftment, and community progress.",
  },
  {
    icon: BookOpen,
    title: "Research & Learning",
    description:
      "We foster critical inquiry, scholarly research, and lifelong intellectual curiosity.",
  },
  {
    icon: GraduationCap,
    title: "Growth & Advancement",
    description:
      "We prepare graduates for further university education and impactful careers.",
  },
];

const objectives = [
  "To produce highly disciplined, hardworking, and ethically grounded graduates who address the critical needs of society.",
  "To encourage active research in education, arts, science, and computing for sustainable national growth.",
  "To champion community participation in educational self-help and youth mentorship projects.",
  "To prepare students thoroughly for advanced degree qualifications and professional certifications.",
  "To foster national unity by bringing together students from diverse backgrounds in an inspiring academic environment.",
];

const leadership = [
  {
    name: "Assc. Prof. Salisu Iliyasu",
    role: "Provost",
    description:
      "Providing strategic institutional leadership for academic excellence and community impact.",
  },
  {
    name: "M. Ibrahim Mansur",
    role: "Registrar",
    description:
      "Directing academic administration, registry operations, and institutional compliance.",
  },
  {
    name: "M. Jamilu Garba Goga",
    role: "Librarian",
    description:
      "The custodian, institutional budgeting, and bursary services.",
  },
];

export default function AboutPage() {
  return (
    <PublicLayout>
      {/* Hero Wrapper */}
      <div className="relative mb-24 md:mb-32">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 md:pt-28 md:pb-40 text-center overflow-hidden">
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
                  About the College
                </Badge>
                <h1 className="mb-6 font-serif text-4xl font-bold text-primary-foreground md:text-5xl lg:text-6xl drop-shadow-lg">
                  Building Tomorrow's Leaders
                </h1>
                <p className="text-lg text-primary-foreground/90 leading-relaxed drop-shadow-md">
                  {schoolConfig.name.full} ({schoolConfig.name.acronym}),{" "}
                  {schoolConfig.contact.city} is dedicated to providing
                  high-quality tertiary education, advanced scholarship, and
                  ethical leadership development.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Floating Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute -bottom-16 left-0 right-0 z-20 hidden md:block"
        >
          <div className="container">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-background/95 backdrop-blur-md p-6 shadow-xl border border-border/50">
                <p className="font-serif text-3xl font-extrabold text-primary">
                  15+
                </p>
                <p className="text-sm font-medium text-muted-foreground text-center !text-muted-foreground">
                  Years of Service
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-background/95 backdrop-blur-md p-6 shadow-xl border border-border/50">
                <p className="font-serif text-3xl font-extrabold text-secondary">
                  5,000+
                </p>
                <p className="text-sm font-medium text-muted-foreground text-center !text-muted-foreground">
                  Students Enrolled
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-background/95 backdrop-blur-md p-6 shadow-xl border border-border/50">
                <p className="font-serif text-3xl font-extrabold text-primary">
                  200+
                </p>
                <p className="text-sm font-medium text-muted-foreground text-center !text-muted-foreground">
                  Academic Staff
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-background/95 backdrop-blur-md p-6 shadow-xl border border-border/50">
                <p className="font-serif text-3xl font-extrabold text-secondary">
                  {schoolConfig.academics.programCount}
                </p>
                <p className="text-sm font-medium text-muted-foreground text-center !text-muted-foreground">
                  Degree Programmes
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* History & Identity Section */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Badge variant="emerald" className="mb-4 px-3 py-1">
                Our Institutional Legacy
              </Badge>
              <h2 className="mb-6 font-serif text-3xl font-bold md:text-4xl text-foreground">
                A Legacy of Community-Focused Higher Education
              </h2>
              <div className="space-y-4 text-muted-foreground text-base leading-relaxed">
                <p>
                  {schoolConfig.name.full} was established to meet the rising
                  demand for accessible, high-standard tertiary and degree
                  education in our region.
                </p>
                <p>
                  Rooted in moral excellence and civic responsibility,{" "}
                  {schoolConfig.name.acronym} remains committed to bridging
                  educational disparities through quality teaching, rigorous
                  academic mentorship, and active community partnership.
                </p>
                <p>
                  Today, {schoolConfig.name.short} prepares graduates who are
                  academically competent, morally upright, and ready to make
                  meaningful contributions to societal welfare and national
                  development.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="bg-accent/30 py-16 md:py-24 border-y border-border/50">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Card className="card-elevated h-full">
                <CardHeader>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Target className="h-7 w-7" />
                  </div>
                  <CardTitle className="font-serif text-2xl text-foreground">
                    Our Mission
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-base leading-relaxed">
                    To contribute to the upliftment and prosperity of society
                    through the development of graduates who are qualitative,
                    morally grounded, and positively responsive to community
                    needs across all spheres of life.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="card-elevated h-full">
                <CardHeader>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                    <Eye className="h-7 w-7" />
                  </div>
                  <CardTitle className="font-serif text-2xl text-foreground">
                    Our Vision
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-base leading-relaxed">
                    To be a premier center of academic excellence and higher
                    learning that fosters human capital development, advanced
                    research, and social transformation through disciplined
                    education.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Objectives */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <Badge variant="emerald" className="mb-3 px-3 py-1">
              Guiding Principles
            </Badge>
            <h2 className="mb-4 font-serif text-3xl font-bold md:text-4xl text-foreground">
              Objectives of the College
            </h2>
          </div>

          <div className="mx-auto max-w-3xl">
            <Card className="card-elevated">
              <CardContent className="pt-6">
                <ul className="space-y-4">
                  {objectives.map((objective, idx) => (
                    <li key={idx} className="flex items-start gap-3.5">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-foreground/80 leading-relaxed">
                        {objective}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 md:py-24 bg-accent/20 border-t border-border/50">
        <div className="container">
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <Badge variant="gold" className="mb-3 px-3 py-1">
              Institutional Pillars
            </Badge>
            <h2 className="mb-4 font-serif text-3xl font-bold md:text-4xl text-foreground">
              Our Core Values
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="card-elevated h-full text-center">
                  <CardHeader>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <value.icon className="h-7 w-7" />
                    </div>
                    <CardTitle className="font-serif text-lg">
                      {value.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {value.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <Badge variant="emerald" className="mb-3 px-3 py-1">
              Administration
            </Badge>
            <h2 className="mb-4 font-serif text-3xl font-bold md:text-4xl text-foreground">
              College Leadership
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {leadership.map((leader, index) => (
              <motion.div
                key={leader.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="card-elevated text-center h-full flex flex-col justify-between">
                  <CardHeader>
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary shadow-xs">
                      <Users className="h-10 w-10" />
                    </div>
                    <CardTitle className="font-serif text-xl">
                      {leader.name}
                    </CardTitle>
                    <CardDescription className="font-semibold text-secondary">
                      {leader.role}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {leader.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
