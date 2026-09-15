/** 우리 학교의 기본 소재지. 지역인재는 이 값과 공식 지원자격을 함께 확인한다. */
export const DEFAULT_SCHOOL_REGION = '부산';

const BUSAN_ULSAN_GYEONGNAM = Object.freeze(['부산', '울산', '경남']);
const CHECKED_AT = '2026-09-15';

const eligibility = (requirementSummary, sourceUrl) => Object.freeze({
  eligibleRegions: BUSAN_ULSAN_GYEONGNAM,
  eligibleSchoolRegions: BUSAN_ULSAN_GYEONGNAM,
  requirementSummary,
  sourceUrl,
  verified: true,
  checkedAt: CHECKED_AT,
});

// 공식 모집요강 또는 어디가의 해당 학년도 전형 안내에서 확인한 대학·전형 단위 지원자격이다.
const REGIONAL_ELIGIBILITY_BY_ADMISSION = Object.freeze({
  '울산대학교|학생부교과(지역교과 전형)': eligibility('부산·울산·경남 지역 고등학교에서 입학일부터 졸업(예정)일까지 전 교육과정을 이수한 졸업(예정)자입니다.', 'https://iphak.ulsan.ac.kr/upload/board/2025/08/05/a7ad7cde-71a3-41ba-9792-d04416e56e1c.pdf'),
  '경상국립대학교|학생부교과(지역인재전형)': eligibility('경남·부산·울산 지역 소재 고등학교에서 입학부터 졸업(예정)까지 전 과정을 이수한 졸업(예정)자입니다.', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2026&unvCd=0000007'),
  '국립부경대학교|학생부교과(지역혁신인재)': eligibility('부산광역시·울산광역시·경상남도 지역 소재 고등학교에서 입학일부터 졸업일까지 전 교육과정을 이수한 졸업(예정)자입니다.', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2026&unvCd=0000013'),
  '동아대학교|학생부교과(지역인재교과전형)': eligibility('부산·울산·경남 지역 소재 고등학교 교육과정을 입학일부터 졸업일까지 이수한 졸업(예정)자입니다.', 'https://ent.donga.ac.kr/upload/entrance_guide.pdf'),
  '고신대학교|학생부교과(지역인재전형)': eligibility('부산·울산·경남 소재 고등학교 전 교육과정을 이수(예정)한 학생입니다.', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2026&unvCd=0000071'),
  '인제대학교|학생부교과(지역인재Ⅰ전형)': eligibility('부산·울산·경남 소재 고등학교에서 입학부터 졸업까지 전 교육과정을 이수한 졸업(예정)자입니다.', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2026&unvCd=0000164'),
  '인제대학교|학생부교과(지역인재Ⅱ전형)': eligibility('부산·울산·경남 소재 고등학교에서 입학부터 졸업까지 전 교육과정을 이수한 졸업(예정)자입니다.', 'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2026&unvCd=0000164'),
  '경남대학교|학생부교과(지역인재전형)': eligibility('경남·부산·울산 지역 고등학교 졸업(예정)자입니다.', 'https://ipsi.kyungnam.ac.kr/sites/ipsi/atchmnfl/curriculum/93/temp_1721264555843101.pdf'),
});

function normalizeRegion(value) {
  const text = String(value ?? '').trim();
  if (text === '부산광역시') return '부산';
  if (text === '울산광역시') return '울산';
  if (text === '경상남도') return '경남';
  return text;
}

export function normalizeRegionalEligibility(value) {
  if (!value || typeof value !== 'object') return null;
  const normalizeList = (items) => Array.isArray(items) ? [...new Set(items.map(normalizeRegion).filter(Boolean))] : [];
  return {
    eligibleRegions: normalizeList(value.eligibleRegions),
    eligibleSchoolRegions: normalizeList(value.eligibleSchoolRegions),
    requirementSummary: String(value.requirementSummary ?? '').trim(),
    sourceUrl: String(value.sourceUrl ?? '').trim() || null,
    verified: value.verified === true,
    checkedAt: String(value.checkedAt ?? '').trim() || null,
  };
}

export function regionalEligibilityFor({ university = '', admissionName = '' } = {}) {
  const item = REGIONAL_ELIGIBILITY_BY_ADMISSION[`${university}|${admissionName}`];
  return item ? normalizeRegionalEligibility(item) : null;
}

export function isSchoolRegionEligible(regionalEligibility, schoolRegion = DEFAULT_SCHOOL_REGION) {
  const value = normalizeRegionalEligibility(regionalEligibility);
  if (!value?.verified) return false;
  const region = normalizeRegion(schoolRegion);
  return value.eligibleSchoolRegions.includes(region) || value.eligibleRegions.includes(region);
}
