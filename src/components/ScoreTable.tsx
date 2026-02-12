import { useCallback, useMemo, memo } from 'react';
import BaseTable, { ColumnDefinition } from './BaseTable';
import { ScoreData } from './views/ScoreView';
import { ScoreBoardData, ThresholdIndustryData, BenjaminGrahamData } from '../types/stock';
import { EntryExitValues } from '../contexts/EntryExitContext';
import { calculateDetailedScoreBreakdown } from '../utils/calculateScoreDetailed';
import { FilterConfig, ShareableTableState } from '../types/filters';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import ScoreBreakdownRow from './ScoreBreakdownRow';

/** Memoized expanded row to avoid recalculating breakdown on every render */
const MemoizedScoreBreakdownExpandedRow = memo(function MemoizedScoreBreakdownExpandedRow({
  scoreBoardData,
  thresholdData,
  benjaminGrahamData,
  entryExitValues,
}: {
  scoreBoardData: ScoreBoardData;
  thresholdData: ThresholdIndustryData[];
  benjaminGrahamData: BenjaminGrahamData[];
  entryExitValues: Map<string, EntryExitValues>;
}) {
  const breakdown = useMemo(
    () =>
      calculateDetailedScoreBreakdown(
        scoreBoardData,
        thresholdData,
        benjaminGrahamData,
        entryExitValues
      ),
    [scoreBoardData, thresholdData, benjaminGrahamData, entryExitValues]
  );
  return <ScoreBreakdownRow breakdown={breakdown} />;
});

interface ScoreTableProps {
  data: ScoreData[];
  loading: boolean;
  error: string | null;
  thresholdData?: ThresholdIndustryData[];
  benjaminGrahamData?: BenjaminGrahamData[];
  entryExitValues?: Map<string, EntryExitValues>;
  initialTableState?: ShareableTableState;
}

const SCORE_COLUMNS: ColumnDefinition[] = [
  { key: 'antal', label: 'Antal', required: true, sticky: true, sortable: false },
  { key: 'companyName', label: 'Company Name', required: true, sticky: true, sortable: true },
  { key: 'ticker', label: 'Ticker', required: true, sticky: true, sortable: true },
  { key: 'currency', label: 'Currency', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'price', label: 'Price', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'entry1', label: 'ENTRY1', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'entry2', label: 'ENTRY2', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'exit1', label: 'EXIT1', defaultVisible: true, sortable: true, align: 'center' },
  { key: 'exit2', label: 'EXIT2', defaultVisible: true, sortable: true, align: 'center' },
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

export default function ScoreTable({ data, loading, error, thresholdData = [], benjaminGrahamData = [], entryExitValues = new Map(), initialTableState }: ScoreTableProps) {
  // Helper function to generate row key - must be used consistently everywhere.
  // Stable identifier (no index) so expanded state survives sort/filter changes.
  const generateRowKey = useCallback((item: ScoreData): string => {
    return `${item.ticker}-${item.companyName}`;
  }, []);

  const getScoreColorClass = useCallback((score: number): string => {
    if (score >= 70) return 'text-green-700 dark:text-green-200 font-bold';
    if (score >= 50 && score < 70) return 'text-blue-700 dark:text-blue-400 font-semibold';
    return 'text-black dark:text-white';
  }, []);

  const renderCell = useCallback((item: ScoreData, column: ColumnDefinition, index: number, globalIndex: number, expandedRows?: { [key: string]: boolean }, toggleRow?: (rowKey: string) => void) => {
    // Use the same format as getRowKey: ticker-companyName (stable, no index)
    // IMPORTANT: This must match exactly with getRowKey function below
    const rowKey = generateRowKey(item);
    const isExpanded = expandedRows?.[rowKey] || false;

    switch (column.key) {
      case 'antal':
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (toggleRow) {
                  toggleRow(rowKey);
                }
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
              aria-expanded={isExpanded}
              title={isExpanded ? 'Collapse' : 'Expand'}
              type="button"
            >
              <ChevronDownIcon 
                className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
              />
            </button>
            <span>{globalIndex + 1}</span>
          </div>
        );
      case 'companyName':
        return <span className="font-medium">{item.companyName}</span>;
      case 'ticker':
        return <span className="text-gray-500 dark:text-gray-300">{item.ticker}</span>;
      case 'currency':
        return <span className="text-black dark:text-white">{item.currency || 'USD'}</span>;
      case 'price':
        return <span className="text-black dark:text-white">{item.price !== null ? item.price.toLocaleString() : 'N/A'}</span>;
      case 'entry1':
        return <span className="text-black dark:text-white">{item.entry1 || '-'}</span>;
      case 'entry2':
        return <span className="text-black dark:text-white">{item.entry2 || '-'}</span>;
      case 'exit1':
        return <span className="text-black dark:text-white">{item.exit1 || '-'}</span>;
      case 'exit2':
        return <span className="text-black dark:text-white">{item.exit2 || '-'}</span>;
      case 'score':
        return (
          <span className={getScoreColorClass(item.score)}>
            {item.score.toFixed(1)}
          </span>
        );
      default:
        return null;
    }
  }, [getScoreColorClass, generateRowKey]);

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
            <span className="text-sm font-medium text-black dark:text-white">{globalIndex + 1}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Company Name</span>
            <span className="text-sm font-medium text-black dark:text-white text-right">{item.companyName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ticker</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{item.ticker}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Currency</span>
            <span className="text-sm text-black dark:text-white">{item.currency || 'USD'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</span>
            <span className="text-sm text-black dark:text-white">{item.price !== null ? item.price.toLocaleString() : 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ENTRY1</span>
            <span className="text-sm text-black dark:text-white">{item.entry1 || '-'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ENTRY2</span>
            <span className="text-sm text-black dark:text-white">{item.entry2 || '-'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">EXIT1</span>
            <span className="text-sm text-black dark:text-white">{item.exit1 || '-'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">EXIT2</span>
            <span className="text-sm text-black dark:text-white">{item.exit2 || '-'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Score</span>
            <span className={`text-sm ${getScoreColorClass(item.score)}`}>{item.score.toFixed(1)}</span>
          </div>
        </div>
      </div>
    );
  }, [getScoreColorClass]);

  const renderExpandedRow = useCallback(
    (item: ScoreData) => (
      <MemoizedScoreBreakdownExpandedRow
        scoreBoardData={item.scoreBoardData}
        thresholdData={thresholdData}
        benjaminGrahamData={benjaminGrahamData}
        entryExitValues={entryExitValues}
      />
    ),
    [thresholdData, benjaminGrahamData, entryExitValues]
  );

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
      renderExpandedRow={renderExpandedRow}
      enableVirtualScroll={true}
      searchFields={['companyName', 'ticker']}
      searchPlaceholder="Sök efter företag eller ticker..."
      defaultSortKey="score"
      defaultSortDirection="desc"
      stickyColumns={['antal', 'companyName', 'ticker', 'currency']}
      ariaLabel="Score"
      minTableWidth="600px"
      getRowKey={(item) => generateRowKey(item)}
      enableExport={true}
      enablePrint={true}
      enableShareableLink={true}
      viewId="score"
      initialFilterState={initialTableState?.filterState}
      initialColumnFilters={initialTableState?.columnFilters}
      initialSearchValue={initialTableState?.searchValue}
      initialSortConfig={initialTableState?.sortConfig}
    />
  );
}

