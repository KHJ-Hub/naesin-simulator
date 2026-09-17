import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAdmissionInterests, toggleAdmissionInterest } from '../src/admission-reference-store.mjs';

const interest = { referenceYear: 2026, university: '검증대학교', department: '국어교육과', admissionName: '일반전형', cut70: 1.89, comparisonScore: 1.82 };

test('관심 대학은 인쇄에 필요한 비교 정보까지 보존한다', () => {
  const [saved] = normalizeAdmissionInterests([interest]);
  assert.equal(saved.cut70Original, 1.89);
  assert.equal(saved.cut50Original, null);
  assert.equal(saved.comparisonScore, 1.82);
  assert.equal(saved.comparisonBasis, 'current');
  assert.equal(saved.admissionCategory, '');
  assert.equal(saved.averageGradeOriginal, null);
});

test('학종 평균등급은 cut으로 바꾸지 않고 관심 대학에 보존한다', () => {
  const [saved] = normalizeAdmissionInterests([{
    referenceYear: 2026,
    university: '검증대학교',
    department: '사회학과',
    admissionName: '학생부종합',
    admissionCategory: 'student-record-comprehensive',
    averageGradeOriginal: 3.21,
    averageGradeConverted: 1.94,
    comparisonReferenceType: 'average-grade',
  }]);
  assert.equal(saved.averageGradeOriginal, 3.21);
  assert.equal(saved.averageGradeConverted, 1.94);
  assert.equal(saved.cut50Original, null);
  assert.equal(saved.cut70Original, null);
  assert.equal(saved.comparisonReferenceType, 'average-grade');
});

test('같은 관심 대학은 다시 저장하면 해제한다', () => {
  assert.equal(toggleAdmissionInterest([], interest).length, 1);
  assert.equal(toggleAdmissionInterest([interest], interest).length, 0);
});
