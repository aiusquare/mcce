import assert from "node:assert/strict";
import test from "node:test";

const attemptsModulePath = new URL(
  "../src/lib/resultBatchAttempts.ts",
  import.meta.url,
);

async function loadAttemptsContract() {
  try {
    return await import(attemptsModulePath.href);
  } catch (error) {
    assert.fail(`Result batch attempt contract is unavailable: ${error}`);
  }
}

test("adds a newly eligible carryover without replacing existing attempts", async () => {
  const { mergeMissingCarryoverAttempts } = await loadAttemptsContract();
  const savedAttempt = {
    id: "attempt-existing",
    student_id: "student-existing",
    ca_score: "17.00",
    exam_score: "31.00",
    total_score: "48.00",
    grade: "D",
  };

  const merged = mergeMissingCarryoverAttempts(
    [savedAttempt],
    [
      {
        student_id: "student-existing",
        registration_type: "CARRYOVER",
      },
      {
        student_id: "student-aliyu",
        matric_number: "CCE/EDU/MENG1/22/006",
        full_name: "Aliyu ABDUSSALAM",
        registration_type: "CARRYOVER",
        previous_attempt: {
          id: "attempt-aliyu-abs",
          grade: "ABS",
          session_name: "2021/2022",
          semester_name: "Contact 3",
        },
      },
    ],
  );

  assert.equal(merged.length, 2);
  assert.strictEqual(merged[0], savedAttempt);
  assert.deepEqual(merged[1], {
    student_id: "student-aliyu",
    matric_number: "CCE/EDU/MENG1/22/006",
    full_name: "Aliyu ABDUSSALAM",
    registration_type: "CARRYOVER",
    previous_attempt: {
      id: "attempt-aliyu-abs",
      grade: "ABS",
      session_name: "2021/2022",
      semester_name: "Contact 3",
    },
    id: null,
    ca_score: null,
    exam_score: null,
    total_score: null,
    grade: null,
    grade_point: null,
    quality_point: null,
    is_locked: 0,
    is_pending_carryover: true,
  });
});

test("does not add regular class-list students to a result batch", async () => {
  const { mergeMissingCarryoverAttempts } = await loadAttemptsContract();

  assert.deepEqual(
    mergeMissingCarryoverAttempts([], [
      {
        student_id: "student-regular",
        registration_type: "CORE",
      },
    ]),
    [],
  );
});

test("saves a discovered carryover only after correction input is entered", async () => {
  const { selectAttemptsForSave } = await loadAttemptsContract();
  const existingBlankAttempt = {
    id: "attempt-existing-blank",
    student_id: "student-existing",
    ca_score: null,
    exam_score: null,
  };
  const untouchedCarryover = {
    id: null,
    student_id: "student-untouched",
    ca_score: null,
    exam_score: null,
    grade: null,
    is_pending_carryover: true,
  };
  const scoredCarryover = {
    id: null,
    student_id: "student-scored",
    ca_score: "18",
    exam_score: "35",
    grade: null,
    is_pending_carryover: true,
  };
  const absentCarryover = {
    id: null,
    student_id: "student-absent",
    ca_score: "",
    exam_score: "",
    grade: "ABS",
    is_pending_carryover: true,
  };

  assert.deepEqual(
    selectAttemptsForSave([
      existingBlankAttempt,
      untouchedCarryover,
      scoredCarryover,
      absentCarryover,
    ]),
    [existingBlankAttempt, scoredCarryover, absentCarryover],
  );
});

test("uses the admission number when a refreshed carryover has no matric number", async () => {
  const { getResultAttemptIdentifier } = await loadAttemptsContract();

  assert.equal(
    getResultAttemptIdentifier({
      matric_number: "",
      admission_number: "CCE/EDU/MENG1/22/006",
    }),
    "CCE/EDU/MENG1/22/006",
  );
});
