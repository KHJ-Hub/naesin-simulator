import { admissionResults2026 } from '../admission-results-2026.mjs';
import { admissionResults2026BusanGenerated } from './generated/busan.mjs';

export const admissionResults2026Busan = Object.freeze([
  ...admissionResults2026.filter((item) => item.region === '부산광역시'),
  ...admissionResults2026BusanGenerated,
]);
