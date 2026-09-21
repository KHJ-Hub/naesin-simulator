import test from 'node:test';
import assert from 'node:assert/strict';
import { admissionResultsByYear } from '../src/admission-results/index.mjs';
import { buildAdmissionDataDashboard } from '../src/admission-data-dashboard-core.mjs';
import { normalizeAdmissionMajorName } from '../src/admission-major-taxonomy.mjs';
import {
  inferAcademicFieldFromDepartment,
  normalizeAdmissionRecord,
} from '../src/admission-record-normalizer.mjs';
import { UNIVERSITY_AUDIT_2026 } from '../src/data/university-audit-2026.mjs';
import { UNIVERSITIES } from '../src/data/universities.mjs';

test('모집단위 표기 정규화는 원문 의미를 보존하고 운영 표기만 정리한다', () => {
  assert.equal(normalizeAdmissionMajorName('  디지털융합학과（야）  '), '디지털융합학과');
  assert.equal(normalizeAdmissionMajorName('지능・데이터융합학부'), '지능·데이터융합학부');
  assert.equal(normalizeAdmissionMajorName('문화지식융합학부  HCI사이언스전공'), '문화지식융합학부 HCI사이언스전공');
});

test('의미가 명확한 누락 전공만 기존 canonical 계열로 안전하게 보강한다', () => {
  const natural = ['건강관리학과', '지적학과', '생활과학계열', '스마트그린학부', '가상현실학과', '말산업학과'];
  const humanities = ['창의인재개발학과'];
  const other = ['디지털밀리터리학과', '첨단방위산업학과', '항공보안학과', '장례문화산업학과', '자율융합계열', '자율설계학부'];
  natural.forEach((name) => assert.equal(inferAcademicFieldFromDepartment(name), 'natural', name));
  humanities.forEach((name) => assert.equal(inferAcademicFieldFromDepartment(name), 'humanities', name));
  other.forEach((name) => assert.equal(inferAcademicFieldFromDepartment(name), 'other', name));
});

test('의류·패션·게임·디지털콘텐츠와 일반 융합 명칭은 억지로 단일 계열로 분류하지 않는다', () => {
  for (const name of ['의류학과', '패션산업학과', '게임콘텐츠학과', '디지털콘텐츠학과', '첨단융합학부', '미래융합학과']) {
    assert.equal(inferAcademicFieldFromDepartment(name), 'unknown', name);
  }
  assert.equal(inferAcademicFieldFromDepartment('자유전공학부'), 'other');
  assert.equal(inferAcademicFieldFromDepartment('무전공'), 'other');
});

test('계열 추론은 입결 raw record를 수정하지 않는다', () => {
  const raw = Object.freeze({ university: '검증대학교', department: '지적학과', admissionCategory: '학생부교과' });
  const normalized = normalizeAdmissionRecord(raw);
  assert.equal(normalized.academicField, 'natural');
  assert.equal('academicField' in raw, false);
  assert.equal(raw.department, '지적학과');
});

test('전국 데이터의 안전 분류와 미분류 수를 고정하고 0건 대학 원인을 감사 상태와 분리한다', () => {
  const dashboard = buildAdmissionDataDashboard(admissionResultsByYear[2026], UNIVERSITIES, {
    universityAudits: UNIVERSITY_AUDIT_2026,
  });
  assert.equal(dashboard.summary.quality.academicFieldInfo.inferredByNormalization, 5);
  assert.equal(dashboard.summary.quality.academicFieldInfo.inferredByTaxonomy, 16036);
  assert.equal(dashboard.summary.quality.academicFieldInfo.unclassified, 218);
  assert.deepEqual(dashboard.summary.quality.zeroResultInfo.byReason, {
    'source-review-needed': 1,
    'outside-current-scope': 6,
    'official-not-published': 13,
  });
  assert.equal(dashboard.summary.quality.zeroResultInfo.total, 20);
  assert.equal(dashboard.summary.quality.actionableCount, 219);
  assert.equal(dashboard.warnings.filter((item) => item.type === '입결 0건' && item.severity === 'info').length, 19);
});
