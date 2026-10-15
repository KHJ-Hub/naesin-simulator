import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentRankReference, normalizeStudentRankReference } from '../src/student-rank-reference.mjs';

test('실제 석차와 산출 인원으로 상위 비율을 소수점 첫째 자리까지 계산한다', () => {
  assert.deepEqual(buildStudentRankReference({ rank: '37', total: '200' }), {
    status: 'valid', rank: 37, total: 200, percentage: 18.5, percentageLabel: '18.5%', summary: '37 / 200명 · 상위 18.5%',
  });
  assert.equal(buildStudentRankReference({ rank: 1, total: 200 }).percentageLabel, '0.5%');
  assert.equal(buildStudentRankReference({ rank: 200, total: 200 }).percentageLabel, '100%');
  assert.equal(buildStudentRankReference({ rank: 40, total: 200 }).percentageLabel, '20%');
});

test('석차가 인원보다 크거나 양의 정수가 아니면 계산하지 않는다', () => {
  assert.equal(buildStudentRankReference({ rank: 201, total: 200 }).status, 'invalid');
  for (const rank of ['0', '-1', '1.5', '학생']) {
    const result = buildStudentRankReference({ rank, total: '200' });
    assert.equal(result.status, 'invalid');
    assert.equal(result.percentage, null);
  }
});

test('입력 전 또는 한쪽만 입력하면 결과를 표시하지 않는다', () => {
  assert.equal(buildStudentRankReference({}).status, 'empty');
  assert.equal(buildStudentRankReference({ rank: '37' }).status, 'incomplete');
  assert.equal(buildStudentRankReference({ total: '200' }).status, 'incomplete');
});

test('백업 복원용 정규화는 유효한 양의 정수만 보존한다', () => {
  assert.deepEqual(normalizeStudentRankReference({ rank: '037', total: 200 }), { rank: '37', total: '200' });
  assert.deepEqual(normalizeStudentRankReference({ rank: '-1', total: 'x' }), { rank: '', total: '' });
});
