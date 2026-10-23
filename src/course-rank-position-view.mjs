import { formatCourseRelativePercentage } from './course-relative-position.mjs';

/** 이미 계산된 석차 참고값만 별도의 연속 막대로 표시한다. 등급값으로 환산하지 않는다. */
export function renderCourseRankPosition(relative) {
  if (!relative || !Number.isFinite(relative.percentage) || relative.percentage < 0 || relative.percentage > 100) return '';
  const label = formatCourseRelativePercentage(relative.percentage);
  const courseCount = Number.isFinite(relative.courseCount) ? relative.courseCount : 0;
  const credits = Number.isFinite(relative.credits) ? relative.credits : 0;
  return `<span class="course-rank-title">과목별 석차 기준 상대 위치</span><strong>${label} 지점</strong><small>석차 입력 ${courseCount}과목 · ${credits}학점 반영</small><div class="course-rank-scale" role="img" aria-label="과목별 석차 기준 상대 위치 ${label} 지점. 왼쪽은 상대적으로 높은 위치, 오른쪽은 상대적으로 낮은 위치예요."><div class="course-rank-directions" aria-hidden="true"><span>높은 위치</span><span>낮은 위치</span></div><div class="course-rank-track" style="--course-rank-position:${relative.percentage}%"><i class="course-rank-marker" aria-hidden="true"></i></div><div class="course-rank-endpoints" aria-hidden="true"><span>0%</span><span>100%</span></div></div><p class="course-relative-note">입력한 과목별 석차를 학점 반영해 계산한 참고 위치예요.</p><p class="course-relative-note">실제 전교 전체 석차나 대학의 공식 백분위를 의미하지 않아요.</p>`;
}
