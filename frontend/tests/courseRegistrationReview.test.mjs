import assert from "node:assert/strict";
import test from "node:test";

const reviewModulePath = new URL(
  "../src/lib/courseRegistrationReview.ts",
  import.meta.url,
);

async function loadReviewContract() {
  try {
    return await import(reviewModulePath.href);
  } catch (error) {
    assert.fail(`Course registration review contract is unavailable: ${error}`);
  }
}

test("builds the details request with the registration row ID", async () => {
  const { buildRegistrationDetailsPath } = await loadReviewContract();

  assert.equal(
    buildRegistrationDetailsPath("registration / 1"),
    "/api/admin/course-registration/registrations/details?id=registration%20%2F%201",
  );
});

test("builds approval payloads with registration_id", async () => {
  const { buildRegistrationProcessPayload } = await loadReviewContract();

  assert.deepEqual(
    buildRegistrationProcessPayload("registration-1", {
      action: "return",
      reason: "Correct the elective selection",
    }),
    {
      registration_id: "registration-1",
      action: "return",
      reason: "Correct the elective selection",
    },
  );
});

test("keys cached details by registration row ID", async () => {
  const { registrationDetailsQueryKey } = await loadReviewContract();

  assert.deepEqual(registrationDetailsQueryKey("registration-1"), [
    "course-registration-details",
    "registration-1",
  ]);
});

test("finds every registration envelope belonging to the selected student", async () => {
  const { collectStudentRegistrationIds } = await loadReviewContract();

  assert.deepEqual(
    collectStudentRegistrationIds(
      [
        { id: "registration-5", student_id: "student-1" },
        { id: "registration-1", student_id: "student-1" },
        { id: "registration-other", student_id: "student-2" },
        { id: "registration-1", student_id: "student-1" },
      ],
      "student-1",
      "registration-5",
    ),
    ["registration-5", "registration-1"],
  );
});

test("combines courses from all contacts while retaining the selected envelope", async () => {
  const { mergeStudentRegistrationDetails } = await loadReviewContract();

  assert.deepEqual(
    mergeStudentRegistrationDetails("registration-5", [
      {
        registration: {
          id: "registration-5",
          student_id: "student-1",
          level: "Contact 5",
        },
        items: [
          {
            id: "item-5",
            registration_id: "registration-5",
            course_level: "Contact 5",
            code: "HAU451",
          },
          {
            id: "item-1",
            registration_id: "registration-1",
            course_level: "Contact 1",
            code: "HAU111",
          },
        ],
      },
      {
        registration: {
          id: "registration-1",
          student_id: "student-1",
          level: "Contact 1",
        },
        items: [
          {
            id: "item-1",
            registration_id: "registration-1",
            course_level: "Contact 1",
            code: "HAU111",
          },
        ],
      },
    ]),
    {
      registration: {
        id: "registration-5",
        student_id: "student-1",
        level: "Contact 5",
      },
      items: [
        {
          id: "item-1",
          registration_id: "registration-1",
          course_level: "Contact 1",
          code: "HAU111",
        },
        {
          id: "item-5",
          registration_id: "registration-5",
          course_level: "Contact 5",
          code: "HAU451",
        },
      ],
    },
  );
});
