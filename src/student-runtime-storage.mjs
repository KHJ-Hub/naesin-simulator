/** URL의 test=1 여부만으로 학생 저장소를 격리한다. */
export function isStudentTestMode(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(String(search)).get('test') === '1';
}

/** 새로고침하면 사라지는 localStorage 호환 메모리 저장소. */
export function createMemoryStorage(initialValues = {}) {
  const values = new Map(
    Object.entries(initialValues).map(([key, value]) => [String(key), String(value)]),
  );

  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); },
  };
}

/**
 * 일반 접속은 기존 localStorage를 그대로 사용하고, test=1에서는 매 페이지 로드마다
 * 새 메모리 저장소를 사용한다. 테스트 모드에서 영구 저장소를 읽거나 지우지 않는다.
 */
export function createStudentRuntimeStorage({
  search = globalThis.location?.search ?? '',
  persistentStorage = globalThis.localStorage,
} = {}) {
  const testMode = isStudentTestMode(search);
  return Object.freeze({
    isTestMode: testMode,
    storage: testMode ? createMemoryStorage() : persistentStorage,
  });
}
