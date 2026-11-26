import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SCHOOL_COURSES } from '../src/course-catalog.mjs';
import { SEMESTER_OFFERINGS, isOfferedInSemester } from '../src/semester-offerings.mjs';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const offeredNames = (entryYear, semesterId) => SCHOOL_COURSES
  .filter((course) => course.entryYear === entryYear && course.semesterId === semesterId && course.selectionGroup === 'student-choice-pool')
  .filter(isOfferedInSemester)
  .map(({ subjectName }) => subjectName);

test('개설 과목 이름은 모두 그 학기 학생 자율 선택 과목으로 카탈로그에 있다', () => {
  for (const [year, semesters] of Object.entries(SEMESTER_OFFERINGS)) {
    for (const [semesterId, names] of Object.entries(semesters)) {
      for (const name of names) {
        assert.ok(SCHOOL_COURSES.some((course) => course.entryYear === Number(year) && course.semesterId === semesterId && course.subjectName === name && course.selectionGroup === 'student-choice-pool'), `${year} ${semesterId} ${name}`);
      }
      assert.equal(new Set(names).size, names.length, `${year} ${semesterId} 중복`);
    }
  }
});

test('2025 입학생 2학년 학기별 개설 과목 수와 대표 과목 (편성표 초록 칸)', () => {
  assert.equal(offeredNames(2025, '2-1').length, 15);
  assert.equal(offeredNames(2025, '2-2').length, 17);
  assert.ok(offeredNames(2025, '2-1').includes('문학'));
  assert.ok(!offeredNames(2025, '2-1').includes('독서와 작문'));
  assert.ok(offeredNames(2025, '2-2').includes('독서와 작문'));
  assert.ok(!offeredNames(2025, '2-2').includes('문학'));
  assert.ok(offeredNames(2025, '3-1').includes('화법과 언어'));
});

test('계열 지정 과목은 모두 그 학기 개설 과목 안에 있다', () => {
  const trackNames = {
    '2-1': ['문학', '영어Ⅰ', '대수', '미적분Ⅰ', '세계시민과 지리', '사회와 문화', '물리학', '생명과학'],
    '2-2': ['독서와 작문', '영어Ⅱ', '확률과 통계', '현대사회와 윤리', '정치', '경제', '화학', '지구과학'],
  };
  for (const year of [2025, 2026]) {
    for (const [semesterId, names] of Object.entries(trackNames)) {
      for (const name of names) assert.ok(offeredNames(year, semesterId).includes(name), `${year} ${semesterId} ${name}`);
    }
  }
});

test('개설 정보가 없는 과목(학교 지정, R&E, 정보 없는 학기)은 거르지 않는다', () => {
  assert.equal(isOfferedInSemester({ selectionGroup: null, subjectName: '음악', entryYear: 2025, semesterId: '1-1' }), true);
  assert.equal(isOfferedInSemester({ selectionGroup: 'research-elective', subjectName: '주제 탐구(R&E) 기초', entryYear: 2025, semesterId: '2-1' }), true);
  assert.equal(isOfferedInSemester({ selectionGroup: 'student-choice-pool', subjectName: '문학', entryYear: 2024, semesterId: '2-1' }), true);
});

test('과목 추가 목록에만 개설 필터를 쓴다', () => {
  assert.match(app, /selectableCoursesForSemester\(semesterId, context\.entryYear, \{ classNumber \}\)\.filter\(isOfferedInSemester\)/);
  assert.equal((app.match(/isOfferedInSemester/g) || []).length, 2);
});

test('노란색 칸(편성 학기 추가 수정)도 개설 과목으로 본다: 2026 입학생 3학년', () => {
  assert.ok(offeredNames(2026, '3-1').includes('확률과 통계'));
  assert.ok(offeredNames(2026, '3-1').includes('영어Ⅱ'));
  assert.ok(offeredNames(2026, '3-2').includes('영어 독해와 작문'));
  assert.ok(offeredNames(2026, '2-2').includes('확률과 통계'));
  assert.ok(!offeredNames(2025, '3-1').includes('확률과 통계'));
});
