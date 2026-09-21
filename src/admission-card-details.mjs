const ELIGIBILITY_LABELS = Object.freeze({
  general: '일반 지원',
  'school-recommendation': '학교장추천',
  regional: '지역인재',
  rural: '농어촌학생',
  opportunity: '기회균형·고른기회',
  vocational: '특성화고 관련',
  special: '기타 특별전형',
});

export function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue);
  return false;
}

function numberOrNull(value) {
  if (!hasMeaningfulValue(value) || (typeof value !== 'number' && typeof value !== 'string')) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textOrNull(value) {
  if (!hasMeaningfulValue(value) || (typeof value !== 'string' && typeof value !== 'number')) return null;
  const text = String(value ?? '').trim();
  return text || null;
}

function firstNumber(item, keys) {
  for (const key of keys) {
    const value = numberOrNull(item?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function firstText(item, keys) {
  for (const key of keys) {
    const value = textOrNull(item?.[key]);
    if (value !== null) return value;
  }
  return null;
}

/** 카드 본문 밖에서 학생에게 보여줄 가치가 있는 실제 추가 정보만 구성한다. */
export function getAdmissionCardDetailItems(item = {}) {
  const details = [];
  const recruitmentCount = firstNumber(item, ['recruitmentCount', 'admissionCount', 'quota', 'capacity']);
  const competitionRate = firstNumber(item, ['competitionRate', 'competitionRatio']);
  const cut50Original = firstNumber(item, ['cut50Original', 'cut50']);
  const cut50Converted = firstNumber(item, ['cut50Converted']);
  const averageGradeOriginal = firstNumber(item, ['averageGradeOriginal', 'averageGrade']);
  const averageGradeConverted = firstNumber(item, ['averageGradeConverted']);

  if (recruitmentCount !== null) details.push({ key: 'recruitment-count', label: '모집인원', value: `${recruitmentCount}명` });
  if (competitionRate !== null) details.push({ key: 'competition-rate', label: '경쟁률', value: `${competitionRate}:1` });
  if (cut50Original !== null) details.push({ key: 'cut50-original', label: '50% cut 원본', value: cut50Original, numeric: true });
  if (cut50Converted !== null) details.push({ key: 'cut50-converted', label: '50% cut 환산 참고', value: cut50Converted, numeric: true });
  if (averageGradeOriginal !== null) details.push({ key: 'average-original', label: '평균등급 원본', value: averageGradeOriginal, numeric: true });
  if (averageGradeConverted !== null) details.push({ key: 'average-converted', label: '평균등급 환산 참고', value: averageGradeConverted, numeric: true });

  const extraResult = firstText(item, ['additionalAdmissionInfo', 'additionalResultInfo', 'resultNote', 'admissionResultNote']);
  if (extraResult) details.push({ key: 'extra-result', label: '추가 입결 정보', value: extraResult });

  const eligibilityType = textOrNull(item.eligibilityType);
  if (eligibilityType && eligibilityType !== 'general' && eligibilityType !== 'unknown') {
    details.push({ key: 'eligibility-type', label: '지원자격 유형', value: ELIGIBILITY_LABELS[eligibilityType] ?? eligibilityType });
  }
  const eligibilityDescription = firstText(item, ['eligibilityDescription', 'eligibilitySummary', 'requirementSummary']);
  if (eligibilityDescription) details.push({ key: 'eligibility-description', label: '지원자격', value: eligibilityDescription });

  const regional = item.regionalEligibility && typeof item.regionalEligibility === 'object' ? item.regionalEligibility : null;
  const regionalSummary = textOrNull(regional?.requirementSummary);
  const regionalRegions = Array.isArray(regional?.eligibleSchoolRegions)
    ? regional.eligibleSchoolRegions.map(textOrNull).filter(Boolean).join('·')
    : '';
  const regionalAdditional = textOrNull(regional?.additionalRequirements);
  if (regionalSummary) details.push({ key: 'regional-summary', label: '지역인재 지원자격', value: regionalSummary });
  else if (regionalRegions) details.push({ key: 'regional-regions', label: '지원 가능 학교 지역', value: regionalRegions });
  if (regionalAdditional) details.push({ key: 'regional-additional', label: '추가 지원요건', value: regionalAdditional });

  // 기준학년도와 출처는 모든 정규화 레코드에 공통으로 붙는 기본 메타정보다.
  // 이것만으로 빈 아코디언을 만들지 않고, 실제 추가 정보가 있을 때 보조 정보로 함께 표시한다.
  if (!details.length) return [];
  const referenceYear = numberOrNull(item.referenceYear ?? item.year);
  const source = textOrNull(item.source);
  const sourceUrl = textOrNull(item.sourceUrl);
  if (referenceYear !== null) details.push({ key: 'reference-year', label: '기준학년도', value: `${referenceYear}학년도`, metadata: true });
  if (source || sourceUrl) details.push({ key: 'source', label: '자료 출처', value: source ?? sourceUrl, href: sourceUrl, metadata: true });
  return details;
}

/** 공통 메타정보가 아니라 카드 본문 밖의 실제 추가 정보가 있는지 판정한다. */
export function hasMeaningfulDetails(item = {}) {
  return getAdmissionCardDetailItems(item).some((detail) => detail.metadata !== true);
}

export function getOfficialAdigaUrl(item = {}) {
  const candidate = textOrNull(item.universityInfo?.adigaUrl ?? item.universityAdigaUrl ?? item.adigaUrl);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && (url.hostname === 'adiga.kr' || url.hostname.endsWith('.adiga.kr')) ? url.href : null;
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatDetailValue(detail) {
  return detail.numeric ? Number(detail.value).toFixed(2) : String(detail.value);
}

function publicHttpUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function renderAdmissionCardDetails(item = {}) {
  if (!hasMeaningfulDetails(item)) return '';
  const details = getAdmissionCardDetailItems(item);
  const rows = details.map((detail) => {
    const value = escapeHtml(formatDetailValue(detail));
    const href = publicHttpUrl(detail.href);
    const content = href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${value}</a>`
      : `<b>${value}</b>`;
    const tag = detail.metadata ? 'small' : 'span';
    return `<${tag} data-detail-key="${escapeHtml(detail.key)}">${escapeHtml(detail.label)} ${content}</${tag}>`;
  }).join('');
  return `<div class="admission-card-details"><button type="button" class="admission-card-details-toggle" data-admission-card-details-toggle aria-expanded="false"><span class="admission-card-details-icon" aria-hidden="true">▶</span><span>세부 정보</span></button><div class="admission-card-details-body" hidden>${rows}</div></div>`;
}

export function renderAdmissionCardSupplement(item = {}) {
  const details = renderAdmissionCardDetails(item);
  if (details) return details;
  const adigaUrl = getOfficialAdigaUrl(item);
  if (!adigaUrl) return '';
  return `<a class="admission-card-adiga-link" href="${escapeHtml(adigaUrl)}" target="_blank" rel="noopener noreferrer">대학어디가에서 자세히 보기 <span aria-hidden="true">↗</span></a>`;
}
