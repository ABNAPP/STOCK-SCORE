/** Stable Firestore-safe id for a DashBoard industry / ISM sector label. */
export function ismSectorIdFromName(sectorName: string): string {
  const t = sectorName.trim().toLowerCase();
  if (!t) return 'unknown_sector';
  return t
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 120);
}
