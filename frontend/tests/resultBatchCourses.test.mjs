import assert from "node:assert/strict";
import test from "node:test";

const courseModulePath = new URL(
  "../src/lib/resultBatchCourses.ts",
  import.meta.url,
);

async function loadCourseContract() {
  try {
    return await import(courseModulePath.href);
  } catch (error) {
    assert.fail(`Result batch course contract is unavailable: ${error}`);
  }
}

const registeredCourses = [
  {
    id: "course-1",
    code: "ENG101",
    title: "Use of English",
    level: "Contact 1",
    type: "core",
    registered_count: "12",
  },
];

test("preserves a raw registered-courses response", async () => {
  const { normalizeRegisteredCoursesResponse } = await loadCourseContract();

  assert.deepEqual(
    normalizeRegisteredCoursesResponse(registeredCourses),
    registeredCourses,
  );
});

test("preserves a wrapped registered-courses response", async () => {
  const { normalizeRegisteredCoursesResponse } = await loadCourseContract();

  assert.deepEqual(
    normalizeRegisteredCoursesResponse({
      status: "success",
      data: registeredCourses,
    }),
    registeredCourses,
  );
});

test("uses an empty list for an invalid registered-courses response", async () => {
  const { normalizeRegisteredCoursesResponse } = await loadCourseContract();

  assert.deepEqual(normalizeRegisteredCoursesResponse({ data: null }), []);
});

test("loads registered courses through the historical entry-session fallback", async () => {
  const { loadCohortRegisteredCourses } = await loadCourseContract();

  const responses = new Map([
    [
      "/api/admin/students?page=1&per_page=100&session=2021%2F2022&department_id=department+english&programme_id=programme-english",
      {
        data: [{ id: "student-1" }],
        meta: { pagination: { total_pages: 2 } },
      },
    ],
    [
      "/api/admin/students?page=2&per_page=100&session=2021%2F2022&department_id=department+english&programme_id=programme-english",
      {
        data: [{ id: "student-2" }],
        meta: { pagination: { total_pages: 2 } },
      },
    ],
    [
      "/api/admin/course-registration/registrations?session_id=all&semester_id=all&status=approved&programme_id=programme-english&level=Contact+1",
      {
        data: [
          {
            id: "registration-1",
            student_id: "student-1",
            status: "approved",
            level: "Contact 1",
          },
          {
            id: "registration-2",
            student_id: "student-2",
            status: "approved",
            level: "Contact 1",
          },
          {
            id: "registration-other-student",
            student_id: "student-3",
            status: "approved",
            level: "Contact 1",
          },
          {
            id: "registration-other-contact",
            student_id: "student-1",
            status: "approved",
            level: "Contact 2",
          },
        ],
      },
    ],
    [
      "/api/admin/course-registration/registrations/details?id=registration-1",
      {
        data: {
          registration: { id: "registration-1", student_id: "student-1" },
          items: [
            {
              id: "item-1",
              course_id: "course-1",
              code: "ENG101",
              title: "Use of English",
              course_level: "Contact 1",
              course_type: "core",
            },
          ],
        },
      },
    ],
    [
      "/api/admin/course-registration/registrations/details?id=registration-2",
      {
        data: {
          registration: { id: "registration-2", student_id: "student-2" },
          items: [
            {
              id: "item-2",
              course_id: "course-1",
              code: "ENG101",
              title: "Use of English",
              course_level: "Contact 1",
              course_type: "core",
            },
            {
              id: "item-3",
              course_id: "course-2",
              code: "ENG102",
              title: "English Grammar",
              course_level: "Contact 1",
              course_type: "core",
            },
          ],
        },
      },
    ],
  ]);

  const courses = await loadCohortRegisteredCourses(
    {
      sessionName: "2021/2022",
      departmentId: "department english",
      programmeId: "programme-english",
      periodName: "Contact 1",
      isContact: true,
    },
    async (path) => {
      assert.ok(responses.has(path), `Unexpected request: ${path}`);
      return responses.get(path);
    },
  );

  assert.deepEqual(courses, [
    {
      id: "course-1",
      code: "ENG101",
      title: "Use of English",
      level: "Contact 1",
      type: "core",
      registered_count: 2,
    },
    {
      id: "course-2",
      code: "ENG102",
      title: "English Grammar",
      level: "Contact 1",
      type: "core",
      registered_count: 1,
    },
  ]);
});

test("matches semester registrations using the resolved semester ID", async () => {
  const { collectCohortRegistrationIds } = await loadCourseContract();

  assert.deepEqual(
    collectCohortRegistrationIds(
      [
        {
          id: "registration-first",
          student_id: "student-1",
          status: "approved",
          semester_id: "semester-first",
          level: "100",
        },
        {
          id: "registration-second",
          student_id: "student-1",
          status: "approved",
          semester_id: "semester-second",
          level: "100",
        },
      ],
      new Set(["student-1"]),
      {
        periodName: "First Semester",
        periodId: "semester-first",
        isContact: false,
      },
    ),
    ["registration-first"],
  );
});
