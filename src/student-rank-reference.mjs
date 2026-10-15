function rawValue(value) {
  return String(value ?? '').trim();
}

function positiveInteger(value) {
  const text = rawValue(value);
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 1 ? number : null;
}

export function normalizeStudentRankReference(value = {}) {
  const rank = positiveInteger(value?.rank);
  const total = positiveInteger(value?.total);
  return {
    rank: rank === null ? '' : String(rank),
    total: total === null ? '' : String(total),
  };
}

export function formatTopRate(percentage) {
  if (!Number.isFinite(percentage)) return '';
  const rounded = Math.round(percentage * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

export function buildStudentRankReference(value = {}) {
  const rankText = rawValue(value?.rank);
  const totalText = rawValue(value?.total);
  if (!rankText && !totalText) return { status: 'empty', rank: null, total: null, percentage: null, percentageLabel: '' };
  if (!rankText || !totalText) return { status: 'incomplete', rank: null, total: null, percentage: null, percentageLabel: '' };

  const rank = positiveInteger(rankText);
  const total = positiveInteger(totalText);
  if (rank === null || total === null) {
    return { status: 'invalid', rank: null, total: null, percentage: null, percentageLabel: '', message: '석차와 인원은 1 이상의 정수로 입력해 주세요.' };
  }
  if (rank > total) {
    return { status: 'invalid', rank, total, percentage: null, percentageLabel: '', message: '실제 석차는 석차 산출 인원보다 클 수 없어요.' };
  }

  const percentage = (rank / total) * 100;
  return {
    status: 'valid',
    rank,
    total,
    percentage,
    percentageLabel: formatTopRate(percentage),
    summary: `${rank} / ${total}명 · 상위 ${formatTopRate(percentage)}`,
  };
}
