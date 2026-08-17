/**
 * Vietnamese Text Normalization & Accent-Insensitive Search Utilities
 */

export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function searchMatchVietnamese(target: string, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!target) return false;

  const rawTarget = target.toLowerCase();
  const rawQuery = query.toLowerCase().trim();
  if (rawTarget.includes(rawQuery)) return true;

  const normTarget = removeVietnameseTones(target);
  const normQuery = removeVietnameseTones(query);
  return normTarget.includes(normQuery);
}
