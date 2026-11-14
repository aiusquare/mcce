import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import heroCampus from "@/assets/hero-campus.jpg";
import {
  Clock,
  Calendar,
  ChevronRight,
  Search,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import {
  getPublicContactChannels,
  getPublicEvents,
  getPublicNews,
} from "@/lib/api";
import { degreeProgrammeGroups } from "@/lib/academicProgrammes";
import { schoolConfig } from "@/config/schoolConfig";

interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  featured: boolean;
}

interface EventItem {
  title: string;
  date: string;
  time: string;
}

const defaultNewsItems: NewsItem[] = [
  {
    id: "1",
    title: `Degree Admissions ${schoolConfig.academics.currentSession} Session`,
    excerpt: `Applications are open for ${schoolConfig.name.short} degree programmes in arts, education, science, and computing.`,
    date: "February 6, 2026",
    category: "Admissions",
    featured: true,
  },
  {
    id: "2",
    title: `${schoolConfig.name.acronym} Expands Academic & Computing Facilities`,
    excerpt: `New learning resources and modern laboratories strengthen academic training across all ${schoolConfig.name.acronym} degree programmes.`,
    date: "December 10, 2024",
    category: "Campus",
    featured: false,
  },
  {
    id: "3",
    title: `Community Development Week in ${schoolConfig.contact.city}`,
    excerpt:
      "Students and staff partnered with local organizations for literacy, mentoring, and community service activities.",
    date: "December 5, 2024",
    category: "Community",
    featured: false,
  },
  {
    id: "4",
    title: "First Semester Examination Timetable Released",
    excerpt:
      "The examination timetable for the first semester has been released. Students are advised to check the portal for their specific schedules.",
    date: "November 28, 2024",
    category: "Academic",
    featured: false,
  },
];

const defaultUpcomingEvents: EventItem[] = [
  {
    title: "Inter-Departmental Quiz Competition",
    date: "January 15, 2025",
    time: "10:00 AM",
  },
  {
    title: "Career Guidance & Professional Development Workshop",
    date: "January 20, 2025",
    time: "2:00 PM",
  },
  {
    title: "Annual Cultural & Community Day",
    date: "February 5, 2025",
    time: "9:00 AM",
  },
];

const defaultAdmissionNotice = {
  title: `ADMISSION INTO DEGREE PROGRAMMES - ${schoolConfig.academics.currentSession} SESSION`,
  college: schoolConfig.name.full,
  intro: `Applications are open. This is your opportunity to begin degree studies with ${schoolConfig.name.short}, dedicated to excellence, discipline, and community development.`,
  emphasis: `Choose ${schoolConfig.name.full} as your first choice institution.`,
  programs: degreeProgrammeGroups.flatMap((group) => group.courses),
  applicationNote:
    "Applicants should select one of the listed degree programmes when completing the online application form.",
  reasons: [
    "Accredited degree programmes aligned with academic and professional growth",
    "Conducive, modern learning environment and ICT facilities",
    "Experienced, qualified instructors and professors",
    "Strong moral and professional training tradition",
    "Excellent prospects for further postgraduate studies and career placement",
  ],
  cta: `Choose ${schoolConfig.name.full} (${schoolConfig.name.acronym}), ${schoolConfig.contact.city} as your institution of choice.`,
  contacts: {
    phones: schoolConfig.contact.phones,
    email: schoolConfig.contact.emails.admissions,
    website: schoolConfig.externalLinks.website,
    address: schoolConfig.contact.fullAddress,
  },
};

function toList(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as any[];
    if (
      obj.data &&
      typeof obj.data === "object" &&
      Array.isArray((obj.data as Record<string, unknown>).data)
    ) {
      return (obj.data as Record<string, unknown>).data as any[];
    }
  }
  return [];
}

export default function NewsPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [newsList, setNewsList] = useState<NewsItem[]>(defaultNewsItems);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>(
    defaultUpcomingEvents,
  );
  const [admissionNotice, setAdmissionNotice] = useState(
    defaultAdmissionNotice,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [newsRes, eventsRes, channelsRes] = await Promise.allSettled([
          getPublicNews(),
          getPublicEvents(),
          getPublicContactChannels(),
        ]);

        if (!mounted) return;

        if (newsRes.status === "fulfilled") {
          const raw = toList(newsRes.value);
          if (raw.length > 0) {
            const mapped = raw.map((item: any, index: number) => ({
              id: String(item.id || item.slug || index + 1),
              title: item.title || item.headline || "News Announcement",
              excerpt:
                item.excerpt ||
                item.summary ||
                item.content ||
                "No description available.",
              date: item.published_at || item.created_at || "Recent",
              category: item.category || "General",
              featured: Boolean(item.featured || item.is_featured),
            }));
            setNewsList(mapped);
          }
        }

        if (eventsRes.status === "fulfilled") {
          const raw = toList(eventsRes.value);
          if (raw.length > 0) {
            const mapped = raw.map((item: any) => ({
              title: item.title || item.name || "Campus Event",
              date: item.event_date || item.date || "Upcoming",
              time: item.event_time || item.time || "TBA",
            }));
            setUpcomingEvents(mapped);
          }
        }

        if (channelsRes.status === "fulfilled") {
          const raw = channelsRes.value;
          if (raw && typeof raw === "object") {
            const channelObj = raw as Record<string, any>;
            setAdmissionNotice((prev) => ({
              ...prev,
              contacts: {
                ...prev.contacts,
                phones: Array.isArray(channelObj.phones)
                  ? channelObj.phones
                  : prev.contacts.phones,
                email: channelObj.email || prev.contacts.email,
                website: channelObj.website || prev.contacts.website,
                address: channelObj.address || prev.contacts.address,
              },
            }));
          }
        }
      } catch (err) {
        // use fallback data
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>(["All"]);
    newsList.forEach((item) => set.add(item.category));
    return Array.from(set);
  }, [newsList]);

  const filteredNews = useMemo(() => {
    return newsList.filter((item) => {
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [newsList, activeCategory, searchQuery]);

  const featuredNews =
    filteredNews.find((item) => item.featured) || filteredNews[0];
  const secondaryNews = filteredNews.filter(
    (item) => !featuredNews || item.id !== featuredNews.id,
  );

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
                <Badge variant="gold" className="mb-4">
                  Stay Informed
                </Badge>
                <h1 className="mb-6 font-serif text-4xl font-bold text-primary-foreground md:text-5xl drop-shadow-lg">
                  News & Events
                </h1>
                <p className="text-lg text-primary-foreground/90 leading-relaxed drop-shadow-md">
                  Stay updated with the latest academic announcements, research
                  developments, and campus events at {schoolConfig.name.full} (
                  {schoolConfig.name.acronym}), {schoolConfig.contact.city}.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Floating Upcoming Events */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute -bottom-16 left-0 right-0 z-20 hidden lg:block"
        >
          <div className="container">
            <div className="grid gap-4 md:grid-cols-3">
              {upcomingEvents.slice(0, 3).map((event, i) => (
                <div
                  key={i}
                  className="relative flex items-start gap-4 rounded-2xl bg-background/95 backdrop-blur-md p-6 shadow-xl border border-border/50 text-left hover:-translate-y-1 transition-transform h-full"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold text-foreground mb-1 line-clamp-2">
                      {event.title}
                    </h3>
                    <p className="text-sm text-muted-foreground !text-muted-foreground">
                      {event.date} • {event.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Official Admission Notice Card */}
      <section className="py-8 md:py-12">
        <div className="container">
          <Card className="card-elevated border-2 border-secondary/60 shadow-lg max-w-4xl mx-auto">
            <CardHeader className="bg-secondary/5 rounded-t-xl border-b border-border/50">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="warning">Important Notice</Badge>
                <Badge variant="gold">
                  {schoolConfig.academics.currentSession} Session
                </Badge>
              </div>
              <CardTitle className="font-serif text-2xl md:text-3xl text-foreground">
                {admissionNotice.title}
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                {admissionNotice.college}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <p className="text-muted-foreground text-base leading-relaxed">
                {admissionNotice.intro}
              </p>
              <p className="font-medium text-foreground">
                {admissionNotice.emphasis}
              </p>

              <div>
                <h3 className="mb-2 font-serif text-lg font-semibold text-foreground">
                  Available Degree Programmes
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {admissionNotice.programs.map((program) => (
                    <li key={program} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-secondary shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        {program}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Important Notice:{" "}
                  </span>
                  {admissionNotice.applicationNote}
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-serif text-lg font-semibold text-foreground">
                  Why Choose {schoolConfig.name.acronym}?
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {admissionNotice.reasons.map((reason) => (
                    <li key={reason} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        {reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="font-medium text-foreground">
                {admissionNotice.cta}
              </p>

              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                <div className="space-y-1">
                  <p>Call: {admissionNotice.contacts.phones.join(", ")}</p>
                  <p>Email: {admissionNotice.contacts.email}</p>
                  <p>Web: {admissionNotice.contacts.website}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {admissionNotice.contacts.address}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="portal" asChild>
                  <a
                    href={
                      admissionNotice.contacts.website.startsWith("http")
                        ? admissionNotice.contacts.website
                        : `https://${admissionNotice.contacts.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit Website
                  </a>
                </Button>
                <Button variant="outline-primary" asChild>
                  <a href={`mailto:${admissionNotice.contacts.email}`}>
                    Contact Admissions
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Filter & Search Bar */}
      <section className="border-b bg-background py-6">
        <div className="container">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search news..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={category === activeCategory ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* News Content Grid */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {featuredNews && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <Card className="card-elevated overflow-hidden group cursor-pointer border-0">
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
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="gold">{featuredNews.category}</Badge>
                        {featuredNews.featured && (
                          <Badge variant="success">Featured</Badge>
                        )}
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {featuredNews.date}
                        </span>
                      </div>
                      <CardTitle className="font-serif text-2xl md:text-3xl">
                        {featuredNews.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-4 text-muted-foreground">
                        {featuredNews.excerpt}
                      </p>
                      <Button variant="outline-primary">
                        Read More
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                {secondaryNews.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    viewport={{ once: true }}
                  >
                    <Card className="card-elevated h-full">
                      <CardHeader>
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant="emerald">{item.category}</Badge>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {item.date}
                          </span>
                        </div>
                        <CardTitle className="font-serif text-lg line-clamp-2">
                          {item.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-4 text-sm text-muted-foreground line-clamp-3">
                          {item.excerpt}
                        </p>
                        <Button
                          variant="link"
                          className="h-auto p-0 text-primary"
                        >
                          Read More
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {!loading && filteredNews.length === 0 && (
                <Card className="card-elevated">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    No news items match your current filters.
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              >
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-serif">
                      <Calendar className="h-5 w-5 text-secondary" />
                      Upcoming Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {upcomingEvents.map((event) => (
                        <div
                          key={`${event.title}-${event.date}`}
                          className="border-l-2 border-secondary pl-4"
                        >
                          <h4 className="font-medium">{event.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {event.date} • {event.time}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="font-serif">Quick Links</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      asChild
                    >
                      <a href="/admissions">Admission Guidelines</a>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      asChild
                    >
                      <a href="/student/login">Student Portal</a>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      asChild
                    >
                      <a href="/contact">Contact Admissions</a>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <Card className="hero-gradient">
                  <CardHeader>
                    <CardTitle className="font-serif text-primary-foreground">
                      Stay Updated
                    </CardTitle>
                    <CardDescription className="text-primary-foreground/80">
                      Subscribe to receive news and updates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Input
                        placeholder="Enter your email"
                        className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                      />
                      <Button variant="hero" className="w-full">
                        Subscribe
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
