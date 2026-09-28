import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTRY_YEAR_CATALOG_METADATA, OFFICIAL_CURRICULUM_SOURCES, SCHOOL_COURSES, commonCourses, coursesForSemester, gradingInputs, recordFromCourse } from '../src/course-catalog.mjs';

test('2025·2026 카탈로그는 공식 편성표 출처를 각각 보존하고 2027 학생용 과목은 등록하지 않는다', () => {
  assert.equal(OFFICIAL_CURRICULUM_SOURCES[2025].sourceDate, '2026-09-03');
  assert.equal(OFFICIAL_CURRICULUM_SOURCES[2026].status, 'confirmed');
  assert.equal(SCHOOL_COURSES.some((course) => course.entryYear === 2027), false);
  assert.equal(ENTRY_YEAR_CATALOG_METADATA[2025].studentChoiceCredits['3-1'], 24);
  assert.equal(ENTRY_YEAR_CATALOG_METADATA[2026].studentChoiceCredits['3-1'], 27);
  const keys = SCHOOL_COURSES.map((course) => `${course.entryYear}:${course.id}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(SCHOOL_COURSES.every((course) => course.subjectName && course.credit > 0 && ['common', 'general', 'career', 'fusion'].includes(course.curriculumCategory)));
});

test('2025 입학생 반별 지정 과목과 제2외국어 선택 관계를 공식 편성표대로 구분한다', () => {
  const classOne = coursesForSemester('2-1', 2025).filter((course) => course.requirement === 'school-designated' && course.classConditions.includes('1'));
  const classFive = coursesForSemester('2-1', 2025).filter((course) => course.requirement === 'school-designated' && course.classConditions.includes('5'));
  assert.ok(classOne.some((course) => course.subjectName === '미술 창작'));
  assert.ok(classOne.some((course) => course.subjectName === '일본어' && course.selectionGroup === 'second-language'));
  assert.ok(classFive.some((course) => course.subjectName === '음악 연주와 창작'));
  assert.ok(classFive.some((course) => course.subjectName === '정보'));
});

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
  assert.equal(record.entryYear, 2026);
  assert.deepEqual(gradingInputs(record.gradingType), { grade: false, achievement: true, passfail: false });
});
