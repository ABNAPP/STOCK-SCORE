import { getPmiCountryName, PMI_COUNTRIES } from './countryAliases';
import type { PmiCountryCode, PmiSeriesMap, PmiType } from './types';

/**
 * Scaffold-only series map (per beslut): lämna null tills verifierade FRED IDs
 * tillhandahålls. Runtime-validering stoppar fetch för att undvika gissade IDs.
 * TODO(pmi-live-data): Fyll endast med verifierade FRED series IDs (ingen gissning).
 * Första verifierade batchen tillagd nedan; övriga entries lämnas som placeholders.
 */
export const PMI_SERIES_MAP: PmiSeriesMap = {
  composite: {
    AT: null,
    BE: null,
    BR: null,
    CH: null,
    CL: null,
    CN: null,
    EE: null,
    DE: null,
    DK: null,
    ES: null,
    EZ: null,
    FI: null,
    FR: null,
    GR: null,
    HU: null,
    IE: null,
    IT: null,
    JP: null,
    KR: null,
    LT: null,
    MX: null,
    NL: null,
    PL: null,
    PT: null,
    SE: null,
    SI: null,
    SK: null,
    TR: null,
    UK: null,
    US: null,
  },
  manufacturing: {
    AT: 'BSCICP02ATM460S',
    BE: 'BSCICP02BEM460S',
    BR: 'BSCICP02BRM460S',
    CH: 'BSCICP02CHM460S',
    CL: 'BSCICP02CLM460S',
    CN: 'CHNBSCICP02STSAM',
    EE: 'BSCICP02EEM460S',
    DE: 'BSCICP02DEM460S',
    DK: 'BSCICP02DKM460S',
    ES: 'BSCICP02ESM460S',
    EZ: 'BSCICP02EZM460S',
    FI: 'BSCICP02FIM460S',
    FR: 'BSCICP02FRM460S',
    GR: 'BSCICP02GRM460S',
    HU: 'BSCICP02HUM460S',
    IE: 'BSCICP02IEM460S',
    IT: 'BSCICP02ITM460S',
    JP: 'JPNBSCICP02STSAQ',
    KR: 'BSCICP02KRM460S',
    LT: 'LTUBSCICP02STSAM',
    MX: 'BSCICP02MXM460S',
    NL: 'BSCICP02NLM460S',
    PL: 'BSCICP02PLM460S',
    PT: 'BSCICP02PTM460S',
    SE: 'BSCICP02SEM460S',
    SI: 'BSCICP02SIM460S',
    SK: 'BSCICP02SKM460S',
    TR: 'BSCICP02TRM460S',
    UK: 'BSCICP02GBQ460S',
    US: 'BSCICP02USM460S',
  },
  services: {
    AT: 'BVCICP02ATM460S',
    BE: 'BVCICP02BEM460S',
    BR: 'BRABVCICP02STSAM',
    // No verified, current Switzerland services confidence series in the active services family.
    CH: null,
    // No verified, current Chile services confidence series in the active services family.
    CL: null,
    // No verified, current China services confidence series in the active services family.
    CN: null,
    // No safely verified FRED services composite ID for Estonia in this batch.
    EE: null,
    DE: 'BVCICP02DEM460S',
    DK: 'BVCICP02DKM460S',
    // Current Spain services series is stale for latest heatmap months; keep placeholder for now.
    ES: null,
    EZ: 'BVCICP02EZM460S',
    FI: 'BVCICP02FIM460S',
    FR: 'BVCICP02FRM460S',
    GR: 'BVCICP02GRM460S',
    HU: 'BVCICP02HUM460S',
    IE: 'BVCICP02IEM460S',
    IT: 'BVCICP02ITM460S',
    // No verified, current Japan services confidence series in the active services family.
    JP: null,
    // No verified, current South Korea services confidence series in the active services family.
    KR: null,
    LT: 'LTUBVCICP02STSAM',
    // No verified, current Mexico services confidence series in the active services family.
    MX: null,
    NL: 'BVCICP02NLM460S',
    PL: 'BVCICP02PLM460S',
    PT: 'BVCICP02PTM460S',
    SE: 'BVCICP02SEM460S',
    SI: 'BVCICP02SIM460S',
    SK: 'BVCICP02SKM460S',
    TR: 'TURBVCICP02STSAM',
    // Current UK services series is stale for latest heatmap months; keep placeholder for now.
    UK: null,
    US: null,
  },
};

export interface PmiSeriesDescriptor {
  countryCode: PmiCountryCode;
  countryName: string;
  seriesId: string;
}

export interface PmiHeatmapSeriesDescriptor {
  countryCode: PmiCountryCode;
  countryName: string;
  seriesId: string | null;
}

export function getPmiSeriesId(type: PmiType, countryCode: PmiCountryCode): string {
  const seriesId = PMI_SERIES_MAP[type][countryCode];
  if (!seriesId) {
    throw new Error(
      `PMI series ID is missing for type "${type}" and country "${countryCode}". ` +
        'Populate src/services/pmi/pmiSeriesMap.ts with verified FRED series IDs before fetching.'
    );
  }
  return seriesId;
}

export function getPmiHeatmapSeriesDescriptors(type: PmiType): PmiSeriesDescriptor[] {
  return PMI_COUNTRIES.map(({ code }) => ({
    countryCode: code,
    countryName: getPmiCountryName(code),
    seriesId: getPmiSeriesId(type, code),
  }));
}

export function getPmiHeatmapSeriesDescriptorsWithOptionalIds(
  type: PmiType
): PmiHeatmapSeriesDescriptor[] {
  return PMI_COUNTRIES.map(({ code }) => ({
    countryCode: code,
    countryName: getPmiCountryName(code),
    seriesId: PMI_SERIES_MAP[type][code],
  }));
}

