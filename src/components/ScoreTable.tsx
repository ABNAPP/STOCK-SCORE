import { useCallback } from 'react';
import BaseTable, { ColumnDefinition } from './BaseTable';
import { ScoreData } from './views/ScoreView';
import { ThresholdIndustryData, BenjaminGrahamData } from '../types/stock';
import { EntryExitValues } from '../contexts/EntryExitContext';
import { calculateDetailedScoreBreakdown } from '../utils/calculateScoreDetailed';
import ScoreBreakdownTooltip from './ScoreBreakdownTooltip';
import { FilterConfig } from './AdvancedFilters';

interface ScoreTableProps {
  data: ScoreData[];
  loading: boolean;
  error: string | null;
  thresholdData?: ThresholdIndustryData[];
  benjaminGrahamData?: BenjaminGrahamData[];
  entryExitValues?: Map<string, EntryExitValues>;
}

const SCORE_COLUMNS: ColumnDefinition[] = [
  { key: 'antal', label: 'Antal', required: true, sticky: true, sortable: false },
  { key: 'companyName', label: 'Company Name', required: true, sticky: true, sortable: true },
  { key: 'ticker', label: 'Ticker', required: true, sticky: true, sortable: true },
  { key: 'score', label: 'Score', defaultVisible: true, sortable: true, align: 'center' },
];

const SCORE_FILTERS: FilterConfig[] = [
  {
    key: 'score',
    label: 'Score',
    type: 'numberRange',
    min: 0,
    max: 100,
    step: 0.1,
  },
  {
    key: 'companyName',
    label: 'Företagsnamn',
    type: 'text',
  },
  {
    key: 'ticker',
    label: 'Ticker',
    type: 'text',
  },
];

export default function ScoreTable({ data, loading, error, thresholdData = [], benjaminGrahamData = [], entryExitValues = new Map() }: ScoreTableProps) {
  const getScoreColorClass = useCallback((score: number): string => {
    if (score >= 75) return 'text-green-600 dark:text-green-400 font-bold';
    if (score >= 45) return 'text-blue-600 dark:text-blue-400 font-semibold';
    return 'text-gray-600 dark:text-gray-400';
  }, []);

  const renderCell = useCallback((item: ScoreData, column: ColumnDefinition, index: number, globalIndex: number) => {
    switch (column.key) {
      case 'antal':
        return globalIndex + 1;
      case 'companyName':
        return <span className="font-medium">{item.companyName}</span>;
      case 'ticker':
        return <span className="text-gray-500 dark:text-gray-300">{item.ticker}</span>;
      case 'score':
        return (
          <span className={getScoreColorClass(item.score)}>
            <ScoreBreakdownTooltip
              breakdown={calculateDetailedScoreBreakdown(
                item.scoreBoardData,
                thresholdData,
                benjaminGrahamData,
                entryExitValues
              )}
            >
              <span>{item.score.toFixed(1)}</span>
            </ScoreBreakdownTooltip>
          </span>
        );
      default:
        return null;
    }
  }, [thresholdData, benjaminGrahamData, entryExitValues, getScoreColorClass]);

  const renderMobileCard = useCallback((item: ScoreData, index: number, globalIndex: number, isExpanded: boolean, toggleExpand: () => void) => {
    return (
      <div
        className={`rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 transition-all duration-300 ease-in-out ${
          globalIndex % 2 === 0 
            ? 'bg-white dark:bg-gray-800' 
            : 'bg-gray-50 dark:bg-gray-800/50'
        }`}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Antal</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{globalIndex + 1}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Company Name</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right">{item.companyName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ticker</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{item.ticker}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Score</span>
            <ScoreBreakdownTooltip
              breakdown={calculateDetailedScoreBreakdown(
                item.scoreBoardData,
                thresholdData,
                benjaminGrahamData,
                entryExitValues
              )}
            >
              <span className={`text-sm ${getScoreColorClass(item.score)}`}>{item.score.toFixed(1)}</span>
            </ScoreBreakdownTooltip>
          </div>
        </div>
      </div>
    );
  }, [thresholdData, benjaminGrahamData, entryExitValues, getScoreColorClass]);

  return (
    <BaseTable<ScoreData>
      data={data}
      loading={loading}
      error={error}
      columns={SCORE_COLUMNS}
      filters={SCORE_FILTERS}
      tableId="score"
      renderCell={renderCell}
      renderMobileCard={renderMobileCard}
      enableVirtualScroll={true}
      enableHelp={true}
      searchFields={['companyName', 'ticker']}
      searchPlaceholder="Sök efter företag eller ticker..."
      defaultSortKey="score"
      defaultSortDirection="desc"
      stickyColumns={['antal', 'companyName', 'ticker']}
      ariaLabel="Score"
      minTableWidth="600px"
      getRowKey={(item, index) => `${item.ticker}-${item.companyName}-${index}`}
    />
  );
}

