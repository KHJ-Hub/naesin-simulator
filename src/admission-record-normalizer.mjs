import { ADMISSION_ELIGIBILITY_TYPES, classifyAdmissionEligibility } from './admission-eligibility.mjs';
import { DEFAULT_SCHOOL_REGION, isSchoolRegionEligible, normalizeRegionalEligibility } from './admission-regional-eligibility.mjs';
import { normalizeAdmissionMajorName } from './admission-major-taxonomy.mjs?v=20260922-open-major1';

/** 전국 입시결과 파일이 공유하는 정규 스키마와 검증 규칙이다. */
export const ADMISSION_CATEGORIES = Object.freeze({
  SUBJECT: '학생부교과',
  COMPREHENSIVE: '학생부종합',
});

export const ADMISSION_DATA_AVAILABILITY = Object.freeze({
  CONFIRMED_CUT: 'confirmed-cut',
  CUT70_ONLY: 'cut70-only',
  CUT50_ONLY: 'cut50-only',
  AVERAGE_ONLY: 'average-only',
  NOT_PUBLISHED: 'not-published',
  NOT_CHECKED: 'not-checked',
  NO_RESULT: 'no-result',
});

const CATEGORY_ALIASES = Object.freeze({
  '학생부교과': ADMISSION_CATEGORIES.SUBJECT,
  'student-record-subject': ADMISSION_CATEGORIES.SUBJECT,
  '학생부종합': ADMISSION_CATEGORIES.COMPREHENSIVE,
  'student-record-comprehensive': ADMISSION_CATEGORIES.COMPREHENSIVE,
});

const AVAILABILITY_VALUES = new Set(Object.values(ADMISSION_DATA_AVAILABILITY));
const finiteOrNull = (value) => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const textOrNull = (value) => String(value ?? '').trim() || null;

export const ADMISSION_ACADEMIC_FIELDS = Object.freeze({
  HUMANITIES: 'humanities',
  NATURAL: 'natural',
  ARTS: 'arts',
  OPEN_MAJOR: 'open-major',
  OTHER: 'other',
  UNKNOWN: 'unknown',
});

const ACADEMIC_FIELD_ALIASES = Object.freeze({
  humanities: ADMISSION_ACADEMIC_FIELDS.HUMANITIES,
  '인문': ADMISSION_ACADEMIC_FIELDS.HUMANITIES,
  '인문사회': ADMISSION_ACADEMIC_FIELDS.HUMANITIES,
  '사회': ADMISSION_ACADEMIC_FIELDS.HUMANITIES,
  '교육': ADMISSION_ACADEMIC_FIELDS.HUMANITIES,
  natural: ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '자연': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '자연과학': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '공학': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '의학/보건': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '의약': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  '보건': ADMISSION_ACADEMIC_FIELDS.NATURAL,
  arts: ADMISSION_ACADEMIC_FIELDS.ARTS,
  '예체능': ADMISSION_ACADEMIC_FIELDS.ARTS,
  '예술': ADMISSION_ACADEMIC_FIELDS.ARTS,
  '체육': ADMISSION_ACADEMIC_FIELDS.ARTS,
  'open-major': ADMISSION_ACADEMIC_FIELDS.OPEN_MAJOR,
  'undeclared': ADMISSION_ACADEMIC_FIELDS.OPEN_MAJOR,
  '자유전공': ADMISSION_ACADEMIC_FIELDS.OPEN_MAJOR,
  '자율전공': ADMISSION_ACADEMIC_FIELDS.OPEN_MAJOR,
  '무전공': ADMISSION_ACADEMIC_FIELDS.OPEN_MAJOR,
  '자유전공/무전공': ADMISSION_ACADEMIC_FIELDS.OPEN_MAJOR,
  other: ADMISSION_ACADEMIC_FIELDS.OTHER,
  '기타': ADMISSION_ACADEMIC_FIELDS.OTHER,
  unknown: ADMISSION_ACADEMIC_FIELDS.UNKNOWN,
  '미분류': ADMISSION_ACADEMIC_FIELDS.UNKNOWN,
});

export function normalizeAcademicField(value) {
  const normalized = String(value ?? '').trim();
  return ACADEMIC_FIELD_ALIASES[normalized] ?? ADMISSION_ACADEMIC_FIELDS.UNKNOWN;
}

// 계열 미정 성격이 모집단위명 자체에 드러난 경우에만 사용한다.
// '광역모집', '통합모집', '융합학부'만으로는 자유전공/무전공을 추정하지 않는다.
const OPEN_MAJOR_NAME_PATTERN = /(자유전공|자율전공|(?:^|[^법])무전공|자유학부|자율학부)/i;
const BROAD_MAJOR_NAME_PATTERN = /(자유전공|자율전공|(?:^|[^법])무전공|자유학부|자율학부|융합학부|융합계열|통합모집(?:단위)?)/i;

function explicitAcademicFieldFromName(name) {
  const fields = new Set();
  const isBroadMajor = BROAD_MAJOR_NAME_PATTERN.test(name);
  const parentheticalLabels = [...name.matchAll(/\(([^)]*)\)/g)].map((match) => match[1]);
  if (
    /(인문(?:사회)?(?:계열|분야|과학대학|대학|학기반|학자율|자율|자유)|문과대학)/.test(name)
    || /\((?:인문|인문계열|인문사회|인문사회계열)\)/.test(name)
  ) fields.add(ADMISSION_ACADEMIC_FIELDS.HUMANITIES);
  if (
    /(자연(?:과학)?(?:계열|분야|과학대학|대학|자율|자유)|이공계열|공학계열|공과대학|이과대학)/.test(name)
    || /\((?:자연|자연계열|자연과학|자연과학계열|이공|이공계열|공학|공학계열)\)/.test(name)
  ) fields.add(ADMISSION_ACADEMIC_FIELDS.NATURAL);
  if (
    /(예체능(?:계열|분야|전공)|예술계열|체육계열)/.test(name)
    || /\((?:예체능|예체능계열|예술|예술계열|체육|체육계열)\)/.test(name)
    || (isBroadMajor && /문화예술/.test(name))
  ) fields.add(ADMISSION_ACADEMIC_FIELDS.ARTS);
  parentheticalLabels.forEach((label) => {
    if (/인문/.test(label)) fields.add(ADMISSION_ACADEMIC_FIELDS.HUMANITIES);
    if (/(자연|이공|공학)/.test(label)) fields.add(ADMISSION_ACADEMIC_FIELDS.NATURAL);
    if (/(예체능|예술|체육)/.test(label)) fields.add(ADMISSION_ACADEMIC_FIELDS.ARTS);
  });
  return Object.freeze({
    academicField: fields.size === 1 ? [...fields][0] : ADMISSION_ACADEMIC_FIELDS.UNKNOWN,
    hasConflict: fields.size > 1,
  });
}

function classifyBroadMajorFromClearTaxonomy(name) {
  const fields = new Set();
  if (/(디자인|미술|음악|무용|체육|스포츠|애니메이션|웹툰|뷰티|미용|예술)/i.test(name)) {
    fields.add(ADMISSION_ACADEMIC_FIELDS.ARTS);
  }
  if (/(?:^|[^전])공학/.test(name)
    || /(공과|자연과학|과학기술|산업과학|생명과학|수산과학|의과학|융합과학|첨단기술|컴퓨터|소프트웨어|인공지능|데이터|정보|전기|전자|반도체|AI|SW|IT|ICT|바이오|생명|농업|동물|산림|수산|해양|환경|모빌리티|소재|철도|의생명|보건|헬스|식품|영양|기후|항해)/i.test(name)) {
    fields.add(ADMISSION_ACADEMIC_FIELDS.NATURAL);
  }
  if (/(인문|사회과학|경상|경영|경제|비즈니스|회계|세무|금융|무역|통상|법과|법학|법무|행정|정책|정치|외교|사회복지|복지|상담|심리|교육|사범|신학|동아시아)/i.test(name)) {
    fields.add(ADMISSION_ACADEMIC_FIELDS.HUMANITIES);
  }
  if (/(군사|국방|안보|밀리터리|방위산업|경호|항공보안|조리|제과|제빵|외식|장례문화산업|항공서비스|운항서비스)/i.test(name)) {
    fields.add(ADMISSION_ACADEMIC_FIELDS.OTHER);
  }
  return Object.freeze({
    academicField: fields.size === 1 ? [...fields][0] : ADMISSION_ACADEMIC_FIELDS.UNKNOWN,
    hasConflict: fields.size > 1,
  });
}

function classifyAcademicFieldFromNormalizedName(name) {
  if (!name) return ADMISSION_ACADEMIC_FIELDS.UNKNOWN;

  // 이름에 명시된 계열을 가장 먼저 사용하되, 복수 계열이 함께 적힌 경우는 단정하지 않는다.
  const explicit = explicitAcademicFieldFromName(name);
  if (explicit.hasConflict) return ADMISSION_ACADEMIC_FIELDS.UNKNOWN;
  if (explicit.academicField !== ADMISSION_ACADEMIC_FIELDS.UNKNOWN) return explicit.academicField;
  if (OPEN_MAJOR_NAME_PATTERN.test(name)) {
    const broadTaxonomy = classifyBroadMajorFromClearTaxonomy(name);
    if (broadTaxonomy.hasConflict) return ADMISSION_ACADEMIC_FIELDS.UNKNOWN;
    return broadTaxonomy.academicField === ADMISSION_ACADEMIC_FIELDS.UNKNOWN
      ? ADMISSION_ACADEMIC_FIELDS.OPEN_MAJOR
      : broadTaxonomy.academicField;
  }

  // 대학·계열명이 분명한 광역 모집단위는 세부 키워드보다 먼저 판별한다.
  if (/(인문|경상|경영|사회과학|법과)대학.*(자유|자율)|경상계열|인문과학계열|인문대학|경상학부|상경학부|법과대학|공직법무/.test(name)) return ADMISSION_ACADEMIC_FIELDS.HUMANITIES;
  if (/(공과|자연과학|과학기술|의과|첨단기술.*)대학.*(자유|자율)|공과대학|과학기술대학|자연과학대학|자연과학부|이학융합학부/.test(name)) return ADMISSION_ACADEMIC_FIELDS.NATURAL;
  if (/(예술|체육)대학.*(자유|자율)|문화산업대학\(예체능\)/.test(name)) return ADMISSION_ACADEMIC_FIELDS.ARTS;

  if (/(예술|아트|디자인|그래픽|미술|회화|조형|음악|성악|작곡|국악|관현악|무용|무예|무도|연극|영화|공연|체육|스포츠|태권도|축구|골프|애니메이션|웹툰|도예|공예|사진|뷰티|미용|방송영상|영상제작|영상학|엔터테인먼트|운동|피트니스|FineArts)/i.test(name)) return ADMISSION_ACADEMIC_FIELDS.ARTS;

  // 학문 계열과 별개의 직업·서비스 분야는 기존 기타 분류를 유지한다.
  if (/(군사|국방|안보|밀리터리|방위산업|경호|항공보안|조리|제과|제빵|외식|장례문화산업|항공서비스|운항서비스|성인학습|자유대학|인터칼리지|아너스|G커리어|Bakery&Beverage)/i.test(name)) return ADMISSION_ACADEMIC_FIELDS.OTHER;

  if (/(?:^|[^전])공학/.test(name)
    || /(컴퓨터|컴퓨팅|소프트웨어|인공지능|데이터과학|데이터사이언스|데이터정보|빅데이터|정보보호|정보보안|정보통신|정보융합|사이버보안|디지털보안|융합보안|해킹보안|스마트보안|지능형보안|지능정보|지능·데이터|지능형네트워크|지능형클라우드|사물인터넷|수리과학|수학|통계|물리|화학|생명|생물|바이오|간호|의예|의학|의과학|의료|약학|약과학|치의|한의|보건|건강관리|헬스케어|재활|작업치료|임상병리|방사선|치위생|응급구조|안경광학|건축|건설|환경|식품|영양|생활과학|농학|농산업|농업|산림|원예|축산|동물|식물|식량자원|말산업|해양|수산|지구과학|지구시스템|지질|지적학과|대기과학|천문|우주과학|스마트팜|스마트그린|기계|자동차|모빌리티|나노|소재|반도체|전기|전자|로봇|드론|무인항공|가상현실|에너지|배터리|이차전지|디스플레이|정보기술|정보시스템|ICT|IT|SW|AI|소방|방재|재난|안전|도시계획|스마트도시|스마트시티|스마트팩토리|스마트시스템과학|조경|철도|항공정비|항공운항|항해|해상운송|헬리콥터|과학컴퓨팅|과학기술|자연과학|융합과학|프런티어과학|문화재보존과학|목재|기후변화|녹색기술|탄소중립|양자|화장품과학|화장품학|푸드테크|와인사이언스|MSDE)/i.test(name)) return ADMISSION_ACADEMIC_FIELDS.NATURAL;

  if (/(국어|문예|문학|영어|영미|독어|독일|불어|프랑스|중어|중국|일어|일본|러시아|노어|스페인|포르투갈|이탈리아|네덜란드|루마니아|그리스|불가리아|세르비아|스칸디나비아|몽골|베트남|말레이|인도어|아랍|중동|태국|튀르키예|페르시아|폴란드|헝가리|체코|언어|사학|역사|고고|철학|미학|유학·동양학|종교|대순종|신학|기독교|불교|원불교|성서|법학|법무|행정|공공|정책|정치|외교|경제|경영|비즈니스|상경|회계|세무|무역|통상|금융|보험|물류|유통|마케팅|관광|부동산|사회|복지|심리|상담|아동|유아|교육|사범|인재개발|문헌정보|미디어|언론|신문방송|광고|홍보|국제|글로벌|지역학|한국학|동북아|동아시아|아시아학|아프리카|중앙아시아|인류학|문화유산|문화콘텐츠|인문문화|인문융합|인문콘텐츠|문화산업대학\(문화\)|커뮤니케이션콘텐츠|창업|벤처|리더십|소비자|경찰|청소년|지리학|지적재산권|휴먼서비스|K-콘텐츠|ELLT|리버럴아츠|Language|Business|Trade)/i.test(name)) return ADMISSION_ACADEMIC_FIELDS.HUMANITIES;

  return ADMISSION_ACADEMIC_FIELDS.UNKNOWN;
}

/** 공식 계열값이 없을 때 모집단위명만으로 명확한 경우에 한해 넓은 계열을 보완한다. */
export function analyzeAcademicFieldFromDepartment(department) {
  const rawName = String(department ?? '').replace(/\s/g, '');
  const normalizedName = normalizeAdmissionMajorName(department).replace(/\s/g, '');
  const rawExplicit = explicitAcademicFieldFromName(rawName);
  const rawField = classifyAcademicFieldFromNormalizedName(rawName);
  const academicField = classifyAcademicFieldFromNormalizedName(normalizedName);
  return Object.freeze({
    academicField,
    normalizedName,
    resolution: academicField === ADMISSION_ACADEMIC_FIELDS.UNKNOWN
      ? 'unclassified'
      : academicField === ADMISSION_ACADEMIC_FIELDS.OPEN_MAJOR
        ? 'open-major'
        : rawField === ADMISSION_ACADEMIC_FIELDS.UNKNOWN
          ? 'normalization'
          : rawExplicit.academicField !== ADMISSION_ACADEMIC_FIELDS.UNKNOWN ? 'explicit-field' : 'taxonomy',
  });
}

export function inferAcademicFieldFromDepartment(department) {
  return analyzeAcademicFieldFromDepartment(department).academicField;
}

export function normalizeAdmissionCategory(value) {
  return CATEGORY_ALIASES[String(value ?? '').trim()] ?? null;
}

/**
 * `referenceYear`를 기준 학년도 canonical field로 사용한다.
 * 이전 파일의 category/year/cut70 형태도 읽되, 원본 숫자를 변환하거나 덮어쓰지 않는다.
 */
export function normalizeAdmissionRecord(record = {}) {
  const admissionCategory = normalizeAdmissionCategory(record.admissionCategory ?? record.category);
  const legacyCategory = normalizeAdmissionCategory(record.category);
  const suppliedType = textOrNull(record.admissionType);
  const admissionType = normalizeAdmissionCategory(suppliedType) ? null : suppliedType;
  const referenceYear = Number(record.referenceYear ?? record.year);
  const suppliedAvailability = record.dataAvailability ?? record.status;
  const dataAvailability = suppliedAvailability == null
    ? ADMISSION_DATA_AVAILABILITY.NOT_CHECKED
    : AVAILABILITY_VALUES.has(suppliedAvailability) ? suppliedAvailability : null;
  const cut50Original = finiteOrNull(record.cut50Original ?? record.cut50);
  const cut70Original = finiteOrNull(record.cut70Original ?? record.cut70);
  const averageGradeOriginal = finiteOrNull(record.averageGradeOriginal ?? record.averageGrade);
  const regionalEligibility = normalizeRegionalEligibility(record.regionalEligibility);
  const regionalEligibilityConfirmed = regionalEligibility?.verified === true || record.regionalEligibilityConfirmed === true;
  const eligibility = classifyAdmissionEligibility({
    admissionName: record.admissionName,
    eligibilityType: record.eligibilityType,
    regionalEligibility,
    regionalEligibilityConfirmed,
    schoolRegion: record.schoolRegion ?? DEFAULT_SCHOOL_REGION,
  });

  return {
    ...record,
    referenceYear,
    admissionCategory,
    // category는 이전 저장본·필터와의 호환을 위한 alias다.
    category: legacyCategory ?? admissionCategory,
    admissionType,
    dataAvailability,
    cut50Original,
    cut70Original,
    cut50: cut50Original,
    cut70: cut70Original,
    cut50Converted: finiteOrNull(record.cut50Converted),
    cut70Converted: finiteOrNull(record.cut70Converted),
    averageGradeOriginal,
    averageGradeConverted: finiteOrNull(record.averageGradeConverted),
    eligibilityType: eligibility.eligibilityType,
    eligibilityVerification: String(record.eligibilityVerification ?? eligibility.eligibilityVerification),
    regionalEligibility,
    regionalEligibilityConfirmed,
    schoolRegion: String(record.schoolRegion ?? DEFAULT_SCHOOL_REGION).trim() || DEFAULT_SCHOOL_REGION,
    regionalEligibleForSchool: eligibility.eligibilityType === ADMISSION_ELIGIBILITY_TYPES.REGIONAL
      ? isSchoolRegionEligible(regionalEligibility, record.schoolRegion ?? DEFAULT_SCHOOL_REGION)
      : null,
    studentDefaultVisible: record.studentDefaultVisible === true || (record.studentDefaultVisible == null && eligibility.studentDefaultVisible),
    field: textOrNull(record.field),
    academicField: record.academicField != null || record.field != null
      ? normalizeAcademicField(record.academicField ?? record.field)
      : inferAcademicFieldFromDepartment(record.department),
    majorSearchGroup: textOrNull(record.majorSearchGroup),
    normalizedMajorKeyword: textOrNull(record.normalizedMajorKeyword),
    sourceUrl: textOrNull(record.sourceUrl),
  };
}

export function isStudentRecordSubject(item = {}) {
  return normalizeAdmissionCategory(item.admissionCategory ?? item.category) === ADMISSION_CATEGORIES.SUBJECT;
}

export function isStudentRecordComprehensive(item = {}) {
  return normalizeAdmissionCategory(item.admissionCategory ?? item.category) === ADMISSION_CATEGORIES.COMPREHENSIVE;
}

export function hasAdmissionCut(item = {}) {
  return Number.isFinite(Number(item.cut50Original)) || Number.isFinite(Number(item.cut70Original));
}

export function isComparableAdmissionRecord(item = {}) {
  return isStudentRecordSubject(item)
    && item.cut70Original != null
    && item.cut70Original !== ''
    && Number.isFinite(Number(item.cut70Original));
}

export function validateAdmissionRecord(record = {}) {
  const item = normalizeAdmissionRecord(record);
  const errors = [];
  if (!Number.isInteger(item.referenceYear)) errors.push('referenceYear');
  if (!item.admissionCategory) errors.push('admissionCategory');
  if (!Object.values(ADMISSION_ELIGIBILITY_TYPES).includes(item.eligibilityType)) errors.push('eligibilityType');
  if (item.eligibilityType === ADMISSION_ELIGIBILITY_TYPES.REGIONAL) {
    if (!item.regionalEligibility) errors.push('regionalEligibility');
    if (item.regionalEligibility?.verified && (!item.regionalEligibility.sourceUrl || item.regionalEligibility.eligibleSchoolRegions.length === 0)) errors.push('regionalEligibility-verification');
  }
  if (!textOrNull(item.university)) errors.push('university');
  if (!textOrNull(item.region)) errors.push('region');
  if (!textOrNull(item.department)) errors.push('department');
  if (!textOrNull(item.admissionName)) errors.push('admissionName');
  if (!textOrNull(item.source)) errors.push('source');
  if (!item.sourceUrl) errors.push('sourceUrl');
  if (!AVAILABILITY_VALUES.has(item.dataAvailability)) errors.push('dataAvailability');

  const inOriginalRange = (value) => value == null || (value >= 1 && value <= 9);
  const inConvertedRange = (value) => value == null || (value >= 1 && value <= 5);
  if (!inOriginalRange(item.cut50Original)) errors.push('cut50Original');
  if (!inOriginalRange(item.cut70Original)) errors.push('cut70Original');
  if (!inOriginalRange(item.averageGradeOriginal)) errors.push('averageGradeOriginal');
  if (!inConvertedRange(item.cut50Converted)) errors.push('cut50Converted');
  if (!inConvertedRange(item.cut70Converted)) errors.push('cut70Converted');
  if (!inConvertedRange(item.averageGradeConverted)) errors.push('averageGradeConverted');

  if (item.dataAvailability === ADMISSION_DATA_AVAILABILITY.CONFIRMED_CUT
    && (item.cut50Original == null || item.cut70Original == null)) errors.push('confirmed-cut-values');
  if (item.dataAvailability === ADMISSION_DATA_AVAILABILITY.CUT70_ONLY && item.cut70Original == null) errors.push('cut70-only-value');
  if (item.dataAvailability === ADMISSION_DATA_AVAILABILITY.CUT50_ONLY && item.cut50Original == null) errors.push('cut50-only-value');
  if (item.dataAvailability === ADMISSION_DATA_AVAILABILITY.AVERAGE_ONLY && item.averageGradeOriginal == null) errors.push('average-only-value');
  return errors;
}

export function validAdmissionRecord(record = {}) {
  return validateAdmissionRecord(record).length === 0;
}
