/**
 * Expanded row content for Personal Portfolio: per-broker breakdown table.
 * Refactored out of PersonalPortfolioView (refactor-only, no behavior change).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PortfolioPosition } from '../../types/portfolio';
import type { PortfolioTableItem } from './PersonalPortfolioColumns';

interface PersonalPortfolioExpandedRowProps {
  item: PortfolioTableItem;
  formatCurrency: (amount: number, currency: string) => string;
}

export function PersonalPortfolioExpandedRow({
  item,
  formatCurrency,
}: PersonalPortfolioExpandedRowProps) {
  const { t } = useTranslation();
  const positions: PortfolioPosition[] =
    item.positions && item.positions.length > 0 ? item.positions : [];

  return (
    <div className="px-6 py-4">
      <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-600">
            <th className="py-2 pr-4 font-semibold">{t('portfolio.broker', 'Broker')}</th>
            <th className="py-2 pr-4 font-semibold">{t('portfolio.quantity', 'Antal')}</th>
            <th className="py-2 pr-4 font-semibold">{t('portfolio.investedAmount', 'Investerat belopp')}</th>
            <th className="py-2 font-semibold">{t('portfolio.investmentCurrency', 'Valuta')}</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, i) => (
            <tr
              key={`${pos.broker}-${i}`}
              className="border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <td className="py-2 pr-4">{pos.broker}</td>
              <td className="py-2 pr-4">{pos.quantity}</td>
              <td className="py-2 pr-4">
                {pos.investedAmount != null && pos.investedAmount > 0
                  ? formatCurrency(pos.investedAmount, pos.investmentCurrency || 'USD')
                  : '-'}
              </td>
              <td className="py-2">{pos.investmentCurrency || 'USD'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
