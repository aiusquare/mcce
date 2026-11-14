import { Link } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { schoolConfig } from "@/config/schoolConfig";

const quickLinks = [
  { name: "About the College", href: "/about" },
  { name: "Admissions & Entry", href: "/admissions" },
  { name: "Academic Catalog", href: "/admissions#programs" },
  { name: "News & Campus Life", href: "/news" },
  { name: "Contact & Directions", href: "/contact" },
];

const portalLinks = [
  { name: "Student Portal Login", href: "/student/login" },
  { name: "Apply for Admission", href: "/student/register" },
  { name: "Check Admission Status", href: "/student/login" },
  { name: "Online Registration", href: "/student/login" },
  { name: "Administrative Console", href: "/admin/login" },
  { name: "Hostel Accommodations", href: schoolConfig.externalLinks.hostelPortal, external: true },
  { name: "E-Library Resource Portal", href: schoolConfig.externalLinks.elibraryPortal, external: true },
];

const socialLinks = [
  { icon: Facebook, href: schoolConfig.socials.facebook, label: "Facebook" },
  { icon: Twitter, href: schoolConfig.socials.twitter, label: "Twitter" },
  { icon: Instagram, href: schoolConfig.socials.instagram, label: "Instagram" },
  { icon: Linkedin, href: schoolConfig.socials.linkedin, label: "LinkedIn" },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-primary/20 bg-primary text-primary-foreground">
      <div className="container py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand Column */}
          <div className="space-y-4">
            <Logo inverse={true} />
            <p className="text-sm leading-relaxed text-primary-foreground/80">
              {schoolConfig.name.tagline}
            </p>
            <p className="text-xs text-primary-foreground/70 italic">
              "{schoolConfig.name.motto}"
            </p>
            <div className="flex gap-2.5 pt-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-foreground/10 text-primary-foreground transition-colors hover:bg-gold hover:text-foreground shadow-xs"
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 font-serif text-lg font-semibold tracking-wide text-gold">
              Quick Links
            </h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-primary-foreground/80 transition-colors hover:text-gold"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Academic & Student Portals */}
          <div>
            <h4 className="mb-4 font-serif text-lg font-semibold tracking-wide text-gold">
              Portals & Services
            </h4>
            <ul className="space-y-2.5">
              {portalLinks.map((link) => (
                <li key={link.name}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary-foreground/80 transition-colors hover:text-gold"
                    >
                      <span>{link.name}</span>
                      <ArrowUpRight className="h-3 w-3 opacity-70" />
                    </a>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-sm text-primary-foreground/80 transition-colors hover:text-gold"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Campus Contact Information */}
          <div>
            <h4 className="mb-4 font-serif text-lg font-semibold tracking-wide text-gold">
              Campus & Registry
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-primary-foreground/80">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>
                  {schoolConfig.contact.fullAddress}
                </span>
              </li>
              <li className="flex items-center gap-3 text-sm text-primary-foreground/80">
                <Phone className="h-4 w-4 shrink-0 text-gold" />
                <a
                  href={`tel:${schoolConfig.contact.primaryPhone.replace(/\s+/g, "")}`}
                  className="hover:text-gold transition-colors"
                >
                  {schoolConfig.contact.phones.join(" / ")}
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm text-primary-foreground/80">
                <Mail className="h-4 w-4 shrink-0 text-gold" />
                <a
                  href={`mailto:${schoolConfig.contact.emails.general}`}
                  className="hover:text-gold transition-colors"
                >
                  {schoolConfig.contact.emails.general}
                </a>
              </li>
              <li className="flex items-center gap-3 text-xs text-primary-foreground/70 pt-1">
                <Clock className="h-3.5 w-3.5 shrink-0 text-gold" />
                <span>Office: {schoolConfig.contact.officeHours.weekdays}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/15 pt-8 md:flex-row">
          <p className="text-xs text-primary-foreground/75">
            © {currentYear} {schoolConfig.name.full}. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-primary-foreground/75">
            <Link to="/contact" className="hover:text-gold transition-colors">
              Admissions Support
            </Link>
            <Link to="/about" className="hover:text-gold transition-colors">
              Institutional Values
            </Link>
            <span className="text-primary-foreground/40">•</span>
            <span className="text-primary-foreground/75">{schoolConfig.academics.currentSession} Academic Calendar</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
