import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMISSION_REFERENCE_DATA } from '../src/admission-reference.mjs';
import {
  LOCAL_ADMISSION_SCOPES,
  LOCAL_ADMISSION_RESULT_LIMIT,
  canCompareWithBusanAdmissions,
  findLocalAdmissionComparisons,
  renderLocalAdmissionComparison,
} from '../src/admission-local-comparison.mjs';
import { admissionMajorSimilarityTier, resolveAdmissionMajorTaxonomy } from '../src/admission-major-taxonomy.mjs';

const subject = (overrides = {}) => ({
  referenceYear: 2026,
  universityId: 'target',
  university: '서울테스트대학교',
  region: '서울특별시',
  department: '경제학과',
  admissionName: '일반전형',
  admissionCategory: '학생부교과',
  academicField: 'humanities',
  cut70Original: 3.1,
  cut70Converted: 1.72,
  cut50Original: null,
  cut50Converted: null,
  averageGradeOriginal: null,
  averageGradeConverted: null,
  studentDefaultVisible: true,
  ...overrides,
});

test('수도권 교과 모집단위를 같은 학년도·70% cut·유사 전공의 부산 자료와 비교한다', () => {
  const target = subject();
  const data = [
    target,
    subject({ universityId: 'busan-a', university: '부산가대학교', region: '부산', department: '경제금융학부', cut70Original: 3.05, cut70Converted: 1.70 }),
    subject({ universityId: 'busan-b', university: '부산나대학교', region: '부산광역시', department: '경영학부', cut70Original: 3.2, cut70Converted: 1.75 }),
    subject({ universityId: 'seoul-b', university: '서울나대학교', region: '서울특별시', department: '경제학부', cut70Converted: 1.71 }),
    subject({ universityId: 'busan-old', university: '부산과거대학교', region: '부산광역시', department: '경제학부', referenceYear: 2025, cut70Converted: 1.71 }),
  ];
  const result = findLocalAdmissionComparisons(target, data);
  assert.equal(result.available, true);
  assert.deepEqual(result.results.map(({ item }) => item.university), ['부산가대학교']);
  assert.deepEqual(result.results.map(({ difference }) => difference), [-0.02]);
  assert.ok(result.results.every(({ reference }) => reference.kind === 'cut70'));
});

test('부산권 유사 입결은 요청값과 무관하게 가장 가까운 3건까지만 제공한다', () => {
  const target = subject();
  const data = [target, ...Array.from({ length: 6 }, (_, index) => subject({
    universityId: `busan-${index}`,
    university: `부산${index}대학교`,
    region: '부산광역시',
    department: `경제${index}학과`,
    cut70Converted: 1.72 + (index + 1) / 100,
  }))];
  const result = findLocalAdmissionComparisons(target, data, { limit: 9 });
  assert.equal(LOCAL_ADMISSION_RESULT_LIMIT, 3);
  assert.equal(result.results.length, 3);
  assert.deepEqual(result.results.map(({ difference }) => difference), [0.01, 0.02, 0.03]);
});

test('같은 계열을 우선하고 부족할 때만 부산권 전체 자료로 보완한다', () => {
  const target = subject();
  const data = [
    target,
    subject({ universityId: 'natural-close', university: '부산자연대학교', region: '부산광역시', department: '컴퓨터공학과', academicField: 'natural', cut70Converted: 1.721 }),
    subject({ universityId: 'human-far', university: '부산인문대학교', region: '부산광역시', department: '경제학부', cut70Converted: 2.1 }),
  ];
  const result = findLocalAdmissionComparisons(target, data, { limit: 2 });
  assert.deepEqual(result.results.map(({ item }) => item.university), ['부산인문대학교']);
  assert.equal(result.results[0].sameAcademicField, true);
  assert.equal(result.usedAcademicFieldFallback, false);
  assert.equal(result.comparisonTier, 'major-group');
  assert.doesNotMatch(renderLocalAdmissionComparison(result), /부산권 전체/);
});

test('전공 분류표는 경제 관련 명칭을 같은 전공군, 경영·통상을 같은 세부 계열로 구분한다', () => {
  for (const department of ['경제학과', '경제금융학부', '경제통상학부', '국제경제학과', '경제무역학부']) {
    assert.equal(resolveAdmissionMajorTaxonomy({ department }).majorGroup, 'economics');
  }
  assert.equal(admissionMajorSimilarityTier({ department: '경제학과', academicField: 'humanities' }, { department: '경영학과', academicField: 'humanities' }), 'detailed-field');
  assert.equal(admissionMajorSimilarityTier({ department: '경제학과', academicField: 'humanities' }, { department: '영어문화학과', academicField: 'humanities' }), 'academic-field');
});

test('유사 전공 후보가 1~2개뿐이면 관련 없는 학과로 3개를 채우지 않는다', () => {
  const target = subject();
  const result = findLocalAdmissionComparisons(target, [
    target,
    subject({ universityId: 'econ-a', university: '부산경제대학교', region: '부산광역시', department: '경제금융학부', cut70Converted: 1.9 }),
    subject({ universityId: 'english-a', university: '부산영문대학교', region: '부산광역시', department: '영어문화학과', cut70Converted: 1.721 }),
  ]);
  assert.equal(result.comparisonTier, 'major-group');
  assert.deepEqual(result.results.map(({ item }) => item.department), ['경제금융학부']);
});

test('자유전공/무전공은 같은 계열끼리만 부산권 유사 입결을 비교한다', () => {
  const target = subject({ department: '자유전공학부', academicField: 'open-major' });
  const result = findLocalAdmissionComparisons(target, [
    target,
    subject({ universityId: 'open-a', university: '부산자유대학교', region: '부산광역시', department: '무전공학부', academicField: 'open-major', cut70Converted: 1.80 }),
    subject({ universityId: 'natural-a', university: '부산자연대학교', region: '부산광역시', department: '컴퓨터공학과', academicField: 'natural', cut70Converted: 1.721 }),
  ]);
  assert.equal(result.available, true);
  assert.equal(result.comparisonTier, 'major-group');
  assert.deepEqual(result.results.map(({ item }) => item.department), ['무전공학부']);
});

test('일반 전공의 부산권 fallback에 자유전공/무전공을 억지로 포함하지 않는다', () => {
  const target = subject({ department: '분류근거없는학과', academicField: 'unknown' });
  const result = findLocalAdmissionComparisons(target, [
    target,
    subject({ universityId: 'open-a', university: '부산자유대학교', region: '부산광역시', department: '자유전공학부', academicField: 'open-major', cut70Converted: 1.721 }),
  ]);
  assert.equal(result.available, false);
  assert.equal(result.reason, 'no-comparable-local-data');
});

test('실제 세종대학교 경제학과 비교에서는 영어 계열을 제외하고 경제 관련 모집단위만 우선한다', () => {
  const target = ADMISSION_REFERENCE_DATA.find((item) => item.university === '세종대학교'
    && item.department === '경제학과'
    && item.admissionCategory === '학생부교과'
    && item.cut70Converted === 1.35);
  assert.ok(target);
  const result = findLocalAdmissionComparisons(target, ADMISSION_REFERENCE_DATA);
  assert.equal(result.available, true);
  assert.equal(result.comparisonTier, 'major-group');
  assert.ok(result.results.length >= 1 && result.results.length <= 3);
  assert.ok(result.results.every(({ item }) => /경제/.test(item.department)));
  assert.equal(result.results.some(({ item }) => /영어|영문/.test(item.department)), false);
});

test('동일 대학·동일 모집단위 자기 비교와 다른 자료 유형은 제외한다', () => {
  const target = subject({ universityId: 'busan-target', university: '부산대상대학교', region: '부산광역시' });
  const data = [
    target,
    subject({ universityId: 'busan-target', university: '부산대상대학교', region: '부산광역시', admissionName: '지역인재전형', cut70Converted: 1.7 }),
    subject({ universityId: 'average', university: '부산평균대학교', region: '부산광역시', department: '경제학부', cut70Original: null, cut70Converted: null, averageGradeOriginal: 3.1, averageGradeConverted: 1.72 }),
  ];
  const result = findLocalAdmissionComparisons(target, data);
  assert.equal(result.available, false);
  assert.equal(result.reason, 'no-comparable-local-data');
  assert.match(renderLocalAdmissionComparison(result), /비교 가능한 부산권 입결 자료가 없어요/);
});

test('학종은 동일한 등록자 내신 자료 유형만 참고 비교하고 별도 안내를 표시한다', () => {
  const target = subject({
    admissionCategory: '학생부종합',
    cut70Original: null,
    cut70Converted: null,
    averageGradeOriginal: 3.42,
    averageGradeConverted: 2.07,
  });
  const data = [
    target,
    subject({ universityId: 'busan-average', university: '부산학종대학교', region: '부산광역시', department: '경영학과', admissionCategory: '학생부종합', cut70Original: null, cut70Converted: null, averageGradeOriginal: 3.4, averageGradeConverted: 2.05 }),
    subject({ universityId: 'busan-cut', university: '부산컷대학교', region: '부산광역시', department: '경제학부', admissionCategory: '학생부종합', cut70Original: 3.4, cut70Converted: 2.05 }),
  ];
  const result = findLocalAdmissionComparisons(target, data);
  assert.equal(result.available, true);
  assert.deepEqual(result.results.map(({ item }) => item.university), ['부산학종대학교']);
  assert.equal(result.targetReference.kind, 'average');
  const html = renderLocalAdmissionComparison(result);
  assert.match(html, /부산권 전년도 등록자 내신 참고/);
  assert.match(html, /등록자 내신 참고로만 확인/);
  assert.doesNotMatch(html, /동급 대학|OO대급|상위 대학|하위 대학/);
});

test('부산·울산·경남 확장 범위는 설정으로만 전환할 수 있다', () => {
  const target = subject();
  const ulsan = subject({ universityId: 'ulsan', university: '울산테스트대학교', region: '울산광역시', department: '경제학부' });
  assert.equal(findLocalAdmissionComparisons(target, [target, ulsan]).available, false);
  const expanded = findLocalAdmissionComparisons(target, [target, ulsan], { scope: LOCAL_ADMISSION_SCOPES.BUSAN_ULSAN_GYEONGNAM });
  assert.equal(expanded.available, true);
  assert.equal(expanded.scopeLabel, '부산·울산·경남권');
});

test('원본 또는 환산값이 없으면 임의 추정하지 않고 비교 버튼 대상에서 제외한다', () => {
  assert.equal(canCompareWithBusanAdmissions(subject({ cut70Converted: null })), false);
  assert.equal(canCompareWithBusanAdmissions(subject({ cut70Original: null })), false);
  assert.equal(canCompareWithBusanAdmissions(subject()), true);
});

test('실제 전국 데이터의 비교 결과는 부산 메타데이터와 같은 지표 종류를 지킨다', () => {
  const target = ADMISSION_REFERENCE_DATA.find((item) => item.region !== '부산광역시'
    && item.studentDefaultVisible
    && item.admissionCategory === '학생부교과'
    && item.cut70Original != null
    && item.cut70Converted != null);
  assert.ok(target);
  const result = findLocalAdmissionComparisons(target, ADMISSION_REFERENCE_DATA);
  assert.equal(result.available, true);
  assert.ok(result.results.length >= 1 && result.results.length <= 3);
  assert.ok(result.results.every(({ item, reference }) => item.universityInfo?.region === '부산광역시'
    && item.referenceYear === target.referenceYear
    && item.admissionCategory === target.admissionCategory
    && reference.kind === result.targetReference.kind));
});

test('비교 패널은 대상 반복 없이 3개 이하 compact 행과 짧은 안내만 렌더링한다', () => {
  const target = subject();
  const result = findLocalAdmissionComparisons(target, [
    target,
    subject({ universityId: 'busan-a', university: '국립부경대학교', region: '부산광역시', department: '경제학부', cut70Converted: 1.74 }),
  ]);
  const html = renderLocalAdmissionComparison(result);
  assert.doesNotMatch(html, /local-admission-target|>대상</);
  assert.match(html, /학생부교과 · 전년도 70% cut 기준/);
  assert.match(html, /local-admission-rank/);
  assert.match(html, /대학의 서열이 아닌 전년도 입결 기준 참고예요/);
  assert.equal((html.match(/<li>/g) ?? []).length, 1);
});

test('학생용과 교사용 카드가 같은 공통 비교 모듈과 클릭 상태를 사용한다', () => {
  const studentApp = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const teacherApp = readFileSync(new URL('../src/teacher-consult-app.mjs', import.meta.url), 'utf8');
  for (const app of [studentApp, teacherApp]) {
    assert.match(app, /findLocalAdmissionComparisons/);
    assert.match(app, /renderLocalAdmissionComparison/);
    assert.match(app, /부산 대학으로 치면\?/);
    assert.match(app, /isExpanded \? '접기'/);
    assert.match(app, /aria-expanded/);
  }
});
