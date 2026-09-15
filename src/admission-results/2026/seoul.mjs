import { admissionResults2026SeoulGenerated } from './generated/seoul.mjs';
import { admissionResults2026SahmyookOfficial } from './official/sahmyook.mjs';

export const admissionResults2026Seoul = Object.freeze([
  ...admissionResults2026SeoulGenerated,
  ...admissionResults2026SahmyookOfficial,
]);
