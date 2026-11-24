/**
 * Local 100% Original Swiss Field-Atlas Topographic Trail Covers (client/public/covers/*.svg)
 * Zero external stock photo hotlinks, zero copyright ambiguity, instant offline PWA load.
 */

export const DEFAULT_TRAIL_COVER = '/covers/trail-fansipan.svg';

export const KNOWN_TRAIL_COVER_SLUGS: ReadonlySet<string> = new Set([
  'trail-fansipan',
  'trail-pusilung',
  'trail-putaleng',
  'trail-kyquansan',
  'trail-tachinhu',
  'trail-nhiucosan',
  'trail-lungcung',
  'trail-taxua',
  'trail-laothan',
  'trail-nguchison',
  'trail-tayconlinh',
  'trail-puluong',
  'trail-bachma',
  'trail-giengtroi',
  'trail-thack50',
  'trail-chuyangsin',
  'trail-muidoi',
  'trail-nuichua',
  'trail-bidoup',
  'trail-tanangphandung',
  'trail-cattien-bausau',
  'trail-nuidinh',
  'trail-chuachan',
  'trail-badenh',
  'trail-khangsuvan',
  'trail-namkanghotao',
  'trail-bavi',
  'trail-yentu',
  'trail-langbiang',
  'trail-bugiamap',
  'trail-talienson',
  'trail-phaluong',
  'trail-binhlieu',
  'trail-cucphuong',
  'trail-honba',
  'trail-bara',
]);

export function getTrailCoverUrl(trailId?: string): string {
  const clean = String(trailId || '').trim();
  if (clean && KNOWN_TRAIL_COVER_SLUGS.has(clean)) {
    return `/covers/${clean}.svg`;
  }
  return DEFAULT_TRAIL_COVER;
}

export function getTrailGalleryUrls(trailId?: string): [string, string] {
  const clean = String(trailId || '').trim();
  if (clean && KNOWN_TRAIL_COVER_SLUGS.has(clean)) {
    return [`/covers/${clean}-ridge.svg`, `/covers/${clean}-topo.svg`];
  }
  return ['/covers/trail-fansipan-ridge.svg', '/covers/trail-fansipan-topo.svg'];
}
