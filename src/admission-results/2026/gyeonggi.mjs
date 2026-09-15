import { admissionResults2026 } from '../admission-results-2026.mjs';
import { admissionResults2026GyeonggiGenerated } from './generated/gyeonggi.mjs';

/** 경기도의 공식 2026학년도 공개 결과만 제공한다. */
export const admissionResults2026Gyeonggi = Object.freeze(
  [
    ...admissionResults2026.filter((item) => item.region === '경기도'),
    ...admissionResults2026GyeonggiGenerated,
  ],
);
