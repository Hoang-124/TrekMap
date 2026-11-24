/**
 * Server-side 100% Original Local Cover & Procedural SVG Avatar Helpers
 * Eliminates all third-party unverified CDN portrait / stock photo dependencies.
 */

export const DEFAULT_AVATAR_URL = '/covers/avatar-default.svg';
export const DEFAULT_ADMIN_AVATAR_URL = '/covers/avatar-admin.svg';
export const DEFAULT_TRAIL_COVER_URL = '/covers/trail-fansipan.svg';
export const DEFAULT_TRIP_COVER_URL = '/covers/trail-taxua.svg';

const TREKKER_PALETTES: ReadonlyArray<{ bg: string; bg2: string; ring: string; fg: string }> = [
  { bg: '#163529', bg2: '#0f231b', ring: '#52b788', fg: '#f4f3ee' },
  { bg: '#1c2f3f', bg2: '#111d28', ring: '#63b3ed', fg: '#f4f3ee' },
  { bg: '#3a2b1c', bg2: '#23190f', ring: '#d4a348', fg: '#f8f6f0' },
  { bg: '#273524', bg2: '#172015', ring: '#74c69d', fg: '#f4f3ee' },
  { bg: '#2b2638', bg2: '#191622', ring: '#9f94e8', fg: '#f4f3ee' },
  { bg: '#372426', bg2: '#211517', ring: '#e07a5f', fg: '#f8f6f0' },
];

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractInitials(rawName?: string): string {
  const cleaned = String(rawName || 'Trekker')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim();
  if (!cleaned) return 'LS';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export function getTrekkerAvatarSvg(name?: string, role?: string): string {
  const label = String(name || 'Trekker').trim() || 'Trekker';
  const initials = escapeSvgText(extractInitials(label));
  const paletteIdx =
    role === 'admin'
      ? 0
      : role === 'moderator'
        ? 1
        : hashSeed(label.toLowerCase()) % TREKKER_PALETTES.length;
  const p = TREKKER_PALETTES[paletteIdx];

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">`,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p.bg}"/><stop offset="100%" stop-color="${p.bg2}"/></linearGradient></defs>`,
    `<rect width="120" height="120" rx="18" fill="url(#g)"/>`,
    `<circle cx="60" cy="60" r="50" fill="none" stroke="${p.ring}" stroke-opacity="0.24" stroke-width="1.5" stroke-dasharray="4 4"/>`,
    `<path d="M12 96 L38 68 L54 84 L74 58 L108 96 Z" fill="${p.ring}" fill-opacity="0.16"/>`,
    `<circle cx="60" cy="54" r="30" fill="${p.bg2}" fill-opacity="0.55" stroke="${p.ring}" stroke-opacity="0.55" stroke-width="1.5"/>`,
    `<text x="60" y="63" text-anchor="middle" fill="${p.fg}" font-family="'Plus Jakarta Sans','Inter',system-ui,sans-serif" font-size="28" font-weight="800" letter-spacing="1">${initials}</text>`,
    `<polygon points="60,14 63,21 57,21" fill="${p.ring}" fill-opacity="0.85"/>`,
    `</svg>`,
  ].join('');

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
