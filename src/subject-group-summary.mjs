export const SUBJECT_GROUP_EVALUATION_MIN_SEMESTERS = 2;

export const SINGLE_SEMESTER_SUBJECT_NOTICE =
  '현재 입력한 학기 기준 교과군 평균이에요. 여러 학기를 입력하면 변화와 강점을 함께 확인할 수 있어요.';

/** 기존 전체 내신 대비 교과군 평균 판정 문구를 그대로 유지한다. */
export function describeSubjectGroupAverage(average, overallAverage) {
  if (!Number.isFinite(average) || !Number.isFinite(overallAverage)) return '';
  const subjectAverage = average;
  const overall = overallAverage;
  const gap = subjectAverage - overall;
  if (gap <= -0.45) return '강점';
  if (gap <= 0.2) return '유지 권장';
  if (gap <= 0.6) return '조금 더 올리면 좋아요';
  if (gap <= 1) return '향상 필요';
  return '우선 관리 권장';
}

export function buildSubjectGroupSummaryDisplay(items = [], {
  overallAverage = null,
  completedSemesterCount = 0,
} = {}) {
  const semesterCount = Math.max(0, Number(completedSemesterCount) || 0);
  const showEvaluation = semesterCount >= SUBJECT_GROUP_EVALUATION_MIN_SEMESTERS
    && Number.isFinite(overallAverage) && items.length > 0;
  return {
    completedSemesterCount: semesterCount,
    showEvaluation,
    contextLabel: semesterCount === 1 ? '1개 학기 기준' : '',
    notice: semesterCount === 1 ? SINGLE_SEMESTER_SUBJECT_NOTICE : '',
    items: items.map((item) => ({
      ...item,
      evaluation: showEvaluation ? describeSubjectGroupAverage(item.average, overallAverage) : '',
    })),
  };
}
