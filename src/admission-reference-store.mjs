export const ADMISSION_INTERESTS_STORAGE_KEY = 'naesin-admission-interests:v1';

export function admissionInterestKey(item = {}) {
  return [item.referenceYear, item.university, item.department, item.admissionName].map((value) => String(value ?? '').trim()).join('|');
}

export function normalizeAdmissionInterest(item = {}) {
  const referenceYear = Number(item.referenceYear);
  const university = String(item.university ?? '').trim().slice(0, 100);
  const department = String(item.department ?? '').trim().slice(0, 120);
  const admissionName = String(item.admissionName ?? '').trim().slice(0, 120);
  const cut70 = Number(item.cut70Original ?? item.cut70);
  const cut50 = Number(item.cut50Original ?? item.cut50);
  const cut70Converted = Number(item.cut70Converted);
  const cut50Converted = Number(item.cut50Converted);
  const comparisonScore = Number(item.comparisonScore);
  if (!Number.isInteger(referenceYear) || !university || !department || !admissionName || !Number.isFinite(cut70)) return null;
  return { referenceYear, university, department, admissionName,
    admissionType: String(item.admissionType ?? '').trim().slice(0, 50),
    category: String(item.category ?? '').trim().slice(0, 50), cut70: Number(cut70.toFixed(2)),
    ...(Object.prototype.hasOwnProperty.call(item, 'cut70Converted') ? {
      cut50: Number.isFinite(cut50) ? Number(cut50.toFixed(2)) : null,
      cut70Original: Number(cut70.toFixed(2)), cut50Original: Number.isFinite(cut50) ? Number(cut50.toFixed(2)) : null,
      cut70Converted: Number.isFinite(cut70Converted) ? Number(cut70Converted.toFixed(2)) : null,
      cut50Converted: Number.isFinite(cut50Converted) ? Number(cut50Converted.toFixed(2)) : null,
    } : {}),
    comparisonScore: Number.isFinite(comparisonScore) ? Number(comparisonScore.toFixed(2)) : null,
    comparisonBasis: item.comparisonBasis === 'target' ? 'target' : 'current' };
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
