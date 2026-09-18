import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentBackup, parseStudentBackup } from '../src/student-backup.mjs';

test('현재 학생 프로필을 JSON 백업 형식으로 복제한다', () => {
  const profile = { student: { studentId: '10101', studentName: '김학생' }, actual: [], admissionInterests: [{ university: '검증대학교', department: '경제학과' }] };
  const backup = createStudentBackup(profile, '2026-09-17T00:00:00.000Z');
  backup.student.studentName = '변경';
  assert.equal(profile.student.studentName, '김학생');
  assert.equal(backup.admissionInterests[0].department, '경제학과');
  assert.equal(backup.exportedAt, '2026-09-17T00:00:00.000Z');
});

test('관심 대학은 백업과 불러오기 왕복 후에도 유지된다', () => {
  const profile = { student: { studentId: '10101', studentName: '김학생' }, actual: [], admissionInterests: [{ university: '검증대학교', department: '경제학과', admissionName: '일반전형' }] };
  const restored = parseStudentBackup(JSON.stringify(createStudentBackup(profile, '2026-09-17T00:00:00.000Z')));
  assert.deepEqual(restored.admissionInterests, profile.admissionInterests);
});

test('정상 백업은 불러오고 잘못된 JSON과 타 형식은 거부한다', () => {
  const restored = parseStudentBackup(JSON.stringify({ student: { studentId: '10101' }, actual: [] }));
  assert.deepEqual(restored.actual, []);
  assert.throws(() => parseStudentBackup('{bad'), /JSON/);
  assert.throws(() => parseStudentBackup(JSON.stringify({ student: {} })), /백업 형식/);
});
