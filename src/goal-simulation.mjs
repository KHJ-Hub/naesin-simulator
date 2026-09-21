import { SEMESTERS, calculateTotalCredits } from './grade-calculator.mjs';

const SEMESTER_ORDER = new Map(SEMESTERS.map(({ id }, index) => [id, index]));
const MAX_TREND_SPAN = 0.6;
const MAX_ADJACENT_CHANGE = 0.2;

function clampGrade(value) {
  return Math.max(1, Math.min(5, Number(value)));
}

/** 마지막 완료 학기 뒤부터 3-1까지를 남은 학기로 반환한다. 과거 누락 학기는 제외한다. */
export function getRemainingSimulationSemesters(completedSemesterIds = []) {
  const completedIndexes = completedSemesterIds
    .map((id) => SEMESTER_ORDER.get(id))
    .filter(Number.isInteger);
  if (!completedIndexes.length) return [];
  return SEMESTERS.slice(Math.max(...completedIndexes) + 1);
}

export function aggregateRemainingBySemester(records = []) {
  const grouped = new Map();

  records.forEach((record) => {
    const semesterId = String(record.semesterId ?? '');
    if (!SEMESTER_ORDER.has(semesterId)) return;
    const credit = Number(record.credit);
    if (!Number.isFinite(credit) || credit <= 0) return;

    const current = grouped.get(semesterId) ?? { semesterId, credit: 0, count: 0 };
    current.credit += credit;
    current.count += 1;
    grouped.set(semesterId, current);
  });

  return [...grouped.values()]
    .sort((a, b) => SEMESTER_ORDER.get(a.semesterId) - SEMESTER_ORDER.get(b.semesterId));
}

export function aggregateScenarioSemesterResults(records = []) {
  const grouped = new Map();

  records.forEach((record) => {
    const semesterId = String(record.semesterId ?? '');
    if (!SEMESTER_ORDER.has(semesterId)) return;
    const credit = Number(record.credit);
    const target = Number(record.target);
    if (!Number.isFinite(credit) || credit <= 0 || !Number.isFinite(target)) return;

    const current = grouped.get(semesterId) ?? { semesterId, credit: 0, weightedTarget: 0 };
    current.credit += credit;
    current.weightedTarget += target * credit;
    grouped.set(semesterId, current);
  });

  return [...grouped.values()]
    .sort((a, b) => SEMESTER_ORDER.get(a.semesterId) - SEMESTER_ORDER.get(b.semesterId))
    .map(({ semesterId, credit, weightedTarget }) => ({
      semesterId,
      credit,
      target: weightedTarget / credit,
    }));
}

function scenarioWeight(semester, weighted) {
  return weighted ? Number(semester.credit) : Number(semester.count);
}

function progressiveTargets(semesters, requiredAverage, mode, weighted) {
  const direction = mode === 'early' ? 1 : -1;
  const weights = semesters.map((semester) => scenarioWeight(semester, weighted));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const weightedCenter = semesters.reduce((sum, _, index) => sum + index * weights[index], 0) / totalWeight;
  const coefficients = semesters.map((_, index) => direction * (index - weightedCenter));
  const desiredStep = Math.min(MAX_ADJACENT_CHANGE, MAX_TREND_SPAN / (semesters.length - 1));
  const boundedStep = coefficients.reduce((step, coefficient) => {
    if (coefficient > 0) return Math.min(step, (5 - requiredAverage) / coefficient);
    if (coefficient < 0) return Math.min(step, (requiredAverage - 1) / -coefficient);
    return step;
  }, desiredStep);
  const step = Math.max(0, boundedStep);

  return semesters.map((semester, index) => ({
    ...semester,
    target: clampGrade(requiredAverage + coefficients[index] * step),
  }));
}

export function createScenarioTargets(remainingRecords, requiredAverage, mode, weighted = true) {
  const semesters = aggregateRemainingBySemester(remainingRecords);
  if (!semesters.length) return [];
  if (mode === 'balanced' || semesters.length === 1) {
    return semesters.map((item) => ({ ...item, target: requiredAverage }));
  }
  return progressiveTargets(semesters, clampGrade(requiredAverage), mode, weighted);
}

export function calculateScenarioFinalAverage(actualRecords, semesterTargets, weighted) {
  const actualWeight = weighted ? calculateTotalCredits(actualRecords) : actualRecords.length;
  const actualTotal = actualRecords.reduce((sum, item) => sum + Number(item.gradeValue) * (weighted ? Number(item.credit) : 1), 0);
  const remainingWeight = semesterTargets.reduce((sum, item) => sum + (weighted ? Number(item.credit) : Number(item.count ?? 1)), 0);
  const remainingTotal = semesterTargets.reduce((sum, item) => sum + Number(item.target) * (weighted ? Number(item.credit) : Number(item.count ?? 1)), 0);
  return actualWeight + remainingWeight
    ? (actualTotal + remainingTotal) / (actualWeight + remainingWeight)
    : null;
}

export function createGoalScenarioSummaries(actualRecords, remainingRecords, requiredAverage, weighted) {
  return [
    ['balanced', '균형형'],
    ['early', '초반 집중형'],
    ['late', '후반 상승형'],
  ].map(([mode, name]) => {
    const semesterResults = createScenarioTargets(remainingRecords, requiredAverage, mode, weighted);
    return {
      mode,
      name,
      semesterResults,
      finalAverage: calculateScenarioFinalAverage(actualRecords, semesterResults, weighted),
    };
  });
}
