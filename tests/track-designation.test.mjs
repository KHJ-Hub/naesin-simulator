import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SCHOOL_COURSES } from '../src/course-catalog.mjs';
import { selectableCoursesForSemester } from '../src/course-catalog-store.mjs';
import {
  TRACK_NONE,
  TRACK_OPTIONS,
  designatedCoursesForTrack,
  hasTrackDesignation,
  trackSubjectNames,
} from '../src/track-designation.mjs';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const names = (list) => list.map(({ subjectName }) => subjectName);
const fill = (entryYear, semesterId, track, classNumber = null) => names(designatedCoursesForTrack(SCHOOL_COURSES, { entryYear, semesterId, track, classNumber }));

test('계열 버튼은 편제 자료의 이름 그대로 인문·자연과 선택 안 함이다', () => {
  assert.deepEqual(TRACK_OPTIONS.map(({ label }) => label), ['인문', '자연', '선택 안 함']);
});

test('트랙 표의 과목 이름은 2025·2026 입학생 카탈로그에서 모두 찾을 수 있다', () => {
  for (const entryYear of [2025, 2026]) {
    for (const semesterId of ['2-1', '2-2']) {
      for (const track of ['인문', '자연', TRACK_NONE]) {
        const pool = SCHOOL_COURSES.filter((course) => course.entryYear === entryYear && course.semesterId === semesterId);
        const expected = trackSubjectNames(semesterId, track, pool);
        const filled = fill(entryYear, semesterId, track);
        for (const name of expected) assert.ok(filled.includes(name), `${entryYear} ${semesterId} ${track} ${name}`);
      }
    }
  }
});

test('2025 입학생 2학년 계열별 지정 과목 (반 정보 없음)', () => {
  assert.deepEqual(fill(2025, '2-1', TRACK_NONE), ['문학', '영어Ⅰ']);
  assert.deepEqual(fill(2025, '2-1', '인문'), ['문학', '영어Ⅰ', '대수', '미적분Ⅰ', '세계시민과 지리', '사회와 문화']);
  assert.deepEqual(fill(2025, '2-1', '자연'), ['문학', '영어Ⅰ', '대수', '미적분Ⅰ', '물리학', '생명과학']);
  assert.deepEqual(fill(2025, '2-2', TRACK_NONE), ['독서와 작문', '영어Ⅱ']);
  assert.deepEqual(fill(2025, '2-2', '인문'), ['독서와 작문', '영어Ⅱ', '확률과 통계', '현대사회와 윤리', '정치', '경제']);
  assert.deepEqual(fill(2025, '2-2', '자연'), ['독서와 작문', '영어Ⅱ', '확률과 통계', '화학', '지구과학']);
});

test('권장 과목은 사회·과학만 채우고 국어·수학·영어 권장(미적분Ⅱ)은 채우지 않는다', () => {
  assert.ok(fill(2025, '2-2', '인문').includes('정치'));
  assert.ok(!fill(2025, '2-2', '자연').includes('미적분Ⅱ'));
  assert.ok(!fill(2026, '2-2', '자연').includes('미적분Ⅱ'));
});

test('학교 지정 과목은 등급 과목만, 지금 반 기준으로 채우고 중국어는 넣지 않는다', () => {
  assert.deepEqual(fill(2025, '2-1', TRACK_NONE, 1), ['일본어', '문학', '영어Ⅰ']);
  assert.deepEqual(fill(2025, '2-1', TRACK_NONE, 5), ['정보', '문학', '영어Ⅰ']);
  assert.deepEqual(fill(2025, '2-2', TRACK_NONE, 4), ['정보', '독서와 작문', '영어Ⅱ']);
  assert.deepEqual(fill(2025, '2-2', TRACK_NONE, 7), ['일본어', '독서와 작문', '영어Ⅱ']);
  assert.deepEqual(fill(2026, '2-1', TRACK_NONE, 3), ['일본어', '문학', '영어Ⅰ']);
  assert.deepEqual(fill(2026, '2-1', TRACK_NONE, 4), ['정보', '문학', '영어Ⅰ']);
  for (const track of ['인문', '자연', TRACK_NONE]) {
    const filled = fill(2025, '2-1', track, 1);
    assert.ok(!filled.includes('중국어'));
    assert.ok(!filled.some((name) => ['미술 창작', '음악 연주와 창작', '스포츠 문화', '주제 탐구(R&E) 기초'].includes(name)), track);
  }
});

test('계열 채우기는 1학년·3학년 학기와 지원하지 않는 입학 연도에는 쓰지 않는다', () => {
  assert.equal(hasTrackDesignation('1-1', 2025), false);
  assert.equal(hasTrackDesignation('3-1', 2025), false);
  assert.equal(hasTrackDesignation('2-1', 2024), false);
  assert.deepEqual(fill(2025, '1-1', '인문'), []);
});

test('채워 넣는 과목은 카탈로그 원본을 그대로 쓰고 과목 유형을 바꾸지 않는다', () => {
  const filled = designatedCoursesForTrack(SCHOOL_COURSES, { entryYear: 2025, semesterId: '2-2', track: '인문', classNumber: 1 });
  for (const course of filled) {
    const original = SCHOOL_COURSES.find((item) => item.entryYear === 2025 && item.id === course.id);
    assert.equal(course, original);
    assert.equal(course.curriculumCategory, original.curriculumCategory);
    assert.equal(course.requirement, original.requirement);
  }
});

test('중국어는 과목 추가 목록에서 빠진다', () => {
  for (const entryYear of [2025, 2026]) {
    for (const semesterId of ['2-1', '2-2']) {
      assert.ok(!names(selectableCoursesForSemester(semesterId, entryYear)).includes('중국어'));
    }
  }
});

test('반 정보 없이 조회하면 1학년 두 학기 목록 모두에 음악·미술·보건·진로가 나온다', () => {
  for (const semesterId of ['1-1', '1-2']) {
    const list = names(selectableCoursesForSemester(semesterId, 2025, { classNumber: null }));
    for (const name of ['음악', '미술', '보건', '진로와 직업']) assert.ok(list.includes(name), `${semesterId} ${name}`);
  }
  assert.deepEqual(names(selectableCoursesForSemester('1-1', 2026, { classNumber: 2 })).filter((name) => ['음악', '미술', '보건', '진로와 직업'].includes(name)), ['음악', '보건']);
});

test('화면 연결: 지난 학년은 반을 쓰지 않고, 계열 선택은 state·백업에 저장하지 않는다', () => {
  assert.match(app, /return semesterGrade === studentCatalogContext\(\)\.grade \? Number\(studentId\.slice\(1, 3\)\) : null;/);
  assert.match(app, /const classNumber = classNumberForSemester\(semesterId\);\s*const available = selectableCoursesForSemester/);
  assert.match(app, /음악·미술·보건·진로는 성적표를 보고 들은 학기에 직접 추가해 주세요\./);
  assert.match(app, /let semesterTrackChoices = \{\};/);
  const defaults = app.slice(app.indexOf('const defaultState = () => ({'), app.indexOf('});', app.indexOf('const defaultState = () => ({')));
  assert.doesNotMatch(defaults, /track/i);
  assert.doesNotMatch(app, /state\.(semesterTrack|track)/);
  assert.match(app, /\$\{trackPickerHtml\(semesterId\)\}<div class="grade-list">/);
  // 예전 백업에 중국어가 있으면 같은 학기 일본어를 또 넣지 않는다(택1 묶음).
  assert.match(app, /course\.requirement === 'school-designated' && course\.selectionGroup && record\.semesterId === semesterId && record\.selectionGroup === course\.selectionGroup/);
});
