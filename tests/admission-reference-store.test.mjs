import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAdmissionInterests, toggleAdmissionInterest } from '../src/admission-reference-store.mjs';

const interest = { referenceYear: 2026, university: '검증대학교', department: '국어교육과', admissionName: '일반전형', cut70: 1.89, comparisonScore: 1.82 };

test('관심 대학은 인쇄에 필요한 비교 정보까지 보존한다', () => {
  const [saved] = normalizeAdmissionInterests([interest]);
  assert.deepEqual(saved, { ...interest, admissionType: '', category: '', comparisonBasis: 'current' });
});

test('같은 관심 대학은 다시 저장하면 해제한다', () => {
  assert.equal(toggleAdmissionInterest([], interest).length, 1);
  assert.equal(toggleAdmissionInterest([interest], interest).length, 0);
});
