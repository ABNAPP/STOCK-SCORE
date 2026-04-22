import * as functions from 'firebase-functions/v1';

type PmiProxyMode = 'heatmap' | 'countryHistory';

interface HeatmapRequest {
  mode: 'heatmap';
  seriesIds: string[];
}

interface CountryHistoryRequest {
  mode: 'countryHistory';
  seriesId: string;
  limit?: number;
}

type PmiFredProxyRequest = HeatmapRequest | CountryHistoryRequest;

interface FredObservation {
  date: string;
  value: string;
}

interface FredApiResponse {
  error_message?: string;
  observations?: FredObservation[];
}

interface SeriesPayload {
  seriesId: string;
  observations: FredObservation[];
}

const FRED_OBSERVATIONS_URL = 'https://api.stlouisfed.org/fred/series/observations';
const SERIES_ID_PATTERN = /^[A-Za-z0-9_.-]{2,64}$/;
/** Must cover all PMI heatmap countries (28) with small headroom for list changes. */
const MAX_HEATMAP_SERIES = 32;
const DEFAULT_HISTORY_LIMIT = 120;
const MAX_HISTORY_LIMIT = 480;

function getFredApiKey(): string {
  return (
    (process.env.FRED_API_KEY as string) ||
    (functions.config().fred?.api_key as string) ||
    ''
  );
}

function assertAuthenticated(context: functions.https.CallableContext): void {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
}

function assertValidSeriesId(seriesId: unknown, fieldName: string): string {
  if (typeof seriesId !== 'string' || !SERIES_ID_PATTERN.test(seriesId)) {
    throw new functions.https.HttpsError('invalid-argument', `Invalid ${fieldName}`);
  }
  return seriesId;
}

function parseHistoryLimit(limit: unknown): number {
  if (limit === undefined || limit === null) {
    return DEFAULT_HISTORY_LIMIT;
  }
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid limit');
  }
  const rounded = Math.floor(limit);
  if (rounded < 1 || rounded > MAX_HISTORY_LIMIT) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `limit must be between 1 and ${MAX_HISTORY_LIMIT}`
    );
  }
  return rounded;
}

async function fetchSeriesObservations(seriesId: string): Promise<FredObservation[]> {
  const apiKey = getFredApiKey();
  if (!apiKey) {
    throw new functions.https.HttpsError('failed-precondition', 'FRED_API_KEY is not configured');
  }

  const url = new URL(FRED_OBSERVATIONS_URL);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('sort_order', 'asc');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new functions.https.HttpsError(
      'internal',
      `FRED request failed: ${response.status} ${response.statusText} - ${text.slice(0, 200)}`
    );
  }

  const payload = (await response.json()) as FredApiResponse;
  if (payload.error_message) {
    throw new functions.https.HttpsError('internal', payload.error_message);
  }

  if (!Array.isArray(payload.observations)) {
    throw new functions.https.HttpsError('internal', `No observations returned for series "${seriesId}"`);
  }

  return payload.observations
    .filter((item) => typeof item?.date === 'string' && typeof item?.value === 'string')
    .map((item) => ({ date: item.date, value: item.value }));
}

export const pmiFredProxy = functions.https.onCall(async (data: PmiFredProxyRequest, context) => {
  assertAuthenticated(context);

  const fetchedAt = Date.now();
  const mode: PmiProxyMode | undefined = data?.mode;
  if (mode !== 'heatmap' && mode !== 'countryHistory') {
    throw new functions.https.HttpsError('invalid-argument', 'mode must be "heatmap" or "countryHistory"');
  }

  if (mode === 'heatmap') {
    const request = data as HeatmapRequest;
    const seriesIdsRaw = request.seriesIds;
    if (!Array.isArray(seriesIdsRaw) || seriesIdsRaw.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'seriesIds must be a non-empty array');
    }
    if (seriesIdsRaw.length > MAX_HEATMAP_SERIES) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `seriesIds exceeds max limit of ${MAX_HEATMAP_SERIES}`
      );
    }

    const validatedSeriesIds = seriesIdsRaw.map((seriesId, index) =>
      assertValidSeriesId(seriesId, `seriesIds[${index}]`)
    );

    const series = await Promise.all(
      validatedSeriesIds.map(async (seriesId): Promise<SeriesPayload> => ({
        seriesId,
        observations: await fetchSeriesObservations(seriesId),
      }))
    );

    return {
      mode,
      source: 'FRED',
      fetchedAt,
      series,
    };
  }

  const request = data as CountryHistoryRequest;
  const validatedSeriesId = assertValidSeriesId(request.seriesId, 'seriesId');
  const limit = parseHistoryLimit(request.limit);
  const observations = await fetchSeriesObservations(validatedSeriesId);
  const slicedObservations = observations.slice(-limit);

  return {
    mode,
    source: 'FRED',
    fetchedAt,
    series: [
      {
        seriesId: validatedSeriesId,
        observations: slicedObservations,
      },
    ],
  };
});
