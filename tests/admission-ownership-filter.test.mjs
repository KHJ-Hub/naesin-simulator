import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ADMISSION_OWNERSHIP_LABELS,
  filterAdmissionRecords,
  getAvailableOwnershipTypes,
  getAvailableUniversities,
  reconcileAdmissionFilters,
  traceAdmissionFilterPipeline,
} from '../src/admission-filter-options.mjs';
import {
  ADMISSION_VIEW_MODES,
  getAdmissionViewFilterOptions,
  prepareAdmissionResultView,
  reconcileAdmissionViewFilters,
} from '../src/admission-result-view.mjs';
import { UNIVERSITIES } from '../src/data/universities.mjs';
import { UNIVERSITY_OWNERSHIP_2026_BY_ID, UNIVERSITY_OWNERSHIP_SOURCE_2026 } from '../src/data/university-ownership-2026.mjs';

function record(overrides = {}) {
  return {
    referenceYear: 2026,
    region: '부산광역시',
    universityId: 'pusan-national',
    university: '부산대학교',
    department: '기계공학부',
    admissionName: '학생부교과전형',
    admissionCategory: '학생부교과',
    academicField: 'natural',
    dataAvailability: 'cut70-only',
    cut70Original: 2.5,
    cut70Converted: 1.8,
    eligibilityType: 'general',
    source: '공식 입학처',
    sourceUrl: 'https://example.test/result',
    ...overrides,
  };
}

const DATA = Object.freeze([
  record(),
  record({ universityId: 'dong-a', university: '동아대학교', department: '경영학과', academicField: 'humanities', cut70Converted: 2.1 }),
  record({ universityId: 'snu', university: '서울대학교', region: '서울특별시', department: '경제학부', academicField: 'humanities', cut70Converted: 1.3 }),
  record({ universityId: 'uos', university: '서울시립대학교', region: '서울특별시', department: '도시공학과', cut70Converted: 1.6 }),
  record({ universityId: 'pusan-national', university: '부산대학교', department: '간호학과', admissionCategory: '학생부종합', admissionName: '학생부종합전형', cut70Converted: 1.9 }),
]);

const UNIVERSITY_FIXTURE = Object.freeze([
  { universityId: 'national-busan', name: '부산국립대', region: '부산광역시', ownership: 'national' },
  { universityId: 'private-busan', name: '부산사립대', region: '부산광역시', ownership: 'private' },
  { universityId: 'public-seoul', name: '서울공립대', region: '서울특별시', ownership: 'public' },
  { universityId: 'name-trap', name: '국립가짜대학교', region: '서울특별시', ownership: 'private' },
]);

test('공식 설립유형 스냅샷은 대학 마스터 전체를 canonical 값으로 덮는다', () => {
  assert.equal(UNIVERSITIES.length, 220);
  assert.equal(Object.keys(UNIVERSITY_OWNERSHIP_2026_BY_ID).length, UNIVERSITIES.length);
  assert.equal(UNIVERSITIES.filter((item) => item.ownership === 'national').length, 45);
  assert.equal(UNIVERSITIES.filter((item) => item.ownership === 'public').length, 1);
  assert.equal(UNIVERSITIES.filter((item) => item.ownership === 'private').length, 174);
  assert.equal(UNIVERSITIES.some((item) => !item.ownership), false);
  assert.equal(UNIVERSITY_OWNERSHIP_SOURCE_2026.provider, '한국대학교육협의회');
  assert.deepEqual(getAvailableOwnershipTypes(), ['national', 'public', 'private']);
  assert.deepEqual(ADMISSION_OWNERSHIP_LABELS, { national: '국립', public: '공립', private: '사립' });
});

test('전체·국립·공립·사립 필터는 대학명 추측 없이 공식 ownership으로 결과를 제한한다', () => {
  assert.equal(filterAdmissionRecords(DATA, {}).length, DATA.length);
  assert.deepEqual(filterAdmissionRecords(DATA, { ownership: 'national' }).map((item) => item.university), ['부산대학교', '서울대학교', '부산대학교']);
  assert.deepEqual(filterAdmissionRecords(DATA, { ownership: 'public' }).map((item) => item.university), ['서울시립대학교']);
  assert.deepEqual(filterAdmissionRecords(DATA, { ownership: 'private' }).map((item) => item.university), ['동아대학교']);

  const nameTrapResult = record({ universityId: 'name-trap', university: '국립가짜대학교', ownership: 'private' });
  assert.equal(filterAdmissionRecords([nameTrapResult], { ownership: 'national' }).length, 0);
  assert.equal(filterAdmissionRecords([nameTrapResult], { ownership: 'private' }).length, 1);
});

test('설립유형은 지역·계열·학과 검색·교과/학종과 동시에 적용된다', () => {
  assert.deepEqual(filterAdmissionRecords(DATA, { region: '부산', ownership: 'national', academicField: 'natural', department: '기계' }).map((item) => item.department), ['기계공학부']);
  assert.deepEqual(filterAdmissionRecords(DATA, { region: '서울', ownership: 'national', academicField: 'humanities' }).map((item) => item.department), ['경제학부']);

  const subject = prepareAdmissionResultView(DATA, {
    admissionViewMode: ADMISSION_VIEW_MODES.SUBJECT,
    filters: { ownership: 'national' },
    comparisonValue: 2,
  });
  assert.equal(subject.totalMatchedResults, 2);
  const comprehensive = prepareAdmissionResultView(DATA, {
    admissionViewMode: ADMISSION_VIEW_MODES.COMPREHENSIVE,
    filters: { ownership: 'national' },
    comparisonValue: 2,
  });
  assert.equal(comprehensive.totalMatchedResults, 1);
});

test('대학 선택지는 지역과 설립유형을 함께 적용하고 입결 0건 대학도 유지한다', () => {
  assert.deepEqual(getAvailableUniversities([], { region: '부산', ownership: 'national' }, UNIVERSITY_FIXTURE), ['부산국립대']);
  assert.deepEqual(getAvailableUniversities([], { ownership: 'public' }, UNIVERSITY_FIXTURE), ['서울공립대']);
  assert.deepEqual(getAvailableUniversities([], { ownership: 'private' }, UNIVERSITY_FIXTURE), ['국립가짜대학교', '부산사립대']);
});

test('설립유형 변경으로 맞지 않는 대학 선택은 전체 대학으로 초기화된다', () => {
  const reconciled = reconcileAdmissionFilters([], {
    region: '부산', ownership: 'national', university: '부산사립대',
  }, UNIVERSITY_FIXTURE);
  assert.equal(reconciled.ownership, 'national');
  assert.equal(reconciled.university, '');

  const viewFilters = reconcileAdmissionViewFilters(DATA, {
    admissionViewMode: ADMISSION_VIEW_MODES.SUBJECT,
    filters: { region: '부산', ownership: 'national', university: '동아대학교' },
  });
  assert.equal(viewFilters.ownership, 'national');
  assert.equal(viewFilters.university, '');
});

test('필터 파이프라인과 종속 선택지에 설립유형 단계가 포함된다', () => {
  const trace = traceAdmissionFilterPipeline(DATA, { ownership: 'national' });
  assert.equal(trace.stages.find((stage) => stage.stage === 'ownership')?.count, 3);
  const options = getAdmissionViewFilterOptions(DATA, {
    admissionViewMode: ADMISSION_VIEW_MODES.SUBJECT,
    filters: { region: '부산', ownership: 'national' },
  });
  assert.deepEqual(options.ownershipTypes, ['national', 'public', 'private']);
  assert.ok(options.universities.includes('부산대학교'));
  assert.equal(options.universities.includes('동아대학교'), false);
});

test('학생용과 교사용 화면은 같은 설립유형 필터 상태를 공통 로직에 연결한다', async () => {
  const [studentHtml, studentApp, teacherHtml, teacherApp] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../teacher-consult.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/teacher-consult-app.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(studentHtml, /id="admission-ownership"/);
  assert.match(studentApp, /'admission-ownership': 'ownership'/);
  assert.match(studentApp, /ADMISSION_OWNERSHIP_LABELS/);
  assert.match(teacherHtml, /id="consult-admission-ownership"/);
  assert.match(teacherApp, /'consult-admission-ownership': 'ownership'/);
  assert.match(teacherApp, /ADMISSION_OWNERSHIP_LABELS/);
});
