const STRICT_ACCENTED_PROFANITY = [
  'đĩ', 'di~', 'lồn', 'cặc', 'buồi', 'đéo', 'đkm', 'đm', 'chó đẻ', 'đái', 'ỉa',
];

const UNACCENTED_PROFANITY = [
  'dkm', 'vkl', 'vcl', 'fuck', 'bitch', 'shit', 'asshole', 'bastard', 'dick', 'cunt', 'pussy',
  'lừa đảo', 'lừa tiền', 'scam', 'bắn chết',
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ');
}

function escapeRegex(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// Precompile all RegExp rules once at module load for O(1) runtime overhead
const PRECOMPILED_ACCENTED = STRICT_ACCENTED_PROFANITY.map((kw) => ({
  kw,
  regex: new RegExp(`(^|\\s|[^\\p{L}\\p{N}])${escapeRegex(kw)}($|\\s|[^\\p{L}\\p{N}])`, 'iu'),
  censorRegex: new RegExp(`(^|\\s|[^\\p{L}\\p{N}])${escapeRegex(kw)}(?=$|\\s|[^\\p{L}\\p{N}])`, 'giu'),
}));

const PRECOMPILED_UNACCENTED = UNACCENTED_PROFANITY.map((kw) => ({
  kw,
  regex: new RegExp(`(^|\\s)${escapeRegex(normalizeText(kw).trim())}($|\\s)`, 'i'),
  censorRegex: new RegExp(`(^|\\s|[^\\p{L}\\p{N}])${escapeRegex(kw)}(?=$|\\s|[^\\p{L}\\p{N}])`, 'giu'),
}));

export function getProfanityMatch(text: string): string | null {
  if (!text) return null;
  const lowerRaw = text.toLowerCase();
  const normalized = normalizeText(text);

  for (const rule of PRECOMPILED_ACCENTED) {
    if (rule.regex.test(lowerRaw)) {
      return rule.kw;
    }
  }

  for (const rule of PRECOMPILED_UNACCENTED) {
    if (rule.regex.test(normalized)) {
      return rule.kw;
    }
  }

  return null;
}

export function containsProfanity(text: string): boolean {
  return getProfanityMatch(text) !== null;
}

export function censorProfanity(text: string): string {
  if (!text) return '';
  let censored = text;
  for (const rule of PRECOMPILED_ACCENTED) {
    censored = censored.replace(rule.censorRegex, '$1***');
  }
  for (const rule of PRECOMPILED_UNACCENTED) {
    censored = censored.replace(rule.censorRegex, '$1***');
  }
  return censored;
}
