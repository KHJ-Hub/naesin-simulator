/**
 * 학번으로 현재 학년을 알 수 있을 때, 아직 해당하지 않는 학년의 학기 입력 카드를 숨긴다.
 * 화면에 보이는 카드만 거르며 성적 데이터와 계산에는 관여하지 않는다.
 */

export const VALID_STUDENT_GRADES = Object.freeze([1, 2, 3]);

/**
 * @param {Array<{id: string, grade: number}>} semesters 전체 학기 목록
 * @param {{ grade?: number | null, hasContent?: (semesterId: string) => boolean }} options
 *   grade: 학번에서 읽은 현재 학년(알 수 없으면 null), hasContent: 이미 입력한 내용이 있는 학기인지
 */
export function visibleSemesters(semesters, { grade = null, hasContent = () => false } = {}) {
  const list = Array.isArray(semesters) ? semesters : [];
  if (!VALID_STUDENT_GRADES.includes(grade)) return [...list];
  return list.filter((semester) => semester.grade <= grade || Boolean(hasContent(semester.id)));
}

export function hiddenSemesterCount(semesters, options) {
  return (Array.isArray(semesters) ? semesters.length : 0) - visibleSemesters(semesters, options).length;
}

/** 화면에 보이는 학기 중 바로 다음 학기의 id를 돌려준다. 없으면 null이다. */
export function nextVisibleSemesterId(visible, semesterId) {
  const index = visible.findIndex(({ id }) => id === semesterId);
  return index >= 0 ? (visible[index + 1]?.id ?? null) : null;
}
