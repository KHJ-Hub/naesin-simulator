import { APP_BUILD_DATE, APP_VERSION } from './app-version.mjs?v=20260921-version-label1';
import {
  createAnonymousFeedbackPayload,
  submitAnonymousFeedback,
} from './feedback-core.mjs?v=20260921-student-feedback2';

function currentSectionLabel() {
  const sections = [...document.querySelectorAll('main section')];
  const center = window.innerHeight / 2;
  const visible = sections
    .map((section) => ({ section, distance: Math.abs(section.getBoundingClientRect().top - center) }))
    .sort((a, b) => a.distance - b.distance)[0]?.section;
  return visible?.querySelector('h2, h3')?.textContent?.trim()
    || visible?.id
    || '학생용 화면';
}

function showFeedbackStatus(element, message, type = '') {
  element.textContent = message;
  element.dataset.type = type;
}

export function setupStudentFeedback() {
  const openButton = document.querySelector('[data-feedback-open]');
  const dialog = document.querySelector('#student-feedback-dialog');
  const form = document.querySelector('#student-feedback-form');
  const closeButtons = dialog ? [...dialog.querySelectorAll('[data-feedback-close]')] : [];
  const status = document.querySelector('#student-feedback-status');
  const submitButton = form?.querySelector('button[type="submit"]');
  if (!openButton || !dialog || !form || !status || !submitButton) return;

  const closeDialog = () => {
    if (dialog.open) dialog.close();
    openButton.focus();
  };
  openButton.addEventListener('click', () => {
    showFeedbackStatus(status, '');
    dialog.showModal();
    form.elements.category.focus();
  });
  closeButtons.forEach((button) => button.addEventListener('click', closeDialog));
  dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;
    try {
      const payload = createAnonymousFeedbackPayload({
        category: form.elements.category.value,
        message: form.elements.message.value,
        grade: form.elements.grade.value,
      }, {
        appVersion: APP_VERSION,
        buildDate: APP_BUILD_DATE,
        currentSection: currentSectionLabel(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        userAgent: navigator.userAgent,
        submittedAt: new Date().toISOString(),
      });
      submitButton.disabled = true;
      submitButton.textContent = '보내는 중...';
      showFeedbackStatus(status, '');
      await submitAnonymousFeedback(payload);
      form.reset();
      showFeedbackStatus(status, '의견을 보냈어요. 알려줘서 고마워요!', 'success');
      window.setTimeout(closeDialog, 850);
    } catch (error) {
      const validationMessage = /선택|입력|1200자/.test(error?.message ?? '') ? error.message : '의견을 보내지 못했어요. 잠시 후 다시 시도해 주세요.';
      showFeedbackStatus(status, validationMessage, 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = '의견 보내기';
    }
  });
}
