import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTRY_YEAR_CATALOG_METADATA, OFFICIAL_CURRICULUM_SOURCES, SCHOOL_COURSES, commonCourses, coursesForSemester, gradingInputs, recordFromCourse } from '../src/course-catalog.mjs';
import { calculateOverallAverage } from '../src/grade-calculator.mjs';

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

test('공식 학생 자율 과목 풀은 상위 학기에서 선택 가능하고 학기별 선택량은 별도 메타데이터로 보존한다', () => {
  for (const entryYear of [2025, 2026]) {
    for (const semesterId of ['2-1', '2-2', '3-1', '3-2']) {
      const courses = coursesForSemester(semesterId, entryYear);
      assert.ok(courses.some((course) => course.subjectName === '세포와 물질 대사' && course.selectionGroup === 'student-choice-pool'));
      assert.ok(courses.some((course) => course.subjectName === '경제' && course.selectionGroup === 'student-choice-pool'));
    }
  }
  assert.equal(coursesForSemester('2-1', 2025).some((course) => course.subjectName === '운동과 건강' && course.selectionGroup === 'student-choice-pool'), true);
  assert.equal(coursesForSemester('2-1', 2026).some((course) => course.subjectName === '운동과 건강'), false);
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

test('2025·2026 보통교과 체육·예술 교과군은 전수 A/B/C 성취도로 처리한다', () => {
  const byYear = new Map([[2025, 0], [2026, 0]]);
  const bodyAndArts = SCHOOL_COURSES.filter((course) => ['체육', '예술'].includes(course.subjectGroup));
  for (const course of bodyAndArts) {
    byYear.set(course.entryYear, byYear.get(course.entryYear) + 1);
    assert.equal(course.gradingType, 'achievement', `${course.entryYear} ${course.semesterId} ${course.subjectName}`);
    assert.equal(course.achievementScale, 'a-c', `${course.entryYear} ${course.semesterId} ${course.subjectName}`);
    assert.equal(course.fiveLevelEligible, false, `${course.entryYear} ${course.semesterId} ${course.subjectName}`);
    assert.equal(course.achievementOnly, true, `${course.entryYear} ${course.semesterId} ${course.subjectName}`);
  }
  assert.equal(byYear.get(2025), 24);
  assert.equal(byYear.get(2026), 14);
  for (const subjectName of ['체육1', '체육2', '스포츠 생활1', '스포츠 생활2', '스포츠 문화', '스포츠 과학', '운동과 건강', '스포츠 경기 체력', '음악', '음악 연주와 창작', '음악 감상과 비평', '음악과 문화', '미술', '미술 창작']) {
    assert.ok(bodyAndArts.some((course) => course.subjectName === subjectName), `${subjectName}이 카탈로그에 있어야 해요.`);
  }
});

test('체육·예술 A/B/C 과목은 숫자값이 있어도 현재 내신 평균에서 제외한다', () => {
  const gradeRecord = { subjectName: '공통국어1', semesterId: '1-1', credit: 4, gradingType: 'grade', fiveLevelEligible: true, gradeValue: '2' };
  const sport = coursesForSemester('2-1', 2025).find((course) => course.subjectName === '운동과 건강');
  const achievementRecord = { ...recordFromCourse(sport, 'exercise'), achievement: 'A', gradeValue: '1' };
  assert.equal(calculateOverallAverage([gradeRecord, achievementRecord], true), 2);
  assert.equal(calculateOverallAverage([gradeRecord, achievementRecord], false), 2);
});

test('선택 과목 레코드는 선택 풀 정보를 보존한다', () => {
  const course = coursesForSemester('2-1', 2026).find((item) => item.subjectName === '경제');
  assert.equal(recordFromCourse(course, 'selected-economics').selectionGroup, 'student-choice-pool');
});
