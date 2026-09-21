import { ACTIVE_ENTRY_YEAR, SCHOOL_COURSES } from './course-catalog.mjs?v=20260914-grading-types3';

export const CATALOG_STORAGE_KEY = 'naesin-course-catalog:v1';

function cloneCourses(courses) { return courses.map((course) => ({ ...course, classConditions: Array.isArray(course.classConditions) ? [...course.classConditions] : [] })); }
function validCourse(course) {
  return course && typeof course.id === 'string' && course.id && Number.isFinite(Number(course.entryYear)) && Number(course.grade) >= 1 && Number(course.grade) <= 3 && Number(course.semester) >= 1 && Number(course.semester) <= 2 && String(course.subjectName || '').trim() && Number(course.credit) > 0;
}
function loadCourses() {
  const defaults = cloneCourses(SCHOOL_COURSES);
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(CATALOG_STORAGE_KEY) || 'null');
    if (!Array.isArray(saved?.courses)) return defaults;
    const byId = new Map(defaults.map((course) => [course.id, course]));
    saved.courses.filter(validCourse).forEach((course) => byId.set(course.id, { ...byId.get(course.id), ...course, grade: Number(course.grade), semester: Number(course.semester), credit: Number(course.credit), active: course.active !== false, enabled: course.enabled !== false }));
    return [...byId.values()].sort((a, b) => (Number(a.entryYear) - Number(b.entryYear)) || (Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)) || a.subjectName.localeCompare(b.subjectName, 'ko'));
  } catch { return defaults; }
}
let courses = loadCourses();

const FIRST_GRADE_GROUP_ORDER = new Map([
  ['국어', 0], ['수학', 1], ['영어', 2], ['사회', 3], ['과학', 4],
]);

/** 화면 표시용 정렬. 1학년만 교과군 순서를 적용하고, 2·3학년은 원본 순서를 보존한다. */
export function sortCoursesForDisplay(items) {
  return [...items].sort((a, b) => {
    if (Number(a.grade) === 1 && Number(b.grade) === 1) {
      const groupOrderA = FIRST_GRADE_GROUP_ORDER.get(a.subjectGroup) ?? 5;
      const groupOrderB = FIRST_GRADE_GROUP_ORDER.get(b.subjectGroup) ?? 5;
      if (groupOrderA !== groupOrderB) return groupOrderA - groupOrderB;
    }
    return (Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));
  });
}

export function catalogCourses({ includeInactive = true } = {}) { return cloneCourses(includeInactive ? courses : courses.filter((course) => course.active !== false && course.enabled !== false)); }
export function catalogCourseById(id, entryYear = null) {
  return courses.find((course) => course.id === id && (entryYear === null || Number(course.entryYear) === Number(entryYear))) ?? null;
}
export function isGradeInputCourse(course = {}) { return ['grade', 'both'].includes(course.gradingType) && course.fiveLevelEligible !== false; }
export function isSupplementalAchievementCourse(course = {}) { return !isGradeInputCourse(course); }
export function coursesForSemester(semesterId, entryYear = ACTIVE_ENTRY_YEAR, { includeAchievementCourses = false } = {}) {
  return sortCoursesForDisplay(courses.filter((course) => course.entryYear === entryYear
    && course.semesterId === semesterId
    && course.active !== false
    && course.enabled !== false
    && (includeAchievementCourses || isGradeInputCourse(course))));
}
export function achievementCoursesForSemester(semesterId, entryYear = ACTIVE_ENTRY_YEAR) {
  return sortCoursesForDisplay(courses.filter((course) => course.entryYear === entryYear
    && course.semesterId === semesterId
    && course.active !== false
    && course.enabled !== false
    && isSupplementalAchievementCourse(course)));
}
/** 학생이 직접 추가할 수 있는 학교 개설 과목. 자동 생성 대상과 달리 성취도/P·F 과목도 포함한다. */
export function selectableCoursesForSemester(semesterId, entryYear = ACTIVE_ENTRY_YEAR, { classNumber = null } = {}) {
  const normalizedClass = classNumber === null || classNumber === undefined || classNumber === '' ? null : String(Number(classNumber));
  return sortCoursesForDisplay(courses.filter((course) => course.entryYear === entryYear
    && course.semesterId === semesterId
    && course.active !== false
    && course.enabled !== false
    && (!course.classConditions?.length || normalizedClass === null || course.classConditions.includes(normalizedClass))));
}
export function commonCourses(entryYear = ACTIVE_ENTRY_YEAR, classNumber = null, { includeAchievementCourses = false } = {}) {
  return sortCoursesForDisplay(courses.filter((course) => course.entryYear === entryYear
    && course.autoGenerate
    && course.active !== false
    && course.enabled !== false
    && (!course.classConditions?.length || course.classConditions.includes(String(classNumber)))
    && (includeAchievementCourses || isGradeInputCourse(course))));
}
export function saveCatalog(nextCourses) {
  courses = cloneCourses(nextCourses.filter(validCourse));
  globalThis.localStorage?.setItem(CATALOG_STORAGE_KEY, JSON.stringify({ version: 1, courses, savedAt: new Date().toISOString() }));
  globalThis.dispatchEvent?.(new CustomEvent('naesin-catalog-updated'));
  return catalogCourses();
}
export function upsertCatalogCourse(course) { return saveCatalog([...courses.filter((item) => item.id !== course.id), { ...course, semesterId: `${course.grade}-${course.semester}`, active: course.active !== false, enabled: course.enabled !== false }]); }
export function disableCatalogCourse(id) { const course = catalogCourseById(id); return course ? saveCatalog(courses.map((item) => item.id === id ? { ...item, active: false, enabled: false } : item)) : catalogCourses(); }
export function resetCatalogOverrides() { courses = cloneCourses(SCHOOL_COURSES); globalThis.localStorage?.removeItem(CATALOG_STORAGE_KEY); return catalogCourses(); }
