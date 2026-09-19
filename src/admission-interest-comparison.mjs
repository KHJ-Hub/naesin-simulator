import { admissionDifference, isStudentRecordComprehensive } from './admission-reference-core.mjs';
import { getAdmissionPrimaryReference } from './admission-card-summary.mjs';
import { ADMISSION_OWNERSHIP_LABELS } from './admission-filter-options.mjs';
import { admissionInterestKey, normalizeAdmissionInterests } from './admission-reference-store.mjs';
import { UNIVERSITY_BY_ID, UNIVERSITY_BY_NAME } from './data/universities.mjs';

export const MAX_ADMISSION_INTEREST_COMPARISONS = 3;
export const MIN_ADMISSION_INTEREST_COMPARISONS = 2;

const finiteOrNull = (value) => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function reconcileAdmissionInterestComparisonSelection(interests = [], selectedKeys = [], maximum = MAX_ADMISSION_INTEREST_COMPARISONS) {
  const availableKeys = new Set(normalizeAdmissionInterests(interests).map(admissionInterestKey));
  return [...new Set(selectedKeys)]
    .filter((key) => availableKeys.has(key))
    .slice(0, maximum);
}

export function buildAdmissionInterestComparison(interests = [], { currentGrade = null, targetGrade = null } = {}) {
  const current = finiteOrNull(currentGrade);
  const target = finiteOrNull(targetGrade);
  const items = normalizeAdmissionInterests(interests)
    .slice(0, MAX_ADMISSION_INTEREST_COMPARISONS)
    .map((item) => {
      const universityInfo = UNIVERSITY_BY_ID[item.universityId] ?? UNIVERSITY_BY_NAME[item.university] ?? null;
      const primaryReference = getAdmissionPrimaryReference(item);
      const referenceGrade = finiteOrNull(primaryReference.converted);
      return Object.freeze({
        ...item,
        key: admissionInterestKey(item),
        universityName: item.university,
        region: universityInfo?.region ?? null,
        ownership: universityInfo?.ownership ?? null,
        ownershipLabel: ADMISSION_OWNERSHIP_LABELS[universityInfo?.ownership] ?? universityInfo?.officialEstablishmentType ?? null,
        primaryReference,
        currentDifference: current == null || referenceGrade == null ? null : admissionDifference(current, referenceGrade),
        targetDifference: target == null || referenceGrade == null ? null : admissionDifference(target, referenceGrade),
      });
    });

  const subject = items.filter((item) => !isStudentRecordComprehensive(item));
  const comprehensive = items.filter(isStudentRecordComprehensive);
  return Object.freeze({
    items: Object.freeze(items),
    subject: Object.freeze(subject),
    comprehensive: Object.freeze(comprehensive),
    mixed: subject.length > 0 && comprehensive.length > 0,
    canCompare: items.length >= MIN_ADMISSION_INTEREST_COMPARISONS,
  });
}
