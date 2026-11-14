type SidebarFeatureConfig = Record<string, boolean>;

export const adminSidebarFeatures: SidebarFeatureConfig = {
  dashboard: true,
  students: true,
  applications: true,
  programmes: true,
  courses: true,
  "course-registration": true,
  exams: true,
  results: true,
  graduation: true,
  fees: true,
  payments: true,
  lecturers: true,
  "pro-news": true,
  "pro-events": true,
  "pro-messages": true,
  "pro-contacts": true,
  "admin-users": true,
  "admin-roles": true,
  "admin-permissions": true,
};

export const studentSidebarFeatures: SidebarFeatureConfig = {
  dashboard: true,
  apply: true,
  admissionStatus: true,
  courseRegistration: true,
  results: true,
  payments: true,
  clearance: true,
  examCard: true,
  profile: true,
};

export function isAdminSidebarEnabled(resourceSlug: string) {
  return adminSidebarFeatures[resourceSlug] !== false;
}

export function isStudentSidebarEnabled(featureKey: string) {
  return studentSidebarFeatures[featureKey] !== false;
}
