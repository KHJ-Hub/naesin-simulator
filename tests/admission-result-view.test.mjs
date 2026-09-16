import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMISSION_REFERENCE_DATA } from '../src/admission-reference.mjs';
import {
  ADMISSION_RESULT_PAGE_SIZE,
  increaseAdmissionResultLimit,
  prepareAdmissionResultView,
  resetAdmissionResultLimit,
} from '../src/admission-result-view.mjs';

const subject = (overrides = {}) => ({
  referenceYear: 2026,
  universityId: 'fixture-university',
  region: '부산광역시',
  university: '가대학교',
  department: '국어국문학과',
  academicField: 'humanities',
  admissionName: '일반전형',
  admissionCategory: '학생부교과',
  dataAvailability: 'confirmed-cut',
  cut50Original: 3,
  cut70Original: 3.2,
  cut50Converted: 1.8,
  cut70Converted: 2.1,
  eligibilityType: 'general',
  source: '대학 공식 입학처',
  sourceUrl: 'https://example.test/result',
  ...overrides,
});

const FIXTURE = [
  subject(),
  subject({ university: '나대학교', department: '경영학과', cut70Converted: 1.9 }),
  subject({ university: '다대학교', department: '컴퓨터공학과', academicField: 'natural', cut70Converted: 2.4 }),
  subject({ university: '라대학교', department: '간호학과', academicField: 'natural', cut70Converted: 1.4 }),
  subject({ university: '마대학교', department: '교육학과', admissionCategory: '학생부종합', admissionName: '종합일반', cut70Converted: 2.05 }),
  subject({ university: '바대학교', department: '사회학과', dataAvailability: 'cut50-only', cut70Original: null, cut70Converted: null }),
  subject({ university: '사대학교', department: '수학과', eligibilityType: 'rural', cut70Converted: 2.01 }),
];

test('필터가 없으면 학생부교과 비교 가능 결과만 현재 내신과 가까운 순으로 정렬한다', () => {
  const view = prepareAdmissionResultView(FIXTURE, { comparisonValue: 2 });
  assert.equal(view.admissionCategory, '학생부교과');
  assert.deepEqual(view.visibleResults.map(({ item }) => item.university), ['가대학교', '나대학교', '다대학교', '라대학교']);
  assert.deepEqual(view.visibleResults.map(({ absoluteDifference }) => absoluteDifference), [0.1, 0.1, 0.4, 0.6]);
  assert.equal(view.visibleResults.some(({ item }) => item.admissionCategory === '학생부종합'), false);
  assert.equal(view.visibleResults.some(({ item }) => item.dataAvailability === 'cut50-only'), false);
});

test('70% cut이 null인 교과 자료는 비교 가능한 결과로 오인하지 않는다', () => {
  const view = prepareAdmissionResultView([
    subject({ dataAvailability: 'cut50-only', cut70Original: null, cut70Converted: null }),
  ], { comparisonValue: 2 });
  assert.equal(view.totalMatchedResults, 0);
});

test('동일한 절대 차이는 대학명과 모집단위 가나다순으로 정렬한다', () => {
  const rows = [
    subject({ university: '가대학교', department: '수학과', cut70Converted: 2.1 }),
    subject({ university: '가대학교', department: '국어학과', cut70Converted: 1.9 }),
    subject({ university: '나대학교', department: '경영학과', cut70Converted: 2.1 }),
  ];
  const view = prepareAdmissionResultView(rows, { comparisonValue: 2 });
  assert.deepEqual(view.visibleResults.map(({ item }) => `${item.university}|${item.department}`), [
    '가대학교|국어학과',
    '가대학교|수학과',
    '나대학교|경영학과',
  ]);
});

test('현재 내신과 목표 내신 비교값에 따라 가까운 결과 순서가 달라진다', () => {
  const current = prepareAdmissionResultView(FIXTURE, { comparisonValue: 2 });
  const target = prepareAdmissionResultView(FIXTURE, { comparisonValue: 1.5 });
  assert.equal(current.visibleResults[0].item.university, '가대학교');
  assert.equal(target.visibleResults[0].item.university, '라대학교');
});

test('지역·대학·계열 조건을 적용한 범위 안에서만 교과 결과를 정렬한다', () => {
  const view = prepareAdmissionResultView(FIXTURE, {
    comparisonValue: 2,
    filters: { region: '부산', university: '다대학교', academicField: 'natural' },
  });
  assert.equal(view.totalMatchedResults, 1);
  assert.equal(view.visibleResults[0].item.department, '컴퓨터공학과');
});

test('학생부종합은 내신 차이를 계산하지 않고 참고 자료로만 정렬한다', () => {
  const view = prepareAdmissionResultView(FIXTURE, {
    comparisonValue: 2,
    filters: { admissionCategory: '학생부종합' },
  });
  assert.equal(view.totalMatchedResults, 1);
  assert.equal(view.visibleResults[0].difference, null);
  assert.equal(view.visibleResults[0].absoluteDifference, null);
  assert.equal(view.visibleResults[0].item.university, '마대학교');
});

test('처음 20건만 반환하고 더 보기는 20건씩 증가하며 초기화하면 20건으로 돌아간다', () => {
  const rows = Array.from({ length: 45 }, (_, index) => subject({
    university: `${String(index + 1).padStart(2, '0')}대학교`,
    department: `${index + 1}학과`,
    cut70Converted: 2 + index / 100,
  }));
  let limit = resetAdmissionResultLimit();
  const first = prepareAdmissionResultView(rows, { comparisonValue: 2, visibleResultLimit: limit });
  assert.equal(ADMISSION_RESULT_PAGE_SIZE, 20);
  assert.equal(first.totalMatchedResults, 45);
  assert.equal(first.visibleResults.length, 20);
  assert.equal(first.hasMore, true);

  limit = increaseAdmissionResultLimit(limit);
  const second = prepareAdmissionResultView(rows, { comparisonValue: 2, visibleResultLimit: limit });
  assert.equal(second.visibleResults.length, 40);
  assert.equal(second.visibleResultLimit, 40);

  limit = increaseAdmissionResultLimit(limit);
  const third = prepareAdmissionResultView(rows, { comparisonValue: 2, visibleResultLimit: limit });
  assert.equal(third.visibleResults.length, 45);
  assert.equal(third.hasMore, false);
  assert.equal(resetAdmissionResultLimit(), 20);
});

test('실제 전국 데이터도 기본 교과 결과를 20건만 준비한다', () => {
  const view = prepareAdmissionResultView(ADMISSION_REFERENCE_DATA, { comparisonValue: 2.5 });
  assert.ok(view.totalMatchedResults > 20);
  assert.equal(view.visibleResults.length, 20);
  assert.ok(view.visibleResults.every(({ item, absoluteDifference }) => item.admissionCategory === '학생부교과' && Number.isFinite(absoluteDifference)));
});
