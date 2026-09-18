import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');

test('동적 결과 컨테이너가 관심 대학 저장 클릭을 직접 위임 처리한다', () => {
  assert.match(app, /#admission-reference-result'\)\.addEventListener\('click',[\s\S]*?closest\('\[data-admission-save\]'\)[\s\S]*?preventDefault\(\)[\s\S]*?stopPropagation\(\)[\s\S]*?updateAdmissionInterest/);
});

test('관심 대학 삭제는 관심 목록 컨테이너에서 독립 처리한다', () => {
  assert.match(app, /#admission-interests'\)\.addEventListener\('click',[\s\S]*?closest\('\[data-admission-remove\]'\)[\s\S]*?updateAdmissionInterest\(removeButton\.dataset\.admissionRemove, 'remove'\)/);
});

test('저장 버튼은 폼 기본 제출을 막는 button 타입과 저장 상태를 가진다', () => {
  assert.match(app, /<button type="button" class="quiet-button admission-save\$\{saved \? ' is-saved' : ''\}"[\s\S]*?aria-pressed="\$\{saved\}"/);
});
