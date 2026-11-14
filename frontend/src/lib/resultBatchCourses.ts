export function normalizeRegisteredCoursesResponse(
  response: unknown,
): unknown[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    Array.isArray(response.data)
  ) {
    return response.data;
  }

  return [];
}

type ApiRecord = Record<string, unknown>;

export type RegistrationPeriod = {
  periodName: string;
  periodId?: string;
  isContact: boolean;
};

export type CohortCourseLookup = RegistrationPeriod & {
  sessionName: string;
  departmentId?: string;
  programmeId: string;
};

export type RegisteredCourse = {
  id: string;
  code: string;
  title: string;
  level: string;
  type: string;
  registered_count: number;
  carryover_count?: number;
};

type ApiGetter = (path: string) => Promise<unknown>;

function asRecord(value: unknown): ApiRecord | null {
  return value && typeof value === "object" ? (value as ApiRecord) : null;
}

function responseDataArray(response: unknown): ApiRecord[] {
  const record = asRecord(response);
  const data = record?.data;
  return Array.isArray(data)
    ? data.filter((item): item is ApiRecord => asRecord(item) !== null)
    : [];
}

function responseDataRecord(response: unknown): ApiRecord | null {
  return asRecord(asRecord(response)?.data);
}

function studentSearchPath(lookup: CohortCourseLookup, page: number): string {
  const query = new URLSearchParams({
    page: String(page),
    per_page: "100",
    session: lookup.sessionName,
  });
  if (lookup.departmentId) {
    query.set("department_id", lookup.departmentId);
  }
  query.set("programme_id", lookup.programmeId);
  return `/api/admin/students?${query.toString()}`;
}

function registrationsSearchPath(lookup: CohortCourseLookup): string {
  const query = new URLSearchParams({
    session_id: "all",
    semester_id: "all",
    status: "approved",
    programme_id: lookup.programmeId,
  });
  if (lookup.isContact) {
    query.set("level", lookup.periodName);
  }
  return `/api/admin/course-registration/registrations?${query.toString()}`;
}

function totalStudentPages(response: unknown): number {
  const meta = asRecord(asRecord(response)?.meta);
  const pagination = asRecord(meta?.pagination);
  const totalPages = Number(pagination?.total_pages || 1);
  return Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1;
}

export function collectCohortRegistrationIds(
  registrations: ApiRecord[],
  studentIds: Set<string>,
  period: RegistrationPeriod,
): string[] {
  const ids = new Set<string>();

  registrations.forEach((registration) => {
    const registrationId = registration.id;
    const studentId = registration.student_id;
    const status = String(registration.status || "").toLowerCase();
    if (
      typeof registrationId !== "string" ||
      typeof studentId !== "string" ||
      !studentIds.has(studentId) ||
      status !== "approved"
    ) {
      return;
    }

    const matchesPeriod = period.isContact
      ? registration.level === period.periodName
      : Boolean(period.periodId) &&
        registration.semester_id === period.periodId;

    if (matchesPeriod) ids.add(registrationId);
  });

  return Array.from(ids);
}

function aggregateRegisteredCourses(details: ApiRecord[]): RegisteredCourse[] {
  const courseMap = new Map<
    string,
    Omit<RegisteredCourse, "registered_count"> & { studentIds: Set<string> }
  >();

  details.forEach((detail) => {
    const registration = asRecord(detail.registration);
    const studentId = registration?.student_id;
    const items = Array.isArray(detail.items) ? detail.items : [];

    items.forEach((value) => {
      const item = asRecord(value);
      const courseId = item?.course_id;
      if (!item || typeof courseId !== "string" || !courseId) return;

      if (!courseMap.has(courseId)) {
        courseMap.set(courseId, {
          id: courseId,
          code: String(item.code || ""),
          title: String(item.title || ""),
          level: String(item.course_level || ""),
          type: String(item.course_type || "core"),
          studentIds: new Set<string>(),
        });
      }

      if (typeof studentId === "string" && studentId) {
        courseMap.get(courseId)?.studentIds.add(studentId);
      }
    });
  });

  return Array.from(courseMap.values())
    .map(({ studentIds, ...course }) => ({
      ...course,
      registered_count: studentIds.size,
    }))
    .sort((left, right) => {
      const levelOrder = left.level.localeCompare(right.level, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return levelOrder || left.code.localeCompare(right.code);
    });
}

export async function loadCohortRegisteredCourses(
  lookup: CohortCourseLookup,
  get: ApiGetter,
): Promise<RegisteredCourse[]> {
  const firstStudentsResponse = await get(studentSearchPath(lookup, 1));
  const students = responseDataArray(firstStudentsResponse);
  const pageCount = totalStudentPages(firstStudentsResponse);

  if (pageCount > 1) {
    const remainingResponses = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        get(studentSearchPath(lookup, index + 2)),
      ),
    );
    remainingResponses.forEach((response) => {
      students.push(...responseDataArray(response));
    });
  }

  const studentIds = new Set(
    students
      .map((student) => student.id)
      .filter((id): id is string => typeof id === "string" && Boolean(id)),
  );
  if (studentIds.size === 0) return [];

  const registrationsResponse = await get(registrationsSearchPath(lookup));
  const registrationIds = collectCohortRegistrationIds(
    responseDataArray(registrationsResponse),
    studentIds,
    lookup,
  );
  if (registrationIds.length === 0) return [];

  const detailResponses = await Promise.all(
    registrationIds.map((registrationId) =>
      get(
        `/api/admin/course-registration/registrations/details?id=${encodeURIComponent(registrationId)}`,
      ),
    ),
  );
  const details = detailResponses
    .map(responseDataRecord)
    .filter((detail): detail is ApiRecord => detail !== null);

  return aggregateRegisteredCourses(details);
}
