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

test('표시 기준 토글 없이 카드에서 5등급 환산과 9등급 원본을 함께 표시한다', () => {
  assert.equal(html.includes('name="admission-scale"'), false);
  assert.equal(html.includes('등급제 표시'), false);
  assert.equal(html.includes('<span>표시 기준</span>'), false);
  assert.equal(app.includes('admissionGradeScaleMode'), false);
  assert.equal(app.includes("admissionComparisonCut(item, 'original')"), false);
  assert.match(app, /5등급제 환산 참고/);
  assert.match(app, /원본 9등급제/);
  assert.match(app, /comparisonEnabled: true/);
});

test('학과 검색은 대학 선택 없이 사용할 수 있는 검색 입력과 자동완성 후보를 갖는다', () => {
  assert.match(html, /id="admission-department"[^>]+type="search"/);
  assert.equal(html.includes('list="admission-department-suggestions"'), false);
  assert.match(html, /role="combobox"[^>]+aria-controls="admission-department-suggestions"[^>]+aria-expanded="false"/);
  assert.match(html, /id="admission-department-suggestions"[^>]+role="listbox"[^>]+hidden/);
  assert.match(html, /enterkeyhint="search"/);
  assert.match(html, /placeholder="학과\/모집단위 검색 \(예: 경제, 간호, 공학\)"/);
  assert.match(app, /departmentInput\.disabled = !admissionViewMode/);
  assert.equal(app.includes("key === 'department' && !admissionFilters.university"), false);
  assert.equal(app.includes('대학을 먼저 선택하세요'), false);
});

test('학과 자유 입력은 자동완성 선택 없이 입력·Enter·변경 시 결과를 다시 렌더링한다', () => {
  assert.match(app, /DEPARTMENT_SEARCH_DEBOUNCE_MS = 180/);
  assert.match(app, /admissionFilters\.department = event\.target\.value\.trim\(\)/);
  assert.match(app, /departmentSearchTimer = window\.setTimeout\(\(\) => \{[\s\S]*?renderAdmissionReferences\(\)/);
  assert.match(app, /if \(key === 'department'\)[\s\S]*?renderAdmissionReferences\(\)/);
  assert.match(app, /if \(event\.key !== 'Enter' \|\| event\.isComposing\) return;[\s\S]*?closeDepartmentSuggestions\(\);[\s\S]*?renderAdmissionReferences\(\)/);
});

test('학과 자동완성은 입력 중에만 열리고 확정·취소 동작에서 즉시 닫힌다', () => {
  assert.match(app, /let isDepartmentSuggestionsOpen = false/);
  assert.match(app, /isDepartmentSuggestionsOpen = Boolean\(admissionViewMode && admissionFilters\.department && options\.departmentSuggestions\.length\)/);
  assert.match(app, /if \(event\.key === 'Escape'\)[\s\S]*?closeDepartmentSuggestions\(\)/);
  assert.match(app, /data-department-suggestion[\s\S]*?closeDepartmentSuggestions\(\)[\s\S]*?renderAdmissionReferences\(\)/);
  assert.match(app, /document\.addEventListener\('pointerdown',[\s\S]*?\.admission-department-field[\s\S]*?closeDepartmentSuggestions\(\)/);
  assert.match(app, /#admission-view-button'\)\.addEventListener\('click',[\s\S]*?closeDepartmentSuggestions\(\)/);
  assert.match(app, /#admission-department'\)\.addEventListener\('(?:focus|click)', openDepartmentSuggestions\)/);
});

test('학과 자동완성 후보 선택은 자유 검색어와 별개로 적용되고 목록을 닫는다', () => {
  assert.match(app, /option\.dataset\.departmentSuggestion\.trim\(\)/);
  assert.match(app, /admissionFilters\.department = option\.dataset\.departmentSuggestion\.trim\(\)/);
  assert.match(app, /role="option" data-department-suggestion/);
  assert.match(app, /input\.setAttribute\('aria-expanded', String\(visible\)\)/);
});
