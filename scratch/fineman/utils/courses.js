export const COURSES = [
  {
    school: "School of Computing",
    courses: ["Computer Science", "Software Engineering", "Information Technology"]
  },
  {
    school: "School of Nursing Science",
    courses: ["Nursing Science"]
  },
  {
    school: "Benjamin Carson College of Health & Medical Sciences",
    courses: ["Medicine and Surgery (MBBS)", "Anatomy", "Physiology", "Biochemistry", "Nutrition and Dietetics"]
  },
  {
    school: "School of Public and Allied Health",
    courses: ["Public Health", "Medical Laboratory Science"]
  },
  {
    school: "School of Law and Security Studies",
    courses: ["Law", "International Law and Security Studies"]
  },
  {
    school: "School of Management Sciences",
    courses: ["Accounting", "Business Administration", "Marketing", "Finance", "Information Resources Management"]
  },
  {
    school: "School of Social Sciences",
    courses: ["Economics", "Mass Communication", "Political Science and Public Administration", "Social Work"]
  },
  {
    school: "School of Science and Technology",
    courses: ["Microbiology", "Agriculture", "Physics", "Chemistry", "Biology", "Industrial Technology"]
  },
  {
    school: "School of Education and Humanities",
    courses: ["Education", "History and International Studies", "Languages and Literary Studies", "Music and Creative Arts", "Religious Studies"]
  },
  {
    school: "School of Engineering",
    courses: ["Civil Engineering", "Mechanical Engineering", "Electrical and Electronics Engineering", "Computer Engineering"]
  }
];

export const FLAT_COURSES = COURSES.reduce((acc, school) => {
  return [...acc, ...school.courses];
}, []).sort();
