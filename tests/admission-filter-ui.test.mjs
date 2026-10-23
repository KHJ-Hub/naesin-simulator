import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

function departmentHandler(eventName, selector = '#admission-department') {
  const start = app.indexOf(`$('${selector}').addEventListener('${eventName}', `);
  assert.ok(start >= 0);
  const body = app.slice(start + app.slice(start).indexOf('(event) => {') + '(event) => {'.length);
  return `(() => {${body.slice(0, body.indexOf('\n});'))}\n})()`;
}

test('Enter는 자유 검색어를 확정하고 조합 중 Enter·Esc는 추천창을 조작하지 않는다', () => {
  const commits = [];
  let closes = 0;
  const input = { value: '경제' };
  const context = vm.createContext({
    event: { key: 'Enter', target: input, preventDefault() {} },
    isDepartmentSearchComposing: false,
    ignoreNativeDepartmentSearchUntil: 0,
    Date,
    commitDepartmentSearch(target) { commits.push(target.value); },
    closeDepartmentSuggestions() { closes += 1; },
  });
  const handler = departmentHandler('keydown');
  vm.runInContext(handler, context);
  assert.deepEqual(commits, ['경제']);
  for (const flags of [{ isComposing: true }, { keyCode: 229 }, {}]) {
    context.isDepartmentSearchComposing = Object.keys(flags).length === 0;
    context.event = { key: 'Enter', target: input, ...flags, preventDefault() { assert.fail('조합 입력을 차단하면 안 됨'); } };
    vm.runInContext(handler, context);
  }
  assert.deepEqual(commits, ['경제']);
  assert.equal(closes, 0);
  context.isDepartmentSearchComposing = false;
  context.event = { key: 'Escape', target: input, preventDefault() {} };
  vm.runInContext(handler, context);
  assert.equal(closes, 1);
  assert.equal(input.value, '경제');
});

test('추천 선택은 검색어를 확정하고 닫으며 추천 목록에 선택 안내를 제공한다', () => {
  let closed = false;
  let rendered = false;
  const input = { value: '경제' };
  const context = vm.createContext({
    event: { target: { closest: () => ({ dataset: { departmentSuggestion: '농업경제학과' } }) } },
    admissionFilters: { department: '경제' },
    $: () => input,
    clearTimeout() {}, departmentSearchTimer: null,
    closeDepartmentSuggestions() { closed = true; },
    resetAdmissionViewPaging() {}, renderAdmissionReferences() { rendered = true; },
  });
  vm.runInContext(departmentHandler('click', '#admission-department-suggestions'), context);
  assert.equal(input.value, '농업경제학과');
  assert.equal(context.admissionFilters.department, '농업경제학과');
  assert.ok(closed && rendered);
  assert.match(app, /관련 모집단위/);
  assert.match(app, /선택하지 않아도 입력한 검색어 전체로 검색돼요\./);
});

test('바깥 클릭은 검색어를 보존하고 닫으며 목록 내부 클릭은 선택 전에 닫지 않는다', () => {
  const start = app.indexOf("document.addEventListener('pointerdown', (event) => {");
  const body = app.slice(start).split('\n});')[0].split('(event) => {')[1];
  let closed = 0;
  const context = vm.createContext({
    admissionFilters: { department: '경제' },
    event: { target: { closest: () => true } },
    closeDepartmentSuggestions() { closed += 1; },
  });
  vm.runInContext(`(() => {${body}})()`, context);
  assert.equal(closed, 0);
  context.event.target.closest = () => null;
  vm.runInContext(`(() => {${body}})()`, context);
  assert.equal(closed, 1);
  assert.equal(context.admissionFilters.department, '경제');
});

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
  assert.match(html, /inputmode="search"/);
  assert.match(html, /placeholder="학과\/모집단위 검색 \(예: 경제, 간호, 공학\)"/);
  assert.match(app, /departmentInput\.disabled = false/);
  assert.equal(app.includes("key === 'department' && !admissionFilters.university"), false);
  assert.equal(app.includes('대학을 먼저 선택하세요'), false);
});

test('학과 자유 입력은 자동완성 선택 없이 입력·Enter·변경 시 결과를 다시 렌더링한다', () => {
  assert.match(app, /DEPARTMENT_SEARCH_DEBOUNCE_MS = 180/);
  assert.match(app, /function updateDepartmentSuggestions\(input,[\s\S]*?admissionFilters\.department = input\.value\.trim\(\)/);
  assert.match(app, /departmentSearchTimer = window\.setTimeout\(async \(\) => \{[\s\S]*?renderAdmissionReferences\(\)/);
  assert.match(app, /if \(key === 'department'\)[\s\S]*?renderAdmissionReferences\(\)/);
  assert.match(app, /if \(event\.key !== 'Enter'\) return;[\s\S]*?commitDepartmentSearch\(event\.target, \{ dismissKeyboard: true, revealResults: true \}\)/);
  assert.match(app, /addEventListener\('search',[\s\S]*?commitDepartmentSearch\(event\.target, \{ dismissKeyboard: true, revealResults: true \}\)/);
});

test('학과 자동완성은 입력 중에만 열리고 확정·취소 동작에서 즉시 닫힌다', () => {
  assert.match(app, /let isDepartmentSuggestionsOpen = false/);
  assert.match(app, /isDepartmentSuggestionsOpen = Boolean\(admissionFilters\.department && options\.departmentSuggestions\.length\)/);
  assert.match(app, /if \(event\.key === 'Escape'\)[\s\S]*?closeDepartmentSuggestions\(\)/);
  assert.match(app, /data-department-suggestion[\s\S]*?closeDepartmentSuggestions\(\)[\s\S]*?renderAdmissionReferences\(\)/);
  assert.match(app, /document\.addEventListener\('pointerdown',[\s\S]*?\.admission-department-field[\s\S]*?closeDepartmentSuggestions\(\)/);
  assert.match(app, /#admission-view-button'\)\.addEventListener\('click',[\s\S]*?closeDepartmentSuggestions\(\)/);
  assert.match(app, /#admission-department'\)\.addEventListener\('focus',[\s\S]*?openDepartmentSuggestions\(\)/);
  assert.match(app, /#admission-department'\)\.addEventListener\('click', openDepartmentSuggestions\)/);
  assert.match(app, /function closeDepartmentSuggestions\(\) \{\s*departmentSearchRequestVersion \+= 1/);
  assert.match(app, /requestVersion === departmentSearchRequestVersion && document\.activeElement === \$\('#admission-department'\)/);
});

test('모바일 한글 IME 조합 종료 시 후보를 즉시 갱신하고 조합 중 Search 입력을 보존한다', () => {
  assert.match(app, /let isDepartmentSearchComposing = false/);
  assert.doesNotMatch(app, /pendingDepartmentSearchCommit/);
  assert.match(app, /addEventListener\('compositionstart',[\s\S]*?isDepartmentSearchComposing = true/);
  assert.match(app, /addEventListener\('compositionupdate',[\s\S]*?updateDepartmentSuggestions\(event\.target\)/);
  assert.match(app, /addEventListener\('compositionend',[\s\S]*?updateDepartmentSuggestions\(event\.target\)[\s\S]*?scheduleDepartmentSearchRender\(\)/);
  assert.match(app, /event\.isComposing \|\| isDepartmentSearchComposing \|\| event\.keyCode === 229/);
});

test('모바일 Search 확정은 키보드를 닫고 결과 영역으로 이동한다', () => {
  assert.match(app, /if \(dismissKeyboard\) input\.blur\(\)/);
  assert.match(app, /await ensureAdmissionData\(\{ allWhenUnscoped: true \}\)/);
  assert.match(app, /scrollAdmissionResultsIntoView[\s\S]*?scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(app, /ignoreNativeDepartmentSearchUntil = Date\.now\(\) \+ 500/);
});

test('학과 자동완성 후보 선택은 자유 검색어와 별개로 적용되고 목록을 닫는다', () => {
  assert.match(app, /option\.dataset\.departmentSuggestion\.trim\(\)/);
  assert.match(app, /admissionFilters\.department = option\.dataset\.departmentSuggestion\.trim\(\)/);
  assert.match(app, /role="option" data-department-suggestion/);
  assert.match(app, /input\.setAttribute\('aria-expanded', String\(visible\)\)/);
});
