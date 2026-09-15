import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIVERSITIES, UNIVERSITY_BY_NAME } from '../src/data/universities.mjs';
import { admissionResultsByRegion2026 } from '../src/admission-results/index.mjs';
import { clearAdmissionResultsCache, loadAdmissionResultsByRegion } from '../src/admission-results-loader.mjs';

test('현재 공식 확인 대학 기본정보는 입시결과와 연결된다', () => {
  assert.equal(UNIVERSITIES.length, 13);
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
  assert.deepEqual(await loadAdmissionResultsByRegion('unknown'), []);
});
