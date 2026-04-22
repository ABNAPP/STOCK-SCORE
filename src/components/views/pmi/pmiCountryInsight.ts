import type { PmiComparisonCardModel } from './pmiCountryDetailUtils';
import type { PmiType } from '../../../services/pmi/types';

interface BuildInsightArgs {
  activeType: PmiType;
  cards: PmiComparisonCardModel[];
  labels: {
    noInsight: string;
    stable: string;
    improving: string;
    softening: string;
    expansionTerritory: string;
    contractionTerritory: string;
    sentenceOne: (args: { typeLabel: string; latest: string; territory: string; direction: string }) => string;
    sentenceTwo: (args: { change: string }) => string;
    sentenceThree: (args: { bestType: string; bestValue: string; worstType: string; worstValue: string }) => string;
    typeLabel: (type: PmiType) => string;
  };
}

function findCard(cards: PmiComparisonCardModel[], type: PmiType): PmiComparisonCardModel | null {
  return cards.find((card) => card.type === type) ?? null;
}

export function buildPmiInsight({ activeType, cards, labels }: BuildInsightArgs): string[] {
  const active = findCard(cards, activeType);
  if (!active || active.unavailable || active.latest === null) {
    return [labels.noInsight];
  }

  const lines: string[] = [];
  const direction =
    active.change === null
      ? labels.stable
      : active.change > 0
        ? labels.improving
        : active.change < 0
          ? labels.softening
          : labels.stable;
  const status = active.latest >= 50 ? labels.expansionTerritory : labels.contractionTerritory;
  lines.push(
    labels.sentenceOne({
      typeLabel: labels.typeLabel(activeType),
      latest: formatValue(active.latest),
      territory: status,
      direction,
    })
  );

  if (active.change !== null) {
    lines.push(labels.sentenceTwo({ change: formatSigned(active.change) }));
  }

  const comparable = cards.filter((card) => !card.unavailable && card.latest !== null);
  if (comparable.length >= 2) {
    const best = [...comparable].sort((a, b) => (b.latest ?? -Infinity) - (a.latest ?? -Infinity))[0];
    const worst = [...comparable].sort((a, b) => (a.latest ?? Infinity) - (b.latest ?? Infinity))[0];
    if (best && worst && best.type !== worst.type) {
      lines.push(
        labels.sentenceThree({
          bestType: labels.typeLabel(best.type),
          bestValue: formatValue(best.latest),
          worstType: labels.typeLabel(worst.type),
          worstValue: formatValue(worst.latest),
        })
      );
    }
  }

  return lines.slice(0, 3);
}

function formatValue(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

function formatSigned(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

