import type { MonitoringCardConfig } from '../../types/managementMonitoring';
import MonitoringCard from './MonitoringCard';

interface MonitoringGridProps {
  cards: MonitoringCardConfig[];
}

export default function MonitoringGrid({ cards }: MonitoringGridProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
      role="list"
    >
      {cards.map((card) => (
        <div
          key={card.id}
          role="listitem"
          className={card.gridSpan === 2 ? 'md:col-span-2' : ''}
        >
          <MonitoringCard {...card} />
        </div>
      ))}
    </div>
  );
}
