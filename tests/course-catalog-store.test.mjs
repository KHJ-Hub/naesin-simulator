import test from 'node:test';
import assert from 'node:assert/strict';
import { achievementCoursesForSemester, catalogCourses, coursesForSemester, commonCourses, isGradeInputCourse, sortCoursesForDisplay } from '../src/course-catalog-store.mjs';

test('카탈로그 기본 항목은 개설 상태와 표시 순서를 가진다', () => {
  const courses = catalogCourses();
  assert.ok(courses.length > 0);
  assert.ok(courses.every((course) => course.active === true && course.enabled === true));
  assert.ok(courses.every((course) => Number.isFinite(course.displayOrder)));
});

test('학생용 학기 조회는 활성 과목만 반환한다', () => {
  const courses = coursesForSemester('1-1', 2026);
  assert.ok(courses.length > 0);
  assert.ok(courses.every((course) => course.active !== false && course.enabled !== false));
  assert.deepEqual(courses.map((course) => course.displayOrder), [...courses].sort((a, b) => a.displayOrder - b.displayOrder).map((course) => course.displayOrder));
});

test('1학년 공통 과목 자동 생성 대상은 common과 autoGenerate 항목이다', () => {
  const courses = commonCourses(2026, 1);
  assert.ok(courses.length > 0);
  assert.ok(courses.every((course) => course.autoGenerate && course.requirement === 'school-designated'));
  assert.ok(courses.every(isGradeInputCourse));
});

test('기본 입력은 등급 과목만 제공하고 성취도 과목은 선택 조회로 보존한다', () => {
  const defaults = commonCourses(2026, 1);
  const optional = achievementCoursesForSemester('1-1', 2026);
  const included = commonCourses(2026, 1, { includeAchievementCourses: true });
  assert.equal(defaults.some((course) => ['과학탐구실험1', '체육1', '음악', '미술', '보건', '진로와 직업'].includes(course.subjectName)), false);
  assert.ok(optional.some((course) => course.subjectName === '과학탐구실험1'));
  assert.ok(optional.some((course) => course.subjectName === '체육1'));
  assert.ok(optional.every((course) => !isGradeInputCourse(course)));
  assert.ok(included.some((course) => course.subjectName === '과학탐구실험1'));
  assert.ok(included.some((course) => course.subjectName === '체육1'));
});

test('학생용 학기 조회도 성취도 과목을 기본 제외하고 옵션으로만 포함한다', () => {
  const defaults = coursesForSemester('1-1', 2026);
  const included = coursesForSemester('1-1', 2026, { includeAchievementCourses: true });
  assert.ok(defaults.every(isGradeInputCourse));
  assert.ok(included.length > defaults.length);
});

test('1학년만 교과군 우선순위로 정렬하고 2·3학년 원본 순서는 보존한다', () => {
  const firstGrade = sortCoursesForDisplay([
    { grade: 1, subjectGroup: '과학', displayOrder: 0 },
    { grade: 1, subjectGroup: '국어', displayOrder: 1 },
    { grade: 1, subjectGroup: '기타', displayOrder: 2 },
  ]);
  assert.deepEqual(firstGrade.map((course) => course.subjectGroup), ['국어', '과학', '기타']);

  const upperGrades = sortCoursesForDisplay([
    { grade: 2, subjectGroup: '과학', displayOrder: 0 },
    { grade: 2, subjectGroup: '국어', displayOrder: 1 },
    { grade: 3, subjectGroup: '수학', displayOrder: 2 },
  ]);
  assert.deepEqual(upperGrades.map((course) => course.subjectGroup), ['과학', '국어', '수학']);
});
