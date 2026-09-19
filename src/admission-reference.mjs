import { admissionResultsByYear } from './admission-results/index.mjs';
import { normalizeAdmissionReferenceData } from './admission-reference-core.mjs';
export * from './admission-reference-core.mjs';

// 연도별 모듈만 교체·추가하면 화면 코드 수정 없이 자료를 갱신할 수 있다.
export const ADMISSION_REFERENCE_DATA = Object.freeze(normalizeAdmissionReferenceData(admissionResultsByYear[2026]));
