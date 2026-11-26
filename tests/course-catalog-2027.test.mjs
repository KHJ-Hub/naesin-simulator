import assert from 'node:assert/strict';
import test from 'node:test';
import { SCHOOL_COURSES, UNCONFIRMED_ENTRY_YEARS } from '../src/course-catalog.mjs';
import { selectableCoursesForSemester } from '../src/course-catalog-store.mjs';
import { getSupportedEntryYears, resolveEntryYear } from '../src/student-course-catalog.mjs';
import { isOfferedInSemester } from '../src/semester-offerings.mjs';

const y2027 = SCHOOL_COURSES.filter((course) => course.entryYear === 2027);
const designated = (semesterId, classNumber) => y2027
  .filter((course) => course.semesterId === semesterId && course.requirement === 'school-designated' && course.active !== false)
  .filter((course) => !course.classConditions.length || course.classConditions.includes(String(classNumber)));
const credits = (list) => list.reduce((sum, course) => sum + course.credit, 0);
const names = (list) => list.map(({ subjectName }) => subjectName);

test('2027 입학생은 데이터만 있고 학생 화면에서는 아직 쓰지 않는다', () => {
  assert.ok(UNCONFIRMED_ENTRY_YEARS.includes(2027));
  assert.deepEqual(getSupportedEntryYears(SCHOOL_COURSES), [2025, 2026]);
  assert.equal(resolveEntryYear({ studentId: '10101' }).entryYear, 2026);
});

test('2027 학교 지정 학점 합계가 편성표 학기별 소계(31·31·12·12·5·5)와 같다', () => {
  for (const [semesterId, expected] of [['1-1', 31], ['1-2', 31], ['2-1', 12], ['2-2', 12], ['3-1', 5], ['3-2', 5]]) {
    assert.equal(credits(designated(semesterId, 1)), expected, `${semesterId} 1반`);
    assert.equal(credits(designated(semesterId, 5)), expected, `${semesterId} 5반`);
  }
});

test('2027 반별 지정 과목: 1학년 음악·정보/미술·진로와 직업, 2학년 미술 창작·일본어/음악 연주와 창작·보건', () => {
  const classed = (semesterId, classNumber) => names(designated(semesterId, classNumber).filter((course) => course.classConditions.length));
  assert.deepEqual(classed('1-1', 1), ['음악', '정보']);
  assert.deepEqual(classed('1-2', 1), ['미술', '진로와 직업']);
  assert.deepEqual(classed('1-1', 4), ['미술', '진로와 직업']);
  assert.deepEqual(classed('1-2', 4), ['음악', '정보']);
  assert.deepEqual(classed('2-1', 3), ['미술 창작', '일본어']);
  assert.deepEqual(classed('2-2', 3), ['음악 연주와 창작', '보건']);
  assert.deepEqual(classed('2-1', 6), ['음악 연주와 창작', '보건']);
  assert.deepEqual(classed('2-2', 6), ['미술 창작', '일본어']);
});

test('2027 문학·미적분Ⅰ·영어Ⅱ는 학교 지정 등급 과목이고 학생 선택 풀에는 없다', () => {
  for (const [name, semesterId] of [['미적분Ⅰ', '2-1'], ['문학', '2-2'], ['영어Ⅱ', '3-1']]) {
    const course = y2027.find((item) => item.subjectName === name && item.requirement === 'school-designated');
    assert.equal(course.semesterId, semesterId, name);
    assert.equal(course.gradingType, 'grade', name);
    assert.equal(course.credit, 4, name);
    assert.ok(!y2027.some((item) => item.subjectName === name && item.selectionGroup === 'student-choice-pool'), name);
  }
});

test('2027 데이터 과학은 정보 진로선택 등급 과목이고 2학년 1학기에 개설된다', () => {
  const data = y2027.filter((course) => course.subjectName === '데이터 과학');
  assert.ok(data.length > 0);
  assert.ok(data.every((course) => course.gradingType === 'grade' && course.fiveLevelEligible === true && course.curriculumCategory === 'career' && course.subjectGroup === '기술·가정/정보'));
  assert.deepEqual(data.filter(isOfferedInSemester).map((course) => course.semesterId), ['2-1']);
});

test('2027 중국어는 닫혀 있고, 체육·예술은 A/B/C 성취도, 보건·진로와 직업은 P/F다', () => {
  assert.ok(!names(selectableCoursesForSemester('2-1', 2027)).includes('중국어'));
  assert.ok(y2027.filter((course) => ['체육', '예술'].includes(course.subjectGroup)).every((course) => course.gradingType === 'achievement' && course.achievementScale === 'a-c'));
  assert.ok(y2027.filter((course) => ['보건', '진로와 직업'].includes(course.subjectName)).every((course) => course.gradingType === 'passfail'));
});

test('2027 학기별 개설 과목: 노란 칸 포함, 학생 선택 과목 수', () => {
  const offered = (semesterId) => names(y2027.filter((course) => course.semesterId === semesterId && course.selectionGroup === 'student-choice-pool').filter(isOfferedInSemester));
  assert.equal(offered('2-1').length, 16);
  assert.equal(offered('2-2').length, 22);
  assert.ok(offered('2-1').includes('세계사'));
  assert.ok(offered('2-2').includes('화법과 언어'));
  assert.ok(offered('3-1').includes('확률과 통계'));
});
