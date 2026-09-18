import { ENABLE_TEACHER_QUICK_MODE } from './feature-flags.mjs';

const consultationApp = document.querySelector('#teacher-consult-app');
const unavailableNotice = document.querySelector('#teacher-consult-unavailable');

if (ENABLE_TEACHER_QUICK_MODE) {
  if (consultationApp) consultationApp.hidden = false;
  if (unavailableNotice) unavailableNotice.hidden = true;
  import('./teacher-consult-app.mjs?v=20260918-busan-compact2');
} else {
  if (consultationApp) consultationApp.hidden = true;
  if (unavailableNotice) unavailableNotice.hidden = false;
}
