/** User-facing label for a Score breakdown metric key (internal ids → i18n). */
export function formatScoreMetricLabel(metric: string, t: (key: string) => string): string {
  if (metric === 'THEOENTRY') {
    return t('scoreBreakdown.theoEntryDisplayLabel');
  }
  const key = `scoreBreakdown.metrics.${metric}`;
  const translated = t(key);
  if (translated !== key) {
    return translated;
  }
  return metric;
}
