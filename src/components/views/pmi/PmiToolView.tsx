import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePmiData } from '../../../hooks/usePmiData';
import type { PmiCountryCode, PmiType } from '../../../services/pmi/types';
import { getPmiCountryName, resolvePmiCountryCode } from '../../../services/pmi/countryAliases';
import PmiHeatmapView from './PmiHeatmapView';
import PmiCountryDetailPage from './PmiCountryDetailPage';

const PMI_TYPES: PmiType[] = ['composite', 'manufacturing', 'services'];

function parsePmiType(value: string | null): PmiType {
  if (value && PMI_TYPES.includes(value as PmiType)) {
    return value as PmiType;
  }
  return 'composite';
}

export default function PmiToolView() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedType = parsePmiType(searchParams.get('type'));
  const selectedCountryCode = resolvePmiCountryCode(searchParams.get('country') ?? '');

  useEffect(() => {
    const nextParams = new URLSearchParams(location.search);
    let changed = false;

    if (nextParams.get('tool') !== 'pmi') {
      nextParams.set('tool', 'pmi');
      changed = true;
    }
    const rawType = nextParams.get('type');
    if (!rawType) {
      nextParams.set('type', 'composite');
      changed = true;
    } else {
      const normalizedType = parsePmiType(rawType);
      if (normalizedType !== rawType) {
        nextParams.set('type', normalizedType);
        changed = true;
      }
    }
    const countryParam = nextParams.get('country');
    if (countryParam && !resolvePmiCountryCode(countryParam)) {
      nextParams.delete('country');
      changed = true;
    }

    if (changed) {
      navigate({ pathname: location.pathname, search: nextParams.toString() }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const {
    data,
    loading,
    error,
    refetch,
    lastUpdated,
    latestReleaseDate,
    source,
  } = usePmiData({
    mode: 'heatmap',
    type: selectedType,
    autoLoad: !selectedCountryCode,
  });

  const handleTypeChange = (nextType: PmiType) => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('tool', 'pmi');
    nextParams.set('type', nextType);
    navigate({ pathname: location.pathname, search: nextParams.toString() }, { replace: true });
  };

  const handleCountrySelect = (countryCode: PmiCountryCode) => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('tool', 'pmi');
    nextParams.set('type', selectedType);
    nextParams.set('country', countryCode);
    navigate({ pathname: location.pathname, search: nextParams.toString() }, { replace: true });
  };

  const handleBackToHeatmap = () => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('tool', 'pmi');
    nextParams.set('type', selectedType);
    nextParams.delete('country');
    navigate({ pathname: location.pathname, search: nextParams.toString() }, { replace: true });
  };

  if (selectedCountryCode) {
    return (
      <PmiCountryDetailPage
        countryCode={selectedCountryCode}
        countryName={getPmiCountryName(selectedCountryCode)}
        type={selectedType}
        onBack={handleBackToHeatmap}
        onTypeChange={handleTypeChange}
      />
    );
  }

  return (
    <PmiHeatmapView
      type={selectedType}
      data={data && 'rows' in data ? data : null}
      loading={loading}
      error={error}
      source={source}
      latestReleaseDate={latestReleaseDate}
      lastUpdated={lastUpdated}
      onTypeChange={handleTypeChange}
      onRetry={() => void refetch(true)}
      onCountrySelect={handleCountrySelect}
    />
  );
}

