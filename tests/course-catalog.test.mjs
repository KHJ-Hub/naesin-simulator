import test from 'node:test';
import assert from 'node:assert/strict';
import { commonCourses, coursesForSemester, gradingInputs, recordFromCourse } from '../src/course-catalog.mjs';

test('2026 입학생 1학년 공통 과목과 반별 지정 과목을 구분한다', () => {
  assert.equal(commonCourses().some((item) => item.subjectName === '공통국어1'), true);
  assert.equal(commonCourses().some((item) => item.subjectName === '음악'), false);
  assert.equal(commonCourses(2026, 1).some((item) => item.subjectName === '음악'), true);
});
test('성취도만 처리하는 과목을 구분한다', () => {
  const lab = coursesForSemester('1-1').find((item) => item.subjectName === '과학탐구실험1');
  assert.equal(lab.fiveLevelEligible, false);
  assert.equal(lab.gradingType, 'achievement');
  assert.equal(lab.achievementScale, 'a-c');
});
test('일반 융합 선택은 A~E 성취도만, 보건은 P 이수 처리한다', () => {
  const socialIssue = coursesForSemester('2-1').find((item) => item.subjectName === '사회문제 탐구');
  const health = commonCourses(2026, 1).find((item) => item.subjectName === '보건');
  assert.equal(socialIssue.gradingType, 'achievement');
  assert.equal(socialIssue.achievementScale, 'a-e');
  assert.equal(socialIssue.fiveLevelEligible, false);
  assert.equal(health.gradingType, 'passfail');
  assert.equal(health.achievementScale, 'pass');
});
test('카탈로그에 등급 처리 방식의 명시적 타입이 있다', () => {
  const grade = coursesForSemester('1-1').find((item) => item.subjectName === '공통국어1');
  assert.equal(grade.gradingType, 'grade');
  assert.equal(['grade', 'achievement', 'passfail', 'both'].includes(grade.gradingType), true);
});
test('grade·achievement·passfail·both 렌더링 입력 계약을 구분한다', () => {
  assert.deepEqual(gradingInputs('grade'), { grade: true, achievement: false, passfail: false });
  assert.deepEqual(gradingInputs('achievement'), { grade: false, achievement: true, passfail: false });
  assert.deepEqual(gradingInputs('passfail'), { grade: false, achievement: false, passfail: true });
  assert.deepEqual(gradingInputs('both'), { grade: true, achievement: true, passfail: false });
});

test('성취도 전용 과목 레코드는 숫자 등급 없이 A/B/C 입력 구조를 유지한다', () => {
  const music = coursesForSemester('1-1').find((item) => item.subjectName === '음악');
  const record = recordFromCourse(music, 'selected-music');
  assert.equal(record.gradingType, 'achievement');
  assert.equal(record.fiveLevelEligible, false);
  assert.equal(record.gradeValue, '');
  assert.equal(record.achievement, '');
  assert.deepEqual(gradingInputs(record.gradingType), { grade: false, achievement: true, passfail: false });
});
