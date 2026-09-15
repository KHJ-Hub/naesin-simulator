import { admissionResults2026 } from '../admission-results-2026.mjs';
import { admissionResults2026GyeongnamGenerated } from './generated/gyeongnam.mjs';

export const admissionResults2026Gyeongnam = Object.freeze([
  ...admissionResults2026.filter((item) => item.region === '경상남도'),
  ...admissionResults2026GyeongnamGenerated,
]);
