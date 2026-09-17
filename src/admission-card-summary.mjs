function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** 카드에서 우선 표시할 공식 입시결과 종류와 원본·환산값을 함께 반환한다. */
export function getAdmissionPrimaryReference(item = {}) {
  const candidates = [
    {
      kind: 'cut70',
      label: '전년도 70% cut',
      original: finiteOrNull(item.cut70Original ?? item.cut70),
      converted: finiteOrNull(item.cut70Converted),
    },
    {
      kind: 'average',
      label: '전년도 평균등급',
      original: finiteOrNull(item.averageGradeOriginal ?? item.averageGrade),
      converted: finiteOrNull(item.averageGradeConverted),
    },
    {
      kind: 'cut50',
      label: '전년도 50% cut',
      original: finiteOrNull(item.cut50Original ?? item.cut50),
      converted: finiteOrNull(item.cut50Converted),
    },
  ];
  return Object.freeze(candidates.find(({ original, converted }) => original != null || converted != null) ?? {
    kind: 'unavailable', label: '전년도 내신 자료', original: null, converted: null,
  });
}
