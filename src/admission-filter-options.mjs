import {
  ADMISSION_ACADEMIC_FIELDS,
  normalizeAcademicField,
  normalizeAdmissionRecord,
  validAdmissionRecord,
} from './admission-record-normalizer.mjs?v=20260922-academic-field1';
import { ADMISSION_ELIGIBILITY_TYPES, isStudentVisibleAdmissionForSchool } from './admission-eligibility.mjs';
import { UNIVERSITIES, UNIVERSITY_BY_ID, UNIVERSITY_BY_NAME } from './data/universities.mjs';
import { normalizeUniversityOwnership } from './data/university-ownership-2026.mjs';

/** 대학 감사에서 사용하는 지역 순서를 학생 검색에도 그대로 적용한다. */
export const ADMISSION_REGION_ORDER = Object.freeze([
  '서울특별시',
  '경기도',
  '인천광역시',
  '부산광역시',
  '울산광역시',
  '경상남도',
  '대구광역시',
  '경상북도',
  '대전광역시',
  '세종특별자치시',
  '충청남도',
  '충청북도',
  '광주광역시',
  '전라남도',
  '전북특별자치도',
  '강원특별자치도',
  '제주특별자치도',
]);

export const ADMISSION_ACADEMIC_FIELD_LABELS = Object.freeze({
  [ADMISSION_ACADEMIC_FIELDS.HUMANITIES]: '인문',
  [ADMISSION_ACADEMIC_FIELDS.NATURAL]: '자연',
  [ADMISSION_ACADEMIC_FIELDS.ARTS]: '예체능',
  [ADMISSION_ACADEMIC_FIELDS.OTHER]: '기타',
  [ADMISSION_ACADEMIC_FIELDS.UNKNOWN]: '계열 미분류',
  'other-unknown': '기타/미분류',
});

export const ADMISSION_ACADEMIC_FIELD_FILTERS = Object.freeze([
  ADMISSION_ACADEMIC_FIELDS.HUMANITIES,
  ADMISSION_ACADEMIC_FIELDS.NATURAL,
  ADMISSION_ACADEMIC_FIELDS.ARTS,
  'other-unknown',
]);

export const ADMISSION_OWNERSHIP_TYPES = Object.freeze(['national', 'public', 'private']);
export const ADMISSION_OWNERSHIP_LABELS = Object.freeze({
  national: '국립',
  public: '공립',
  private: '사립',
});

const koSort = (left, right) => String(left).localeCompare(String(right), 'ko');
const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort(koSort);
const REGION_ALIASES = Object.freeze({
  서울: '서울특별시', seoul: '서울특별시',
  경기: '경기도', gyeonggi: '경기도',
  인천: '인천광역시', incheon: '인천광역시',
  부산: '부산광역시', busan: '부산광역시',
  울산: '울산광역시', ulsan: '울산광역시',
  경남: '경상남도', gyeongnam: '경상남도',
  대구: '대구광역시', daegu: '대구광역시',
  경북: '경상북도', gyeongbuk: '경상북도',
  대전: '대전광역시', daejeon: '대전광역시',
  세종: '세종특별자치시', sejong: '세종특별자치시',
  충남: '충청남도', chungnam: '충청남도',
  충북: '충청북도', chungbuk: '충청북도',
  광주: '광주광역시', gwangju: '광주광역시',
  전남: '전라남도', jeonnam: '전라남도',
  전북: '전북특별자치도', jeonbuk: '전북특별자치도',
  강원: '강원특별자치도', gangwon: '강원특별자치도',
  제주: '제주특별자치도', jeju: '제주특별자치도',
});

export function normalizeAdmissionRegion(region) {
  const value = String(region ?? '').trim();
  return REGION_ALIASES[value] ?? REGION_ALIASES[value.toLocaleLowerCase('en-US')] ?? value;
}

function masterUniversities(universities = UNIVERSITIES) {
  return universities
    .filter((item) => item && item.name)
    .map((item) => ({ ...item, region: normalizeAdmissionRegion(item.region) }));
}
function universityInfo(item = {}) {
  return item.universityInfo
    ?? UNIVERSITY_BY_ID[item.universityId]
    ?? UNIVERSITY_BY_NAME[item.university]
    ?? null;
}
function itemOwnership(item = {}) {
  return normalizeUniversityOwnership(
    item.ownership
    ?? item.universityInfo?.ownership
    ?? universityInfo(item)?.ownership
    ?? item.establishmentType,
  );
}
function genderConditionMatches(item = {}, schoolGender = '') {
  if (!schoolGender || schoolGender === 'coeducational' || schoolGender === 'female') return true;
  return universityInfo(item)?.undergraduateGender !== 'women-only';
}
const selectedAcademicField = (filters = {}) => filters.academicField || filters.field || '';
const itemAcademicField = (item = {}) => normalizeAcademicField(item.academicField ?? item.field);
const academicFieldMatches = (item, selected) => selected === 'other-unknown'
  ? [ADMISSION_ACADEMIC_FIELDS.OTHER, ADMISSION_ACADEMIC_FIELDS.UNKNOWN].includes(itemAcademicField(item))
  : itemAcademicField(item) === selected;
const normalizedRecordCache = new WeakMap();

const normalizeDepartmentSearchText = (value) => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase('ko-KR')
  .replace(/[\s·ㆍ・,()\[\]{}\-_/]/g, '');

function normalizedEntry(record) {
  if (record && typeof record === 'object' && normalizedRecordCache.has(record)) return normalizedRecordCache.get(record);
  const item = normalizeAdmissionRecord(record);
  const entry = { item, valid: validAdmissionRecord(item) };
  if (record && typeof record === 'object') normalizedRecordCache.set(record, entry);
  return entry;
}

function visibleRecords(data, filters = {}) {
  return data
    .map(normalizedEntry)
    .filter((entry) => entry.valid)
    .map((entry) => entry.item)
    .filter((item) => genderConditionMatches(item, filters.schoolGender))
    .filter((item) => filters.includeSpecialEligibility === true || isStudentVisibleAdmissionForSchool(item, { schoolRegion: filters.schoolRegion }));
}

function matches(item, filters = {}, ignored = []) {
  const skip = new Set(ignored);
  const academicField = selectedAcademicField(filters);
  return (
    (skip.has('region') || !filters.region || normalizeAdmissionRegion(item.region) === normalizeAdmissionRegion(filters.region))
    && (skip.has('ownership') || !filters.ownership || itemOwnership(item) === normalizeUniversityOwnership(filters.ownership))
    && (skip.has('university') || !filters.university || item.university === filters.university)
    && (skip.has('academicField') || !academicField || academicFieldMatches(item, academicField))
    && (skip.has('department') || !filters.department || departmentMatchesSearch(item, filters.department))
    && (skip.has('admissionName') || !filters.admissionName || item.admissionName === filters.admissionName)
    && (skip.has('admissionType') || !filters.admissionType || item.admissionType === filters.admissionType)
    && (skip.has('admissionCategory') || !filters.admissionCategory || item.admissionCategory === filters.admissionCategory)
    && (skip.has('category') || !filters.category || item.admissionCategory === filters.category)
    && (skip.has('eligibilityType') || !filters.eligibilityType || item.eligibilityType === filters.eligibilityType)
  );
}

/** 공식 모집단위명과 검색 보조 키워드를 함께 사용하되 원본 명칭은 변경하지 않는다. */
export function departmentMatchesSearch(item, query = '') {
  const needle = normalizeDepartmentSearchText(query);
  if (!needle) return true;
  const metadata = departmentSearchMetadata(item);
  return normalizeDepartmentSearchText(`${metadata.department} ${metadata.normalizedMajorKeyword} ${metadata.majorSearchGroup ?? ''}`).includes(needle);
}

/** 실제 결과 조회용 필터. 선택지 계산과 분리해 같은 규칙을 독립적으로 검증한다. */
export function filterAdmissionRecords(data, filters = {}) {
  return visibleRecords(data, filters).filter((item) => matches(item, filters));
}

/**
 * 학생 화면의 실제 필터 순서를 단계별 건수로 돌려준다.
 * 학교 공통 설정(지역·성별)과 전형 자격을 서로 다른 단계로 추적한다.
 */
export function traceAdmissionFilterPipeline(data, filters = {}) {
  const stages = [];
  const snapshot = (stage, records, applied = true) => {
    stages.push(Object.freeze({ stage, count: records.length, applied }));
    return records;
  };
  let records = snapshot('all-valid-records', data.map(normalizedEntry).filter((entry) => entry.valid).map((entry) => entry.item));
  const category = filters.admissionCategory || filters.category || '';
  records = snapshot('admission-category', category ? records.filter((item) => item.admissionCategory === category) : records, Boolean(category));
  records = snapshot('school-settings', records, Boolean(filters.schoolRegion));
  records = snapshot('gender', filters.schoolGender ? records.filter((item) => genderConditionMatches(item, filters.schoolGender)) : records, Boolean(filters.schoolGender));

  if (filters.includeSpecialEligibility !== true) {
    const generallyEligible = new Set([
      ADMISSION_ELIGIBILITY_TYPES.GENERAL,
      ADMISSION_ELIGIBILITY_TYPES.SCHOOL_RECOMMENDATION,
      ADMISSION_ELIGIBILITY_TYPES.REGIONAL,
    ]);
    records = snapshot('eligibility-type', records.filter((item) => generallyEligible.has(item.eligibilityType)));
    records = snapshot('regional-eligibility', records.filter((item) => item.eligibilityType !== ADMISSION_ELIGIBILITY_TYPES.REGIONAL || isStudentVisibleAdmissionForSchool(item, { schoolRegion: filters.schoolRegion })));
  } else {
    records = snapshot('eligibility-type', records, false);
    records = snapshot('regional-eligibility', records, false);
  }

  const filterStep = (stage, predicate, applied) => {
    records = snapshot(stage, applied ? records.filter(predicate) : records, applied);
  };
  filterStep('region', (item) => normalizeAdmissionRegion(item.region) === normalizeAdmissionRegion(filters.region), Boolean(filters.region));
  filterStep('ownership', (item) => itemOwnership(item) === normalizeUniversityOwnership(filters.ownership), Boolean(filters.ownership));
  filterStep('university', (item) => item.university === filters.university, Boolean(filters.university));
  const academicField = selectedAcademicField(filters);
  filterStep('academic-field', (item) => academicFieldMatches(item, academicField), Boolean(academicField));
  filterStep('department', (item) => departmentMatchesSearch(item, filters.department), Boolean(filters.department));
  filterStep('admission-name', (item) => item.admissionName === filters.admissionName, Boolean(filters.admissionName));
  filterStep('admission-type', (item) => item.admissionType === filters.admissionType, Boolean(filters.admissionType));
  return Object.freeze({ stages: Object.freeze(stages), finalRecords: Object.freeze(records) });
}

export function getAvailableRegions(data, filters = {}, universities = UNIVERSITIES) {
  const present = new Set(masterUniversities(universities).map((item) => item.region));
  const ordered = ADMISSION_REGION_ORDER.filter((region) => present.has(region));
  const extras = [...present].filter((region) => !ADMISSION_REGION_ORDER.includes(region)).sort(koSort);
  return [...ordered, ...extras];
}

export function getAvailableUniversities(data, filters = {}, universities = UNIVERSITIES) {
  // 대학 자체와 입시결과 공개 여부는 별개다. 대학 목록은 마스터의 지역만으로 만들고,
  // 계열·전형·자격 및 입시결과 레코드 존재 여부는 대학 선택 후 결과 조회에만 적용한다.
  const selectedRegion = normalizeAdmissionRegion(filters.region);
  const selectedOwnership = normalizeUniversityOwnership(filters.ownership);
  const entries = masterUniversities(universities)
    .filter((item) => !selectedRegion || item.region === selectedRegion)
    .filter((item) => !selectedOwnership || normalizeUniversityOwnership(item.ownership ?? item.establishmentType) === selectedOwnership)
    .filter((item) => genderConditionMatches(item, filters.schoolGender));
  return uniqueSorted(entries.map((item) => item.name));
}

export function getAvailableOwnershipTypes(universities = UNIVERSITIES) {
  const present = new Set(masterUniversities(universities)
    .map((item) => normalizeUniversityOwnership(item.ownership ?? item.establishmentType))
    .filter(Boolean));
  return ADMISSION_OWNERSHIP_TYPES.filter((ownership) => present.has(ownership));
}

export function getAvailableAcademicFields(data, filters = {}) {
  const records = visibleRecords(data, filters).filter((item) => matches(item, filters, ['academicField', 'department', 'admissionName']));
  const present = new Set(records.map(itemAcademicField));
  return ADMISSION_ACADEMIC_FIELD_FILTERS.filter((field) => field === 'other-unknown'
    ? present.has(ADMISSION_ACADEMIC_FIELDS.OTHER) || present.has(ADMISSION_ACADEMIC_FIELDS.UNKNOWN)
    : present.has(field));
}

export function departmentSearchMetadata(itemOrDepartment = {}) {
  const item = typeof itemOrDepartment === 'string' ? { department: itemOrDepartment } : itemOrDepartment;
  const department = String(item.department ?? '').trim();
  const normalizedMajorKeyword = String(item.normalizedMajorKeyword ?? department)
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s·ㆍ・,()\[\]{}\-_/]/g, '');
  const majorSearchGroup = String(item.majorSearchGroup ?? (/건축/.test(department) ? '건축' : '')).trim() || null;
  return Object.freeze({ department, normalizedMajorKeyword, majorSearchGroup });
}

function departmentRecords(data, filters = {}) {
  return visibleRecords(data, filters).filter((item) => matches(item, filters, ['department', 'admissionName']));
}

/** 현재 지역·대학·계열 범위의 공식 모집단위명 목록을 제공한다. */
export function getAvailableDepartments(data, filters = {}) {
  return uniqueSorted(departmentRecords(data, filters).map((item) => item.department));
}

export function searchAvailableDepartments(data, filters = {}, query = '', { limit = 50 } = {}) {
  const needle = normalizeDepartmentSearchText(query);
  if (!needle) return [];
  const departments = new Map();
  departmentRecords(data, filters).forEach((item) => {
    const metadata = departmentSearchMetadata(item);
    const haystack = normalizeDepartmentSearchText(`${metadata.department} ${metadata.normalizedMajorKeyword} ${metadata.majorSearchGroup ?? ''}`);
    if (haystack.includes(needle) && !departments.has(item.department)) departments.set(item.department, metadata);
  });
  return [...departments.values()].sort((left, right) => koSort(left.department, right.department)).slice(0, Math.max(0, limit));
}

/** 상위 전형 분류를 그대로 복사한 값은 하위 전형명 선택지로 사용하지 않는다. */
export function isMeaningfulAdmissionNameOption(item = {}) {
  const admissionName = String(item.admissionName ?? '').trim();
  if (!admissionName) return false;
  const compact = (value) => String(value ?? '').replace(/\s/g, '');
  const name = compact(admissionName);
  const category = compact(item.admissionCategory ?? item.category);
  const type = compact(item.admissionType);
  return name !== category && (!type || name !== type);
}

export function getAvailableAdmissionNames(data, filters = {}) {
  const records = visibleRecords(data, filters).filter((item) => matches(item, filters, ['admissionName']));
  return uniqueSorted(records.filter(isMeaningfulAdmissionNameOption).map((item) => String(item.admissionName).trim()));
}

export function getAvailableAdmissionCategories(data, filters = {}) {
  const records = visibleRecords(data, filters).filter((item) => matches(item, filters, ['admissionCategory', 'category']));
  return uniqueSorted(records.map((item) => item.admissionCategory));
}

/** 전체 데이터의 canonical 계열 분포와 검토가 필요한 고유 모집단위를 반환한다. */
export function summarizeAdmissionAcademicFields(data) {
  const counts = Object.fromEntries(Object.values(ADMISSION_ACADEMIC_FIELDS).map((field) => [field, 0]));
  const unknownDepartments = new Set();
  data.map(normalizedEntry).filter((entry) => entry.valid).forEach(({ item }) => {
    const field = itemAcademicField(item);
    counts[field] += 1;
    if (field === ADMISSION_ACADEMIC_FIELDS.UNKNOWN) unknownDepartments.add(item.department);
  });
  return Object.freeze({
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
    counts: Object.freeze({ ...counts }),
    unknownDepartments: Object.freeze([...unknownDepartments].sort(koSort)),
  });
}

/** 상위 조건 변경 뒤에도 유효한 선택은 유지하고, 범위를 벗어난 하위 선택만 전체로 되돌린다. */
export function reconcileAdmissionFilters(data, filters = {}, universities = UNIVERSITIES) {
  const next = {
    region: normalizeAdmissionRegion(filters.region),
    ownership: normalizeUniversityOwnership(filters.ownership) ?? '',
    university: String(filters.university ?? ''),
    field: String(selectedAcademicField(filters)),
    department: String(filters.department ?? ''),
    admissionName: String(filters.admissionName ?? ''),
    admissionCategory: String(filters.admissionCategory ?? filters.category ?? ''),
    includeSpecialEligibility: filters.includeSpecialEligibility === true,
    schoolRegion: String(filters.schoolRegion ?? ''),
    schoolGender: String(filters.schoolGender ?? ''),
  };

  if (next.region && !getAvailableRegions(data, next, universities).includes(next.region)) next.region = '';
  if (next.ownership && !getAvailableOwnershipTypes(universities).includes(next.ownership)) next.ownership = '';
  if (next.university && !getAvailableUniversities(data, { ...next, field: '', department: '', admissionName: '' }, universities).includes(next.university)) next.university = '';
  if (next.field && !getAvailableAcademicFields(data, { ...next, department: '', admissionName: '' }).includes(next.field)) next.field = '';
  if (next.department && !searchAvailableDepartments(data, { ...next, department: '', admissionName: '' }, next.department, { limit: 1 }).length) next.department = '';
  if (next.admissionName && !getAvailableAdmissionNames(data, next).includes(next.admissionName)) next.admissionName = '';
  if (next.admissionCategory && !getAvailableAdmissionCategories(data, next).includes(next.admissionCategory)) next.admissionCategory = '';
  return next;
}
