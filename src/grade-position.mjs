import { convertGrade5ToGrade9 } from './grade-conversion/grade9-to-grade5.mjs';

function positionInScale(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) return null;
  return Number((((number - minimum) / (maximum - minimum)) * 100).toFixed(2));
}

export function buildGradePositionModel(currentGrade) {
  const grade5 = Number(currentGrade);
  if (!Number.isFinite(grade5) || grade5 < 1 || grade5 > 5) return null;
  const conversion = convertGrade5ToGrade9(grade5);
  if (!conversion) return null;
  return {
    grade5,
    grade9: conversion.convertedValue,
    grade5Position: positionInScale(grade5, 1, 5),
    grade9Position: positionInScale(conversion.convertedValue, 1, 9),
    conversionDataset: conversion.conversionDataset,
    isApproximate: conversion.isApproximate,
  };
}
