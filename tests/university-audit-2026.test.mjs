import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIVERSITY_AUDIT_2026, UNIVERSITY_AUDIT_SUMMARY_2026 } from '../src/data/university-audit-2026.mjs';

test('서울·경기·인천 대학은 결과 레코드와 별도로 모두 감사 대상이다', () => {
  assert.equal(UNIVERSITY_AUDIT_2026.length, 76);
  assert.ok(UNIVERSITY_AUDIT_2026.every((item) => item.referenceYear === 2026 && item.universityId && item.subjectAdmissionStatus && item.comprehensiveAdmissionStatus));
});

test('서울 공식 감사와 기존 수도권 결과 상태를 함께 연결한다', () => {
  const gachon = UNIVERSITY_AUDIT_2026.find((item) => item.universityName === '가천대학교');
  const konkuk = UNIVERSITY_AUDIT_2026.find((item) => item.universityName === '건국대학교');
  const seoul = UNIVERSITY_AUDIT_2026.find((item) => item.universityName === '서울대학교');
  assert.equal(gachon.subjectAdmissionStatus, 'confirmed-cut');
  assert.equal(konkuk.subjectAdmissionStatus, 'confirmed-cut');
  assert.equal(konkuk.comprehensiveAdmissionStatus, 'confirmed-cut');
  assert.ok(konkuk.sourceUrls.some((url) => url.includes('adiga.kr')));
  assert.equal(seoul.subjectAdmissionStatus, 'not-published');
  assert.equal(seoul.comprehensiveAdmissionStatus, 'not-published');
  assert.equal(UNIVERSITY_AUDIT_SUMMARY_2026.서울특별시.total, 43);
  assert.equal(UNIVERSITY_AUDIT_SUMMARY_2026.서울특별시.audited, 43);
});
