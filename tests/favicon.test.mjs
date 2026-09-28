import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';

const pages = ['index.html', 'teacher.html', 'teacher-consult.html'];
const assets = ['favicon.ico', 'favicon-32x32.png', 'favicon-64x64.png', 'apple-touch-icon.png'];

test('학생·관리자·빠른상담 페이지는 GitHub Pages 하위 경로에서도 동작하는 상대 favicon 경로를 사용한다', async () => {
  await Promise.all(assets.map(async (asset) => {
    const target = new URL(`../${asset}`, import.meta.url);
    await access(target);
    assert.ok((await stat(target)).size > 0, `${asset} 파일이 비어 있지 않아야 합니다.`);
  }));
  for (const page of pages) {
    const html = await readFile(new URL(`../${page}`, import.meta.url), 'utf8');
    assert.match(html, /rel="icon" href="\.\/favicon\.ico\?v=20260928-favicon2" sizes="any"/);
    assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\.\/favicon-32x32\.png\?v=20260928-favicon2"/);
    assert.match(html, /rel="icon" type="image\/png" sizes="64x64" href="\.\/favicon-64x64\.png\?v=20260928-favicon2"/);
    assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\.\/apple-touch-icon\.png\?v=20260928-favicon2"/);
  }
});

test('GitHub Pages 배포 산출물에는 모든 favicon 파일을 포함한다', async () => {
  const workflow = await readFile(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');
  assert.match(workflow, /cp favicon\.ico favicon-32x32\.png favicon-64x64\.png apple-touch-icon\.png _site\//);
});
