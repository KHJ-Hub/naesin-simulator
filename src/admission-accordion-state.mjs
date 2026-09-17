export const ADMISSION_UNIVERSITY_INITIAL_GROUP_COUNT = 10;
export const ADMISSION_UNIVERSITY_INITIAL_RESULT_COUNT = 5;

export function createAdmissionAccordionState(defaultExpandedKeys = []) {
  const defaults = new Set(defaultExpandedKeys.map(String));
  const overrides = new Map();

  const isExpanded = (key) => {
    const normalized = String(key ?? '');
    return overrides.has(normalized) ? overrides.get(normalized) : defaults.has(normalized);
  };

  return Object.freeze({
    isExpanded,
    setExpanded(key, expanded) {
      const normalized = String(key ?? '');
      overrides.set(normalized, Boolean(expanded));
      return Boolean(expanded);
    },
    toggle(key) {
      const normalized = String(key ?? '');
      const next = !isExpanded(normalized);
      overrides.set(normalized, next);
      return next;
    },
    reset() {
      overrides.clear();
    },
  });
}
