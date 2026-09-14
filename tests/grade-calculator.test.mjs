import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAverage, calculateSemesterAverages, calculateSubjectGroupAverages, calculateRequiredRemainingAverage } from '../src/grade-calculator.mjs';

const records = [
  { semesterId: '1-1', subjectName: '국어', subjectGroup: '국어', credit: 4, gradeValue: 1 },
  { semesterId: '1-1', subjectName: '수학', subjectGroup: '수학', credit: 2, gradeValue: 3 },
  { semesterId: '1-2', subjectName: '영어', subjectGroup: '영어', credit: 3, gradeValue: 2 },
];

test('학점 가중 평균을 계산한다', () => assert.equal(calculateAverage(records.slice(0, 2)), 1.67));
test('학기별·교과별 평균을 계산한다', () => {
  assert.equal(calculateSemesterAverages(records).find((item) => item.id === '1-2').average, 2);
  assert.equal(calculateSubjectGroupAverages(records).find((item) => item.subjectGroup === '수학').average, 3);
});
test('유효하지 않은 성적은 평균에서 제외한다', () => assert.equal(calculateAverage([...records, { subjectName: '', credit: 4, gradeValue: 1 }]), 1.78));
test('목표 내신에 필요한 잔여 평균을 계산한다', () => {
  const actual = [{ subjectName: '국어', credit: 4, gradeValue: 2 }];
  assert.equal(calculateRequiredRemainingAverage(actual, [{ subjectName: '수학', credit: 4, gradeValue: 1 }], 1.5), 1);
});
