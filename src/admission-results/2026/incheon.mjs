import { admissionResults2026 } from '../admission-results-2026.mjs';

/** 인천광역시의 공식 2026학년도 공개 결과만 제공한다. */
export const admissionResults2026Incheon = Object.freeze(
  admissionResults2026.filter((item) => item.region === '인천광역시'),
);
