/**
 * High-Speed Profanity & Toxic Content Moderation Filter for TrekMap
 */

// Words that require exact accent/diacritics because their accentless form collides with common Vietnamese words
// (e.g. "đi" vs "đĩ", "đèo" vs "đéo", "buổi" vs "buồi", "các" vs "cặc", "lon" vs "lồn")
const STRICT_ACCENTED_PROFANITY = [
  'đĩ', 'di~', 'lồn', 'cặc', 'buồi', 'đéo', 'đkm', 'đm', 'chó đẻ', 'đái', 'ỉa'
];

// Unaccented toxic words that are unequivocally profane/toxic
const UNACCENTED_PROFANITY = [
  'dkm', 'vkl', 'vcl', 'fuck', 'bitch', 'shit', 'asshole', 'bastard', 'dick', 'cunt', 'pussy',
  'lừa đảo', 'lừa tiền', 'scam', 'bắn chết'
];

/**
 * Normalizes text for accent-insensitive keyword matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ');
}

/**
 * Checks if text contains toxic/profanity keywords
 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  
  const lowerRaw = text.toLowerCase();
  const normalized = normalizeText(text);

  // 1. Check exact accented profanities (must match exact word boundary in raw text)
  for (const kw of STRICT_ACCENTED_PROFANITY) {
    const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(^|\\s|[^\\p{L}\\p{N}])${escaped}($|\\s|[^\\p{L}\\p{N}])`, 'iu');
    if (regex.test(lowerRaw)) {
      return true;
    }
  }

  // 2. Check unaccented profanities against normalized text
  for (const kw of UNACCENTED_PROFANITY) {
    const normKw = normalizeText(kw).trim();
    const regex = new RegExp(`(^|\\s)${normKw}($|\\s)`, 'i');
    if (regex.test(normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the specific violating keyword detected (if any)
 */
export function getProfanityMatch(text: string): string | null {
  if (!text) return null;
  const lowerRaw = text.toLowerCase();
  const normalized = normalizeText(text);

  for (const kw of STRICT_ACCENTED_PROFANITY) {
    const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(^|\\s|[^\\p{L}\\p{N}])${escaped}($|\\s|[^\\p{L}\\p{N}])`, 'iu');
    if (regex.test(lowerRaw)) {
      return kw;
    }
  }

  for (const kw of UNACCENTED_PROFANITY) {
    const normKw = normalizeText(kw).trim();
    const regex = new RegExp(`(^|\\s)${normKw}($|\\s)`, 'i');
    if (regex.test(normalized)) {
      return kw;
    }
  }

  return null;
}

/**
 * Censors profanity words with asterisks (***)
 */
export function censorProfanity(text: string): string {
  if (!text) return '';
  let censored = text;
  const allKeywords = [...STRICT_ACCENTED_PROFANITY, ...UNACCENTED_PROFANITY];

  for (const kw of allKeywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    censored = censored.replace(regex, '***');
  }

  return censored;
}
