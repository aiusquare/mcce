import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import heroCampus from "@/assets/hero-campus.jpg";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  MessageSquare,
  Building2,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import {
  getPublicContactChannels,
  submitPublicContactMessage,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { schoolConfig } from "@/config/schoolConfig";

type ContactCard = {
  icon: typeof MapPin;
  title: string;
  details: string[];
};

type Department = {
  name: string;
  email: string;
  phone: string;
};

const defaultContactInfo: ContactCard[] = [
  {
    icon: MapPin,
    title: "Visit Us",
    details: [schoolConfig.contact.fullAddress],
  },
  {
    icon: Phone,
    title: "Call Us",
    details: [schoolConfig.contact.phones.join(", ")],
  },
  {
    icon: Mail,
    title: "Email Us",
    details: [
      schoolConfig.contact.emails.general,
      schoolConfig.contact.emails.admissions,
    ],
  },
  {
    icon: Clock,
    title: "Office Hours",
    details: [
      schoolConfig.contact.officeHours.weekdays,
      schoolConfig.contact.officeHours.saturdays,
    ],
  },
];

const defaultDepartments: Department[] = [
  {
    name: "Admissions & Records Office",
    email: schoolConfig.contact.emails.admissions,
    phone: schoolConfig.contact.primaryPhone,
  },
  {
    name: "Academic Registry",
    email: schoolConfig.contact.emails.registry,
    phone: schoolConfig.contact.primaryPhone,
  },
  {
    name: "Bursary & Student Accounts",
    email: schoolConfig.contact.emails.bursary,
    phone: schoolConfig.contact.primaryPhone,
  },
  {
    name: "Student Affairs & Welfare",
    email: schoolConfig.contact.emails.studentAffairs,
    phone: schoolConfig.contact.primaryPhone,
  },
  {
    name: "ICT Support & Portals Desk",
    email: schoolConfig.contact.emails.ict,
    phone: schoolConfig.contact.primaryPhone,
  },
];

function extractPayload(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, any>;
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data;
  }
  return obj;
}

export default function ContactPage() {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [contactInfo, setContactInfo] =
    useState<ContactCard[]>(defaultContactInfo);
  const [departments, setDepartments] =
    useState<Department[]>(defaultDepartments);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  useEffect(() => {
    const loadChannels = async () => {
      try {
        const response = await getPublicContactChannels();
        const payload = extractPayload(response);

        const phones = Array.isArray(payload.phones)
          ? payload.phones.map(String).filter(Boolean)
          : [];
        const emails = Array.isArray(payload.emails)
          ? payload.emails.map(String).filter(Boolean)
          : [];
        const address =
          typeof payload.address === "string" && payload.address.trim()
            ? [payload.address.trim()]
            : [];
        const hours = Array.isArray(payload.hours)
          ? payload.hours.map(String).filter(Boolean)
          : [];

        setContactInfo((prev) =>
          prev.map((card) => {
            if (card.title === "Visit Us" && address.length) {
              return { ...card, details: address };
            }
            if (card.title === "Call Us" && phones.length) {
              return { ...card, details: phones };
            }
            if (card.title === "Email Us" && emails.length) {
              return { ...card, details: emails };
            }
            if (card.title === "Office Hours" && hours.length) {
              return { ...card, details: hours };
            }
            return card;
          }),
        );

        if (Array.isArray(payload.departments) && payload.departments.length) {
          setDepartments(
            payload.departments.map((item: any) => ({
              name: String(item?.name || ""),
              email: String(item?.email || ""),
              phone: String(item?.phone || ""),
            })),
          );
        }
      } catch (error) {
        // keep fallback values
      }
    };

    void loadChannels();
  }, []);

  const locationText = useMemo(
    () =>
      contactInfo[0]?.details?.[0] ||
      `${schoolConfig.name.acronym} ${schoolConfig.contact.city}`,
    [contactInfo],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.email.trim() || !form.message.trim()) {
      toast({
        title: "Validation",
        description: "First name, email and message are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);
      await submitPublicContactMessage({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        subject: form.subject.trim() || undefined,
        message: form.message.trim(),
      });
      toast({
        title: "Message sent",
        description: "Your message was received successfully.",
      });
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
    } catch (error) {
      toast({
        title: "Failed to send",
        description:
          error instanceof Error
            ? error.message
            : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 text-center overflow-hidden">
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
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="gold" className="mb-4">
                Get In Touch
              </Badge>
              <h1 className="mb-6 font-serif text-4xl font-bold text-primary-foreground md:text-5xl drop-shadow-lg">
                Contact Us
              </h1>
              <p className="text-lg text-primary-foreground/90 leading-relaxed drop-shadow-md">
                Have questions regarding admissions, registration, or academic
                programmes? Reach out through any of our institutional channels.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {contactInfo.map((info, index) => (
              <motion.div
                key={info.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="card-elevated h-full text-center">
                  <CardHeader>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                      <info.icon className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="font-serif">{info.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {info.details.map((detail, i) => (
                      <p key={i} className="text-sm text-muted-foreground">
                        {detail}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-accent/30 py-16 md:py-24">
        <div className="container">
          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                    <MessageSquare className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="font-serif text-2xl">
                    Send Us a Message
                  </CardTitle>
                  <CardDescription>
                    Fill out the form below and our admissions team will get
                    back to you within 24 hours.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          placeholder="Enter your first name"
                          value={form.firstName}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              firstName: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          placeholder="Enter your last name"
                          value={form.lastName}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              lastName: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={form.email}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+234 XXX XXX XXXX"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        placeholder="What is this regarding?"
                        value={form.subject}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            subject: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        placeholder="Type your message here..."
                        rows={5}
                        value={form.message}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            message: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="portal"
                      size="lg"
                      className="w-full"
                      disabled={sending}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {sending ? "Sending..." : "Send Message"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              >
                <Card className="card-elevated overflow-hidden">
                  <div className="h-64 hero-gradient flex items-center justify-center">
                    <div className="text-center text-primary-foreground px-6">
                      <MapPin className="mx-auto mb-2 h-12 w-12 opacity-50" />
                      <p className="font-medium">Find Us</p>
                      <p className="text-sm opacity-80">{locationText}</p>
                    </div>
                  </div>
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
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                      <Building2 className="h-5 w-5 text-secondary" />
                    </div>
                    <CardTitle className="font-serif">
                      Department Contacts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {departments.map((dept) => (
                        <div
                          key={`${dept.name}-${dept.email}`}
                          className="border-b border-border pb-3 last:border-0 last:pb-0"
                        >
                          <h4 className="font-medium">{dept.name}</h4>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <a
                              href={`mailto:${dept.email}`}
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <Mail className="h-3 w-3" />
                              {dept.email}
                            </a>
                            <a
                              href={`tel:${dept.phone}`}
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              <Phone className="h-3 w-3" />
                              {dept.phone}
                            </a>
                          </div>
                        </div>
                      ))}
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
