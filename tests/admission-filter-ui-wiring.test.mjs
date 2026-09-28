import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('지원 유형 선택지는 canonical eligibility select id에 연결된다', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /<select id="admission-support-type"/);
  assert.match(html, /지원 유형/);
  assert.match(app, /\['supportType', 'admission-support-type', options\.supportTypes, '전체', ADMISSION_SUPPORT_TYPE_LABELS\]/);
  assert.match(app, /'admission-support-type': 'supportType'/);
  assert.doesNotMatch(html, /id="admission-name"/);
  assert.doesNotMatch(app, /#admission-\$\{key\}/);
});
