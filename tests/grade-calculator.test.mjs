import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAverage, calculateOverallAverage, calculateSemesterAverages, calculateSubjectGroupAverages, calculateTotalCredits, calculateRequiredRemainingAverage, validRecord, validAverageInput } from '../src/grade-calculator.mjs';

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
  assert.equal(calculateRequiredRemainingAverage(actual, [{ subjectName: '수학', credit: 4 }], 1.5), 1);
});

test('5등급제 범위를 벗어난 등급과 목표는 제외한다', () => {
  assert.equal(validRecord({ subjectName: '국어', credit: 4, gradeValue: 6 }), false);
  assert.equal(calculateRequiredRemainingAverage([{ subjectName: '국어', credit: 4, gradeValue: 2 }], [{ subjectName: '수학', credit: 4 }], 5.1), null);
});

test('성취도·P/F 전용 과목은 숫자 값이 남아 있어도 내신과 목표 계산에서 제외한다', () => {
  const grade = { semesterId: '1-1', subjectName: '공통국어1', credit: 4, gradeValue: 2, gradingType: 'grade', fiveLevelEligible: true };
  const achievement = { semesterId: '1-1', subjectName: '과학탐구실험1', credit: 1, gradeValue: 1, gradingType: 'achievement', fiveLevelEligible: false };
  const passfail = { semesterId: '1-1', subjectName: '보건', credit: 2, gradeValue: 1, gradingType: 'passfail', fiveLevelEligible: false };
  assert.equal(calculateOverallAverage([grade, achievement, passfail]), 2);
  assert.equal(calculateTotalCredits([grade, achievement, passfail]), 4);
  assert.equal(calculateRequiredRemainingAverage([grade], [
    { subjectName: '공통수학2', credit: 4, gradingType: 'grade', fiveLevelEligible: true },
    { subjectName: '체육2', credit: 2, gradingType: 'achievement', fiveLevelEligible: false },
  ], 1.5), 1);
});
test('간편 입력 평균은 1.00~5.00만 허용한다', () => {
  assert.equal(validAverageInput(1), true);
  assert.equal(validAverageInput(2.14), true);
  assert.equal(validAverageInput(0.99), false);
  assert.equal(validAverageInput(5.01), false);
});

test('5개 학기 범위에서 1학기 4.00과 목표 3.00의 단순 잔여 평균은 2.75다', () => {
  const actual = [{ semesterId: '1-1', subjectName: '1학기 평균', credit: 1, gradeValue: 4 }];
  const remaining = ['1-2', '2-1', '2-2', '3-1'].map((semesterId) => ({ semesterId, subjectName: `${semesterId} 남은 학기`, credit: 1 }));
  assert.equal(calculateRequiredRemainingAverage(actual, remaining, 3, false), 2.75);
});
