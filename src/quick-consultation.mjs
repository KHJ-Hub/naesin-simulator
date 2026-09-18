import {
  MAX_GRADE,
  MIN_GRADE,
  SEMESTERS,
  calculateRequiredRemainingAverage,
  validAverageInput,
} from './grade-calculator.mjs';
import { createGoalScenarioSummaries } from './goal-simulation.mjs';

const SEMESTER_INDEX = new Map(SEMESTERS.map((semester, index) => [semester.id, index]));

const fixed = (value) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(2)) : null;

export function createQuickConsultationState() {
  return {
    studentName: '',
    studentId: '',
    currentAverage: '',
    completedSemesterId: '',
    targetAverage: '',
    semesterAverages: {},
    admissionInterests: [],
  };
}
export function validateQuickConsultationInput(input = {}) {
  const errors = {};
  const studentId = String(input.studentId ?? '').trim();
  if (studentId && !/^\d{5}$/.test(studentId)) errors.studentId = '학번은 입력하는 경우 숫자 5자리로 입력해주세요.';
  if (!validAverageInput(input.currentAverage)) errors.currentAverage = '현재 내신을 1.00~5.00 사이로 입력해주세요.';
  if (!SEMESTER_INDEX.has(String(input.completedSemesterId ?? ''))) errors.completedSemesterId = '현재까지 완료한 학기를 선택해주세요.';
  if (!validAverageInput(input.targetAverage)) errors.targetAverage = '목표 내신을 1.00~5.00 사이로 입력해주세요.';
  Object.entries(input.semesterAverages ?? {}).forEach(([semesterId, value]) => {
    if (value !== '' && value !== null && value !== undefined && (!SEMESTER_INDEX.has(semesterId) || !validAverageInput(value))) {
      errors[`semesterAverage:${semesterId}`] = '학기 평균은 1.00~5.00 사이로 입력해주세요.';
    }
  });
  return Object.freeze(errors);
}

function actualRecords(currentAverage, completedSemesters) {
  return completedSemesters.map((semester) => ({
    semesterId: semester.id,
    subjectName: `${semester.label} 누적 기준`,
    credit: 1,
    gradeValue: currentAverage,
    gradingType: 'grade',
    fiveLevelEligible: true,
  }));
}

function remainingRecords(remainingSemesters) {
  return remainingSemesters.map((semester) => ({
    semesterId: semester.id,
    subjectName: `${semester.label} 목표`,
    credit: 1,
    gradingType: 'grade',
    fiveLevelEligible: true,
  }));
}

function highestReachableAverage(currentAverage, completedCount, remainingCount) {
  if (!completedCount) return null;
  return fixed(((currentAverage * completedCount) + (MIN_GRADE * remainingCount)) / (completedCount + remainingCount));
}

/**
 * 직접 입력한 현재 누적 내신을 완료 학기 수만큼 동일 비중으로 환산한다.
 * 과목·학점 정보가 없는 빠른 상담이므로 모든 학기는 동일 비중이다.
 */
export function calculateQuickConsultation(input = {}) {
  const errors = validateQuickConsultationInput(input);
  if (Object.keys(errors).length) return Object.freeze({ valid: false, errors });

  const completedIndex = SEMESTER_INDEX.get(String(input.completedSemesterId));
  const completedSemesters = SEMESTERS.slice(0, completedIndex + 1);
  const remainingSemesters = SEMESTERS.slice(completedIndex + 1);
  const currentAverage = fixed(input.currentAverage);
  const targetAverage = fixed(input.targetAverage);
  const actual = actualRecords(currentAverage, completedSemesters);
  const remaining = remainingRecords(remainingSemesters);
  const requiredAverage = remaining.length
    ? calculateRequiredRemainingAverage(actual, remaining, targetAverage, false)
    : null;
  const achievable = remaining.length
    ? requiredAverage >= MIN_GRADE && requiredAverage <= MAX_GRADE
    : Math.abs(currentAverage - targetAverage) < 0.005;
  const scenarios = achievable && remaining.length
    ? createGoalScenarioSummaries(actual, remaining, requiredAverage, false).map((scenario) => ({
      ...scenario,
      finalAverage: fixed(scenario.finalAverage),
      semesterResults: scenario.semesterResults.map((item) => ({
        ...item,
        label: SEMESTERS.find((semester) => semester.id === item.semesterId)?.label ?? item.semesterId,
        target: fixed(item.target),
      })),
    }))
    : [];

  const semesterAverages = Object.fromEntries(SEMESTERS.map((semester) => {
    const value = input.semesterAverages?.[semester.id];
    return [semester.id, validAverageInput(value) && SEMESTER_INDEX.get(semester.id) <= completedIndex ? fixed(value) : null];
  }));

  return Object.freeze({
    valid: true,
    errors: Object.freeze({}),
    studentName: String(input.studentName ?? '').trim(),
    studentId: String(input.studentId ?? '').trim(),
    currentAverage,
    targetAverage,
    completedSemesterId: String(input.completedSemesterId),
    completedSemesters: Object.freeze(completedSemesters),
    remainingSemesters: Object.freeze(remainingSemesters),
    completedSemesterCount: completedSemesters.length,
    remainingSemesterCount: remainingSemesters.length,
    semesterAverages: Object.freeze(semesterAverages),
    requiredAverage: fixed(requiredAverage),
    achievable,
    highestReachableAverage: highestReachableAverage(currentAverage, completedSemesters.length, remainingSemesters.length),
    scenarios: Object.freeze(scenarios),
    calculationBasis: '현재 누적 내신과 남은 학기를 동일 비중으로 계산',
  });
}
