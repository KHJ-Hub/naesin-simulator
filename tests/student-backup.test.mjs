import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentBackup, parseStudentBackup } from '../src/student-backup.mjs';

test('현재 학생 프로필을 JSON 백업 형식으로 복제한다', () => {
  const profile = { student: { studentId: '10101', studentName: '김학생' }, actual: [], admissionInterests: [] };
  const backup = createStudentBackup(profile, '2026-09-17T00:00:00.000Z');
  backup.student.studentName = '변경';
  assert.equal(profile.student.studentName, '김학생');
  assert.equal(backup.exportedAt, '2026-09-17T00:00:00.000Z');
});

test('정상 백업은 불러오고 잘못된 JSON과 타 형식은 거부한다', () => {
  const restored = parseStudentBackup(JSON.stringify({ student: { studentId: '10101' }, actual: [] }));
  assert.deepEqual(restored.actual, []);
  assert.throws(() => parseStudentBackup('{bad'), /JSON/);
  assert.throws(() => parseStudentBackup(JSON.stringify({ student: {} })), /백업 형식/);
});
