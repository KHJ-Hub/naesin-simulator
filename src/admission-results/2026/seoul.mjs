import { admissionResults2026SahmyookOfficial } from './official/sahmyook.mjs';
import { admissionResults2026SeoulVerified } from './verified/seoul.mjs';

const keyOf = (item) => [item.university, item.department, item.admissionName, item.admissionCategory].join('|');
const records = new Map(admissionResults2026SeoulVerified.map((item) => [keyOf(item), item]));

// 삼육대 입학처가 별도로 공개한 평균등급은 같은 공식 cut 레코드에 병합한다.
// cut이 공개되지 않은 모집단위는 average-only 레코드로 보존한다.
for (const average of admissionResults2026SahmyookOfficial) {
  const key = keyOf(average);
  const cut = records.get(key);
  if (!cut) {
    records.set(key, average);
    continue;
  }
  records.set(key, Object.freeze({
    ...cut,
    averageGradeOriginal: average.averageGradeOriginal,
    averageGradeConverted: average.averageGradeConverted,
    interpolation: Object.freeze({
      ...cut.interpolation,
      averageGrade: average.interpolation.averageGrade,
    }),
    sourceUrls: Object.freeze([...new Set([cut.sourceUrl, average.sourceUrl])]),
  }));
}

export const admissionResults2026Seoul = Object.freeze([...records.values()]);
