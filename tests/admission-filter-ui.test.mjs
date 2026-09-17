import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

test('입시결과 주요 필터를 아코디언 없이 모두 노출한다', () => {
  assert.equal(html.includes('필터 더보기'), false);
  assert.equal(html.includes('class="admission-filter-details"'), false);
  assert.equal(html.includes('id="admission-category"'), false);
  assert.match(html, /class="admission-filter-grid"/);
  assert.match(html, /학과\/모집단위 검색/);
});

test('학과 검색은 대학 선택 없이 사용할 수 있는 검색 입력과 자동완성 후보를 갖는다', () => {
  assert.match(html, /id="admission-department"[^>]+type="search"/);
  assert.match(html, /list="admission-department-suggestions"/);
  assert.match(html, /placeholder="예: 경제, 간호, 컴퓨터"/);
  assert.match(app, /departmentInput\.disabled = !admissionViewMode/);
  assert.equal(app.includes("key === 'department' && !admissionFilters.university"), false);
  assert.equal(app.includes('대학을 먼저 선택하세요'), false);
});
