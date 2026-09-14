import { ACTIVE_ENTRY_YEAR, SCHOOL_COURSES } from './course-catalog.mjs?v=20260914-grading-types2';

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

export function catalogCourses({ includeInactive = true } = {}) { return cloneCourses(includeInactive ? courses : courses.filter((course) => course.active !== false && course.enabled !== false)); }
export function catalogCourseById(id) { return courses.find((course) => course.id === id) ?? null; }
export function coursesForSemester(semesterId, entryYear = ACTIVE_ENTRY_YEAR) { return courses.filter((course) => course.entryYear === entryYear && course.semesterId === semesterId && course.active !== false && course.enabled !== false).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)); }
export function commonCourses(entryYear = ACTIVE_ENTRY_YEAR, classNumber = null) { return courses.filter((course) => course.entryYear === entryYear && course.autoGenerate && course.active !== false && course.enabled !== false && (!course.classConditions?.length || course.classConditions.includes(String(classNumber)))).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)); }
export function saveCatalog(nextCourses) {
  courses = cloneCourses(nextCourses.filter(validCourse));
  globalThis.localStorage?.setItem(CATALOG_STORAGE_KEY, JSON.stringify({ version: 1, courses, savedAt: new Date().toISOString() }));
  globalThis.dispatchEvent?.(new CustomEvent('naesin-catalog-updated'));
  return catalogCourses();
}
export function upsertCatalogCourse(course) { return saveCatalog([...courses.filter((item) => item.id !== course.id), { ...course, semesterId: `${course.grade}-${course.semester}`, active: course.active !== false, enabled: course.enabled !== false }]); }
export function disableCatalogCourse(id) { const course = catalogCourseById(id); return course ? saveCatalog(courses.map((item) => item.id === id ? { ...item, active: false, enabled: false } : item)) : catalogCourses(); }
export function resetCatalogOverrides() { courses = cloneCourses(SCHOOL_COURSES); globalThis.localStorage?.removeItem(CATALOG_STORAGE_KEY); return catalogCourses(); }
