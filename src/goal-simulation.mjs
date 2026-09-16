import { SEMESTERS, calculateTotalCredits } from './grade-calculator.mjs';

const SEMESTER_ORDER = new Map(SEMESTERS.map(({ id }, index) => [id, index]));

function clampGrade(value) {
  return Math.max(1, Math.min(5, Number(value)));
}

export function aggregateRemainingBySemester(records = []) {
  const grouped = new Map();

  records.forEach((record) => {
    const semesterId = String(record.semesterId ?? '');
    if (!SEMESTER_ORDER.has(semesterId)) return;
    const credit = Number(record.credit);
    if (!Number.isFinite(credit) || credit <= 0) return;

    const current = grouped.get(semesterId) ?? { semesterId, credit: 0 };
    current.credit += credit;
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

export function createScenarioTargets(remainingRecords, requiredAverage, mode) {
  const semesters = aggregateRemainingBySemester(remainingRecords);
  if (!semesters.length) return [];
  if (mode === 'balanced' || semesters.length === 1) {
    return semesters.map((item) => ({ ...item, target: requiredAverage }));
  }

  const anchorIndex = mode === 'early' ? 0 : semesters.length - 1;
  const anchor = semesters[anchorIndex];
  const totalWeight = semesters.reduce((sum, item) => sum + item.credit, 0);
  const anchorTarget = clampGrade(requiredAverage - 0.4);
  const otherWeight = totalWeight - anchor.credit;
  const otherTarget = otherWeight > 0
    ? clampGrade((requiredAverage * totalWeight - anchorTarget * anchor.credit) / otherWeight)
    : requiredAverage;

  return semesters.map((item, index) => ({
    ...item,
    target: index === anchorIndex ? anchorTarget : otherTarget,
  }));
}

export function calculateScenarioFinalAverage(actualRecords, semesterTargets, weighted) {
  const actualWeight = weighted ? calculateTotalCredits(actualRecords) : actualRecords.length;
  const actualTotal = actualRecords.reduce((sum, item) => sum + Number(item.gradeValue) * (weighted ? Number(item.credit) : 1), 0);
  const remainingWeight = semesterTargets.reduce((sum, item) => sum + (weighted ? Number(item.credit) : 1), 0);
  const remainingTotal = semesterTargets.reduce((sum, item) => sum + Number(item.target) * (weighted ? Number(item.credit) : 1), 0);
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
    const semesterResults = createScenarioTargets(remainingRecords, requiredAverage, mode);
    return {
      mode,
      name,
      semesterResults,
      finalAverage: calculateScenarioFinalAverage(actualRecords, semesterResults, weighted),
    };
  });
}
