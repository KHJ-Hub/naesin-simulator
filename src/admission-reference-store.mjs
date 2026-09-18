export const ADMISSION_INTERESTS_STORAGE_KEY = 'naesin-admission-interests:v1';

export function admissionInterestKey(item = {}) {
  return [item.referenceYear, item.university, item.department, item.admissionCategory ?? item.category, item.admissionName].map((value) => String(value ?? '').trim()).join('|');
}

export function normalizeAdmissionInterest(item = {}) {
  const optionalNumber = (...values) => {
    const value = values.find((candidate) => candidate !== null && candidate !== undefined && candidate !== '');
    if (value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
  };
  const referenceYear = Number(item.referenceYear);
  const universityId = String(item.universityId ?? '').trim().slice(0, 100) || null;
  const university = String(item.university ?? '').trim().slice(0, 100);
  const department = String(item.department ?? '').trim().slice(0, 120);
  const admissionName = String(item.admissionName ?? '').trim().slice(0, 120);
  const cut70 = optionalNumber(item.cut70Original, item.cut70);
  const cut50 = optionalNumber(item.cut50Original, item.cut50);
  const cut70Converted = optionalNumber(item.cut70Converted);
  const cut50Converted = optionalNumber(item.cut50Converted);
  const averageGradeOriginal = optionalNumber(item.averageGradeOriginal);
  const averageGradeConverted = optionalNumber(item.averageGradeConverted);
  const comparisonScore = optionalNumber(item.comparisonScore);
  const hasPublishedGrade = [cut70, cut50, cut70Converted, cut50Converted, averageGradeOriginal, averageGradeConverted].some((value) => value !== null);
  if (!Number.isInteger(referenceYear) || !university || !department || !admissionName || !hasPublishedGrade) return null;
  return { referenceYear, universityId, university, universityName: university, department, admissionName,
    admissionType: String(item.admissionType ?? '').trim().slice(0, 50),
    admissionCategory: String(item.admissionCategory ?? item.category ?? '').trim().slice(0, 50),
    category: String(item.category ?? item.admissionCategory ?? '').trim().slice(0, 50), cut70,
    eligibilityType: String(item.eligibilityType ?? 'unknown').trim().slice(0, 50),
    eligibilityVerification: String(item.eligibilityVerification ?? '').trim().slice(0, 50),
    regionalEligibility: item.regionalEligibility && typeof item.regionalEligibility === 'object' ? {
      eligibleRegions: Array.isArray(item.regionalEligibility.eligibleRegions) ? [...item.regionalEligibility.eligibleRegions] : [],
      eligibleSchoolRegions: Array.isArray(item.regionalEligibility.eligibleSchoolRegions) ? [...item.regionalEligibility.eligibleSchoolRegions] : [],
      requirementSummary: String(item.regionalEligibility.requirementSummary ?? '').trim().slice(0, 300),
      sourceUrl: String(item.regionalEligibility.sourceUrl ?? '').trim().slice(0, 500),
      additionalRequirements: String(item.regionalEligibility.additionalRequirements ?? '').trim().slice(0, 300),
      requiresIndividualVerification: item.regionalEligibility.requiresIndividualVerification === true,
      verified: item.regionalEligibility.verified === true,
      checkedAt: String(item.regionalEligibility.checkedAt ?? '').trim().slice(0, 20),
    } : null,
    studentDefaultVisible: item.studentDefaultVisible === true,
    cut50,
    cut70Original: cut70,
    cut50Original: cut50,
    cut70Converted,
    cut50Converted,
    averageGradeOriginal,
    averageGradeConverted,
    comparisonReferenceType: ['average-grade', 'cut50', 'cut70'].includes(item.comparisonReferenceType) ? item.comparisonReferenceType : null,
    dataAvailability: String(item.dataAvailability ?? '').trim().slice(0, 50) || null,
    conversionDataset: String(item.conversionDataset ?? '').trim().slice(0, 100) || null,
    isApproximate: item.isApproximate === true,
    sourceUrl: String(item.sourceUrl ?? '').trim().slice(0, 500),
    source: String(item.source ?? '').trim().slice(0, 200),
    updatedAt: String(item.updatedAt ?? '').trim().slice(0, 20) || null,
    comparisonScore,
    comparisonBasis: item.comparisonBasis === 'target' ? 'target' : item.comparisonBasis === 'reference' ? 'reference' : 'current' };
}

export function normalizeAdmissionInterests(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).map(normalizeAdmissionInterest).filter((item) => {
    if (!item || seen.has(admissionInterestKey(item))) return false;
    seen.add(admissionInterestKey(item));
    return true;
  });
}

export function toggleAdmissionInterest(items, item) {
  const normalized = normalizeAdmissionInterest(item);
  if (!normalized) return normalizeAdmissionInterests(items);
  const key = admissionInterestKey(normalized);
  const current = normalizeAdmissionInterests(items);
  return current.some((interest) => admissionInterestKey(interest) === key)
    ? current.filter((interest) => admissionInterestKey(interest) !== key)
    : [...current, normalized];
}
