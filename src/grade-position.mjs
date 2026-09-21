import { convertGrade5ToGrade9 } from './grade-conversion/grade9-to-grade5.mjs';

export const GRADE_POSITION_SCALES = Object.freeze({
  grade5: Object.freeze({
    scale: 5,
    cumulativePercentages: Object.freeze([10, 34, 66, 90, 100]),
    bandPercentages: Object.freeze([10, 24, 32, 24, 10]),
  }),
  grade9: Object.freeze({
    scale: 9,
    cumulativePercentages: Object.freeze([4, 11, 23, 40, 60, 77, 89, 96, 100]),
    bandPercentages: Object.freeze([4, 7, 12, 17, 20, 17, 12, 7, 4]),
  }),
});

/**
 * 차트 안에서 마커를 배치하기 위한 0~100 시각 좌표다.
 * 등급 구간 중심 사이를 보간하며 실제 석차 백분위나 학생의 누적분포 추정값이 아니다.
 */
function visualMarkerPosition(value, scale) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1 || number > scale.scale) return null;
  const centers = scale.cumulativePercentages.map((upper, index) => {
    const lower = index === 0 ? 0 : scale.cumulativePercentages[index - 1];
    return (lower + upper) / 2;
  });
  const lowerGradeIndex = Math.floor(number) - 1;
  const upperGradeIndex = Math.min(Math.ceil(number) - 1, centers.length - 1);
  if (lowerGradeIndex === upperGradeIndex) return centers[lowerGradeIndex];
  const fraction = number - Math.floor(number);
  return Number((centers[lowerGradeIndex] + ((centers[upperGradeIndex] - centers[lowerGradeIndex]) * fraction)).toFixed(2));
}

export function buildGradePositionModel(currentGrade) {
  const grade5 = Number(currentGrade);
  if (!Number.isFinite(grade5) || grade5 < 1 || grade5 > 5) return null;
  const conversion = convertGrade5ToGrade9(grade5);
  if (!conversion) return null;
  const markerPosition = visualMarkerPosition(grade5, GRADE_POSITION_SCALES.grade5);
  return {
    grade5,
    grade9: conversion.convertedValue,
    markerPosition,
    grade5Scale: GRADE_POSITION_SCALES.grade5,
    grade9Scale: GRADE_POSITION_SCALES.grade9,
    conversionDataset: conversion.conversionDataset,
    isApproximate: conversion.isApproximate,
  };
}
