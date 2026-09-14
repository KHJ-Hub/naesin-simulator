export const SEMESTERS = [
  { id: '1-1', label: '1학년 1학기', grade: 1, semester: 1 },
  { id: '1-2', label: '1학년 2학기', grade: 1, semester: 2 },
  { id: '2-1', label: '2학년 1학기', grade: 2, semester: 1 },
  { id: '2-2', label: '2학년 2학기', grade: 2, semester: 2 },
  { id: '3-1', label: '3학년 1학기', grade: 3, semester: 1 },
];
export const MIN_GRADE = 1;
export const MAX_GRADE = 5;
export function validAverageInput(value) {
  const average = Number(value);
  return Number.isFinite(average) && average >= MIN_GRADE && average <= MAX_GRADE;
}

export function validRecord(record) {
  const grade = Number(record.gradeValue);
  const credit = Number(record.credit);
  return Boolean(String(record.subjectName || '').trim()) && Number.isFinite(grade) && grade >= MIN_GRADE && grade <= MAX_GRADE && Number.isFinite(credit) && credit > 0;
}

export function validCourseRecord(record) {
  const credit = Number(record.credit);
  return Boolean(String(record.subjectName || '').trim()) && Number.isFinite(credit) && credit > 0;
}

export function calculateAverage(records = [], weighted = true) {
  const valid = records.filter(validRecord);
  if (!valid.length) return null;
  const totalCredits = valid.reduce((sum, record) => sum + Number(record.credit), 0);
  const total = valid.reduce((sum, record) => sum + Number(record.gradeValue) * (weighted ? Number(record.credit) : 1), 0);
  return Number((total / (weighted ? totalCredits : valid.length)).toFixed(2));
}

export function calculateOverallAverage(records = [], weighted = true) {
  return calculateAverage(records, weighted);
}

export function calculateSemesterAverages(records = [], weighted = true) {
  return SEMESTERS.map((semester) => ({ ...semester, average: calculateAverage(records.filter((record) => record.semesterId === semester.id), weighted) }));
}

export function calculateSubjectGroupAverages(records = [], weighted = true) {
  const groups = [...new Set(records.map((record) => String(record.subjectGroup || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  return groups.map((subjectGroup) => ({ subjectGroup, average: calculateAverage(records.filter((record) => record.subjectGroup === subjectGroup), weighted) }));
}

export function calculateTotalCredits(records = [], requireGrade = true) {
  return records.filter(requireGrade ? validRecord : validCourseRecord).reduce((sum, record) => sum + Number(record.credit), 0);
}

export function calculateRequiredRemainingAverage(actualRecords = [], expectedRecords = [], targetAverage, weighted = true) {
  const actual = actualRecords.filter(validRecord);
  const expected = expectedRecords.filter(validCourseRecord);
  const target = Number(targetAverage);
  if (!actual.length || !expected.length || !Number.isFinite(target) || target < MIN_GRADE || target > MAX_GRADE) return null;
  const actualCredits = calculateTotalCredits(actual);
  const remainingCredits = calculateTotalCredits(expected, false);
  const actualTotal = actual.reduce((sum, record) => sum + Number(record.gradeValue) * (weighted ? Number(record.credit) : 1), 0);
  const totalWeight = weighted ? actualCredits + remainingCredits : actual.length + expected.length;
  const required = (target * totalWeight - actualTotal) / (weighted ? remainingCredits : expected.length);
  return Number(required.toFixed(2));
}

export function describeGoalDifficulty(requiredAverage) {
  if (requiredAverage === null || requiredAverage === undefined) return '남은 예상 성적과 목표 내신을 입력해주세요.';
  if (requiredAverage < MIN_GRADE || requiredAverage > MAX_GRADE) return '현재 입력된 조건에서는 해당 목표 내신에 도달하기 어렵습니다.';
  if (requiredAverage <= 1.5) return '대부분 높은 등급이 필요한 목표입니다.';
  if (requiredAverage <= 2.5) return '상당한 성적 향상이 필요한 목표입니다.';
  return '현재 설정에서 목표 범위에 가까운 편입니다.';
}
