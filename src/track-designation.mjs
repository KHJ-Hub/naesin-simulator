/**
 * 2학년 과목별 입력에서 미리 채워 줄 지정 과목.
 * 출처: 2025·2026학년도 고교학점제 수강신청 안내(1학년)의 교과별 이수 트랙.
 * 과목 유형(공통·일반·진로·융합)이나 성적 처리 방식은 바꾸지 않고, 채워 줄 과목 이름만 정한다.
 * 계열 선택은 과목을 채우는 도우미일 뿐이므로 학생 상태나 백업에 저장하지 않는다.
 */

export const TRACK_NONE = 'none';

export const TRACK_OPTIONS = Object.freeze([
  Object.freeze({ id: '인문', label: '인문' }),
  Object.freeze({ id: '자연', label: '자연' }),
  Object.freeze({ id: TRACK_NONE, label: '선택 안 함' }),
]);

/** 권장 과목은 사회·과학 교과만 미리 채우고, 국어·수학·영어는 필수만 채운다. */
export const RECOMMENDED_PREFILL_GROUPS = Object.freeze(['사회', '과학']);

const REQUIRED = '필수';
const RECOMMENDED = '권장';

/** 계열과 상관없이 모두 듣는 과목(트랙 표의 "공통" 필수). */
const COMMON_TRACK = Object.freeze({
  '2-1': [['문학', REQUIRED], ['영어Ⅰ', REQUIRED]],
  '2-2': [['독서와 작문', REQUIRED], ['영어Ⅱ', REQUIRED]],
});

const TRACKS = Object.freeze({
  인문: Object.freeze({
    '2-1': [['대수', REQUIRED], ['미적분Ⅰ', REQUIRED], ['세계시민과 지리', REQUIRED], ['사회와 문화', REQUIRED]],
    '2-2': [['확률과 통계', REQUIRED], ['현대사회와 윤리', REQUIRED], ['정치', RECOMMENDED], ['경제', RECOMMENDED]],
  }),
  자연: Object.freeze({
    '2-1': [['대수', REQUIRED], ['미적분Ⅰ', REQUIRED], ['물리학', REQUIRED], ['생명과학', REQUIRED]],
    '2-2': [['확률과 통계', REQUIRED], ['화학', REQUIRED], ['지구과학', REQUIRED], ['미적분Ⅱ', RECOMMENDED]],
  }),
});

export const TRACK_ENTRY_YEARS = Object.freeze([2025, 2026]);

export function isTrackId(track) {
  return TRACK_OPTIONS.some(({ id }) => id === track);
}

export function hasTrackDesignation(semesterId, entryYear) {
  return TRACK_ENTRY_YEARS.includes(Number(entryYear)) && Object.hasOwn(COMMON_TRACK, semesterId);
}

const isGradeCourse = (course) => ['grade', 'both'].includes(course.gradingType) && course.fiveLevelEligible !== false;
const isOpen = (course) => course.active !== false && course.enabled !== false;

/** 트랙 표에서 이 학기에 채울 과목 이름. 권장 과목은 사회·과학 교과일 때만 포함한다. */
export function trackSubjectNames(semesterId, track, courses = []) {
  const entries = [...(COMMON_TRACK[semesterId] ?? []), ...(TRACKS[track]?.[semesterId] ?? [])];
  const groupOf = (name) => courses.find((course) => course.subjectName === name)?.subjectGroup;
  return [...new Set(entries
    .filter(([name, level]) => level === REQUIRED || RECOMMENDED_PREFILL_GROUPS.includes(groupOf(name)))
    .map(([name]) => name))];
}

/**
 * 계열을 고르면 채울 학교 과목 목록.
 * 트랙 표의 과목 + 학교 지정 과목 중 등급이 나오는 과목(반 조건이 있으면 반이 맞을 때만).
 */
export function designatedCoursesForTrack(courses, { entryYear, semesterId, track, classNumber = null } = {}) {
  if (!hasTrackDesignation(semesterId, entryYear)) return [];
  const pool = (Array.isArray(courses) ? courses : [])
    .filter((course) => Number(course.entryYear) === Number(entryYear) && course.semesterId === semesterId && isOpen(course));
  const names = trackSubjectNames(semesterId, track, pool);
  const fromTrack = names
    .map((name) => pool.find((course) => course.subjectName === name && course.requirement === 'elective'))
    .filter(Boolean);
  const normalizedClass = classNumber === null || classNumber === undefined || classNumber === '' ? null : String(Number(classNumber));
  const schoolDesignated = pool.filter((course) => course.requirement === 'school-designated'
    && isGradeCourse(course)
    && (!course.classConditions?.length || (normalizedClass !== null && course.classConditions.includes(normalizedClass))));
  return [...schoolDesignated, ...fromTrack];
}
