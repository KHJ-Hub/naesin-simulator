import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMISSION_REGION_ORDER,
  departmentSearchMetadata,
  filterAdmissionRecords,
  getAvailableAcademicFields,
  getAvailableAdmissionCategories,
  getAvailableAdmissionNames,
  getAvailableDepartments,
  getAvailableRegions,
  getAvailableUniversities,
  reconcileAdmissionFilters,
  searchAvailableDepartments,
  summarizeAdmissionAcademicFields,
  traceAdmissionFilterPipeline,
} from '../src/admission-filter-options.mjs';
import { inferAcademicFieldFromDepartment, normalizeAdmissionRecord } from '../src/admission-record-normalizer.mjs';
import { createOfficialAdmissionResult } from '../src/admission-results/admission-result-factory.mjs';
import { UNIVERSITIES } from '../src/data/universities.mjs';
import { ADMISSION_REFERENCE_DATA } from '../src/admission-reference.mjs';

test('학종 필터 파이프라인은 전형 구분과 자격 유형을 별도 단계로 추적한다', () => {
  const trace = traceAdmissionFilterPipeline(ADMISSION_REFERENCE_DATA, { admissionCategory: '학생부종합' });
  const counts = Object.fromEntries(trace.stages.map(({ stage, count }) => [stage, count]));
  assert.equal(counts['admission-category'], 6123);
  assert.equal(counts['eligibility-type'], 2413);
  assert.equal(counts['regional-eligibility'], 2084);
  assert.equal(trace.finalRecords.length, 2084);

  const pusan = traceAdmissionFilterPipeline(ADMISSION_REFERENCE_DATA, {
    admissionCategory: '학생부종합',
    region: '부산광역시',
    university: '부산대학교',
  });
  assert.equal(pusan.finalRecords.length, 69);
  assert.ok(pusan.finalRecords.every((item) => item.admissionCategory === '학생부종합' && item.university === '부산대학교'));
});

function result(overrides = {}) {
  return {
    referenceYear: 2026,
    region: '부산광역시',
    university: '부산대학교',
    department: '건축학과',
    admissionName: '교과우수전형',
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

const FIXTURE = Object.freeze([
  result(),
  result(), // 동일 레코드가 있어도 선택지는 중복되지 않아야 한다.
  result({ department: '컴퓨터공학과', admissionName: '학교장추천', eligibilityType: 'school-recommendation' }),
  result({ department: '국어국문학과', admissionName: '학생부종합일반', admissionCategory: '학생부종합', academicField: 'humanities' }),
  result({ university: '동아대학교', department: '건축공학과', admissionName: '지역인재', eligibilityType: 'general' }),
  result({ region: '서울특별시', university: '서울대학교', department: '건축학전공', admissionName: '지역균형전형' }),
]);

const UNIVERSITY_FIXTURE = Object.freeze([
  { universityId: 'pusan', name: '부산대학교', region: '부산광역시' },
  { universityId: 'donga', name: '동아대학교', region: '부산' },
  { universityId: 'busan-no-result', name: '부산미확보대학교', region: 'busan' },
  { universityId: 'seoul', name: '서울대학교', region: '서울특별시' },
  { universityId: 'pusan-duplicate', name: '부산대학교', region: '부산광역시' },
]);

const FIELD_FIXTURE = Object.freeze([
  result({ department: '국어국문학과', academicField: 'humanities' }),
  result({ department: '컴퓨터공학과', academicField: 'natural' }),
  result({ department: '회화과', academicField: 'arts' }),
  result({ department: '자율전공학부', academicField: 'other' }),
  result({ department: '미래융합학과', academicField: 'unknown' }),
]);

test('지역 선택에 따라 대학 목록을 좁히고 중복을 제거해 가나다순으로 반환한다', () => {
  assert.deepEqual(getAvailableUniversities(FIXTURE, { region: '부산광역시' }, UNIVERSITY_FIXTURE), ['동아대학교', '부산대학교', '부산미확보대학교']);
  assert.deepEqual(getAvailableUniversities(FIXTURE, { region: '서울특별시' }, UNIVERSITY_FIXTURE), ['서울대학교']);
  assert.equal(getAvailableUniversities(FIXTURE, { region: '서울특별시' }, UNIVERSITY_FIXTURE).includes('부산대학교'), false);
});

test('지역은 대학 감사에서 정의한 순서를 유지한다', () => {
  const regions = getAvailableRegions(FIXTURE, {}, UNIVERSITY_FIXTURE);
  assert.deepEqual(regions, ['서울특별시', '부산광역시']);
  assert.ok(ADMISSION_REGION_ORDER.indexOf(regions[0]) < ADMISSION_REGION_ORDER.indexOf(regions[1]));
});

test('부산대학교와 입결 레코드가 없는 대학도 대학 마스터 기준으로 노출한다', () => {
  const withoutPusanResults = FIXTURE.filter((item) => item.university !== '부산대학교');
  const universities = getAvailableUniversities(withoutPusanResults, { region: '부산' }, UNIVERSITY_FIXTURE);
  assert.ok(universities.includes('부산대학교'));
  assert.ok(universities.includes('부산미확보대학교'));
  assert.equal(universities.filter((name) => name === '부산대학교').length, 1);
});

test('실제 부산 대학 마스터에는 부산대학교가 포함된다', () => {
  const universities = getAvailableUniversities([], { region: 'busan' }, UNIVERSITIES);
  assert.ok(universities.includes('부산대학교'));
  assert.equal(universities.length, 14);
});

test('부산 남고 설정에서 여자대학교는 결과와 대학 선택지에서 제외한다', () => {
  const womenOnly = result({
    universityId: 'ewha', university: '이화여자대학교', region: '서울특별시',
    department: '국어국문학과', academicField: 'humanities',
  });
  assert.equal(filterAdmissionRecords([womenOnly], { schoolGender: 'male' }).length, 0);
  assert.equal(filterAdmissionRecords([womenOnly], { schoolGender: 'female' }).length, 1);
  const seoulForMaleSchool = getAvailableUniversities([], { region: '서울', schoolGender: 'male' }, UNIVERSITIES);
  assert.equal(seoulForMaleSchool.includes('이화여자대학교'), false);
  assert.equal(getAvailableUniversities([], { region: '서울' }, UNIVERSITIES).includes('이화여자대학교'), true);
});

test('부산과 부산대학교의 실제 academicField에서 계열 선택지를 생성한다', () => {
  assert.deepEqual(getAvailableAcademicFields(ADMISSION_REFERENCE_DATA, { region: '부산광역시' }), ['humanities', 'natural', 'arts', 'other-unknown']);
  assert.deepEqual(getAvailableAcademicFields(ADMISSION_REFERENCE_DATA, { region: '부산광역시', university: '부산대학교' }), ['humanities', 'natural', 'arts', 'other-unknown']);
});

test('대학 선택 여부와 관계없이 현재 범위의 공식 모집단위를 중복 없이 반환한다', () => {
  assert.deepEqual(getAvailableDepartments(FIXTURE, { university: '부산대학교' }), ['건축학과', '국어국문학과', '컴퓨터공학과']);
  assert.deepEqual(getAvailableDepartments(FIXTURE, {}), ['건축공학과', '건축학과', '건축학전공', '국어국문학과', '컴퓨터공학과']);
});

test('상위 지역 변경으로 무효가 된 대학·모집단위·전형명은 전체 선택으로 초기화한다', () => {
  const filters = reconcileAdmissionFilters(FIXTURE, {
    region: '서울특별시',
    university: '부산대학교',
    field: 'natural',
    department: '컴퓨터공학과',
    admissionName: '학교장추천',
    admissionCategory: '학생부교과',
  }, UNIVERSITY_FIXTURE);
  assert.equal(filters.region, '서울특별시');
  assert.equal(filters.university, '');
  assert.equal(filters.department, '');
  assert.equal(filters.admissionName, '');
});

test('상위 지역 변경으로 존재하지 않게 된 계열도 전체로 초기화한다', () => {
  const fieldRecords = [
    result({ region: '부산광역시', university: '부산대학교', department: '회화과', academicField: 'arts' }),
    result({ region: '서울특별시', university: '서울대학교', department: '국어국문학과', academicField: 'humanities' }),
    result({ region: '서울특별시', university: '서울대학교', department: '미래융합학과', academicField: undefined, field: undefined }),
  ];
  const filters = reconcileAdmissionFilters(fieldRecords, {
    region: '서울특별시',
    university: '',
    field: 'arts',
  }, UNIVERSITY_FIXTURE);
  assert.equal(filters.field, '');
  assert.deepEqual(getAvailableAcademicFields(fieldRecords, { region: '서울특별시' }), ['humanities', 'other-unknown']);
});

test('건축 검색은 명칭을 합치지 않고 관련 공식 모집단위명을 그대로 반환한다', () => {
  const originalNames = FIXTURE.map((item) => item.department);
  const matches = searchAvailableDepartments(FIXTURE, {}, '건축', { limit: 20 });
  assert.deepEqual(matches.map((item) => item.department), ['건축공학과', '건축학과', '건축학전공']);
  assert.ok(matches.every((item) => item.majorSearchGroup === '건축'));
  assert.deepEqual(FIXTURE.map((item) => item.department), originalNames);
  assert.equal(departmentSearchMetadata('건축학부').department, '건축학부');
});

test('기존 field 값은 canonical academicField로 읽되 검색 보조값과 원본 모집단위명을 보존한다', () => {
  const normalized = normalizeAdmissionRecord(result({ field: '공학', academicField: undefined, majorSearchGroup: '건축', normalizedMajorKeyword: '건축설계' }));
  assert.equal(normalized.field, '공학');
  assert.equal(normalized.academicField, 'natural');
  assert.equal(normalized.department, '건축학과');
  assert.equal(normalized.majorSearchGroup, '건축');
  assert.equal(normalized.normalizedMajorKeyword, '건축설계');
  assert.equal(inferAcademicFieldFromDepartment('컴퓨터교육과'), 'natural');
  assert.equal(inferAcademicFieldFromDepartment('체육교육과'), 'arts');
  assert.equal(inferAcademicFieldFromDepartment('자율전공학부'), 'other');
  assert.equal(inferAcademicFieldFromDepartment('경영대학자유전공학부'), 'humanities');
  assert.equal(inferAcademicFieldFromDepartment('미래융합학과'), 'unknown');
  assert.equal(inferAcademicFieldFromDepartment('데이터사이언스학과'), 'natural');
  assert.equal(inferAcademicFieldFromDepartment('방송영상학과'), 'arts');
  assert.equal(inferAcademicFieldFromDepartment('공공정책학과'), 'humanities');
});

test('계열 필터는 인문·자연·예체능과 기타/미분류 묶음을 canonical 값으로 적용한다', () => {
  assert.deepEqual(getAvailableAcademicFields(FIELD_FIXTURE, { university: '부산대학교' }), ['humanities', 'natural', 'arts', 'other-unknown']);
  assert.equal(filterAdmissionRecords(FIELD_FIXTURE, {}).length, 5);
  assert.deepEqual(filterAdmissionRecords(FIELD_FIXTURE, { field: 'humanities' }).map((item) => item.department), ['국어국문학과']);
  assert.deepEqual(filterAdmissionRecords(FIELD_FIXTURE, { field: 'natural' }).map((item) => item.department), ['컴퓨터공학과']);
  assert.deepEqual(filterAdmissionRecords(FIELD_FIXTURE, { field: 'arts' }).map((item) => item.department), ['회화과']);
  assert.deepEqual(filterAdmissionRecords(FIELD_FIXTURE, { field: 'other-unknown' }).map((item) => item.department), ['자율전공학부', '미래융합학과']);
  assert.equal(filterAdmissionRecords(FIELD_FIXTURE, { region: '서울특별시', field: 'natural' }).length, 0);
  const audit = summarizeAdmissionAcademicFields(FIELD_FIXTURE);
  assert.deepEqual(audit.counts, { humanities: 1, natural: 1, arts: 1, other: 1, unknown: 1 });
  assert.deepEqual(audit.unknownDepartments, ['미래융합학과']);
});

test('새 공식 데이터는 제공된 academicField를 저장하고 공식값을 이름 추론보다 우선한다', () => {
  const official = createOfficialAdmissionResult({
    university: '검증대학교', region: '부산광역시', department: '컴퓨터문화학과', academicField: 'humanities',
    admissionName: '일반전형', admissionCategory: '학생부교과', cut70Original: 2.5,
    sourceUrl: 'https://example.test/official', eligibilityType: 'general',
  });
  assert.equal(official.academicField, 'humanities');
  assert.equal(normalizeAdmissionRecord(official).academicField, 'humanities');
});

test('학생부교과·종합과 계열 조건이 선택지와 실제 결과에 함께 적용된다', () => {
  assert.deepEqual(getAvailableAdmissionNames(FIXTURE), ['교과우수전형', '지역균형전형', '지역인재', '학교장추천', '학생부종합일반']);
  assert.deepEqual(getAvailableDepartments(FIXTURE, { university: '부산대학교', admissionCategory: '학생부종합' }), ['국어국문학과']);
  assert.deepEqual(getAvailableAcademicFields(FIXTURE, { university: '부산대학교', admissionCategory: '학생부교과' }), ['natural']);
  assert.deepEqual(getAvailableAdmissionNames(FIXTURE, { university: '부산대학교', field: 'humanities' }), ['학생부종합일반']);
  assert.deepEqual(getAvailableAdmissionCategories(FIXTURE, { university: '부산대학교', department: '국어국문학과' }), ['학생부종합']);
  const comprehensive = filterAdmissionRecords(FIXTURE, { university: '부산대학교', admissionCategory: '학생부종합', field: 'humanities' });
  assert.equal(comprehensive.length, 1);
  assert.equal(comprehensive[0].department, '국어국문학과');
});

test('대학 미선택 상태에서도 지역·계열과 학과 검색어를 조합한다', () => {
  const economic = [
    result({ university: '부산대학교', department: '경제학부', academicField: 'humanities', majorSearchGroup: '경제' }),
    result({ university: '동아대학교', department: '경제금융학부', academicField: 'humanities', majorSearchGroup: '경제' }),
    result({ region: '서울특별시', university: '서울대학교', department: '경제학부', academicField: 'humanities', majorSearchGroup: '경제' }),
    result({ university: '부산대학교', department: '컴퓨터공학과', academicField: 'natural' }),
  ];
  assert.equal(filterAdmissionRecords(economic, { department: '경제' }).length, 3);
  assert.deepEqual(filterAdmissionRecords(economic, { region: '부산', department: '경제' }).map((item) => item.department), ['경제학부', '경제금융학부']);
  assert.equal(filterAdmissionRecords(economic, { field: 'humanities', department: '경제' }).length, 3);
  assert.deepEqual(filterAdmissionRecords(economic, { university: '부산대학교', department: '경제' }).map((item) => item.department), ['경제학부']);
  assert.deepEqual(searchAvailableDepartments(economic, { region: '부산', field: 'humanities' }, '경제').map((item) => item.department), ['경제금융학부', '경제학부']);
});

test('자동완성 선택 없이 자유 검색어를 공식 모집단위명과 보조 키워드에 부분일치시킨다', () => {
  const departments = [
    result({ university: '부산대학교', department: '경제학과', academicField: 'humanities', majorSearchGroup: '경제' }),
    result({ university: '동아대학교', department: '경제금융학부', academicField: 'humanities', normalizedMajorKeyword: '경제금융' }),
    result({ university: '서울대학교', region: '서울특별시', department: '글로벌경제학과', academicField: 'humanities' }),
    result({ university: '검증대학교', department: '글로벌비즈니스학부', academicField: 'humanities', majorSearchGroup: '경제' }),
    result({ university: '부산대학교', department: '기계공학과', academicField: 'natural' }),
    result({ university: '동아대학교', department: '전자공학과', academicField: 'natural' }),
    result({ university: '인제대학교', department: '간호학과', academicField: 'natural' }),
  ];

  assert.equal(filterAdmissionRecords(departments, { department: '경제' }).length, 4);
  assert.equal(filterAdmissionRecords(departments, { department: '공학' }).length, 2);
  assert.deepEqual(filterAdmissionRecords(departments, { department: '간호' }).map((item) => item.department), ['간호학과']);
  assert.deepEqual(filterAdmissionRecords(departments, { department: '경제학과' }).map((item) => item.department), ['경제학과', '글로벌경제학과']);
  assert.equal(filterAdmissionRecords(departments, { region: '부산', field: 'humanities', department: ' 경제 ' }).length, 3);
  assert.deepEqual(filterAdmissionRecords(departments, { university: '부산대학교', department: '공학' }).map((item) => item.department), ['기계공학과']);
  assert.equal(filterAdmissionRecords(departments, { field: 'natural', department: '공학' }).length, 2);
  assert.equal(filterAdmissionRecords(departments, { department: '   ' }).length, departments.length);
  assert.equal(filterAdmissionRecords(departments, { department: '존재하지않는학과' }).length, 0);
});

test('상위 지역이 바뀌어도 학과 검색어가 새 범위에서 유효하면 유지한다', () => {
  const economic = [
    result({ university: '부산대학교', department: '경제학부', academicField: 'humanities', majorSearchGroup: '경제' }),
    result({ region: '서울특별시', university: '서울대학교', department: '경제학부', academicField: 'humanities', majorSearchGroup: '경제' }),
  ];
  const filters = reconcileAdmissionFilters(economic, {
    region: '서울특별시', university: '', field: 'humanities', department: '경제', admissionCategory: '학생부교과',
  }, UNIVERSITY_FIXTURE);
  assert.equal(filters.department, '경제');
});
