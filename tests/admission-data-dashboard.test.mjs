import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildAdmissionDataDashboard,
  filterAdmissionDashboardUniversities,
  loadAdmissionDashboardDataset,
} from '../src/admission-data-dashboard-core.mjs';

const universities = [
  { universityId: 'u-busan', name: '부산가대학교', region: '부산광역시', ownership: 'national', officialEstablishmentType: '국립' },
  { universityId: 'u-seoul', name: '서울나대학교', region: '서울특별시', ownership: 'private', officialEstablishmentType: '사립' },
  { universityId: 'u-empty', name: '경기다대학교', region: '경기도', ownership: 'public', officialEstablishmentType: '공립' },
];

const baseRecord = (overrides = {}) => ({
  referenceYear: 2026,
  university: '부산가대학교',
  region: '부산광역시',
  department: '경제학과',
  admissionName: '일반전형',
  admissionCategory: '학생부교과',
  academicField: 'humanities',
  dataAvailability: 'confirmed-cut',
  cut50Original: 2.1,
  cut70Original: 2.3,
  cut50Converted: 1.5,
  cut70Converted: 1.6,
  source: '공식 자료',
  sourceUrl: 'https://example.test/result',
  updatedAt: '2026-09-20',
  ...overrides,
});

test('입결 데이터 현황은 전체·교과·종합·상태·기준연도를 정확히 집계한다', () => {
  const dashboard = buildAdmissionDataDashboard([
    baseRecord(),
    baseRecord({ department: '경영학과', dataAvailability: 'cut70-only', cut50Original: null, cut50Converted: null }),
    baseRecord({ university: '서울나대학교', region: '서울특별시', department: '심리학과', admissionCategory: '학생부종합', dataAvailability: 'average-only', cut50Original: null, cut70Original: null, cut50Converted: null, cut70Converted: null, averageGradeOriginal: 2.5, averageGradeConverted: 1.7 }),
  ], universities);
  assert.equal(dashboard.summary.universityCount, 3);
  assert.equal(dashboard.summary.recordCount, 3);
  assert.equal(dashboard.summary.subjectCount, 2);
  assert.equal(dashboard.summary.comprehensiveCount, 1);
  assert.equal(dashboard.summary.statusCounts['confirmed-cut'], 1);
  assert.equal(dashboard.summary.statusCounts['cut70-only'], 1);
  assert.equal(dashboard.summary.statusCounts['average-only'], 1);
  assert.deepEqual(dashboard.summary.referenceYears, [2026]);
  assert.equal(dashboard.summary.latestUpdatedAt, '2026-09-20');
});

test('지역별·대학별 집계는 대학 metadata와 교과·종합 레코드를 분리한다', () => {
  const dashboard = buildAdmissionDataDashboard([
    baseRecord(),
    baseRecord({ admissionCategory: '학생부종합', admissionName: '종합전형', dataAvailability: 'not-published', cut50Original: null, cut70Original: null, cut50Converted: null, cut70Converted: null }),
  ], universities);
  const busan = dashboard.regionSummaries.find((item) => item.region === '부산');
  const university = dashboard.universities.find((item) => item.universityId === 'u-busan');
  assert.deepEqual({ universities: busan.universityCount, records: busan.recordCount, subject: busan.subjectCount, comprehensive: busan.comprehensiveCount }, { universities: 1, records: 2, subject: 1, comprehensive: 1 });
  assert.deepEqual({ total: university.total, subject: university.subject, comprehensive: university.comprehensive }, { total: 2, subject: 1, comprehensive: 1 });
  assert.equal(university.statusCounts['not-published'], 1);
});

test('metadata에 있지만 입결 0건인 대학과 metadata에 없는 universityId를 경고한다', () => {
  const dashboard = buildAdmissionDataDashboard([
    baseRecord({ universityId: 'unknown-id', university: '미등록대학교' }),
  ], universities);
  assert.ok(dashboard.warnings.some((item) => item.type === '입결 0건' && item.university === '경기다대학교'));
  assert.ok(dashboard.warnings.some((item) => item.type === '대학 연결 오류' && item.description.includes('unknown-id')));
});

test('전형명·기준연도·계열·필수 식별값과 환산 이상을 읽기 전용 경고로 탐지한다', () => {
  const dashboard = buildAdmissionDataDashboard([
    baseRecord({ admissionName: '', referenceYear: null, academicField: 'unknown', department: '', cut70Converted: null }),
  ], universities);
  const types = new Set(dashboard.warnings.map((item) => item.type));
  assert.ok(types.has('전형명 누락'));
  assert.ok(types.has('기준연도 누락'));
  assert.ok(types.has('계열 확인 필요'));
  assert.ok(types.has('환산값 이상'));
  assert.ok(types.has('필수 식별값 누락'));
});

test('average-only 레코드의 cut 혼용 흔적을 평균과 별개로 경고한다', () => {
  const dashboard = buildAdmissionDataDashboard([
    baseRecord({ dataAvailability: 'average-only', averageGradeOriginal: 2.4, averageGradeConverted: 1.65 }),
  ], universities);
  assert.ok(dashboard.warnings.some((item) => item.type === '평균·컷 혼용 의심'));
  assert.equal(dashboard.summary.statusCounts['average-only'], 1);
});

test('지역·설립유형·전형구분·상태·대학명 필터를 함께 적용한다', () => {
  const dashboard = buildAdmissionDataDashboard([
    baseRecord(),
    baseRecord({ university: '서울나대학교', region: '서울특별시', department: '사회학과', admissionCategory: '학생부종합', admissionName: '종합전형', dataAvailability: 'average-only', cut50Original: null, cut70Original: null, cut50Converted: null, cut70Converted: null, averageGradeOriginal: 2.5, averageGradeConverted: 1.7 }),
  ], universities);
  const filtered = filterAdmissionDashboardUniversities(dashboard.universities, {
    region: '서울', ownership: 'private', admissionCategory: '학생부종합', dataAvailability: 'average-only', query: '서울나',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].university, '서울나대학교');
  assert.equal(filtered[0].records.length, 1);
});

test('레코드가 0건이어도 기본 대학 목록은 빈 상태로 깨지지 않는다', () => {
  const dashboard = buildAdmissionDataDashboard([], universities);
  assert.equal(dashboard.summary.recordCount, 0);
  assert.equal(filterAdmissionDashboardUniversities(dashboard.universities, {}).length, 3);
  assert.equal(filterAdmissionDashboardUniversities(dashboard.universities, { admissionCategory: '학생부교과' }).length, 0);
});

test('지역 lazy load 일부 실패는 나머지 데이터를 유지하고 실패 지역을 반환한다', async () => {
  const dataset = await loadAdmissionDashboardDataset({
    regionKeys: ['busan', 'seoul'],
    loadRegion: async (region) => {
      if (region === 'seoul') throw new Error('network');
      return [baseRecord()];
    },
  });
  assert.equal(dataset.records.length, 1);
  assert.deepEqual(dataset.failures.map((item) => item.regionKey), ['seoul']);
});

test('teacher.html은 기존 기능 사이에 입결 현황 탭을 두고 최초 탭 진입 시 로드한다', async () => {
  const [html, module, styles] = await Promise.all([
    readFile(new URL('../teacher.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/teacher-admission-dashboard.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /data-teacher-main-tab="courses"[\s\S]*data-teacher-main-tab="admissions"[\s\S]*data-teacher-main-tab="feedback"/);
  assert.match(html, /data-teacher-main-view="admissions" hidden/);
  assert.match(module, /data-teacher-main-tab="admissions"[\s\S]*loadDashboard/);
  assert.match(module, /loadAdmissionDashboardDataset/);
  assert.match(module, /UNIVERSITY_PAGE_SIZE = 20/);
  assert.match(styles, /\.admission-dashboard-university/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*\.admission-dashboard-record/);
});
