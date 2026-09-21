import {
  SEMESTERS,
  calculateAverage,
  calculateTotalCredits,
  validAverageInput,
} from './grade-calculator.mjs';

const SEMESTER_INDEX = new Map(SEMESTERS.map(({ id }, index) => [id, index]));

function isGradeCourse(record = {}) {
  return (!record.gradingType || ['grade', 'both'].includes(record.gradingType))
    && record.fiveLevelEligible !== false;
}

function validGradeRecord(record = {}) {
  const grade = Number(record.gradeValue);
  const credit = Number(record.credit);
  return isGradeCourse(record)
    && Boolean(String(record.subjectName ?? '').trim())
    && Number.isFinite(grade)
    && grade >= 1
    && grade <= 5
    && Number.isFinite(credit)
    && credit > 0;
}

function quickAverageFor(state, semesterId) {
  const value = Number(state?.quickAverages?.[semesterId]);
  return validAverageInput(value) ? Number(value.toFixed(2)) : null;
}

/**
 * 한 학기를 하나의 계산 단위로 정규화한다.
 * 상세입력이 완료된 학기는 학기 내부에서만 학점(또는 과목) 가중을 적용하고,
 * 간편입력은 상세입력이 완료되지 않았을 때 사용한다.
 */
export function normalizeSemesterPerformance(state = {}) {
  const actual = Array.isArray(state.actual) ? state.actual : [];
  const weightedWithinSemester = state.weighted !== false;

  return SEMESTERS.map((semester) => {
    const rows = actual.filter((record) => record.semesterId === semester.id);
    const gradeRows = rows.filter(isGradeCourse);
    const validRows = gradeRows.filter(validGradeRecord);
    const detailedComplete = gradeRows.length > 0 && validRows.length === gradeRows.length;
    const quickAverage = quickAverageFor(state, semester.id);

    let source = 'missing';
    let average = null;
    if (detailedComplete) {
      source = 'detailed';
      average = calculateAverage(validRows, weightedWithinSemester);
    } else if (quickAverage !== null) {
      source = 'quick';
      average = quickAverage;
    } else if (validRows.length) {
      source = 'partial';
    }

    const labels = {
      detailed: '상세입력 완료',
      quick: gradeRows.length ? '간편입력 · 상세 미완료' : '간편입력',
      partial: `상세입력 일부 (${validRows.length}/${gradeRows.length}과목)`,
      missing: '미입력',
    };

    return {
      ...semester,
      source,
      average,
      complete: source === 'detailed' || source === 'quick',
      statusLabel: labels[source],
      rows,
      gradeRows,
      validRows,
      enteredCourseCount: validRows.length,
      totalCourseCount: gradeRows.length,
      detailedCredits: calculateTotalCredits(validRows),
    };
  });
}

function semesterAverageRecord(performance, prefix = 'current') {
  return {
    id: `${prefix}-${performance.id}`,
    semesterId: performance.id,
    subjectName: `${performance.label} 평균`,
    subjectGroup: '',
    credit: 1,
    gradeValue: performance.average,
    source: performance.source,
  };
}

export function buildCurrentGradeModel(state = {}) {
  const semesters = normalizeSemesterPerformance(state);
  const completedSemesters = semesters.filter((semester) => semester.complete);
  const semesterRecords = completedSemesters.map((semester) => semesterAverageRecord(semester));
  const average = semesterRecords.length
    ? Number((semesterRecords.reduce((sum, record) => sum + Number(record.gradeValue), 0) / semesterRecords.length).toFixed(2))
    : null;
  const hasQuick = completedSemesters.some((semester) => semester.source === 'quick');
  const hasDetailed = completedSemesters.some((semester) => semester.source === 'detailed');
  const weightedWithinSemester = state.weighted !== false;

  let calculationBasis = '입력된 성적 없음';
  if (hasQuick && hasDetailed) {
    calculationBasis = weightedWithinSemester
      ? '학기별 동일 비중 · 상세 학기는 학점 가중 평균'
      : '학기별 동일 비중 · 상세 학기는 과목 동일 비중 평균';
  } else if (hasQuick) {
    calculationBasis = '입력한 학기 평균을 학기별 동일 비중으로 계산';
  } else if (hasDetailed) {
    calculationBasis = weightedWithinSemester
      ? '학기별 동일 비중 · 학기 안은 학점 가중 평균'
      : '학기별 동일 비중 · 학기 안은 과목 동일 비중 평균';
  }

  return {
    semesters,
    completedSemesters,
    semesterRecords,
    average,
    hasQuick,
    hasDetailed,
    weightedWithinSemester,
    calculationBasis,
  };
}

/** 마지막 완료 학기 뒤만 미래로 본다. 그 이전의 미입력 학기는 과거 누락으로 분리한다. */
export function buildRemainingSemesterModel(state = {}, currentModel = buildCurrentGradeModel(state)) {
  const completedIndexes = currentModel.completedSemesters
    .map(({ id }) => SEMESTER_INDEX.get(id))
    .filter(Number.isInteger);
  if (!completedIndexes.length) {
    return { lastCompletedSemesterId: null, remainingSemesters: [], remainingRecords: [], missingPastSemesters: [] };
  }

  const lastCompletedIndex = Math.max(...completedIndexes);
  const remainingSemesters = SEMESTERS.slice(lastCompletedIndex + 1);
  const completedIds = new Set(currentModel.completedSemesters.map(({ id }) => id));
  const missingPastSemesters = SEMESTERS
    .slice(0, lastCompletedIndex)
    .filter(({ id }) => !completedIds.has(id));
  const remainingRecords = remainingSemesters.map((semester) => ({
    id: `remaining-${semester.id}`,
    semesterId: semester.id,
    subjectName: `${semester.label} 남은 학기`,
    subjectGroup: '',
    credit: 1,
  }));

  return {
    lastCompletedSemesterId: SEMESTERS[lastCompletedIndex].id,
    remainingSemesters,
    remainingRecords,
    missingPastSemesters,
  };
}

export function buildStudentGradeModels(state = {}) {
  const current = buildCurrentGradeModel(state);
  return { current, remaining: buildRemainingSemesterModel(state, current) };
}
