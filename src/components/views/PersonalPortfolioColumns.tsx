/**
 * Column definitions and table item type for Personal Portfolio view.
 * Refactored out of PersonalPortfolioView (refactor-only, no behavior change).
 */

import type { ColumnDefinition } from '../BaseTable';
import type { PortfolioItem } from '../../types/portfolio';

export interface PortfolioTableItem extends PortfolioItem {
  rowNumber?: number;
  currentPrice?: number | null;
  currentPriceUSD?: number | null;
  invested?: number | null;
  marketValue?: number | null;
  profitLoss?: number | null;
  profitLossPercent?: number | null;
  marketWeight?: number | null;
}

export const PORTFOLIO_COLUMNS: ColumnDefinition<PortfolioTableItem>[] = [
  { key: 'rowNumber', label: 'Antal', required: true, sticky: true, sortable: false },
  { key: 'companyName', label: 'Company Name', required: true, sticky: true, sortable: true },
  { key: 'ticker', label: 'Ticker', required: true, sticky: true, sortable: true },
  { key: 'currency', label: 'Currency', defaultVisible: false, sticky: true, sortable: true, align: 'center' },
  { key: 'currentPrice', label: 'Current Price', defaultVisible: false, sortable: true, align: 'center' },
  { key: 'currentPriceUSD', label: 'Current Price($)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'quantity', label: 'Quantity', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'average', label: 'Average ($)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'invested', label: 'Invested ($)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'marketValue', label: 'Market Value ($)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'profitLoss', label: 'P/L ($)', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'profitLossPercent', label: 'P/L%', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'marketWeight', label: 'Market Weight', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'actions', label: 'Actions', required: false, sortable: false, align: 'right' },
];
