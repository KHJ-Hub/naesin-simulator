import { BUSAN_CONVERSION_DATASETS, DEFAULT_BUSAN_CONVERSION_DATASET } from './busan-grade5-distribution.mjs';
export { DEFAULT_BUSAN_CONVERSION_DATASET } from './busan-grade5-distribution.mjs';

const round = (value, digits = 2) => Number(value.toFixed(digits));

function findAnchor(anchors, original) {
  return anchors.findIndex(([, legacy]) => legacy === original);
}

/** 공식 대응표의 인접한 9등급 기준점 사이에서만 선형 보간한다. */
export function convertGrade9ToGrade5(originalGrade, datasetId = DEFAULT_BUSAN_CONVERSION_DATASET) {
  const dataset = BUSAN_CONVERSION_DATASETS[datasetId];
  const original = Number(originalGrade);
  if (!dataset || !Number.isFinite(original) || original < 1 || original > 9) return null;
  const anchors = dataset.anchors;
  const exactIndex = findAnchor(anchors, original);
  if (exactIndex >= 0) return result(original, anchors[exactIndex][0], dataset, false, null, null);

  if (original < anchors[0][1]) {
    return result(original, anchors[0][0], dataset, false, anchors[0], null, 'lower-bound');
  }
  if (original > anchors.at(-1)[1]) {
    return result(original, anchors.at(-1)[0], dataset, false, null, anchors.at(-1), 'upper-bound');
  }
  for (let index = 1; index < anchors.length; index += 1) {
    const lower = anchors[index - 1];
    const upper = anchors[index];
    if (original <= upper[1]) {
      const ratio = (original - lower[1]) / (upper[1] - lower[1]);
      const converted = lower[0] + ratio * (upper[0] - lower[0]);
      return result(original, converted, dataset, true, lower, upper, null);
    }
  }
  return null;
}

function result(original, converted, dataset, interpolation, lowerAnchor, upperAnchor, boundary = null) {
  return {
    originalScale: 9, originalValue: original, convertedScale: 5,
    convertedValue: round(converted), conversionDataset: dataset.id,
    interpolation, isApproximate: true, conversionConfidence: 'reference',
    lowerAnchor: lowerAnchor ? { converted: lowerAnchor[0], original: lowerAnchor[1] } : null,
    upperAnchor: upperAnchor ? { converted: upperAnchor[0], original: upperAnchor[1] } : null,
    boundary,
  };
}

export function conversionDataset(datasetId = DEFAULT_BUSAN_CONVERSION_DATASET) {
  return BUSAN_CONVERSION_DATASETS[datasetId] ?? null;
}

export function conversionDisplay(resultValue) {
  return resultValue ? `약 ${resultValue.convertedValue.toFixed(2)}등급` : '환산 자료 없음';
}
