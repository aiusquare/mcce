import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  getAdminProContactChannels,
  updateAdminProContactChannels,
} from "@/lib/api";
import { schoolConfig } from "@/config/schoolConfig";

interface DepartmentContact {
  id: string;
  name: string;
  email: string;
  phone: string;
}

const defaultDepartments: DepartmentContact[] = [
  {
    id: "admissions",
    name: "Admissions Office",
    email: schoolConfig.contact.emails.admissions,
    phone: schoolConfig.contact.primaryPhone,
  },
  {
    id: "registry",
    name: "Registry",
    email: schoolConfig.contact.emails.registry,
    phone: schoolConfig.contact.primaryPhone,
  },
  {
    id: "bursary",
    name: "Bursary (Finance)",
    email: schoolConfig.contact.emails.bursary,
    phone: schoolConfig.contact.primaryPhone,
  },
];

const defaultState = {
  address: schoolConfig.contact.fullAddress,
  phones: schoolConfig.contact.phones.join(", "),
  emails: `${schoolConfig.contact.emails.general}, ${schoolConfig.contact.emails.admissions}`,
  officeHours: `${schoolConfig.contact.officeHours.weekdays}\n${schoolConfig.contact.officeHours.saturdays}`,
  admissionsPhones: schoolConfig.contact.phones.join(", "),
  admissionsEmail: schoolConfig.contact.emails.admissions,
  admissionsWebsite: schoolConfig.externalLinks.website,
  admissionsAddress: schoolConfig.contact.fullAddress,
};

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(", ");
}

function joinLines(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join("\n");
}

function extractPayload(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && "data" in value) {
    return ((value as Record<string, unknown>).data || {}) as Record<string, any>;
  }
  return (value || {}) as Record<string, any>;
}

export default function ProContactsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultState);
  const [departments, setDepartments] =
    useState<DepartmentContact[]>(defaultDepartments);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const response = await getAdminProContactChannels();
      const payload = extractPayload(response);

      const contactInfo =
        payload.contact_info ||
        payload.contactInfo ||
        payload.general ||
        payload.contact ||
        {};
      const admissions =
        payload.admissions ||
        payload.news_contacts ||
        payload.admissionNoticeContacts ||
        {};
      const deptList = Array.isArray(payload.departments)
        ? payload.departments
        : Array.isArray(payload.department_contacts)
          ? payload.department_contacts
          : [];

      const cards = Array.isArray(payload.contact_cards) ? payload.contact_cards : [];
      const visitCard = cards.find(
        (card: any) => String(card?.title || "").toLowerCase() === "visit us",
      );
      const officeCard = cards.find(
        (card: any) => String(card?.title || "").toLowerCase() === "office hours",
      );

      setForm({
        address:
          String(contactInfo.address || "") ||
          (Array.isArray(visitCard?.details) ? String(visitCard.details[0] || "") : "") ||
          defaultState.address,
        phones: joinList(contactInfo.phones) || defaultState.phones,
        emails: joinList(contactInfo.emails) || defaultState.emails,
        officeHours:
          joinLines(contactInfo.office_hours) ||
          (Array.isArray(officeCard?.details)
            ? officeCard.details.join("\n")
            : "") ||
          defaultState.officeHours,
        admissionsPhones: joinList(admissions.phones) || defaultState.admissionsPhones,
        admissionsEmail: String(admissions.email || "") || defaultState.admissionsEmail,
        admissionsWebsite:
          String(admissions.website || "") || defaultState.admissionsWebsite,
        admissionsAddress:
          String(admissions.address || "") || defaultState.admissionsAddress,
      });

      if (deptList.length > 0) {
        setDepartments(
          deptList.map((item: any, index: number) => ({
            id: String(item?.id || `dept-${index + 1}`),
            name: String(item?.name || ""),
            email: String(item?.email || ""),
            phone: String(item?.phone || ""),
          })),
        );
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load contact channels",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDepartment = (
    id: string,
    key: keyof DepartmentContact,
    value: string,
  ) => {
    setDepartments((prev) =>
      prev.map((dept) => (dept.id === id ? { ...dept, [key]: value } : dept)),
    );
  };

  const addDepartment = () => {
    const id = `dept-${Date.now()}-${Math.round(Math.random() * 9999)}`;
    setDepartments((prev) => [...prev, { id, name: "", email: "", phone: "" }]);
  };

  const removeDepartment = (id: string) => {
    setDepartments((prev) => prev.filter((dept) => dept.id !== id));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const payload = {
        contact_info: {
          address: form.address.trim(),
          phones: splitList(form.phones),
          emails: splitList(form.emails),
          office_hours: splitLines(form.officeHours),
        },
        admissions: {
          phones: splitList(form.admissionsPhones),
          email: form.admissionsEmail.trim(),
          website: form.admissionsWebsite.trim(),
          address: form.admissionsAddress.trim(),
        },
        departments: departments
          .map((dept) => ({
            id: dept.id,
            name: dept.name.trim(),
            email: dept.email.trim(),
            phone: dept.phone.trim(),
          }))
          .filter((dept) => dept.name),
      };

      await updateAdminProContactChannels(payload);
      toast({ title: "Success", description: "Contact channels updated" });
      await loadChannels();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update contact channels",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-4">Loading contact channels...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">PRO - Contact Channels</h1>
            <p className="text-sm text-muted-foreground">
              Update contact details used by Contact and News pages.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>General Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-address">Address</Label>
              <Textarea
                id="contact-address"
                rows={2}
                value={form.address}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, address: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-phones">Phones (comma-separated)</Label>
                <Input
                  id="contact-phones"
                  value={form.phones}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phones: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-emails">Emails (comma-separated)</Label>
                <Input
                  id="contact-emails"
                  value={form.emails}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, emails: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-office-hours">Office Hours (one per line)</Label>
              <Textarea
                id="contact-office-hours"
                rows={3}
                value={form.officeHours}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, officeHours: e.target.value }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admissions Notice Channels (News Page)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="admissions-phones">Phones (comma-separated)</Label>
              <Input
                id="admissions-phones"
                value={form.admissionsPhones}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, admissionsPhones: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admissions-email">Email</Label>
                <Input
                  id="admissions-email"
                  value={form.admissionsEmail}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, admissionsEmail: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admissions-website">Website</Label>
                <Input
                  id="admissions-website"
                  value={form.admissionsWebsite}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, admissionsWebsite: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admissions-address">Address</Label>
              <Textarea
                id="admissions-address"
                rows={2}
                value={form.admissionsAddress}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, admissionsAddress: e.target.value }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {departments.map((dept) => (
              <div key={dept.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
                <Input
                  value={dept.name}
                  onChange={(e) => updateDepartment(dept.id, "name", e.target.value)}
                  placeholder="Department Name"
                />
                <Input
                  value={dept.email}
                  onChange={(e) => updateDepartment(dept.id, "email", e.target.value)}
                  placeholder="Email"
                />
                <Input
                  value={dept.phone}
                  onChange={(e) => updateDepartment(dept.id, "phone", e.target.value)}
                  placeholder="Phone"
                />
                <Button variant="destructive" onClick={() => removeDepartment(dept.id)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addDepartment}>
              Add Department Contact
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
