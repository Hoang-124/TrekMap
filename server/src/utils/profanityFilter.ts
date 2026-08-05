/**
 * High-Speed Profanity & Toxic Content Moderation Filter for TrekMap
 */

// Common toxic, profanity, and offensive keywords (Vietnamese & English)
const PROFANITY_KEYWORDS = [
  'dm', 'dkm', 'đkm', 'đm', 'vkl', 'vcl', 'vl', 'đéo', 'deo', 'lon', 'lồn', 
  'cặc', 'cac', 'buồi', 'buoi', 'đĩ', 'di~', 'chó đẻ', 'cho de', 'đái', 'ỉa',
  'fuck', 'bitch', 'shit', 'asshole', 'bastard', 'dick', 'cunt', 'pussy',
  'lừa đảo', 'lừa tiền', 'scam', 'bắn chết', 'giết'
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
  const wordsRaw = lowerRaw.split(/\s+/);
  const wordsNorm = normalized.split(/\s+/);

  for (const kw of PROFANITY_KEYWORDS) {
    const normKw = normalizeText(kw);
    // Exact word or substring match
    if (wordsRaw.includes(kw) || wordsNorm.includes(normKw)) {
      return true;
    }
    // Check regex pattern for boundary match
    const regex = new RegExp(`\\b${normKw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
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
  const normalized = normalizeText(text);

  for (const kw of PROFANITY_KEYWORDS) {
    const normKw = normalizeText(kw);
    const regex = new RegExp(`\\b${normKw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
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

  for (const kw of PROFANITY_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    censored = censored.replace(regex, '***');
  }

  return censored;
}
