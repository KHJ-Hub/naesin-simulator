const DEFAULT_PRINT_TITLE = '내신설계노트_결과표';

function safeTitlePart(value, maxLength = 40) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** 브라우저 PDF 저장 제안에 쓰는 제목이며, 실제 파일명 다운로드를 강제하지 않는다. */
export function createStudentPrintTitle(student = {}) {
  const studentId = String(student?.studentId ?? '').replace(/\D/g, '').slice(0, 5);
  const studentName = safeTitlePart(student?.studentName, 30);
  if (!/^\d{5}$/.test(studentId) || !studentName) return DEFAULT_PRINT_TITLE;
  return `내신설계노트_${studentId}_${studentName}`;
}

/**
 * 인쇄 요청을 시작하는 순간에만 문서 제목을 바꾼다.
 * PDF 저장 파일명은 브라우저가 결정하므로 제목만 힌트로 제공하고 즉시 원복한다.
 */
export function printStudentReport({ documentRef = globalThis.document, windowRef = globalThis.window, student = {} } = {}) {
  if (!documentRef || !windowRef || typeof windowRef.print !== 'function') return { printed: false, title: DEFAULT_PRINT_TITLE };
  const originalTitle = documentRef.title;
  const title = createStudentPrintTitle(student);
  documentRef.title = title;
  try {
    windowRef.print();
    return { printed: true, title };
  } finally {
    documentRef.title = originalTitle;
  }
}
