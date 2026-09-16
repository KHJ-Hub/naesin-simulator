import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMISSION_REFERENCE_DATA } from '../src/admission-reference.mjs';
import {
  ADMISSION_REGION_ORDER,
  getAvailableUniversities,
  normalizeAdmissionRegion,
} from '../src/admission-filter-options.mjs';
import {
  ADIGA_UNIVERSITIES_2026,
  UNIVERSITIES,
} from '../src/data/universities.mjs';
import {
  auditUniversityCatalog,
  findDuplicateUniversities,
} from '../src/data/university-catalog-audit.mjs';

const NATIONAL_AUDIT = auditUniversityCatalog({
  officialUniversities: ADIGA_UNIVERSITIES_2026,
  universities: UNIVERSITIES,
  admissionResults: ADMISSION_REFERENCE_DATA,
});

test('전국 모든 지역에서 마스터 등록 대학 수와 드롭다운 노출 수가 일치한다', () => {
  NATIONAL_AUDIT.byRegion.forEach((region) => {
    assert.equal(region.dropdownUniversityCount, region.registeredUniversityCount, region.region);
    assert.equal(region.missingFromDropdown.length, 0, region.region);
  });
  assert.equal(NATIONAL_AUDIT.totals.registeredUniversityCount, NATIONAL_AUDIT.totals.dropdownUniversityCount);
});

test('대학어디가 2026 스냅샷의 전국 대학이 모두 마스터에 연결된다', () => {
  assert.equal(NATIONAL_AUDIT.totals.officialUniversityCount, 220);
  assert.equal(NATIONAL_AUDIT.totals.officialMissingFromMasterCount, 0);
  assert.deepEqual(NATIONAL_AUDIT.issues.officialMissingFromMaster, []);
});

test('지역 별칭을 17개 canonical 지역값으로 정규화한다', () => {
  assert.equal(normalizeAdmissionRegion('서울'), '서울특별시');
  assert.equal(normalizeAdmissionRegion('seoul'), '서울특별시');
  assert.equal(normalizeAdmissionRegion('부산'), '부산광역시');
  assert.equal(normalizeAdmissionRegion('busan'), '부산광역시');
  assert.equal(normalizeAdmissionRegion('강원'), '강원특별자치도');
  assert.ok(UNIVERSITIES.every((item) => ADMISSION_REGION_ORDER.includes(normalizeAdmissionRegion(item.region))));
});

test('입시결과가 0건인 대학도 해당 지역 드롭다운에 노출한다', () => {
  const fixtureUniversities = [
    { universityId: 'with-result', name: '결과대학교', region: '부산' },
    { universityId: 'without-result', name: '미확보대학교', region: 'busan' },
  ];
  const fixtureResults = [{
    universityId: 'with-result',
    university: '결과대학교',
    region: '부산광역시',
  }];
  assert.deepEqual(
    getAvailableUniversities(fixtureResults, { region: '부산광역시' }, fixtureUniversities),
    ['결과대학교', '미확보대학교'],
  );
});

test('실제 입시결과에는 universityId 누락이나 마스터 미연결 행이 없다', () => {
  assert.equal(NATIONAL_AUDIT.totals.resultWithoutUniversityIdCount, 0);
  assert.equal(NATIONAL_AUDIT.totals.resultWithoutMasterCount, 0);
  assert.equal(NATIONAL_AUDIT.totals.resultNameMismatchCount, 0);
});

test('대학 마스터 중복과 지역 불일치를 탐지한다', () => {
  assert.equal(NATIONAL_AUDIT.totals.duplicateUniversityCount, 0);
  assert.equal(NATIONAL_AUDIT.totals.regionMismatchCount, 0);

  const duplicates = findDuplicateUniversities([
    { universityId: 'same', adigaCode: '0000001', name: '중복대학교', region: '서울' },
    { universityId: 'same', adigaCode: '0000001', name: '중복대학교', region: '서울특별시' },
  ]);
  assert.ok(duplicates.some((group) => group.type === 'universityId'));
  assert.ok(duplicates.some((group) => group.type === 'adigaCode'));
  assert.ok(duplicates.some((group) => group.type === 'name-region'));
});

test('universityId가 없는 입시결과 레코드를 감사에서 탐지한다', () => {
  const audit = auditUniversityCatalog({
    officialUniversities: [{ universityId: 'official', name: '연결대학교', region: '서울특별시' }],
    universities: [{ universityId: 'master', name: '연결대학교', region: '서울특별시' }],
    admissionResults: [{ university: '연결대학교', region: '서울특별시' }],
    regions: ['서울특별시'],
  });
  assert.equal(audit.totals.resultWithoutUniversityIdCount, 1);
  assert.equal(audit.totals.resultWithoutMasterCount, 0);
});
