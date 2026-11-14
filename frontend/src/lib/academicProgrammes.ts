export const degreeProgrammes = [
  {
    name: "B.A Islamic Studies",
    code: "BAIS",
    department: "Arts and Islamic Studies",
    departmentCode: "AIS",
  },
  {
    name: "B.A Hausa",
    code: "BAHA",
    department: "Arts and Islamic Studies",
    departmentCode: "AIS",
  },
  {
    name: "B.ED Guidance and Counselling",
    code: "BEDGC",
    department: "Education",
    departmentCode: "EDU",
  },
  {
    name: "B. Library and Information Science",
    code: "BLIS",
    department: "Information Studies",
    departmentCode: "LIS",
  },
  {
    name: "B.A (ED) English",
    code: "BAEDENG",
    department: "Education",
    departmentCode: "EDU",
  },
  {
    name: "Bsc. (ED) Biology",
    code: "BSCEDBIO",
    department: "Education",
    departmentCode: "EDU",
  },
  {
    name: "Bsc. Computer Science",
    code: "BSCCS",
    department: "Science and Computing",
    departmentCode: "SCI",
  },
];

export const degreeProgrammeGroups = [
  {
    department: "Arts and Islamic Studies",
    departmentCode: "AIS",
    courses: ["B.A Islamic Studies", "B.A Hausa"],
  },
  {
    department: "Education",
    departmentCode: "EDU",
    courses: [
      "B.ED Guidance and Counselling",
      "B.A (ED) English",
      "Bsc. (ED) Biology",
    ],
  },
  {
    department: "Information Studies",
    departmentCode: "LIS",
    courses: ["B. Library and Information Science"],
  },
  {
    department: "Science and Computing",
    departmentCode: "SCI",
    courses: ["Bsc. Computer Science"],
  },
];

export const degreeProgrammeCatalogue = degreeProgrammeGroups.map((group) => ({
  department_id: group.departmentCode.toLowerCase(),
  department: group.department,
  department_code: group.departmentCode,
  programmes: degreeProgrammes
    .filter((programme) => programme.department === group.department)
    .map((programme) => ({
      id: programme.code.toLowerCase(),
      code: programme.code,
      name: programme.name,
    })),
}));
