import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SEMESTERS } from '../src/grade-calculator.mjs';
import { hiddenSemesterCount, nextVisibleSemesterId, visibleSemesters } from '../src/semester-visibility.mjs';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const ids = (list) => list.map(({ id }) => id);

test('학번의 학년에 맞춰 1학년은 1학년 학기만, 2학년은 2학년 2학기까지, 3학년은 전체를 보여준다', () => {
  assert.deepEqual(ids(visibleSemesters(SEMESTERS, { grade: 1 })), ['1-1', '1-2']);
  assert.deepEqual(ids(visibleSemesters(SEMESTERS, { grade: 2 })), ['1-1', '1-2', '2-1', '2-2']);
  assert.deepEqual(ids(visibleSemesters(SEMESTERS, { grade: 3 })), ['1-1', '1-2', '2-1', '2-2', '3-1']);
});

test('학번이 없거나 올바르지 않으면 지금처럼 모든 학기를 보여준다', () => {
  for (const grade of [null, undefined, 0, 4, NaN, '1']) {
    assert.deepEqual(ids(visibleSemesters(SEMESTERS, { grade })), ids(SEMESTERS), String(grade));
  }
  assert.deepEqual(ids(visibleSemesters(SEMESTERS)), ids(SEMESTERS));
});

test('이미 입력한 내용이 있는 학기는 학년과 상관없이 계속 보여준다', () => {
  const hasContent = (id) => id === '3-1' || id === '2-1';
  assert.deepEqual(ids(visibleSemesters(SEMESTERS, { grade: 1, hasContent })), ['1-1', '1-2', '2-1', '3-1']);
});

test('숨긴 학기 수와 다음 보이는 학기를 계산한다', () => {
  assert.equal(hiddenSemesterCount(SEMESTERS, { grade: 1 }), 3);
  assert.equal(hiddenSemesterCount(SEMESTERS, { grade: 3 }), 0);
  assert.equal(hiddenSemesterCount(SEMESTERS, { grade: null }), 0);
  const visible = visibleSemesters(SEMESTERS, { grade: 1 });
  assert.equal(nextVisibleSemesterId(visible, '1-1'), '1-2');
  assert.equal(nextVisibleSemesterId(visible, '1-2'), null);
  assert.equal(nextVisibleSemesterId(visible, '3-1'), null);
});

test('원본 학기 목록은 바뀌지 않고 걸러낸 결과는 새 배열이다', () => {
  const before = ids(SEMESTERS);
  const result = visibleSemesters(SEMESTERS, { grade: 1 });
  assert.notEqual(result, SEMESTERS);
  assert.deepEqual(ids(SEMESTERS), before);
});

test('화면 연결: 걸러낸 목록으로 카드를 만들고 안내 문구 자리가 있으며 계산·저장 코드는 SEMESTERS 전체를 쓴다', () => {
  assert.match(html, /id="semester-visibility-note"[^>]*hidden/);
  assert.match(app, /grade: catalogContext\.grade, hasContent: semesterHasContent/);
  assert.match(app, /nextVisibleSemesterId\(visibleSemesterList\(\), semesterId\)/);
  assert.match(app, /semesterId: SEMESTERS\.some\(\(semester\) => semester\.id === record\.semesterId\)/);
  assert.match(app, /activeSemester: SEMESTERS\.some\(/);
});
