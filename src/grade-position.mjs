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

export function gradeValueLinearPosition(value, scale) {
  const numericValue = Number(value);
  const numericScale = Number(scale);
  if (!Number.isFinite(numericValue) || !Number.isInteger(numericScale) || numericScale < 2) return null;
  if (numericValue < 1 || numericValue > numericScale) return null;
  return ((numericValue - 1) / (numericScale - 1)) * 100;
}

export function buildGradePositionModel(currentGrade) {
  const grade5 = Number(currentGrade);
  if (!Number.isFinite(grade5) || grade5 < 1 || grade5 > 5) return null;
  const conversion = convertGrade5ToGrade9(grade5);
  if (!conversion) return null;
  return {
    grade5,
    grade9: conversion.convertedValue,
    grade5LinearPosition: gradeValueLinearPosition(grade5, 5),
    grade9LinearPosition: gradeValueLinearPosition(conversion.convertedValue, 9),
    grade5Scale: GRADE_POSITION_SCALES.grade5,
    grade9Scale: GRADE_POSITION_SCALES.grade9,
    conversionDataset: conversion.conversionDataset,
    isApproximate: conversion.isApproximate,
  };
}
