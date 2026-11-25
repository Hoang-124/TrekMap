const DEFAULT_PROD_CLIENT_URL = 'https://lost.vn';
const DEFAULT_DEV_CLIENT_URL = 'http://localhost:5173';

/**
 * Resolves the canonical frontend base URL without trailing slashes.
 * Never falls back to `http://localhost:5173` in production so activation emails,
 * password reset links, itineraries, and SOS LiveBeacon share links stay production-safe.
 */
export function getClientBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.CLIENT_URL || '').trim().replace(/\/+$/, '');
  if (configured) {
    return configured;
  }
  return env.NODE_ENV === 'production' ? DEFAULT_PROD_CLIENT_URL : DEFAULT_DEV_CLIENT_URL;
}
