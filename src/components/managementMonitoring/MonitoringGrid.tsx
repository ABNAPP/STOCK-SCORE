import type { MonitoringCardConfig } from '../../types/managementMonitoring';
import MonitoringCard from './MonitoringCard';

interface MonitoringGridProps {
  cards: MonitoringCardConfig[];
}

/** Wide overview card(s) — left column on lg. Narrow cards — stacked right column on lg (card 2 above card 3). */
function partitionCards(cards: MonitoringCardConfig[]) {
  const wide = cards.filter((c) => c.gridSpan === 2);
  const narrow = cards.filter((c) => c.gridSpan !== 2);
  return { wide, narrow };
}

export default function MonitoringGrid({ cards }: MonitoringGridProps) {
  const { wide, narrow } = partitionCards(cards);

  return (
    <div
      className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-start lg:gap-5"
      role="list"
    >
      {wide.length > 0 ? (
        <div className="flex min-w-0 w-full flex-col gap-4 sm:gap-5 lg:flex-1" role="presentation">
          {wide.map((card) => (
            <div key={card.id} role="listitem" className="w-full min-w-0">
              <MonitoringCard {...card} />
            </div>
          ))}
        </div>
      ) : null}

      {narrow.length > 0 ? (
        <div
          className="mx-auto flex w-full max-w-md flex-col gap-4 sm:gap-5 lg:mx-0 lg:max-w-md lg:flex-shrink-0"
          role="presentation"
        >
          {narrow.map((card) => (
            <div key={card.id} role="listitem" className="w-full">
              <MonitoringCard {...card} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
