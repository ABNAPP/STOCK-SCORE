import type { MonitoringCardConfig } from '../../types/managementMonitoring';
import MonitoringCard from './MonitoringCard';

interface MonitoringGridProps {
  cards: MonitoringCardConfig[];
}

export default function MonitoringGrid({ cards }: MonitoringGridProps) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12 lg:items-start"
      role="list"
    >
      {cards.map((card) => {
        const isWide = card.gridSpan === 2;
        return (
          <div
            key={card.id}
            role="listitem"
            className={
              isWide
                ? 'lg:col-span-8'
                : 'mx-auto w-full max-w-md lg:mx-0 lg:max-w-none lg:col-span-4 lg:self-start'
            }
          >
            <MonitoringCard {...card} />
          </div>
        );
      })}
    </div>
  );
}
