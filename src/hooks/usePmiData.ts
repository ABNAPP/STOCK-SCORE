import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_TTL,
  getCachedData,
  setCachedData,
} from '../services/firestoreCacheService';
import {
  getPmiCountryDetailCacheKey,
  getPmiHeatmapCacheKey,
} from '../services/cacheKeys';
import {
  fetchPmiCountryDetailData,
  fetchPmiHeatmapData,
} from '../services/pmi/pmiService';
import type {
  PmiCountryDetailData,
  PmiHeatmapData,
  PmiType,
} from '../services/pmi/types';
import { resolvePmiCountryCode } from '../services/pmi/countryAliases';

type PmiMode = 'heatmap' | 'countryDetail';
type PmiDataPayload = PmiHeatmapData | PmiCountryDetailData;
type PmiDataSource = 'appCache' | 'network';

interface UsePmiDataOptions {
  mode: PmiMode;
  type: PmiType;
  country?: string;
  autoLoad?: boolean;
}

interface UsePmiDataResult {
  data: PmiDataPayload | null;
  loading: boolean;
  error: string | null;
  refetch: (forceRefresh?: boolean) => Promise<void>;
  lastUpdated: Date | null;
  latestReleaseDate: string | null;
  source: string | null;
  dataSource: PmiDataSource | null;
}

function getCacheKey(options: UsePmiDataOptions): string {
  if (options.mode === 'heatmap') {
    return getPmiHeatmapCacheKey(options.type);
  }

  const code = options.country ? resolvePmiCountryCode(options.country) : null;
  if (!code) {
    throw new Error('country is required for PMI country detail mode');
  }
  return getPmiCountryDetailCacheKey(options.type, code);
}

export function usePmiData(options: UsePmiDataOptions): UsePmiDataResult {
  const { mode, type, country, autoLoad } = options;
  const [data, setData] = useState<PmiDataPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(autoLoad !== false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState<PmiDataSource | null>(null);

  const loadData = useCallback(
    async (forceRefresh: boolean = false) => {
      setError(null);
      setLoading(true);

      let cacheKey: string;
      try {
        cacheKey = getCacheKey({ mode, type, country, autoLoad });
      } catch (cacheKeyError) {
        setError(cacheKeyError instanceof Error ? cacheKeyError.message : String(cacheKeyError));
        setLoading(false);
        return;
      }

      if (!forceRefresh) {
        const cached = await getCachedData<PmiDataPayload>(cacheKey);
        if (cached) {
          setData(cached);
          setDataSource('appCache');
          setLastUpdated(new Date(cached.metadata.fetchedAt));
          setLoading(false);
          return;
        }
      }

      try {
        const freshData =
          mode === 'heatmap'
            ? await fetchPmiHeatmapData(type)
            : await fetchPmiCountryDetailData(type, country ?? '');

        await setCachedData(cacheKey, freshData, DEFAULT_TTL);
        setData(freshData);
        setDataSource('network');
        setLastUpdated(new Date(freshData.metadata.fetchedAt));
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setLoading(false);
      }
    },
    [mode, type, country, autoLoad]
  );

  useEffect(() => {
    if (autoLoad === false) {
      setLoading(false);
      return;
    }
    loadData(false);
  }, [loadData, autoLoad]);

  const latestReleaseDate = useMemo(() => data?.metadata.latestAvailableRelease ?? null, [data]);
  const source = useMemo(() => data?.metadata.source ?? null, [data]);

  return {
    data,
    loading,
    error,
    refetch: loadData,
    lastUpdated,
    latestReleaseDate,
    source,
    dataSource,
  };
}

