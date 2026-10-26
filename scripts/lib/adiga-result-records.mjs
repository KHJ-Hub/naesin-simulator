import { admissionInterestKey } from '../../src/admission-reference-store.mjs';

/** 값 충돌은 제외하되 서로 다른 모집시기의 공식 결과는 모두 보존한다. */
export function uniqueRecords(records) {
  const unique = new Map();
  const conflicts = new Set();
  for (const record of records) {
    const key = admissionInterestKey({ referenceYear: 2026, ...record });
    const values = [record.cut50Original, record.cut70Original, record.averageGradeOriginal ?? null].join('|');
    if (!unique.has(key)) unique.set(key, { record, values });
    else if (unique.get(key).values !== values) conflicts.add(key);
  }
  return {
    records: [...unique.entries()].filter(([key]) => !conflicts.has(key)).map(([, value]) => value.record),
    conflicts: [...conflicts],
  };
}
