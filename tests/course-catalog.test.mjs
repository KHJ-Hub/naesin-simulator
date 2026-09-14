import test from 'node:test';
import assert from 'node:assert/strict';
import { commonCourses, coursesForSemester } from '../src/course-catalog.mjs';

test('2026 입학생 1학년 공통 과목과 반별 지정 과목을 구분한다', () => {
  assert.equal(commonCourses().some((item) => item.subjectName === '공통국어1'), true);
  assert.equal(commonCourses().some((item) => item.subjectName === '음악'), false);
  assert.equal(commonCourses(2026, 1).some((item) => item.subjectName === '음악'), true);
});
test('성취도만 처리하는 과목을 구분한다', () => {
  const lab = coursesForSemester('1-1').find((item) => item.subjectName === '과학탐구실험1');
  assert.equal(lab.fiveLevelEligible, false);
  assert.equal(lab.gradingType, 'achievement-a-c');
});
test('일반 융합 선택은 A~E 성취도만, 보건은 P 이수 처리한다', () => {
  const socialIssue = coursesForSemester('2-1').find((item) => item.subjectName === '사회문제 탐구');
  const health = commonCourses(2026, 1).find((item) => item.subjectName === '보건');
  assert.equal(socialIssue.gradingType, 'achievement-a-e-no-rank');
  assert.equal(socialIssue.fiveLevelEligible, false);
  assert.equal(health.gradingType, 'pass');
});
