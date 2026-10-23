import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('공개 프런트 설정에는 공개 가능한 Apps Script endpoint만 있고 관리자 비밀번호는 없다', async () => {
  const config = await read('../src/feedback-config.mjs');
  assert.match(config, /FEEDBACK_GAS_URL\s*=\s*'https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec'/);
  assert.doesNotMatch(config, /FEEDBACK_ADMIN_PASSWORD\s*=/);
});

test('Pages 배포물은 실행에 필요한 정적 파일만 허용 목록으로 구성한다', async () => {
  const workflow = await read('../.github/workflows/deploy-pages.yml');
  assert.match(workflow, /mkdir -p _site/);
  assert.match(workflow, /cp index\.html teacher\.html teacher-consult\.html styles\.css _site\//);
  assert.match(workflow, /cp -R src _site\/src/);
  assert.match(workflow, /path: _site/);
  assert.doesNotMatch(workflow, /path:\s*\./);
});

test('Pages workflow action은 검증 가능한 immutable SHA로 고정한다', async () => {
  const workflow = await read('../.github/workflows/deploy-pages.yml');
  ['checkout', 'setup-node', 'configure-pages', 'upload-pages-artifact', 'deploy-pages'].forEach((action) => {
    assert.match(workflow, new RegExp(`uses: actions/${action}@[0-9a-f]{40}`));
  });
  const dependabot = await read('../.github/dependabot.yml');
  assert.match(dependabot, /package-ecosystem: github-actions/);
});

test('정적 페이지는 현재 외부 연결 범위에 맞는 meta CSP를 사용한다', async () => {
  const pages = await Promise.all(['../index.html', '../teacher.html', '../teacher-consult.html'].map(read));
  pages.forEach((html) => {
    assert.match(html, /http-equiv="Content-Security-Policy"/);
    assert.match(html, /script-src 'self'/);
    assert.match(html, /connect-src 'self' https:\/\/script\.google\.com https:\/\/script\.googleusercontent\.com/);
    assert.match(html, /object-src 'none'/);
    assert.match(html, /base-uri 'self'/);
    assert.match(html, /frame-src 'none'/);
    assert.match(html, /meta name="referrer" content="strict-origin-when-cross-origin"/);
  });
});

test('익명 의견의 학생 입력은 Google Sheet 수식으로 실행되지 않게 중립화한다', async () => {
  const script = await read('../google-apps-script/feedback-api.gs');
  assert.match(script, /function feedbackSafeSheetText_/);
  assert.match(script, /\^\[=\+\\-@\]/);
  assert.match(script, /feedbackSafeSheetText_\(item\.message\)/);
  assert.match(script, /feedbackSafeSheetText_\(rawNote\)/);
});

test('관리자 의견 조회와 수정은 서버의 관리자 토큰 검증 뒤에만 실행한다', async () => {
  const script = await read('../google-apps-script/feedback-api.gs');
  assert.match(script, /action === 'listFeedback'[\s\S]*?feedbackRequireAdmin_\(request\.adminToken\)[\s\S]*?feedbackList_/);
  assert.match(script, /action === 'updateFeedback'[\s\S]*?feedbackRequireAdmin_\(request\.adminToken\)[\s\S]*?feedbackUpdate_/);
  assert.match(script, /PropertiesService\.getScriptProperties\(\)/);
  assert.match(script, /FEEDBACK_LOGIN_MAX_FAILURES\s*=\s*5/);
  assert.match(script, /FEEDBACK_LOGIN_LOCKOUT_SECONDS\s*=\s*900/);
  assert.match(script, /feedbackAdminLogout_/);
});

test('민감 파일과 학생 백업·로그·소스맵을 기본적으로 Git에서 제외한다', async () => {
  const ignore = await read('../.gitignore');
  ['.env', '.env.*', 'secrets.*', 'credentials.*', 'service-account*.json', 'backup*.json', 'student*.json', '*.log', '*.map'].forEach((entry) => {
    assert.ok(ignore.includes(entry), `${entry} 누락`);
  });
});
