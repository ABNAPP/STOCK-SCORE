import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BaseTable, { ColumnDefinition, HeaderRenderProps } from '../BaseTable';
import type { IsmBasketConstituentTableRow } from '../../types/ismBasketConstituentTableRow';
import { useIsmSectorDetailLocal } from './IsmSectorDetailLocalContext';
import { Card, CardHeader } from '../ui/Card';

const TABLE_ID = 'ism-sector-basket';

function formatPct(v: number | null | undefined, fractionDigits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toLocaleString(undefined, { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits })}%`;
}

function formatSignedPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

type Props = {
  footer?: ReactNode;
};

export default function IsmSectorConstituentBasketTable({ footer }: Props) {
  const { t } = useTranslation();
  const {
    constituentBasketTableRows,
    constituentBasketTableRowsLoading,
    constituentBasketTableRowsError,
    refetchConstituentBasketTableRows,
    committedLocalParams,
  } = useIsmSectorDetailLocal();

  const columns: ColumnDefinition<IsmBasketConstituentTableRow>[] = useMemo(
    () => [
      { key: 'ticker_raw', label: t('ism.detail.colTicker'), required: true, sortable: true },
      { key: 'company_name', label: t('ism.detail.colCompany'), required: true, sortable: true },
      {
        key: 'currentWeightPct',
        label: t('ism.detail.basketColWeight'),
        defaultVisible: true,
        sortable: true,
        align: 'right',
      },
      {
        key: 'priceVsSmaPct',
        label: t('ism.detail.basketColPriceVsSma', { n: committedLocalParams.sectorSmaLength }),
        defaultVisible: true,
        sortable: true,
        align: 'right',
      },
      {
        key: 'smaSlopeRising',
        label: t('ism.detail.basketColSmaSlope', { n: committedLocalParams.sectorSmaLength }),
        defaultVisible: true,
        sortable: true,
        align: 'center',
      },
      {
        key: 'inBreadth',
        label: t('ism.detail.basketColInBreadth'),
        defaultVisible: true,
        sortable: true,
        align: 'center',
      },
      {
        key: 'breadthContributionPct',
        label: t('ism.detail.basketColBreadthContrib'),
        defaultVisible: true,
        sortable: true,
        align: 'right',
      },
    ],
    [committedLocalParams.sectorSmaLength, t]
  );

  const renderHeader = useCallback(
    (props: HeaderRenderProps<IsmBasketConstituentTableRow>) => {
      const { column, getStickyPosition, handleSort, getSortIcon } = props;
      const isSticky = Boolean(column.sticky);
      const stickyClass = isSticky ? `sm:sticky sm:top-0 ${getStickyPosition(column.key)} z-50` : '';
      const sortable = column.sortable !== false;
      const alignClass =
        column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left';

      if (!sortable) {
        return (
          <th
            className={`px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider ${stickyClass} bg-gray-50 dark:bg-gray-900 ${alignClass}`}
            scope="col"
          >
            {column.label}
          </th>
        );
      }

      return (
        <th
          className={`px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 ${stickyClass} bg-gray-50 dark:bg-gray-900 ${alignClass}`}
          scope="col"
          onClick={() => handleSort(column.key)}
        >
          <span className="inline-flex items-center gap-1">
            {column.label}
            <span className="text-[10px] opacity-70">{getSortIcon(column.key)}</span>
          </span>
        </th>
      );
    },
    []
  );

  const renderCell = useCallback(
    (
      item: IsmBasketConstituentTableRow,
      column: ColumnDefinition<IsmBasketConstituentTableRow>,
      _index: number,
      _globalIndex: number
    ) => {
      switch (column.key) {
        case 'ticker_raw':
          return (
            <div className="inline-flex items-center gap-2">
              <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{item.ticker_raw}</span>
              {item.isSelected && (
                <span className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400 font-semibold">
                  {t('ism.detail.basketSelectedBadge')}
                </span>
              )}
            </div>
          );
        case 'company_name':
          return (
            <span className="font-medium text-gray-900 dark:text-gray-100 max-w-[14rem] truncate inline-block align-bottom" title={item.company_name}>
              {item.company_name}
            </span>
          );
        case 'currentWeightPct':
          return <span className="tabular-nums text-gray-900 dark:text-gray-100">{formatPct(item.currentWeightPct)}</span>;
        case 'priceVsSmaPct':
          return <span className="tabular-nums text-gray-900 dark:text-gray-100">{formatSignedPct(item.priceVsSmaPct)}</span>;
        case 'smaSlopeRising':
          if (item.smaSlopeRising == null) return <span className="text-gray-500 dark:text-gray-400">{t('ism.detail.na')}</span>;
          return (
            <span className={item.smaSlopeRising ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
              {item.smaSlopeRising ? t('ism.detail.rising') : t('ism.detail.falling')}
            </span>
          );
        case 'inBreadth':
          if (item.inBreadth == null) return <span className="text-gray-500 dark:text-gray-400">{t('ism.detail.na')}</span>;
          return (
            <span className={item.inBreadth ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-600 dark:text-gray-400'}>
              {item.inBreadth ? t('ism.detail.basketYes') : t('ism.detail.basketNo')}
            </span>
          );
        case 'breadthContributionPct':
          return <span className="tabular-nums text-gray-900 dark:text-gray-100">{formatPct(item.breadthContributionPct)}</span>;
        default:
          return null;
      }
    },
    [t]
  );

  const renderMobileCard = useCallback(
    (item: IsmBasketConstituentTableRow, _index: number, globalIndex: number, _isExpanded: boolean, _toggleExpand: () => void) => {
      const base =
        globalIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50';
      const selected = item.isSelected
        ? 'ring-2 ring-amber-500 dark:ring-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/20'
        : 'border-gray-300 dark:border-gray-600';
      const slope =
        item.smaSlopeRising == null ? (
          <span className="text-gray-500 dark:text-gray-400">{t('ism.detail.na')}</span>
        ) : (
          <span className={item.smaSlopeRising ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
            {item.smaSlopeRising ? t('ism.detail.rising') : t('ism.detail.falling')}
          </span>
        );
      const breadth =
        item.inBreadth == null ? (
          <span className="text-gray-500 dark:text-gray-400">{t('ism.detail.na')}</span>
        ) : (
          <span className={item.inBreadth ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-600 dark:text-gray-400'}>
            {item.inBreadth ? t('ism.detail.basketYes') : t('ism.detail.basketNo')}
          </span>
        );
      return (
        <div className={`${base} rounded-lg border ${selected} shadow-sm p-4 space-y-2`}>
          <div className="flex justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{item.ticker_raw}</span>
            {item.isSelected && (
              <span className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400 font-semibold">
                {t('ism.detail.basketSelectedBadge')}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{item.company_name}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-gray-500 dark:text-gray-400">{t('ism.detail.basketColWeight')}</span>
            <span className="text-right tabular-nums">{formatPct(item.currentWeightPct)}</span>
            <span className="text-gray-500 dark:text-gray-400">
              {t('ism.detail.basketColPriceVsSma', { n: committedLocalParams.sectorSmaLength })}
            </span>
            <span className="text-right tabular-nums">{formatSignedPct(item.priceVsSmaPct)}</span>
            <span className="text-gray-500 dark:text-gray-400">
              {t('ism.detail.basketColSmaSlope', { n: committedLocalParams.sectorSmaLength })}
            </span>
            <span className="text-right">{slope}</span>
            <span className="text-gray-500 dark:text-gray-400">{t('ism.detail.basketColInBreadth')}</span>
            <span className="text-right">{breadth}</span>
            <span className="text-gray-500 dark:text-gray-400">{t('ism.detail.basketColBreadthContrib')}</span>
            <span className="text-right tabular-nums">{formatPct(item.breadthContributionPct)}</span>
          </div>
        </div>
      );
    },
    [committedLocalParams.sectorSmaLength, t]
  );

  const getRowClassName = useCallback((item: IsmBasketConstituentTableRow) => {
    if (!item.isSelected) return undefined;
    return 'ring-2 ring-inset ring-amber-500 dark:ring-amber-400 !bg-amber-50 dark:!bg-amber-950/35 shadow-[inset_4px_0_0_0] shadow-amber-500 dark:shadow-amber-400 font-medium';
  }, []);

  return (
    <section className="flex-1 min-h-0 mt-2" aria-label={t('ism.detail.tableAria')}>
      <Card variant="outlined" padding="none" className="overflow-hidden flex flex-col min-h-0">
        <CardHeader title={t('ism.detail.constituentsTitle')} className="px-4 pt-4" />
        <div className="min-h-[220px] flex flex-col flex-1 px-1 pb-1">
          <BaseTable<IsmBasketConstituentTableRow>
            data={constituentBasketTableRows}
            loading={constituentBasketTableRowsLoading}
            error={constituentBasketTableRowsError}
            columns={columns}
            filters={[]}
            tableId={TABLE_ID}
            renderCell={renderCell}
            renderHeader={renderHeader}
            renderMobileCard={renderMobileCard}
            enableVirtualScroll
            virtualScrollRowHeight={52}
            virtualScrollOverscan={8}
            enableMobileExpand={false}
            searchFields={['ticker_raw', 'company_name']}
            searchPlaceholder={t('ism.detail.basketSearchPlaceholder')}
            defaultSortKey="currentWeightPct"
            defaultSortDirection="desc"
            stickyColumns={[]}
            headerCellPaddingClass="px-2 py-2"
            cellPaddingClass="px-2 py-2"
            ariaLabel={t('ism.detail.tableAria')}
            minTableWidth="720px"
            getRowKey={(item) => item.symbol_id}
            getRowClassName={getRowClassName}
            emptyMessage={t('ism.detail.noConstituents')}
            onRetry={() => void refetchConstituentBasketTableRows()}
          />
        </div>
        {footer}
      </Card>
    </section>
  );
}
