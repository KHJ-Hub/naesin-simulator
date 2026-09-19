import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, html, loader, styles, version] = await Promise.all([
  readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/admission-results-loader.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  import('../src/app-version.mjs'),
]);

test('학생 초기 진입 번들은 전국 입결과 감사 데이터를 정적 import하지 않는다', () => {
  assert.doesNotMatch(app, /from ['"]\.\/admission-reference\.mjs/);
  assert.doesNotMatch(app, /from ['"].*university-audit-2026\.mjs/);
  assert.match(app, /from ['"]\.\/admission-reference-core\.mjs/);
  assert.match(app, /from ['"]\.\/admission-results-loader\.mjs/);
});

test('입결은 지역별 동적 import와 메모리 캐시를 사용한다', () => {
  assert.equal((loader.match(/await import\(modulePath\)/g) ?? []).length, 1);
  assert.match(loader, /const cache = new Map\(\)/);
  assert.match(loader, /if \(!cache\.has\(region\)\)/);
  assert.equal((loader.match(/admission-results\/2026\//g) ?? []).length, 17);
  assert.match(app, /ensureAdmissionData\(\{ allWhenUnscoped: true \}\)/);
  assert.match(app, /await loadAdmissionRegion\('busan'\)[\s\S]*?findLocalAdmissionComparisons\(item, admissionReferenceData\)/);
});

test('접힌 입결 그룹은 카드 DOM을 만들지 않고 펼칠 때만 렌더링한다', () => {
  assert.match(app, /const expandedContent = isExpanded[\s\S]*?visibleUniversities\.map/);
  assert.match(app, /: '';/);
  assert.match(app, /admissionResultGroupExpanded\.toggle\(key\);\s*renderAdmissionReferences\(\);/);
});

test('동적 UI 이벤트 위임은 컨테이너마다 한 번만 등록된다', () => {
  assert.equal((app.match(/#admission-reference-result'\)\.addEventListener\('click'/g) ?? []).length, 1);
  assert.equal((app.match(/#admission-interests'\)\.addEventListener\('click'/g) ?? []).length, 1);
  assert.equal((app.match(/semesterCards\.addEventListener\('click'/g) ?? []).length, 1);
});

test('버전은 한 모듈에서 관리되고 화면 하단에 표시된다', () => {
  assert.equal(version.APP_VERSION, '1.0.0');
  assert.equal(version.APP_BUILD_DATE, '2026.09.19');
  assert.match(html, /id="app-version"/);
  assert.match(app, /v\$\{APP_VERSION\} · \$\{APP_BUILD_DATE\}/);
  assert.match(styles, /\.app-version\s*\{/);
});

test('루트 CSS와 JS에는 동일 배포 버전 쿼리가 붙는다', () => {
  const cssVersion = html.match(/styles\.css\?v=([^"']+)/)?.[1];
  const jsVersion = html.match(/src\/app\.mjs\?v=([^"']+)/)?.[1];
  assert.ok(cssVersion);
  assert.equal(jsVersion, cssVersion);
});

test('학생 런타임에는 외부 전송 API나 분석 스크립트가 없다', () => {
  assert.doesNotMatch(app, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|gtag\s*\(|analytics/i);
  assert.doesNotMatch(html, /googletagmanager|google-analytics|segment|mixpanel|hotjar/i);
});
