import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogCourses, coursesForSemester, commonCourses } from '../src/course-catalog-store.mjs';

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
});
