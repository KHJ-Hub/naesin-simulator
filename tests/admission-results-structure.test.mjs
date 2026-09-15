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
  assert.ok(rows.every((item) => item.sourceUrl.includes('adiga.kr') && item.referenceYear === 2026));
  assert.ok(rows.every((item) => item.cut50Original != null || item.cut70Original != null || item.averageGradeOriginal != null));
});
