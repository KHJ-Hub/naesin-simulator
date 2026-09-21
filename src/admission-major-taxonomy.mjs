/**
 * 모집단위 원문은 바꾸지 않고 비교·검색에만 사용하는 재사용 가능한 전공 분류표다.
 * 구체 전공군(majorGroup)과 한 단계 넓은 세부 계열(detailedField)을 분리한다.
 */
export const ADMISSION_MAJOR_GROUP_RULES = Object.freeze([
  { majorGroup: 'economics', detailedField: 'business-economics', keywords: ['경제'] },
  { majorGroup: 'business', detailedField: 'business-economics', keywords: ['경영', '회계', '세무', '금융', '재무', '마케팅', '유통'] },
  { majorGroup: 'trade-logistics', detailedField: 'business-economics', keywords: ['무역', '통상', '물류'] },
  { majorGroup: 'law-public', detailedField: 'social-science', keywords: ['법학', '법무', '행정', '정책', '정치', '외교'] },
  { majorGroup: 'social-welfare', detailedField: 'social-science', keywords: ['사회복지', '복지', '사회학'] },
  { majorGroup: 'psychology-counseling', detailedField: 'social-science', keywords: ['심리', '상담'] },
  { majorGroup: 'language-literature', detailedField: 'humanities-language', keywords: ['국어국문', '영어영문', '독어', '불어', '중어', '일어', '언어', '문학'] },
  { majorGroup: 'history-philosophy', detailedField: 'humanities-language', keywords: ['사학', '역사', '철학', '고고'] },
  { majorGroup: 'education', detailedField: 'education', keywords: ['교육', '사범'] },
  { majorGroup: 'computer-software', detailedField: 'engineering-computing', keywords: ['컴퓨터', '소프트웨어', '인공지능', '데이터사이언스', '정보보호', '정보보안'] },
  { majorGroup: 'electrical-electronics', detailedField: 'engineering-computing', keywords: ['전기', '전자', '반도체', '정보통신'] },
  { majorGroup: 'mechanical-mobility', detailedField: 'engineering-industry', keywords: ['기계', '자동차', '모빌리티', '로봇'] },
  { majorGroup: 'architecture', detailedField: 'engineering-industry', keywords: ['건축', '건설'] },
  { majorGroup: 'chemical-materials', detailedField: 'natural-science', keywords: ['화학', '화공', '소재', '신소재'] },
  { majorGroup: 'life-bio', detailedField: 'natural-science', keywords: ['생명', '생물', '바이오'] },
  { majorGroup: 'math-statistics', detailedField: 'natural-science', keywords: ['수학', '통계'] },
  { majorGroup: 'medicine-health', detailedField: 'health-medical', keywords: ['의예', '의학', '치의', '한의', '약학', '간호', '보건', '재활', '치위생', '임상병리'] },
  { majorGroup: 'arts-design', detailedField: 'arts-sports', keywords: ['미술', '음악', '디자인', '회화', '조형', '무용'] },
  { majorGroup: 'sports', detailedField: 'arts-sports', keywords: ['체육', '스포츠'] },
]);

const EXPLICIT_GROUP_ALIASES = Object.freeze({
  경제: 'economics', economics: 'economics',
  경영: 'business', business: 'business',
  무역: 'trade-logistics', 통상: 'trade-logistics', 물류: 'trade-logistics',
  건축: 'architecture', architecture: 'architecture',
  컴퓨터: 'computer-software', 소프트웨어: 'computer-software',
});

/**
 * 모집단위 원문은 보존하고, 분류·검색에서만 안전한 표기 차이를 정리한다.
 * 괄호 안의 전공명은 유지하며 주·야간 같은 운영 표기만 제거한다.
 */
export function normalizeAdmissionMajorName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ㆍ・]/g, '·')
    .replace(/\(\s*(?:주|야|주간|야간)\s*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeMajorTaxonomyText(value) {
  return normalizeAdmissionMajorName(value)
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s·,()\[\]{}\-_/&]/g, '');
}

function explicitMajorGroup(item = {}) {
  const raw = String(item.majorSearchGroup ?? '').trim();
  if (!raw) return null;
  const normalized = normalizeMajorTaxonomyText(raw);
  return EXPLICIT_GROUP_ALIASES[normalized] ?? `custom:${normalized}`;
}

export function resolveAdmissionMajorTaxonomy(item = {}) {
  const department = String(item.department ?? '').trim();
  const searchText = normalizeMajorTaxonomyText(`${department} ${item.normalizedMajorKeyword ?? ''} ${item.majorSearchGroup ?? ''}`);
  if (String(item.academicField ?? item.field ?? '') === 'open-major') {
    return Object.freeze({
      majorGroup: 'open-major',
      detailedField: 'open-major',
      normalizedKeyword: normalizeMajorTaxonomyText(item.normalizedMajorKeyword ?? department),
    });
  }
  const explicit = explicitMajorGroup(item);
  const matchedRule = ADMISSION_MAJOR_GROUP_RULES.find(({ majorGroup, keywords }) => (
    majorGroup === explicit || keywords.some((keyword) => searchText.includes(normalizeMajorTaxonomyText(keyword)))
  ));
  return Object.freeze({
    majorGroup: matchedRule?.majorGroup ?? explicit,
    detailedField: matchedRule?.detailedField ?? null,
    normalizedKeyword: normalizeMajorTaxonomyText(item.normalizedMajorKeyword ?? department),
  });
}

export function admissionMajorSimilarityTier(target = {}, candidate = {}) {
  const left = resolveAdmissionMajorTaxonomy(target);
  const right = resolveAdmissionMajorTaxonomy(candidate);
  if (left.majorGroup && left.majorGroup === right.majorGroup) return 'major-group';
  if (left.detailedField && left.detailedField === right.detailedField) return 'detailed-field';
  const leftField = String(target.academicField ?? target.field ?? '');
  const rightField = String(candidate.academicField ?? candidate.field ?? '');
  if (leftField && leftField !== 'unknown' && leftField === rightField) return 'academic-field';
  return 'all-local';
}
