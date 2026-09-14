/**
 * 학교 과목 카탈로그의 임시 정적 저장소입니다.
 * 향후 관리자 화면, CSV/Excel 일괄 등록, 서버 DB는 이 계층만 교체해 연결합니다.
 * 실제 운영 전 학교의 확정 교육과정·학점표로 목록을 검토해야 합니다.
 */
export const COURSE_CATALOG_VERSION = 1;

const course = (id, subjectName, grade, semester, subjectGroup, credit, requirement) => ({
  id, subjectName, grade, semester, semesterId: `${grade}-${semester}`,
  subjectGroup, credit, gradingType: 'five-level', requirement,
});

// 요청에 명시된 1학년 공통 과목을 기본값으로 둡니다. 학교 확정 목록으로 확장하세요.
export const SCHOOL_COURSES = [
  course('common-korean-1', '공통국어1', 1, 1, '국어', 4, 'common'),
  course('common-math-1', '공통수학1', 1, 1, '수학', 4, 'common'),
  course('common-english-1', '공통영어1', 1, 1, '영어', 3, 'common'),
  course('common-korean-2', '공통국어2', 1, 2, '국어', 4, 'common'),
  course('common-math-2', '공통수학2', 1, 2, '수학', 4, 'common'),
  course('common-english-2', '공통영어2', 1, 2, '영어', 3, 'common'),

  // 2·3학년은 학생이 학교 개설 목록에서 선택합니다.
  course('literature', '문학', 2, 1, '국어', 4, 'elective'),
  course('algebra', '대수', 2, 1, '수학', 4, 'elective'),
  course('english-1', '영어Ⅰ', 2, 1, '영어', 3, 'elective'),
  course('sociology', '사회와 문화', 2, 1, '사회', 3, 'elective'),
  course('global-citizen-geography', '세계시민과 지리', 2, 1, '사회', 3, 'elective'),
];

export function coursesForSemester(semesterId) {
  return SCHOOL_COURSES.filter((item) => item.semesterId === semesterId);
}

export function commonCourses() {
  return SCHOOL_COURSES.filter((item) => item.requirement === 'common');
}

export function courseById(courseId) {
  return SCHOOL_COURSES.find((item) => item.id === courseId) ?? null;
}

export function recordFromCourse(course, id) {
  return { id, courseId: course.id, semesterId: course.semesterId, subjectName: course.subjectName, subjectGroup: course.subjectGroup, credit: course.credit, gradingType: course.gradingType, requirement: course.requirement, gradeValue: '', achievement: '' };
}
