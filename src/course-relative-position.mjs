import { SEMESTERS } from './grade-calculator.mjs';

const SEMESTER_ORDER = new Map(SEMESTERS.map(({ id }, index) => [id, index]));

export function positiveInteger(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 1 ? number : null;
}

export function validateCourseRankReference(record = {}) {
  const rankText = String(record.courseRank ?? '').trim();
  const totalText = String(record.courseRankTotal ?? '').trim();
  if (!rankText && !totalText) return { status: 'empty', rank: null, total: null, percentage: null, message: '' };
  if (!rankText || !totalText) {
    return { status: 'incomplete', rank: null, total: null, percentage: null, message: '석차와 산출 인원을 모두 입력해 주세요.' };
  }
  const rank = positiveInteger(rankText);
  const total = positiveInteger(totalText);
  if (rank === null || total === null) {
    return { status: 'invalid', rank, total, percentage: null, message: '1 이상의 정수로 입력해 주세요.' };
  }
  if (rank > total) {
    return { status: 'invalid', rank, total, percentage: null, message: '석차는 산출 인원보다 클 수 없어요.' };
  }
  return { status: 'valid', rank, total, percentage: rank / total * 100, message: '' };
}

export function formatCourseRelativePercentage(value) {
  if (!Number.isFinite(value)) return '';
  const rounded = Number(value.toFixed(1));
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function isNumericGradeCourse(record = {}) {
  return (!record.gradingType || ['grade', 'both'].includes(record.gradingType))
    && record.fiveLevelEligible !== false;
}

function isDetailedSemester(state, semesterId, records) {
  const mode = state?.inputModes?.[semesterId];
  if (mode === 'quick') return false;
  if (mode === 'detailed') return true;
  return records.some((record) => String(record.gradeValue ?? '').trim()
    || String(record.courseRank ?? '').trim()
    || String(record.courseRankTotal ?? '').trim());
}

/**
 * 과목별 실제 석차로부터 참고용 상대 위치를 만든다.
 * 학기 안에서는 학점 가중, 학기 사이는 동일 비중이며 내신 계산에는 관여하지 않는다.
 */
export function buildCourseRelativePosition(state = {}) {
  const records = Array.isArray(state.actual) ? state.actual : [];
  const grouped = new Map();

  records.forEach((record) => {
    if (!SEMESTER_ORDER.has(record.semesterId) || !isNumericGradeCourse(record)) return;
    if (!isDetailedSemester(state, record.semesterId, records.filter((item) => item.semesterId === record.semesterId))) return;
    const reference = validateCourseRankReference(record);
    const credit = Number(record.credit);
    if (reference.status !== 'valid' || !Number.isFinite(credit) || credit <= 0) return;
    const semester = grouped.get(record.semesterId) ?? { semesterId: record.semesterId, weightedTotal: 0, credits: 0, courseCount: 0 };
    semester.weightedTotal += reference.percentage * credit;
    semester.credits += credit;
    semester.courseCount += 1;
    grouped.set(record.semesterId, semester);
  });

  const semesters = [...grouped.values()]
    .sort((left, right) => SEMESTER_ORDER.get(left.semesterId) - SEMESTER_ORDER.get(right.semesterId))
    .map((semester) => ({
      semesterId: semester.semesterId,
      label: SEMESTERS.find(({ id }) => id === semester.semesterId)?.label ?? semester.semesterId,
      percentage: semester.weightedTotal / semester.credits,
      percentageLabel: formatCourseRelativePercentage(semester.weightedTotal / semester.credits),
      courseCount: semester.courseCount,
      credits: semester.credits,
    }));

  if (!semesters.length) return null;
  const percentage = semesters.reduce((sum, semester) => sum + semester.percentage, 0) / semesters.length;
  return {
    percentage,
    percentageLabel: formatCourseRelativePercentage(percentage),
    semesterCount: semesters.length,
    courseCount: semesters.reduce((sum, semester) => sum + semester.courseCount, 0),
    credits: semesters.reduce((sum, semester) => sum + semester.credits, 0),
    semesters,
  };
}
