import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIVERSITIES, UNIVERSITY_BY_NAME } from '../src/data/universities.mjs';
import { admissionResultsByRegion2026 } from '../src/admission-results/index.mjs';
import { clearAdmissionResultsCache, loadAdmissionResultsByRegion } from '../src/admission-results-loader.mjs';

test('현재 공식 확인 대학 기본정보는 입시결과와 연결된다', () => {
  assert.ok(UNIVERSITIES.length >= 14);
  for (const item of Object.values(admissionResultsByRegion2026).flat()) {
    const university = UNIVERSITY_BY_NAME[item.university];
    assert.ok(university, item.university);
    assert.equal(university.region, item.region);
    assert.ok(university.adigaUrl.startsWith('https://www.adiga.kr/'));
  }
});

test('지역 데이터는 필요한 지역만 동적으로 불러온다', async () => {
  clearAdmissionResultsCache();
  assert.deepEqual(await loadAdmissionResultsByRegion('busan'), admissionResultsByRegion2026.busan);
  assert.deepEqual(await loadAdmissionResultsByRegion('incheon'), admissionResultsByRegion2026.incheon);
  assert.deepEqual(await loadAdmissionResultsByRegion('gyeonggi'), admissionResultsByRegion2026.gyeonggi);
  assert.deepEqual(await loadAdmissionResultsByRegion('seoul'), admissionResultsByRegion2026.seoul);
  assert.deepEqual(await loadAdmissionResultsByRegion('unknown'), []);
});

test('서울 공식 결과는 전형과 모집단위가 식별된 행만 중복 없이 보존한다', () => {
  const rows = admissionResultsByRegion2026.seoul;
  const keys = rows.map((item) => [item.university, item.department, item.admissionName, item.admissionCategory].join('|'));
  assert.ok(rows.length > 1_000);
  assert.equal(new Set(keys).size, rows.length);
  assert.ok(rows.every((item) => item.sourceUrl.startsWith('https://') && item.referenceYear === 2026));
  assert.ok(rows.every((item) => item.cut50Original != null || item.cut70Original != null || item.averageGradeOriginal != null));
});

test('삼육대학교 공식 평균등급은 cut과 분리된 average-only 자료로 보존된다', () => {
  const rows = admissionResultsByRegion2026.seoul.filter((item) => item.university === '삼육대학교');
  assert.equal(rows.length, 42);
  assert.equal(rows.filter((item) => item.admissionCategory === '학생부교과').length, 20);
  assert.equal(rows.filter((item) => item.admissionCategory === '학생부종합').length, 22);
  assert.ok(rows.every((item) => item.dataAvailability === 'average-only'));
  assert.ok(rows.every((item) => item.cut50Original == null && item.cut70Original == null));
  assert.ok(rows.every((item) => Number.isFinite(item.averageGradeOriginal)));
  assert.ok(rows.every((item) => item.averageGradeConverted >= 1 && item.averageGradeConverted <= 5));
  assert.equal(
    rows.find((item) => item.department === '간호학과' && item.admissionName === '학교장추천')?.averageGradeOriginal,
    1.98,
  );
  assert.equal(
    rows.find((item) => item.department === '컴퓨터공학부' && item.admissionName === 'S/W인재')?.averageGradeOriginal,
    3.8,
  );
});

test('경기 공식 결과도 원본과 환산값을 분리해 저장한다', () => {
  const rows = admissionResultsByRegion2026.gyeonggi;
  assert.ok(rows.length > 500);
  assert.ok(rows.every((item) => item.cut50Original == null || Number.isFinite(item.cut50Converted)));
  assert.ok(rows.every((item) => item.cut70Original == null || Number.isFinite(item.cut70Converted)));
});

test('인천 공식 결과는 기존 입학처 자료와 어디가 표를 함께 보존한다', () => {
  const rows = admissionResultsByRegion2026.incheon;
  assert.ok(rows.length > 200);
  assert.ok(rows.some((item) => item.dataAvailability === 'cut70-only'));
  assert.ok(rows.some((item) => item.dataAvailability === 'cut50-only'));
});

test('전국 지역별 결과는 canonical 필드와 원본·환산값을 보존한다', () => {
  const rows = Object.values(admissionResultsByRegion2026).flat();
  const keys = rows.map((item) => [item.referenceYear, item.university, item.department, item.admissionCategory, item.admissionName].join('|'));
  assert.equal(new Set(keys).size, rows.length);
  assert.ok(rows.every((item) => item.referenceYear === 2026 && item.sourceUrl));
  assert.ok(rows.every((item) => item.cut50Original == null || (item.cut50Converted >= 1 && item.cut50Converted <= 5)));
  assert.ok(rows.every((item) => item.cut70Original == null || (item.cut70Converted >= 1 && item.cut70Converted <= 5)));
  assert.ok(rows.every((item) => item.averageGradeOriginal == null || (item.averageGradeConverted >= 1 && item.averageGradeConverted <= 5)));
});

test('등록된 모든 지역 lazy loader가 동일한 지역 배열을 반환한다', async () => {
  clearAdmissionResultsCache();
  for (const [region, expected] of Object.entries(admissionResultsByRegion2026)) {
    assert.deepEqual(await loadAdmissionResultsByRegion(region), expected, region);
  }
});
