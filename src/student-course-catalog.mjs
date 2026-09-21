import { ACTIVE_ENTRY_YEAR, SCHOOL_COURSES } from './course-catalog.mjs';

/**
 * 학생 화면에서 학번의 학년을 해석하는 기준 학년도다.
 * 시스템 날짜로 추정하지 않고, 검증된 카탈로그 배포 학년도에 맞춰 명시적으로 관리한다.
 */
export const STUDENT_CATALOG_ACADEMIC_YEAR = 2026;

/** 관리자에서 과목을 편집할 수 있는 연도와 학생 화면 지원 연도를 분리한다. */
export const CONFIGURED_STUDENT_ENTRY_YEARS = Object.freeze([ACTIVE_ENTRY_YEAR]);

const integerYear = (value) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
};

export function getSupportedEntryYears(courses = SCHOOL_COURSES) {
  const catalogYears = new Set((Array.isArray(courses) ? courses : [])
    .map((course) => integerYear(course?.entryYear))
    .filter(Number.isInteger));
  return CONFIGURED_STUDENT_ENTRY_YEARS.filter((year) => catalogYears.has(year));
}

export function resolveEntryYear(studentInfo = {}, {
  academicYear = STUDENT_CATALOG_ACADEMIC_YEAR,
  supportedEntryYears = CONFIGURED_STUDENT_ENTRY_YEARS,
} = {}) {
  const studentId = String(studentInfo?.studentId ?? '').replace(/\D/g, '').slice(0, 5);
  const supported = [...new Set((Array.isArray(supportedEntryYears) ? supportedEntryYears : [])
    .map(integerYear)
    .filter(Number.isInteger))].sort((a, b) => a - b);

  if (!/^\d{5}$/.test(studentId)) {
    return { status: 'pending', studentId, grade: null, entryYear: null, supportedEntryYears: supported };
  }

  const grade = Number(studentId[0]);
  if (![1, 2, 3].includes(grade)) {
    return { status: 'invalid', studentId, grade: null, entryYear: null, supportedEntryYears: supported };
  }

  const entryYear = Number(academicYear) - grade + 1;
  return {
    status: supported.includes(entryYear) ? 'supported' : 'unsupported',
    studentId,
    grade,
    entryYear,
    supportedEntryYears: supported,
  };
}

export function getCatalogForEntryYear(entryYear, courses = SCHOOL_COURSES) {
  const year = integerYear(entryYear);
  if (!year || !CONFIGURED_STUDENT_ENTRY_YEARS.includes(year)) return null;
  return (Array.isArray(courses) ? courses : []).filter((course) => Number(course?.entryYear) === year);
}

export function catalogSupportForYear(entryYear, courses = SCHOOL_COURSES) {
  const year = integerYear(entryYear);
  const hasCatalogData = Boolean(year && (Array.isArray(courses) ? courses : []).some((course) => Number(course?.entryYear) === year));
  return {
    entryYear: year,
    hasCatalogData,
    studentSupported: Boolean(year && CONFIGURED_STUDENT_ENTRY_YEARS.includes(year) && hasCatalogData),
  };
}

export function recordEntryYear(record = {}, courses = SCHOOL_COURSES) {
  const direct = integerYear(record?.entryYear);
  if (direct) return direct;
  const configured = (Array.isArray(courses) ? courses : []).find((course) => course?.id === record?.courseId);
  return integerYear(configured?.entryYear);
}

/** 지원 연도의 상세 과목만 남기고 간편 학기 평균은 그대로 보존한다. */
export function buildCatalogAwareGradeState(state = {}, context, courses = SCHOOL_COURSES) {
  const resolved = context ?? resolveEntryYear(state?.student);
  const actual = resolved.status === 'supported'
    ? (Array.isArray(state?.actual) ? state.actual : []).filter((record) => recordEntryYear(record, courses) === resolved.entryYear)
    : [];
  return { ...state, actual, catalogContext: resolved };
}
