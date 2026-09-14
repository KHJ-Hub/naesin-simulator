export const SEMESTERS = [
  { id: '1-1', label: '1학년 1학기', grade: 1, semester: 1 },
  { id: '1-2', label: '1학년 2학기', grade: 1, semester: 2 },
  { id: '2-1', label: '2학년 1학기', grade: 2, semester: 1 },
  { id: '2-2', label: '2학년 2학기', grade: 2, semester: 2 },
  { id: '3-1', label: '3학년 1학기', grade: 3, semester: 1 },
];

export function validRecord(record) {
  const grade = Number(record.gradeValue);
  const credit = Number(record.credit);
  return Boolean(String(record.subjectName || '').trim()) && Number.isFinite(grade) && grade >= 1 && grade <= 9 && Number.isFinite(credit) && credit > 0;
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

export function calculateTotalCredits(records = []) {
  return records.filter(validRecord).reduce((sum, record) => sum + Number(record.credit), 0);
}

export function calculateRequiredRemainingAverage(actualRecords = [], expectedRecords = [], targetAverage, weighted = true) {
  const actual = actualRecords.filter(validRecord);
  const expected = expectedRecords.filter(validRecord);
  const target = Number(targetAverage);
  if (!actual.length || !expected.length || !Number.isFinite(target) || target <= 0) return null;
  const actualCredits = calculateTotalCredits(actual);
  const remainingCredits = calculateTotalCredits(expected);
  const actualTotal = actual.reduce((sum, record) => sum + Number(record.gradeValue) * (weighted ? Number(record.credit) : 1), 0);
  const totalWeight = weighted ? actualCredits + remainingCredits : actual.length + expected.length;
  const required = (target * totalWeight - actualTotal) / (weighted ? remainingCredits : expected.length);
  return Number(required.toFixed(2));
}

export function describeGoalDifficulty(requiredAverage) {
  if (requiredAverage === null || requiredAverage === undefined) return '남은 예상 성적과 목표 내신을 입력해주세요.';
  if (requiredAverage < 1 || requiredAverage > 9) return '현재 설정에서는 달성이 매우 어려운 범위입니다.';
  if (requiredAverage <= 1.5) return '대부분 높은 등급이 필요한 목표입니다.';
  if (requiredAverage <= 2.5) return '상당한 성적 향상이 필요한 목표입니다.';
  return '현재 설정에서 목표 범위에 가까운 편입니다.';
}
