import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMISSION_REFERENCE_DATA } from '../src/admission-reference.mjs';
import {
  ADMISSION_RESULT_PAGE_SIZE,
  ADMISSION_SUBJECT_GROUPS,
  ADMISSION_VIEW_MODES,
  classifyComprehensiveReferenceRange,
  classifySubjectAdmissionRange,
  getAdmissionViewFilterOptions,
  increaseAdmissionGroupLimit,
  interleaveAdmissionResultsByUniversity,
  groupResultsByUniversity,
  prepareAdmissionResultView,
  reconcileAdmissionViewFilters,
  resetAdmissionGroupLimits,
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

const comprehensive = (overrides = {}) => subject({
  admissionCategory: '학생부종합',
  admissionName: '종합일반',
  ...overrides,
});

const FIXTURE = [
  subject(),
  subject({ university: '나대학교', department: '경영학과', cut70Converted: 1.9 }),
  subject({ university: '다대학교', department: '컴퓨터공학과', academicField: 'natural', cut70Converted: 2.4 }),
  subject({ university: '라대학교', department: '간호학과', academicField: 'natural', cut70Converted: 1.4 }),
  comprehensive({ university: '마대학교', region: '서울특별시', department: '교육학과', cut70Converted: 2.05 }),
  subject({ university: '바대학교', department: '사회학과', dataAvailability: 'cut50-only', cut70Original: null, cut70Converted: null }),
  subject({ university: '사대학교', department: '수학과', eligibilityType: 'rural', cut70Converted: 2.01 }),
];

const subjectView = (data, options = {}) => prepareAdmissionResultView(data, {
  admissionViewMode: ADMISSION_VIEW_MODES.SUBJECT,
  comparisonValue: 2,
  ...options,
});

test('전형 방식을 고르기 전에는 결과와 하위 필터 선택지를 만들지 않는다', () => {
  const view = prepareAdmissionResultView(FIXTURE, { comparisonValue: 2 });
  const options = getAdmissionViewFilterOptions(FIXTURE);
  assert.equal(view.admissionViewMode, null);
  assert.equal(view.totalMatchedResults, 0);
  assert.deepEqual(options.regions, []);
  assert.deepEqual(options.universities, []);
});

test('학생 내신 2.00 기준 ±0.20 경계를 포함하고 등급 숫자 방향을 정확히 분류한다', () => {
  assert.equal(classifySubjectAdmissionRange(2, 1.8), ADMISSION_SUBJECT_GROUPS.SIMILAR);
  assert.equal(classifySubjectAdmissionRange(2, 1.79), ADMISSION_SUBJECT_GROUPS.HIGHER);
  assert.equal(classifySubjectAdmissionRange(2, 2.2), ADMISSION_SUBJECT_GROUPS.SIMILAR);
  assert.equal(classifySubjectAdmissionRange(2, 2.21), ADMISSION_SUBJECT_GROUPS.LOWER);
});

test('대학별 그룹은 universityId를 기준으로 묶고 기존 결과 순서를 보존한다', () => {
  const results = [
    { item: subject({ universityId: 'pusan', university: '부산대학교', department: '경영학과' }) },
    { item: subject({ universityId: 'pusan', university: '부산대학교', department: '국어국문학과' }) },
    { item: subject({ universityId: 'donga', university: '동아대학교', department: '간호학과' }) },
  ];
  const groups = groupResultsByUniversity(results);
  assert.deepEqual(groups.map(({ universityId, universityName, resultCount }) => ({ universityId, universityName, resultCount })), [
    { universityId: 'pusan', universityName: '부산대학교', resultCount: 2 },
    { universityId: 'donga', universityName: '동아대학교', resultCount: 1 },
  ]);
  assert.deepEqual(groups[0].results.map(({ item }) => item.department), ['경영학과', '국어국문학과']);
});

test('교과 모드에서만 차이를 계산하고 세 그룹별 건수를 제공한다', () => {
  const rows = [
    subject({ university: '경계상단대', cut70Converted: 1.8 }),
    subject({ university: '높은입결대', cut70Converted: 1.79 }),
    subject({ university: '경계하단대', cut70Converted: 2.2 }),
    subject({ university: '낮은입결대', cut70Converted: 2.21 }),
  ];
  const view = subjectView(rows);
  assert.equal(view.subjectSimilarCount, 2);
  assert.equal(view.subjectHigherCount, 1);
  assert.equal(view.subjectLowerCount, 1);
  assert.ok(view.visibleResults.every(({ difference, absoluteDifference }) => Number.isFinite(difference) && Number.isFinite(absoluteDifference)));
  assert.ok(view.subjectGroups.similar.universityGroups.every((group) => group.universityId && group.resultCount === group.results.length));
});

test('각 교과 그룹 안에서는 학생 내신과 가까운 순, 동률이면 대학·모집단위 가나다순이다', () => {
  const rows = [
    subject({ university: '나대학교', department: '경영학과', cut70Converted: 1.7 }),
    subject({ university: '가대학교', department: '수학과', cut70Converted: 1.79 }),
    subject({ university: '가대학교', department: '국어학과', cut70Converted: 1.79 }),
    subject({ university: '다대학교', department: '컴퓨터학과', cut70Converted: 2.4 }),
    subject({ university: '라대학교', department: '간호학과', cut70Converted: 2.21 }),
  ];
  const view = subjectView(rows);
  assert.deepEqual(view.subjectGroups.higher.visibleResults.map(({ item }) => `${item.university}|${item.department}`), [
    '가대학교|국어학과',
    '가대학교|수학과',
    '나대학교|경영학과',
  ]);
  assert.deepEqual(view.subjectGroups.lower.visibleResults.map(({ item }) => item.university), ['라대학교', '다대학교']);
});

test('학생부종합 모드는 현재·목표 내신 차이와 교과 그룹을 만들지 않는다', () => {
  const view = prepareAdmissionResultView(FIXTURE, {
    admissionViewMode: ADMISSION_VIEW_MODES.COMPREHENSIVE,
    comparisonValue: 2,
  });
  assert.equal(view.totalMatchedResults, 1);
  assert.equal(view.subjectGroups, null);
  assert.equal(view.comprehensive.visibleResults[0].difference, null);
  assert.equal(view.comprehensive.visibleResults[0].absoluteDifference, null);
});

test('학종은 전년도 등록자 내신 참고용 ±0.2 그룹과 대학별 묶음을 별도로 제공한다', () => {
  const rows = [
    comprehensive({ universityId: 'pusan', university: '부산대학교', department: '경영학과', cut70Converted: 1.8 }),
    comprehensive({ universityId: 'pusan', university: '부산대학교', department: '국어국문학과', cut70Converted: 1.79 }),
    comprehensive({ universityId: 'donga', university: '동아대학교', department: '간호학과', cut70Converted: 2.2 }),
    comprehensive({ universityId: 'donga', university: '동아대학교', department: '컴퓨터공학과', cut70Converted: 2.21 }),
  ];
  const view = prepareAdmissionResultView(rows, {
    admissionViewMode: ADMISSION_VIEW_MODES.COMPREHENSIVE,
    comparisonValue: 2,
  });
  assert.equal(classifyComprehensiveReferenceRange(2, 1.8), ADMISSION_SUBJECT_GROUPS.SIMILAR);
  assert.equal(classifyComprehensiveReferenceRange(2, 1.79), ADMISSION_SUBJECT_GROUPS.HIGHER);
  assert.equal(classifyComprehensiveReferenceRange(2, 2.2), ADMISSION_SUBJECT_GROUPS.SIMILAR);
  assert.equal(classifyComprehensiveReferenceRange(2, 2.21), ADMISSION_SUBJECT_GROUPS.LOWER);
  assert.equal(view.comprehensiveSimilarCount, 2);
  assert.equal(view.comprehensiveHigherCount, 1);
  assert.equal(view.comprehensiveLowerCount, 1);
  assert.deepEqual(view.comprehensiveReferenceGroups.similar.universityGroups.map(({ universityId, resultCount }) => ({ universityId, resultCount })), [
    { universityId: 'donga', resultCount: 1 },
    { universityId: 'pusan', resultCount: 1 },
  ]);
  assert.ok(view.comprehensiveReferenceGroups.similar.visibleResults.every((entry) => entry.difference == null && Number.isFinite(entry.referenceDifference)));
});

test('학종 첫 페이지는 한 대학의 모집단위가 독점하지 않도록 대학별로 순환 배치한다', () => {
  const rows = [
    ...Array.from({ length: 25 }, (_, index) => comprehensive({ university: '가대학교', department: `가${index}학과` })),
    ...Array.from({ length: 3 }, (_, index) => comprehensive({ university: '나대학교', department: `나${index}학과` })),
    ...Array.from({ length: 2 }, (_, index) => comprehensive({ university: '다대학교', department: `다${index}학과` })),
  ];
  const view = prepareAdmissionResultView(rows, {
    admissionViewMode: ADMISSION_VIEW_MODES.COMPREHENSIVE,
  });
  assert.deepEqual(view.comprehensive.visibleResults.slice(0, 3).map(({ item }) => item.university), ['가대학교', '나대학교', '다대학교']);
  assert.equal(new Set(view.comprehensive.visibleResults.map(({ item }) => item.university)).size, 3);
  assert.equal(interleaveAdmissionResultsByUniversity([]).length, 0);
});

test('부산 학종 첫 페이지에는 공식 데이터가 있는 부산대학교가 포함된다', () => {
  const view = prepareAdmissionResultView(ADMISSION_REFERENCE_DATA, {
    admissionViewMode: ADMISSION_VIEW_MODES.COMPREHENSIVE,
    filters: { region: '부산광역시' },
  });
  assert.ok(view.comprehensive.visibleResults.some(({ item }) => item.university === '부산대학교'));
});

test('9등급제 원본 교과 모드는 학생 내신 비교와 범위 그룹 없이 전체 원본 자료를 제공한다', () => {
  const view = subjectView(FIXTURE, { comparisonEnabled: false });
  assert.equal(view.subjectGroups, null);
  assert.equal(view.subjectSimilarCount, 0);
  assert.equal(view.subjectHigherCount, 0);
  assert.equal(view.subjectLowerCount, 0);
  assert.equal(view.totalMatchedResults, 5);
  assert.ok(view.subjectReference.visibleResults.every(({ difference, absoluteDifference, group }) => difference === null && absoluteDifference === null && group === null));
});

test('전형 모드가 바뀌면 해당 모드 데이터만으로 지역·대학 선택지를 재계산한다', () => {
  const subjectOptions = getAdmissionViewFilterOptions(FIXTURE, { admissionViewMode: ADMISSION_VIEW_MODES.SUBJECT });
  const comprehensiveOptions = getAdmissionViewFilterOptions(FIXTURE, { admissionViewMode: ADMISSION_VIEW_MODES.COMPREHENSIVE });
  assert.deepEqual(subjectOptions.regions, ['부산광역시']);
  assert.ok(subjectOptions.universities.includes('가대학교'));
  assert.equal(subjectOptions.universities.includes('마대학교'), false);
  assert.deepEqual(comprehensiveOptions.regions, ['서울특별시']);
  assert.deepEqual(comprehensiveOptions.universities, ['마대학교']);
});

test('모드 변경으로 유효하지 않은 하위 필터는 전체 선택으로 초기화한다', () => {
  const filters = reconcileAdmissionViewFilters(FIXTURE, {
    admissionViewMode: ADMISSION_VIEW_MODES.COMPREHENSIVE,
    filters: { region: '부산', university: '가대학교', field: 'natural', department: '컴퓨터공학과', admissionName: '일반전형' },
  });
  assert.equal(filters.region, '');
  assert.equal(filters.university, '');
  assert.equal(filters.field, '');
  assert.equal(filters.department, '');
  assert.equal(filters.admissionName, '');
});

test('지역·대학·계열 조건을 먼저 적용한 뒤 교과 그룹을 계산한다', () => {
  const view = subjectView(FIXTURE, {
    filters: { region: '부산', university: '다대학교', academicField: 'natural' },
  });
  assert.equal(view.totalMatchedResults, 1);
  assert.equal(view.subjectGroups.lower.visibleResults[0].item.department, '컴퓨터공학과');
});

test('각 교과 그룹은 처음 20건만 제공하고 더 보기는 선택 그룹만 20건 증가시킨다', () => {
  const rows = [
    ...Array.from({ length: 25 }, (_, index) => subject({ university: `비슷${index}대`, department: `${index}학과`, cut70Converted: 2 + index / 1000 })),
    ...Array.from({ length: 25 }, (_, index) => subject({ university: `높음${index}대`, department: `${index}학과`, cut70Converted: 1.79 - index / 100 })),
    ...Array.from({ length: 25 }, (_, index) => subject({ university: `낮음${index}대`, department: `${index}학과`, cut70Converted: 2.21 + index / 100 })),
  ];
  let limits = resetAdmissionGroupLimits();
  const first = subjectView(rows, { visibleResultLimits: limits });
  assert.equal(ADMISSION_RESULT_PAGE_SIZE, 20);
  assert.equal(first.subjectGroups.similar.visibleResults.length, 20);
  assert.equal(first.subjectGroups.higher.visibleResults.length, 20);
  assert.equal(first.subjectGroups.lower.visibleResults.length, 20);

  limits = increaseAdmissionGroupLimit(limits, ADMISSION_SUBJECT_GROUPS.HIGHER);
  const second = subjectView(rows, { visibleResultLimits: limits });
  assert.equal(second.subjectGroups.higher.visibleResults.length, 25);
  assert.equal(second.subjectGroups.similar.visibleResults.length, 20);
  assert.equal(second.subjectGroups.lower.visibleResults.length, 20);
});

test('70% cut이 없거나 기본 숨김 자격인 교과 자료는 비교 그룹에서 제외한다', () => {
  const view = subjectView(FIXTURE);
  assert.equal(view.visibleResults.some(({ item }) => item.dataAvailability === 'cut50-only'), false);
  assert.equal(view.visibleResults.some(({ item }) => item.eligibilityType === 'rural'), false);
});

test('실제 전국 데이터에서도 교과 그룹 건수 합과 전체 매칭 수가 일치한다', () => {
  const view = prepareAdmissionResultView(ADMISSION_REFERENCE_DATA, {
    admissionViewMode: ADMISSION_VIEW_MODES.SUBJECT,
    comparisonValue: 2.5,
  });
  assert.equal(view.subjectSimilarCount + view.subjectHigherCount + view.subjectLowerCount, view.totalMatchedResults);
  assert.ok(view.totalMatchedResults > 20);
  assert.equal(view.subjectGroups.similar.visibleResults.length, Math.min(20, view.subjectSimilarCount));
});
