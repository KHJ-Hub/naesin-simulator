import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMISSION_REFERENCE_DATA as DATA } from '../src/admission-reference.mjs';
import {
  ADMISSION_ACADEMIC_FIELD_FILTERS, ADMISSION_SUPPORT_TYPE_OPTIONS,
  filterAdmissionRecords, getAvailableAcademicFields, getAvailableAdmissionSupportTypes,
} from '../src/admission-filter-options.mjs';
import {
  ADMISSION_VIEW_MODES, getAdmissionViewFilterOptions, reconcileAdmissionViewFilters, prepareAdmissionResultView,
} from '../src/admission-result-view.mjs';

const school = { schoolRegion: '부산광역시', schoolGender: 'male' };
const subject = ADMISSION_VIEW_MODES.SUBJECT;
const cases = [
  ['A 전국 인문', { field: 'humanities' }],
  ['B 전국 자연', { field: 'natural' }],
  ['C 전국 학교장추천', { supportType: 'school-recommendation' }],
  ['D 전국 지역인재', { supportType: 'regional' }],
  ['E 전국 자연 학교장추천', { field: 'natural', supportType: 'school-recommendation' }],
  ['F 부산 전체 지원유형', { region: '부산광역시' }],
  ['G 부산 지역인재', { region: '부산광역시', supportType: 'regional' }],
  ['H 국립 단독', { ownership: 'national' }],
  ['I 대학 단독', { university: '부산대학교' }],
  ['J 학과검색 단독', { department: '간호' }],
  ['전국 자연 지역인재', { field: 'natural', supportType: 'regional' }],
  ['전국 국립 인문 일반', { ownership: 'national', field: 'humanities', supportType: 'general' }],
  ['대학과 간호 자유검색', { university: '부산대학교', department: '간호' }],
];

for (const [name, selected] of cases) {
  test(`${name}: 독립 선택을 유지하고 기존 AND 결과와 정렬을 보존한다`, () => {
    const filters = { ...school, ...selected };
    const reconciled = reconcileAdmissionViewFilters(DATA, { admissionViewMode: subject, filters });
    for (const [key, value] of Object.entries(selected)) assert.equal(reconciled[key], value);
    const expected = filterAdmissionRecords(DATA, { ...filters, admissionCategory: '학생부교과' });
    assert.ok(expected.length > 0);
    const view = prepareAdmissionResultView(DATA, { admissionViewMode: subject, filters: reconciled, comparisonValue: 2.5 });
    const direct = prepareAdmissionResultView(DATA, { admissionViewMode: subject, filters, comparisonValue: 2.5 });
    assert.equal(view.totalMatchedResults, direct.totalMatchedResults);
    assert.deepEqual(view, direct);
  });
}

test('데이터 로딩 전·전형 방식 선택 전에도 모든 옵션을 제공하고 선택을 보존한다', () => {
  const filters = { ...school, field: 'natural', supportType: 'school-recommendation', ownership: 'national', department: '간호' };
  for (const mode of [null, subject, ADMISSION_VIEW_MODES.COMPREHENSIVE]) {
    const options = getAdmissionViewFilterOptions([], { admissionViewMode: mode, filters });
    assert.deepEqual(options.academicFields, ADMISSION_ACADEMIC_FIELD_FILTERS);
    assert.deepEqual(options.supportTypes, ADMISSION_SUPPORT_TYPE_OPTIONS);
    assert.deepEqual(options.ownershipTypes, ['national', 'public', 'private']);
    assert.ok(options.regions.includes('부산광역시'));
    assert.ok(options.universities.includes('부산대학교'));
    assert.ok(options.universities.includes('동아대학교'));
    const next = reconcileAdmissionViewFilters([], { admissionViewMode: mode, filters });
    for (const [key, value] of Object.entries(filters)) assert.equal(next[key], value);
  }
});

test('0건 조건에서도 계열·지원유형·검색어를 지우지 않고 대학만 지역 충돌 시 초기화한다', () => {
  const filters = { region: '서울특별시', university: '부산대학교', field: 'arts', ownership: 'national', supportType: 'special', department: '존재하지않는검색어' };
  const next = reconcileAdmissionViewFilters(DATA, { admissionViewMode: subject, filters });
  assert.equal(next.university, '');
  for (const key of ['region', 'field', 'ownership', 'supportType', 'department']) assert.equal(next[key], filters[key]);
  const options = getAdmissionViewFilterOptions(DATA, { admissionViewMode: subject, filters: next });
  assert.ok(options.universities.includes('서울대학교'));
  assert.ok(!options.universities.includes('부산대학교'));
  assert.deepEqual(getAvailableAcademicFields([], filters), ADMISSION_ACADEMIC_FIELD_FILTERS);
  assert.deepEqual(getAvailableAdmissionSupportTypes([], filters), ADMISSION_SUPPORT_TYPE_OPTIONS);
});

function permutations(values) {
  if (!values.length) return [[]];
  return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest]));
}

test('K 지역·계열·지원유형·설립유형 24가지 선택 순서의 최종 결과가 같다', () => {
  const selected = { region: '부산광역시', field: 'natural', supportType: 'regional', ownership: 'national' };
  for (const mode of [subject, ADMISSION_VIEW_MODES.COMPREHENSIVE]) {
    const direct = prepareAdmissionResultView(DATA, { admissionViewMode: mode, filters: { ...school, ...selected }, comparisonValue: 2.5 });
    assert.ok(direct.totalMatchedResults > 0);
    for (const order of permutations(Object.keys(selected))) {
      let filters = { ...school };
      for (const key of order) filters = reconcileAdmissionViewFilters(DATA, { admissionViewMode: mode, filters: { ...filters, [key]: selected[key] } });
      assert.deepEqual(prepareAdmissionResultView(DATA, { admissionViewMode: mode, filters, comparisonValue: 2.5 }), direct);
    }
  }
});
