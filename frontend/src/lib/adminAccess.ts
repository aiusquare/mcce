import {
  BarChart3,
  BookOpen,
  CreditCard,
  FileText,
  GraduationCap,
  Home,
  type LucideIcon,
  Newspaper,
  Settings,
  Shield,
  Users,
} from "lucide-react";

export const ADMIN_SESSION_STORAGE_KEY = "mccas_admin_session";
export const LEGACY_ADMIN_SESSION_STORAGE_KEY = "MCCAS_admin_session";

export type AdminModule =
  | "overview"
  | "registry"
  | "exam"
  | "finance"
  | "lecturer"
  | "pro"
  | "system";

export type AdminPermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "manage"
  | "assign_roles";

export type AdminResource = {
  slug: string;
  name: string;
  path: string;
  module: AdminModule;
  description: string;
  icon: LucideIcon;
};

export type AdminAccessGrant = {
  permission?: string;
  name?: string;
  action?: string;
  resource_slug?: string | null;
  resource?: string | null;
  slug?: string | null;
  path?: string | null;
  module?: string | null;
};

export type AdminRoleRef = string | { name?: string; slug?: string };

export type AdminSession = {
  id?: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  token?: string;
  role?: string;
  role_slug?: string;
  is_super_admin?: boolean;
  isSuperAdmin?: boolean;
  must_change_password?: boolean;
  mustChangePassword?: boolean;
  roles: AdminRoleRef[];
  permissions: AdminAccessGrant[];
};

export type AdminMenuItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  resourceSlug: string;
};

export type AdminMenuGroup = {
  label: string;
  module: AdminModule;
  items: AdminMenuItem[];
};

export const ADMIN_RESOURCES: AdminResource[] = [
  {
    slug: "dashboard",
    name: "Dashboard",
    path: "/admin/dashboard",
    module: "overview",
    description: "Admin dashboard and operational summary",
    icon: Home,
  },
  {
    slug: "students",
    name: "Students",
    path: "/admin/students",
    module: "registry",
    description: "Student records and registry data",
    icon: Users,
  },
  {
    slug: "applications",
    name: "Applications",
    path: "/admin/applications",
    module: "registry",
    description: "Admission application review",
    icon: FileText,
  },
  {
    slug: "programmes",
    name: "Programmes",
    path: "/admin/programmes",
    module: "registry",
    description: "Departments and academic programmes",
    icon: GraduationCap,
  },
  {
    slug: "courses",
    name: "Courses",
    path: "/admin/courses",
    module: "registry",
    description: "Course catalogue and offerings",
    icon: GraduationCap,
  },
  {
    slug: "course-registration",
    name: "Course Registration",
    path: "/admin/course-registration",
    module: "registry",
    description: "Manage semester registrations, approvals and course class lists",
    icon: FileText,
  },
  {
    slug: "exams",
    name: "Exam Management",
    path: "/admin/exams",
    module: "exam",
    description: "Entrance exams and overall exam logistics",
    icon: FileText,
  },
  {
    slug: "results",
    name: "Result Management",
    path: "/admin/results",
    module: "exam",
    description:
      "Manage semester results, academic performance and publication",
    icon: BookOpen,
  },
  {
    slug: "graduation",
    name: "Graduation Management",
    path: "/admin/graduation",
    module: "exam",
    description:
      "CCMAS/BMAS graduation clearance, senate lists and deficiency audit",
    icon: GraduationCap,
  },
  {
    slug: "fees",
    name: "Fee Management",
    path: "/admin/fees",
    module: "finance",
    description: "Fee setup and invoice rules",
    icon: CreditCard,
  },
  {
    slug: "payments",
    name: "Payments",
    path: "/admin/payments",
    module: "finance",
    description: "Payment monitoring and reconciliation",
    icon: BarChart3,
  },
  {
    slug: "lecturers",
    name: "Lecturer Access",
    path: "/admin/lecturers",
    module: "lecturer",
    description: "Lecturer workspace and course access",
    icon: BookOpen,
  },
  {
    slug: "pro-news",
    name: "News",
    path: "/admin/pro/news",
    module: "pro",
    description: "Public news publishing",
    icon: Newspaper,
  },
  {
    slug: "pro-events",
    name: "Events",
    path: "/admin/pro/events",
    module: "pro",
    description: "Public event publishing",
    icon: FileText,
  },
  {
    slug: "pro-messages",
    name: "Messages",
    path: "/admin/pro/messages",
    module: "pro",
    description: "Contact messages and enquiries",
    icon: FileText,
  },
  {
    slug: "pro-contacts",
    name: "Contact Channels",
    path: "/admin/pro/contacts",
    module: "pro",
    description: "Public contact channels",
    icon: Settings,
  },
  {
    slug: "admin-users",
    name: "User Management",
    path: "/admin/users",
    module: "system",
    description: "Create administrators and assign roles",
    icon: Users,
  },
  {
    slug: "admin-roles",
    name: "Roles",
    path: "/admin/roles",
    module: "system",
    description: "Role definitions",
    icon: Shield,
  },
  {
    slug: "admin-permissions",
    name: "Page Access",
    path: "/admin/permissions",
    module: "system",
    description: "Allow page access by role",
    icon: Settings,
  },
  {
    slug: "account-settings",
    name: "Settings",
    path: "/admin/settings",
    module: "system",
    description: "Account settings and password",
    icon: Settings,
  },
];

export const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  {
    label: "Overview",
    module: "overview",
    items: resourcesForModule("overview"),
  },
  {
    label: "Registry",
    module: "registry",
    items: resourcesForModule("registry"),
  },
  {
    label: "Exam Office",
    module: "exam",
    items: resourcesForModule("exam"),
  },
  {
    label: "Finance",
    module: "finance",
    items: resourcesForModule("finance"),
  },
  {
    label: "Lecturer",
    module: "lecturer",
    items: resourcesForModule("lecturer"),
  },
  {
    label: "PRO",
    module: "pro",
    items: resourcesForModule("pro"),
  },
  {
    label: "System",
    module: "system",
    items: resourcesForModule("system"),
  },
];

function resourcesForModule(module: AdminModule): AdminMenuItem[] {
  return ADMIN_RESOURCES.filter((resource) => resource.module === module).map(
    (resource) => ({
      name: resource.name,
      href: resource.path,
      icon: resource.icon,
      resourceSlug: resource.slug,
    }),
  );
}

function normalizeAccessValue(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function roleToSlug(role: AdminRoleRef) {
  const raw = typeof role === "string" ? role : role.slug || role.name || "";
  return normalizeAccessValue(raw);
}

function truthyFlag(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function looksLikeSuperAdmin(value: unknown) {
  const slug = normalizeAccessValue(value);
  return [
    "admin",
    "administrator",
    "super_admin",
    "superadmin",
    "super_administrator",
    "superadministrator",
  ].includes(slug);
}

function collectRolesFromSession(session: AdminSession) {
  const roles: unknown[] = [
    ...(session.roles || []),
    session.role,
    session.role_slug,
  ];

  return roles.filter(Boolean);
}

function impliedPermissionsForRoles(roles: AdminRoleRef[]): AdminAccessGrant[] {
  const roleSlugs = roles.map(roleToSlug);
  const resourcePerms = new Map<string, Set<string>>();

  const grant = (resourceSlugs: string[], permissions: string[] = ["view"]) => {
    resourceSlugs.forEach((slug) => {
      if (!resourcePerms.has(slug)) {
        resourcePerms.set(slug, new Set());
      }
      const set = resourcePerms.get(slug)!;
      permissions.forEach((p) => set.add(p));
    });
  };

  roleSlugs.forEach((role) => {
    if (
      ["admin", "administrator", "super_admin", "superadmin"].includes(role)
    ) {
      grant(ADMIN_RESOURCES.map((resource) => resource.slug), [
        "view",
        "create",
        "edit",
        "delete",
        "approve",
        "manage",
      ]);
      return;
    }

    if (role.includes("registry") || role.includes("admission")) {
      grant(
        ["students", "applications", "programmes", "courses"],
        ["view", "create", "edit", "approve", "manage"],
      );
      grant(["dashboard"], ["view"]);
    }

    if (
      role.includes("finance") ||
      role.includes("bursar") ||
      role.includes("fee") ||
      role.includes("payment")
    ) {
      grant(["fees", "payments"], ["view", "create", "edit", "manage"]);
      grant(["dashboard"], ["view"]);
    }

    if (role.includes("exam")) {
      // Exams Officer: Full operational management on exam suite & course registrations
      grant(
        ["exams", "results", "graduation", "course-registration"],
        ["view", "create", "edit", "approve", "manage"],
      );
      // Read-only inspection on student registry and course catalog
      grant(["dashboard", "students", "courses"], ["view"]);
    }

    if (role.includes("lecturer")) {
      grant(["lecturers"], ["view", "create", "edit"]);
      grant(["dashboard", "courses"], ["view"]);
    }

    if (role.includes("pro") || role.includes("public_relation")) {
      grant(
        ["pro-news", "pro-events", "pro-messages", "pro-contacts"],
        ["view", "create", "edit", "delete", "manage"],
      );
      grant(["dashboard"], ["view"]);
    }

    if (role.includes("manager")) {
      grant(
        [
          "students",
          "applications",
          "programmes",
          "courses",
          "fees",
          "payments",
          "exams",
        ],
        ["view", "create", "edit", "manage"],
      );
      grant(["dashboard"], ["view"]);
    }
  });

  const output: AdminAccessGrant[] = [];
  resourcePerms.forEach((permSet, slug) => {
    const resource = ADMIN_RESOURCES.find((item) => item.slug === slug);
    permSet.forEach((perm) => {
      output.push({
        permission: perm,
        resource_slug: slug,
        path: resource?.path,
        module: resource?.module,
      });
    });
  });

  return output;
}

export function isSuperAdmin(session?: AdminSession | null) {
  if (!session) return false;
  if (truthyFlag(session.is_super_admin) || truthyFlag(session.isSuperAdmin)) {
    return true;
  }

  if (
    session.email &&
    session.email.toLowerCase() === "superadmin@mcce.edu.ng"
  ) {
    return true;
  }

  return collectRolesFromSession(session).some((role) => {
    if (typeof role === "object" && role) {
      const roleRef = role as {
        name?: unknown;
        slug?: unknown;
        role?: unknown;
      };
      return (
        looksLikeSuperAdmin(roleRef.slug) ||
        looksLikeSuperAdmin(roleRef.name) ||
        looksLikeSuperAdmin(roleRef.role)
      );
    }

    return looksLikeSuperAdmin(role);
  });
}

function grantPermissionName(grant: AdminAccessGrant) {
  return (grant.permission || grant.name || grant.action || "")
    .trim()
    .toLowerCase();
}

function grantResourceSlug(grant: AdminAccessGrant) {
  return (
    grant.resource_slug ||
    grant.resource ||
    grant.slug ||
    (grant.path ? resourceForPath(grant.path)?.slug : "") ||
    ""
  )
    .trim()
    .toLowerCase();
}

function normalizeSlug(slug: string) {
  if (!slug) return "";
  return slug
    .replace(/^admin[-_]?/, "")
    .trim()
    .toLowerCase();
}

export function resourceForPath(pathname: string) {
  return ADMIN_RESOURCES.find(
    (resource) =>
      pathname === resource.path || pathname.startsWith(`${resource.path}/`),
  );
}

export function canAccessResource(
  session: AdminSession | null | undefined,
  resourceSlug: string,
  action: AdminPermissionAction = "view",
) {
  if (!session) return false;
  if (resourceSlug === "account-settings") return true;
  if (isSuperAdmin(session)) return true;

  // Direct check for exam officers if role is assigned
  const roles = (session.roles || []).map(roleToSlug);
  if (session.role) roles.push(normalizeAccessValue(session.role));
  if (session.role_slug) roles.push(normalizeAccessValue(session.role_slug));
  const isExamOfficer = roles.some((r) => r.includes("exam"));

  if (isExamOfficer) {
    const examCoreResources = [
      "exams",
      "results",
      "graduation",
      "course-registration",
    ];
    const examReadOnlyResources = ["dashboard", "students", "courses"];

    if (examCoreResources.includes(resourceSlug)) {
      return true; // Full operational permissions on exam office suite & course registrations
    }
    if (examReadOnlyResources.includes(resourceSlug)) {
      return action === "view"; // Read-only on registry lookup & operational dashboard
    }
    // Explicitly restrict from Finance, System, Admissions, and PRO
    if (
      [
        "fees",
        "payments",
        "admin-users",
        "admin-roles",
        "admin-permissions",
        "applications",
        "programmes",
        "lecturers",
        "pro-news",
        "pro-events",
        "pro-messages",
        "pro-contacts",
      ].includes(resourceSlug)
    ) {
      return false;
    }
  }

  return (session.permissions || []).some((grant) => {
    const permission = grantPermissionName(grant);
    const grantResource = grantResourceSlug(grant);
    const resourceMatches =
      !grantResource ||
      grantResource === resourceSlug ||
      normalizeSlug(grantResource) === normalizeSlug(resourceSlug);
    const permissionMatches =
      permission === action || permission === "manage" || permission === "*";

    return resourceMatches && permissionMatches;
  });
}

export function canAccessPath(
  session: AdminSession | null | undefined,
  pathname: string,
) {
  const resource = resourceForPath(pathname);
  if (!resource) return Boolean(session && isSuperAdmin(session));
  return canAccessResource(session, resource.slug);
}

export function visibleMenuGroups(session: AdminSession | null | undefined) {
  if (isSuperAdmin(session)) {
    return ADMIN_MENU_GROUPS;
  }

  return ADMIN_MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      canAccessResource(session, item.resourceSlug),
    ),
  })).filter((group) => group.items.length > 0);
}

export function firstAccessibleAdminPath(session: AdminSession) {
  if (isSuperAdmin(session)) {
    return "/admin/dashboard";
  }

  const firstResource = ADMIN_RESOURCES.find((resource) =>
    canAccessResource(session, resource.slug),
  );
  return firstResource?.path || "/admin/login";
}

export function readAdminSession(): AdminSession | null {
  try {
    const raw =
      localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_ADMIN_SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch (error) {
    return null;
  }
}

export function saveAdminSession(session: AdminSession) {
  const json = JSON.stringify(session);
  localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, json);
  localStorage.setItem(LEGACY_ADMIN_SESSION_STORAGE_KEY, json);
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  localStorage.removeItem(LEGACY_ADMIN_SESSION_STORAGE_KEY);
}

export function createFallbackSuperAdmin(email: string): AdminSession {
  return {
    email,
    full_name: "Super Admin",
    roles: ["super_admin"],
    permissions: ADMIN_RESOURCES.map((resource) => ({
      permission: "manage",
      resource_slug: resource.slug,
      path: resource.path,
      module: resource.module,
    })),
  };
}

export function normalizeAdminSession(payload: unknown, fallbackEmail: string) {
  const source =
    typeof payload === "object" && payload && "data" in payload
      ? (payload as { data?: unknown }).data
      : payload;
  const data = (source || {}) as Record<string, unknown>;
  const user = (data.user || data.admin || data.profile || data || {}) as
    | Record<string, unknown>
    | AdminSession;
  const roles = Array.isArray(user.roles)
    ? (user.roles as AdminRoleRef[])
    : Array.isArray(data.roles)
      ? (data.roles as AdminRoleRef[])
      : [];
  const permissions = Array.isArray(user.permissions)
    ? (user.permissions as AdminAccessGrant[])
    : Array.isArray(data.permissions)
      ? (data.permissions as AdminAccessGrant[])
      : [];
  const email = String(user.email || fallbackEmail).toLowerCase();
  const isSuperAdminFlag =
    email === "superadmin@mcce.edu.ng" ||
    truthyFlag(user.is_super_admin) ||
    truthyFlag(user.isSuperAdmin) ||
    truthyFlag(data.is_super_admin) ||
    truthyFlag(data.isSuperAdmin) ||
    roles.some((role) =>
      typeof role === "object"
        ? looksLikeSuperAdmin(role.slug) || looksLikeSuperAdmin(role.name)
        : looksLikeSuperAdmin(role),
    ) ||
    looksLikeSuperAdmin(user.role) ||
    looksLikeSuperAdmin(user.role_slug);

  const userRolesList = roles.map(roleToSlug);
  if (user.role) userRolesList.push(normalizeAccessValue(user.role));
  if (user.role_slug) userRolesList.push(normalizeAccessValue(user.role_slug));
  const hasExamOfficerRole = userRolesList.some((r) => r.includes("exam"));

  const resolvedPermissions =
    permissions.length > 0
      ? hasExamOfficerRole
        ? [...permissions, ...impliedPermissionsForRoles(roles)]
        : permissions
      : impliedPermissionsForRoles(roles);

  return {
    id: String(user.id || ""),
    email: String(user.email || fallbackEmail),
    full_name: String(user.full_name || user.name || "Admin User"),
    first_name: typeof user.first_name === "string" ? user.first_name : "",
    last_name: typeof user.last_name === "string" ? user.last_name : "",
    token: String(data.token || data.access_token || user.token || ""),
    role: typeof user.role === "string" ? user.role : "",
    role_slug: typeof user.role_slug === "string" ? user.role_slug : "",
    is_super_admin: isSuperAdminFlag,
    must_change_password:
      truthyFlag(user.must_change_password) ||
      truthyFlag(user.mustChangePassword) ||
      truthyFlag(data.must_change_password) ||
      truthyFlag(data.mustChangePassword),
    roles,
    permissions: resolvedPermissions,
  } satisfies AdminSession;
}
