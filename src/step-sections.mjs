/**
 * STEP 3·4 접고 펴기. 접힌 영역도 DOM에 그대로 남아 있어 입력값이 지워지지 않는다.
 * 요소는 <details>와 같은 모양({ open, dataset })이기만 하면 되므로 테스트에서는 가짜 객체를 쓴다.
 */

export const COLLAPSIBLE_STEP_IDS = Object.freeze({
  analysis: 'analysis-section',
  admission: 'admission-section',
});

const present = (elements) => [...elements].filter(Boolean);

export function openStep(element) {
  if (element && !element.open) element.open = true;
}

export function closeSteps(elements) {
  present(elements).forEach((element) => { element.open = false; });
}

/** 제목 줄의 안내 문구를 "내신을 계산하면 열려요"와 "눌러서 열기" 중에서 고르는 표시값이다. */
export function markStepsReady(elements, ready) {
  present(elements).forEach((element) => {
    if (!element.dataset) return;
    if (ready) element.dataset.ready = 'true';
    else delete element.dataset.ready;
  });
}

/** 인쇄 중에는 모든 단계를 펼치고, 끝나면 인쇄 전 상태로 되돌리는 함수를 돌려준다. */
export function expandForPrint(elements) {
  const targets = present(elements);
  const previous = targets.map((element) => Boolean(element.open));
  targets.forEach((element) => { element.open = true; });
  return () => targets.forEach((element, index) => { element.open = previous[index]; });
}

export function bindPrintExpansion(elements, windowRef = globalThis.window) {
  if (!windowRef || typeof windowRef.addEventListener !== 'function') return () => {};
  let restore = null;
  const onBeforePrint = () => { if (!restore) restore = expandForPrint(elements); };
  const onAfterPrint = () => { if (restore) { restore(); restore = null; } };
  windowRef.addEventListener('beforeprint', onBeforePrint);
  windowRef.addEventListener('afterprint', onAfterPrint);
  return () => {
    windowRef.removeEventListener?.('beforeprint', onBeforePrint);
    windowRef.removeEventListener?.('afterprint', onAfterPrint);
  };
}

/** 위쪽에 붙어 있는(sticky) 상단바 높이만큼 비워서 제목이 가려지지 않게 스크롤한다. */
export function scrollStepIntoView(element, { windowRef = globalThis.window, documentRef = globalThis.document } = {}) {
  if (!element || !windowRef || typeof windowRef.scrollTo !== 'function') return;
  const topbar = documentRef?.querySelector?.('.topbar');
  const stuck = topbar && windowRef.getComputedStyle?.(topbar).position === 'sticky';
  const offset = (stuck ? topbar.getBoundingClientRect().height + 10 : 0) + 12;
  const top = element.getBoundingClientRect().top + (windowRef.scrollY || 0) - offset;
  const reduceMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  windowRef.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
}
