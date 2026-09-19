import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const studentCopyFiles = [
  '../index.html',
  '../src/app.mjs',
  '../src/admission-reference.mjs',
  '../src/admission-local-comparison.mjs',
  '../src/grade-calculator.mjs',
  '../src/student-backup.mjs',
];

const studentCopy = (await Promise.all(
  studentCopyFiles.map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
)).join('\n');

test('학생용 안내·오류·성공 문구는 차분한 해요체를 사용한다', () => {
  const formalEndings = [
    /합니다\./,
    /됩니다\./,
    /입니다\./,
    /없습니다\./,
    /있습니다\./,
    /않습니다\./,
    /하세요\./,
    /해주세요\./,
  ];

  formalEndings.forEach((ending) => assert.doesNotMatch(studentCopy, ending));
  assert.match(studentCopy, /현재 내신을 계산해요\./);
  assert.match(studentCopy, /백업 데이터를 불러왔어요\./);
  assert.match(studentCopy, /전년도 입결 기준 참고예요\./);
});
