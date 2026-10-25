import { formatCourseRelativePercentage } from './course-relative-position.mjs';

const validPosition = (relative) => relative && Number.isFinite(relative.percentage)
  && relative.percentage >= 0 && relative.percentage <= 100;

/** 이미 계산된 참고값과 반영 범위만 요약한다. */
export function renderCourseRankPosition(relative) {
  if (!validPosition(relative)) return '';
  const label = formatCourseRelativePercentage(relative.percentage);
  const courseCount = Number.isFinite(relative.courseCount) ? relative.courseCount : 0;
  const credits = Number.isFinite(relative.credits) ? relative.credits : 0;
  return `<span class="course-rank-title">과목별 석차 기준 상대 위치</span><strong>${label} 지점</strong><small>석차 입력 ${courseCount}과목 · ${credits}학점 반영</small><p class="course-relative-note">입력한 과목별 석차를 학점 반영해 계산한 참고 위치예요.</p><p class="course-relative-note">실제 전교 전체 석차나 대학의 공식 백분위를 의미하지 않아요.</p>`;
}

/** 참고 마커는 현재 적용받는 5등급제에만 표시하며 등급 판정을 만들지 않는다. */
export function renderCourseRankGrade5Marker(relative, scale) {
  if (scale !== 5 || !validPosition(relative)) return '';
  const label = formatCourseRelativePercentage(relative.percentage);
  return `<span class="course-rank-marker-label">내 위치 ${label}</span><i class="course-rank-grade5-line" aria-hidden="true" style="left:${relative.percentage}%"></i>`;
}
