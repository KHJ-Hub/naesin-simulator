import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentPrintTitle, printStudentReport } from '../src/print-ux.mjs';

test('학생 정보가 완전하면 PDF 저장에 쓸 안전한 인쇄 제목을 만든다', () => {
  assert.equal(createStudentPrintTitle({ studentId: '20101', studentName: '홍 길동' }), '내신설계노트_20101_홍 길동');
  assert.equal(createStudentPrintTitle({ studentId: '20-101', studentName: '홍/길:동?' }), '내신설계노트_20101_홍길동');
});

test('학생 정보가 불완전하면 안전한 기본 인쇄 제목을 쓴다', () => {
  assert.equal(createStudentPrintTitle({ studentId: '2010', studentName: '홍길동' }), '내신설계노트_결과표');
  assert.equal(createStudentPrintTitle({ studentId: '20101', studentName: '' }), '내신설계노트_결과표');
});

test('인쇄 요청 시에만 제목을 바꾸고 print 호출 뒤 원래 제목으로 복원한다', () => {
  const documentRef = { title: '배정고 내신 설계 노트' };
  let observedTitle = '';
  const windowRef = { print() { observedTitle = documentRef.title; } };
  const result = printStudentReport({ documentRef, windowRef, student: { studentId: '20101', studentName: '홍길동' } });
  assert.deepEqual(result, { printed: true, title: '내신설계노트_20101_홍길동' });
  assert.equal(observedTitle, '내신설계노트_20101_홍길동');
  assert.equal(documentRef.title, '배정고 내신 설계 노트');
});
