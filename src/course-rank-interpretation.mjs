import { GRADE_POSITION_SCALES } from './grade-position.mjs';

/** 기존 석차 참고 비율을 구간표와 대조하는 표시용 해석. 내신·환산 계산에는 사용하지 않는다. */
export function interpretCourseRankPosition(percentage) {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return null;
  // 누적 경계값 자체는 해당 경계를 상한으로 하는 구간에 포함한다.
  const grade5 = GRADE_POSITION_SCALES.grade5.cumulativePercentages.findIndex((boundary) => percentage <= boundary) + 1;
  const grade9 = GRADE_POSITION_SCALES.grade9.cumulativePercentages.findIndex((boundary) => percentage <= boundary) + 1;
  return {
    grade5,
    grade9,
    grade5Label: `5등급제 ${grade5}등급 구간`,
    grade9Label: `9등급제 ${grade9}등급 구간`,
    label: `참고 위치 기준 · 5등급제 ${grade5}등급 구간 / 9등급제 ${grade9}등급 구간`,
  };
}
