import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ADMISSION_REFERENCE_DATA } from '../src/admission-reference.mjs';
import {
  LOCAL_ADMISSION_SCOPES,
  canCompareWithBusanAdmissions,
  findLocalAdmissionComparisons,
  renderLocalAdmissionComparison,
} from '../src/admission-local-comparison.mjs';

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

test('수도권 교과 모집단위를 같은 학년도·70% cut의 부산 자료와 비교한다', () => {
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
  assert.deepEqual(result.results.map(({ item }) => item.university), ['부산가대학교', '부산나대학교']);
  assert.deepEqual(result.results.map(({ difference }) => difference), [-0.02, 0.03]);
  assert.ok(result.results.every(({ reference }) => reference.kind === 'cut70'));
});

test('같은 계열을 우선하고 부족할 때만 부산권 전체 자료로 보완한다', () => {
  const target = subject();
  const data = [
    target,
    subject({ universityId: 'natural-close', university: '부산자연대학교', region: '부산광역시', department: '컴퓨터공학과', academicField: 'natural', cut70Converted: 1.721 }),
    subject({ universityId: 'human-far', university: '부산인문대학교', region: '부산광역시', department: '경제학부', cut70Converted: 2.1 }),
  ];
  const result = findLocalAdmissionComparisons(target, data, { limit: 2 });
  assert.deepEqual(result.results.map(({ item }) => item.university), ['부산인문대학교', '부산자연대학교']);
  assert.equal(result.results[0].sameAcademicField, true);
  assert.equal(result.usedAcademicFieldFallback, true);
  assert.match(renderLocalAdmissionComparison(result), /같은 계열의 비교 가능한 자료가 부족/);
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
  assert.match(renderLocalAdmissionComparison(result), /비교 가능한 부산권 입결 자료가 없습니다/);
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
  assert.match(html, /서류·활동·면접/);
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
  assert.ok(result.results.length >= 1 && result.results.length <= 5);
  assert.ok(result.results.every(({ item, reference }) => item.universityInfo?.region === '부산광역시'
    && item.referenceYear === target.referenceYear
    && item.admissionCategory === target.admissionCategory
    && reference.kind === result.targetReference.kind));
});

test('학생용과 교사용 카드가 같은 공통 비교 모듈과 클릭 상태를 사용한다', () => {
  const studentApp = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const teacherApp = readFileSync(new URL('../src/teacher-consult-app.mjs', import.meta.url), 'utf8');
  for (const app of [studentApp, teacherApp]) {
    assert.match(app, /findLocalAdmissionComparisons/);
    assert.match(app, /renderLocalAdmissionComparison/);
    assert.match(app, /부산 대학으로 치면\?/);
    assert.match(app, /aria-expanded/);
  }
});
