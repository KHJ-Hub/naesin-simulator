import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('전형명 선택지는 실제 select id에 연결된다', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /<select id="admission-name"/);
  assert.match(app, /\['admissionName', 'admission-name', options\.admissionNames, '전체 전형명'\]/);
  assert.doesNotMatch(app, /#admission-\$\{key\}/);
});
