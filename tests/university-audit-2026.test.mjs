import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIVERSITY_AUDIT_2026, UNIVERSITY_AUDIT_SUMMARY_2026 } from '../src/data/university-audit-2026.mjs';

test('서울·경기·인천 73개 대학은 결과 레코드와 별도로 모두 감사 대상이다', () => {
  assert.equal(UNIVERSITY_AUDIT_2026.length, 73);
  assert.ok(UNIVERSITY_AUDIT_2026.every((item) => item.referenceYear === 2026 && item.universityId && item.subjectAdmissionStatus && item.comprehensiveAdmissionStatus));
});

test('기존 가천대 교과 결과는 감사 상태에 연결하고 미조사 대학은 not-checked로 남긴다', () => {
  const gachon = UNIVERSITY_AUDIT_2026.find((item) => item.universityName === '가천대학교');
  const konkuk = UNIVERSITY_AUDIT_2026.find((item) => item.universityName === '건국대학교');
  const seoul = UNIVERSITY_AUDIT_2026.find((item) => item.universityName === '서울대학교');
  assert.equal(gachon.subjectAdmissionStatus, 'confirmed-cut');
  assert.equal(konkuk.subjectAdmissionStatus, 'confirmed-cut');
  assert.equal(konkuk.comprehensiveAdmissionStatus, 'confirmed-cut');
  assert.ok(konkuk.sourceUrls.some((url) => url.includes('adiga.kr')));
  assert.equal(seoul.subjectAdmissionStatus, 'not-checked');
  assert.equal(seoul.comprehensiveAdmissionStatus, 'not-checked');
  assert.equal(UNIVERSITY_AUDIT_SUMMARY_2026.서울특별시.total, 40);
});
