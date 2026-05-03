import type { ScoreModelMetricDraft } from '../config/scoreModelViewConfig';

export function parsePointInput(raw: string): { finite: boolean; value: number; negative: boolean } {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '—') {
    return { finite: false, value: NaN, negative: false };
  }
  const n = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(n)) {
    return { finite: false, value: NaN, negative: false };
  }
  return { finite: true, value: n, negative: n < 0 };
}

export function sumFullPointsForCategory(
  rows: ScoreModelMetricDraft[],
  category: 'Fundamental' | 'Technical'
): number {
  return rows
    .filter((r) => r.category === category)
    .reduce((sum, r) => {
      const p = parsePointInput(r.fullPoints);
      return p.finite ? sum + p.value : sum;
    }, 0);
}

export function validateScoreModelDraft(rows: ScoreModelMetricDraft[]): {
  ok: boolean;
  issues: string[];
  fundamentalMax: number;
  technicalMax: number;
  totalWeight: number;
} {
  const fundamentalMax = sumFullPointsForCategory(rows, 'Fundamental');
  const technicalMax = sumFullPointsForCategory(rows, 'Technical');
  const totalWeight = fundamentalMax + technicalMax;

  const issues: string[] = [];

  if (Math.abs(totalWeight - 100) > 0.001) {
    issues.push(`Total is ${totalWeight.toFixed(4).replace(/\.?0+$/, '')}, expected 100.`);
  }
  if (fundamentalMax < 0) {
    issues.push('Fundamental max (sum of full points) is negative.');
  }
  if (technicalMax < 0) {
    issues.push('Technical max (sum of full points) is negative.');
  }

  const pointFields = ['fullPoints', 'halfPoints', 'zeroPoints'] as const;
  for (const row of rows) {
    for (const field of pointFields) {
      const raw = row[field];
      const trimmed = raw.trim();
      if (trimmed === '') {
        issues.push(`Empty ${field.replace('Points', ' points')} for "${row.displayName}".`);
        continue;
      }
      const { finite, negative, value } = parsePointInput(raw);
      if (!finite) {
        issues.push(`Invalid number in "${row.displayName}" (${field}).`);
      } else if (negative) {
        issues.push(`Negative points (${value}) in "${row.displayName}" (${field}).`);
      }
    }
  }

  const ok = issues.length === 0 && Math.abs(totalWeight - 100) < 0.001;

  return {
    ok,
    issues: [...new Set(issues)],
    fundamentalMax,
    technicalMax,
    totalWeight,
  };
}
