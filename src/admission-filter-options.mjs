import {
  ADMISSION_ACADEMIC_FIELDS,
  normalizeAcademicField,
  normalizeAdmissionRecord,
  validAdmissionRecord,
} from './admission-record-normalizer.mjs';
import { isDefaultStudentVisibleAdmission } from './admission-eligibility.mjs';
import { UNIVERSITIES } from './data/universities.mjs';

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
const selectedAcademicField = (filters = {}) => filters.academicField || filters.field || '';
const itemAcademicField = (item = {}) => normalizeAcademicField(item.academicField ?? item.field);
const academicFieldMatches = (item, selected) => selected === 'other-unknown'
  ? [ADMISSION_ACADEMIC_FIELDS.OTHER, ADMISSION_ACADEMIC_FIELDS.UNKNOWN].includes(itemAcademicField(item))
  : itemAcademicField(item) === selected;
const normalizedRecordCache = new WeakMap();

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
    .filter((item) => filters.includeSpecialEligibility === true || isDefaultStudentVisibleAdmission(item));
}

function matches(item, filters = {}, ignored = []) {
  const skip = new Set(ignored);
  const academicField = selectedAcademicField(filters);
  return (
    (skip.has('region') || !filters.region || normalizeAdmissionRegion(item.region) === normalizeAdmissionRegion(filters.region))
    && (skip.has('university') || !filters.university || item.university === filters.university)
    && (skip.has('academicField') || !academicField || academicFieldMatches(item, academicField))
    && (skip.has('department') || !filters.department || item.department === filters.department)
    && (skip.has('admissionName') || !filters.admissionName || item.admissionName === filters.admissionName)
    && (skip.has('admissionType') || !filters.admissionType || item.admissionType === filters.admissionType)
    && (skip.has('admissionCategory') || !filters.admissionCategory || item.admissionCategory === filters.admissionCategory)
    && (skip.has('category') || !filters.category || item.admissionCategory === filters.category)
    && (skip.has('eligibilityType') || !filters.eligibilityType || item.eligibilityType === filters.eligibilityType)
  );
}

/** 실제 결과 조회용 필터. 선택지 계산과 분리해 같은 규칙을 독립적으로 검증한다. */
export function filterAdmissionRecords(data, filters = {}) {
  return visibleRecords(data, filters).filter((item) => matches(item, filters));
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
  const entries = masterUniversities(universities)
    .filter((item) => !selectedRegion || item.region === selectedRegion);
  return uniqueSorted(entries.map((item) => item.name));
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

/** 대학을 고른 경우에만 짧은 select 목록을 제공한다. 전국 검색은 searchAvailableDepartments를 사용한다. */
export function getAvailableDepartments(data, filters = {}) {
  if (!filters.university) return [];
  return uniqueSorted(departmentRecords(data, filters).map((item) => item.department));
}

export function searchAvailableDepartments(data, filters = {}, query = '', { limit = 50 } = {}) {
  const needle = String(query).normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s/g, '');
  if (!needle) return [];
  const departments = new Map();
  departmentRecords(data, filters).forEach((item) => {
    const metadata = departmentSearchMetadata(item);
    const haystack = `${metadata.normalizedMajorKeyword} ${metadata.majorSearchGroup ?? ''}`.toLocaleLowerCase('ko-KR').replace(/\s/g, '');
    if (haystack.includes(needle) && !departments.has(item.department)) departments.set(item.department, metadata);
  });
  return [...departments.values()].sort((left, right) => koSort(left.department, right.department)).slice(0, Math.max(0, limit));
}

export function getAvailableAdmissionNames(data, filters = {}) {
  if (!filters.university) return [];
  const records = visibleRecords(data, filters).filter((item) => matches(item, filters, ['admissionName']));
  return uniqueSorted(records.map((item) => item.admissionName));
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
    university: String(filters.university ?? ''),
    field: String(selectedAcademicField(filters)),
    department: String(filters.department ?? ''),
    admissionName: String(filters.admissionName ?? ''),
    admissionCategory: String(filters.admissionCategory ?? filters.category ?? ''),
    includeSpecialEligibility: filters.includeSpecialEligibility === true,
  };

  if (next.region && !getAvailableRegions(data, next, universities).includes(next.region)) next.region = '';
  if (next.university && !getAvailableUniversities(data, { ...next, field: '', department: '', admissionName: '' }, universities).includes(next.university)) next.university = '';
  if (next.field && !getAvailableAcademicFields(data, { ...next, department: '', admissionName: '' }).includes(next.field)) next.field = '';
  if (next.department && (!next.university || !getAvailableDepartments(data, { ...next, admissionName: '' }).includes(next.department))) next.department = '';
  if (next.admissionName && !getAvailableAdmissionNames(data, next).includes(next.admissionName)) next.admissionName = '';
  if (next.admissionCategory && !getAvailableAdmissionCategories(data, next).includes(next.admissionCategory)) next.admissionCategory = '';
  return next;
}
