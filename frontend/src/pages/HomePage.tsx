import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  GraduationCap,
  Users,
  BookOpen,
  Award,
  Calendar,
  Clock,
  ChevronRight,
  Building2,
  Library,
  Landmark,
  ShieldCheck,
  Microscope,
  Monitor,
  Home,
  Quote,
} from "lucide-react";
import { schoolConfig } from "@/config/schoolConfig";
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
import heroCampus from "@/assets/hero-campus.jpg";
import { degreeProgrammeGroups } from "@/lib/academicProgrammes";

const stats = [
  { label: "Students Enrolled", value: "2,000+", icon: Users },
  { label: "Degree Programmes", value: "6", icon: BookOpen },
  { label: "Qualified Staff", value: "200+", icon: GraduationCap },
  { label: "Years of Service", value: "4+", icon: Award },
];

const programs = [
  {
    title: "Arts and Islamic Studies",
    description:
      "Degree programmes in Islamic Studies and Hausa language for students pursuing arts, culture, and scholarship.",
    icon: BookOpen,
    color: "bg-info/10 text-info",
  },
  {
    title: "Education Programmes",
    description:
      "Degree pathways in Guidance and Counselling, English Education, and Biology Education.",
    icon: GraduationCap,
    color: "bg-primary/10 text-primary",
  },
  // {
  //   title: "Science and Information Studies",
  //   description:
  //     "Degree programmes in Computer Science and Library and Information Science.",
  //   icon: Library,
  //   color: "bg-primary/10 text-primary",
  // },
];

const newsItems = [
  {
    id: 1,
    title: "Degree Admissions 2026/2027 Session",
    excerpt:
      "Applications are open for MCCE degree programmes in arts, education, science, and information studies.",
    date: "Feb 6, 2026",
    category: "Admissions",
    featured: true,
  },
  {
    id: 2,
    title: "MCCE Expands Academic Facilities",
    excerpt:
      "Upgraded learning spaces strengthen academic training across arts, education, science, and information studies.",
    date: "Dec 10, 2024",
    category: "Campus",
    featured: false,
  },
  {
    id: 3,
    title: "Community Outreach Week in Funtua",
    excerpt:
      "Students and staff supported local clinics with health screening and education.",
    date: "Dec 5, 2025",
    category: "Community",
    featured: false,
  },
];

export default function HomePage() {
  const [showNewsPopup, setShowNewsPopup] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("MCCAS_latest_news_dismissed");
    if (!dismissed) {
      setShowNewsPopup(true);
    }
  }, []);

  const handleDismissPopup = () => {
    localStorage.setItem("MCCAS_latest_news_dismissed", "true");
    setShowNewsPopup(false);
  };

  return (
    <PublicLayout>
      {showNewsPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4">
          <Card className="card-elevated w-full max-w-xl border-2 border-secondary/60 shadow-gold">
            <CardHeader className="bg-secondary/10">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="warning">Latest News</Badge>
                <Badge variant="gold">{newsItems[0].category}</Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {newsItems[0].date}
                </span>
              </div>
              <CardTitle className="font-serif text-xl md:text-2xl">
                {newsItems[0].title}
              </CardTitle>
              <CardDescription className="text-base">
                {newsItems[0].excerpt}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={handleDismissPopup}>
                Dismiss
              </Button>
              <Button variant="portal" asChild>
                <Link to="/news" onClick={handleDismissPopup}>
                  See More
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Hero Wrapper */}
      <div className="relative mb-24 md:mb-32">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden">
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

          {/* Content */}
          <div className="container relative z-10 py-20 pb-36 md:py-28 md:pb-40 flex flex-col items-center justify-center text-center">
            <div className="max-w-4xl mx-auto flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Badge
                  variant="gold"
                  className="mb-6 px-4 py-1.5 text-xs md:text-sm tracking-wide bg-gold/90 text-primary-foreground border-none shadow-lg"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {schoolConfig.academics.currentSession} Admissions Now Open
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mb-6 font-serif text-5xl font-extrabold leading-[1.15] text-primary-foreground md:text-6xl lg:text-7xl drop-shadow-xl"
              >
                Excellence in <span className="text-gold">Performance</span> &{" "}
                <br className="hidden md:block" />
                Outstanding <span className="text-gold">Behaviours</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-10 max-w-2xl text-lg text-primary-foreground/90 md:text-xl leading-relaxed drop-shadow-md"
              >
                {schoolConfig.name.tagline} Join {schoolConfig.name.acronym}{" "}
                today to begin your journey toward academic distinction and
                professional success.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col w-full sm:w-auto sm:flex-row gap-4 items-center justify-center"
              >
                <Button
                  variant="hero"
                  size="xl"
                  className="w-full sm:w-auto shadow-gold shadow-lg hover:scale-105 transition-transform"
                  asChild
                >
                  <Link to="/student/register">
                    Start Your Application
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="xl"
                  className="w-full sm:w-auto bg-background/10 text-primary-foreground border-primary-foreground/20 hover:bg-background/20 backdrop-blur-md"
                  asChild
                >
                  <Link to="/about">Discover {schoolConfig.name.acronym}</Link>
                </Button>
              </motion.div>

              {/* Quick Access Pills */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-12 flex flex-wrap items-center justify-center gap-3 text-sm text-primary-foreground/80"
              >
                <span className="font-medium">Quick Links:</span>
                <Link
                  to="/student/login"
                  className="rounded-full bg-black/20 hover:bg-black/40 px-4 py-1.5 backdrop-blur-md transition-colors border border-white/10"
                >
                  Student Portal
                </Link>
                <Link
                  to="/admissions"
                  className="rounded-full bg-black/20 hover:bg-black/40 px-4 py-1.5 backdrop-blur-md transition-colors border border-white/10"
                >
                  Entry Requirements
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Floating Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="absolute -bottom-16 left-0 right-0 z-20 hidden md:block"
        >
          <div className="container">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-4 rounded-2xl bg-background/90 backdrop-blur-md p-6 shadow-xl border border-border/50 hover:-translate-y-1 transition-transform"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-serif text-2xl font-extrabold text-foreground leading-none">
                      {stat.value}
                    </p>
                    <p className="text-sm font-medium text-muted-foreground mt-1">
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Mobile Stats Row (since absolute positioning is tricky on mobile hero) */}
      <section className="bg-background py-8 md:hidden relative z-10 border-b">
        <div className="container">
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center text-center p-4 rounded-xl bg-muted/50 border border-border"
              >
                <stat.icon className="h-6 w-6 text-primary mb-2" />
                <p className="font-serif text-xl font-bold text-foreground">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Welcome & Institutional Identity Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-square md:aspect-[4/3] bg-muted flex items-center justify-center border border-border">
                <div className="absolute inset-0 bg-secondary/20 flex flex-col items-center justify-center text-secondary-foreground/50 p-8 text-center">
                  <Quote className="h-12 w-12 mb-4 opacity-50 text-primary" />
                  <p className="font-serif text-xl md:text-2xl italic">
                    "Empowering the next generation of leaders through moral
                    discipline and academic excellence."
                  </p>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 h-32 w-32 rounded-xl bg-gold/10 -z-10 pattern-overlay opacity-50" />
              <div className="absolute -top-6 -left-6 h-32 w-32 rounded-xl bg-primary/10 -z-10 pattern-overlay opacity-50" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Badge variant="gold" className="mb-4">
                Welcome to {schoolConfig.name.acronym}
              </Badge>
              <h2 className="mb-6 font-serif text-3xl font-bold md:text-4xl text-foreground">
                From the Desk of the Provost
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed text-base md:text-lg">
                <p>
                  At <strong>{schoolConfig.name.full}</strong>, we are committed
                  to providing world-class tertiary education anchored on sound
                  moral principles, academic rigor, and practical competence.
                </p>
                <p>
                  Established in{" "}
                  {schoolConfig.institution?.foundedYear || "2015"}, our
                  institution continues to shape the future of our communities
                  by offering fully accredited degree, diploma, and remedial
                  programmes. We invite you to explore a campus designed for
                  innovation, research, and holistic student development.
                </p>
              </div>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button variant="portal" asChild>
                  <Link to="/about">Read Full Message</Link>
                </Button>
                <div className="flex items-center gap-3 border-l-2 border-primary/20 pl-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Award className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">
                      Excellence in Education
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {schoolConfig.name.motto}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Affiliations & Accreditations Banner */}
      <section className="border-y border-border/50 bg-accent/30 py-10">
        <div className="container">
          <p className="mb-8 text-center text-sm font-bold uppercase tracking-widest text-primary/70">
            Accredited & Affiliated With
          </p>
          <div className="flex flex-wrap justify-center gap-10 md:gap-20 opacity-70 grayscale transition-all duration-300 hover:grayscale-0 hover:opacity-100">
            <div className="flex items-center gap-3">
              <Landmark className="h-8 w-8 text-primary" />
              <span className="font-serif font-bold text-xl text-foreground">
                JAMB
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <span className="font-serif font-bold text-xl text-foreground">
                NUC
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Award className="h-8 w-8 text-primary" />
              <span className="font-serif font-bold text-xl text-foreground">
                Federal University Dutsinma (FUDMA)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Programs Section */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mb-12 text-center">
            <Badge variant="emerald" className="mb-4">
              Our Degree Programmes
            </Badge>
            <h2 className="mb-4 font-serif text-3xl font-bold md:text-4xl">
              Degree Pathways for Advanced Studies
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Explore MCCE programmes designed to prepare students for
              scholarship, professional service, and lifelong learning.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            {programs.map((program, index) => (
              <motion.div
                key={program.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="card-elevated h-full">
                  <CardHeader>
                    <div
                      className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl ${program.color}`}
                    >
                      <program.icon className="h-7 w-7" />
                    </div>
                    <CardTitle className="font-serif">
                      {program.title}
                    </CardTitle>
                    <CardDescription>{program.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="link" className="px-0" asChild>
                      <Link to="/admissions">
                        View Programs
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Campus Facilities Section */}
      <section className="py-16 md:py-24 bg-accent/20 border-t border-border/50">
        <div className="container">
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <Badge variant="gold" className="mb-3 px-3 py-1">
              Campus Life
            </Badge>
            <h2 className="mb-4 font-serif text-3xl font-bold md:text-4xl text-foreground">
              Modern Facilities & Infrastructure
            </h2>
            <p className="text-muted-foreground text-base">
              Experience a conducive learning environment equipped with
              state-of-the-art academic and recreational facilities.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "ICT Centre",
                desc: "High-speed internet and modern computing labs for digital literacy and research.",
                icon: Monitor,
              },
              {
                title: "E-Library",
                desc: "Vast collection of digital journals, e-books, and automated cataloging systems.",
                icon: Library,
              },
              {
                title: "Science Labs",
                desc: "Fully equipped laboratories for biology, chemistry, and physics practicals.",
                icon: Microscope,
              },
              {
                title: "Hostel Accommodation",
                desc: "Secure, comfortable, and affordable on-campus housing for students.",
                icon: Home,
              },
            ].map((facility, index) => (
              <motion.div
                key={facility.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="card-elevated h-full border-transparent bg-background hover:border-primary/20 transition-all text-center group shadow-sm hover:shadow-md">
                  <CardContent className="pt-8 pb-8 flex flex-col items-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
                      <facility.icon className="h-8 w-8" />
                    </div>
                    <h3 className="mb-3 font-serif font-bold text-xl text-foreground">
                      {facility.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {facility.desc}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* News & Announcements Section */}
      <section className="bg-accent/30 py-16 md:py-24">
        <div className="container">
          <div className="mb-12 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <Badge variant="gold" className="mb-4">
                Latest Updates
              </Badge>
              <h2 className="font-serif text-3xl font-bold md:text-4xl">
                News & Announcements
              </h2>
            </div>
            <Button variant="outline-primary" asChild>
              <Link to="/news">
                View All News
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <Card className="card-elevated mb-8 border-2 border-secondary/60 shadow-gold">
            <CardHeader className="bg-secondary/10">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="warning">Important</Badge>
                <Badge variant="gold">Admissions 2026/2027</Badge>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Feb 6, 2026
                </span>
              </div>
              <CardTitle className="font-serif text-2xl">
                ADMISSION INTO DEGREE PROGRAMMES - 2026/2027 SESSION
              </CardTitle>
              <CardDescription className="text-base">
                JAMB registration has commenced. Choose MCCE as your first
                choice. Available programmes include{" "}
                {degreeProgrammeGroups
                  .flatMap((group) => group.courses)
                  .join(", ")}
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Select any listed degree programme during application to
                proceed.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="portal" asChild>
                  <Link to="/admissions">Apply via JAMB</Link>
                </Button>
                <Button variant="outline-primary" asChild>
                  <Link to="/news">View Full Notice</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Featured News */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="lg:col-span-2"
            >
              <Card className="card-elevated h-full overflow-hidden group cursor-pointer border-0">
                <div className="relative h-56 md:h-64 overflow-hidden">
                  <img
                    src={heroCampus}
                    alt="Featured News"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
                  <div className="absolute bottom-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:shadow-lg group-hover:shadow-primary/30 group-hover:-translate-y-1">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                </div>
                <CardHeader className="relative -mt-10 bg-background mx-4 rounded-xl shadow-lg border border-border/50 p-6 z-10">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="gold">{newsItems[0].category}</Badge>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {newsItems[0].date}
                    </span>
                  </div>
                  <CardTitle className="font-serif text-2xl">
                    {newsItems[0].title}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {newsItems[0].excerpt}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="portal" asChild>
                    <Link to="/student/login">
                      Apply Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Other News */}
            <div className="flex flex-col gap-6">
              {newsItems.slice(1).map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="card-elevated">
                    <CardHeader>
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant="emerald">{item.category}</Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {item.date}
                        </span>
                      </div>
                      <CardTitle className="font-serif text-lg">
                        {item.title}
                      </CardTitle>
                      <CardDescription className="text-sm line-clamp-2">
                        {item.excerpt}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="hero-gradient py-16 md:py-24">
        <div className="container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="mb-4 font-serif text-3xl font-bold text-primary-foreground md:text-4xl">
              Ready to Begin Your Journey?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-primary-foreground/90">
              Join thousands of students who have chosen MCCE for advanced
              degree education. Applications for the 2025/2026 session will soon
              be open.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button variant="hero" size="xl" asChild>
                <Link to="/student/login">
                  Start Application
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="hero-outline" size="xl" asChild>
                <Link to="/contact">Contact Admissions</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
}
