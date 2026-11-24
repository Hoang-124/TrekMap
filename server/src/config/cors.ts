const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];

const PROD_ORIGINS = ['https://lost.vn', 'https://www.lost.vn'];

export function getAllowedOrigins(): string[] {
  const envOrigins = (process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (envOrigins.length > 0) {
    return process.env.NODE_ENV === 'production'
      ? envOrigins
      : Array.from(new Set([...envOrigins, ...DEV_ORIGINS]));
  }

  return process.env.NODE_ENV === 'production'
    ? PROD_ORIGINS
    : [...DEV_ORIGINS, ...PROD_ORIGINS];
}
