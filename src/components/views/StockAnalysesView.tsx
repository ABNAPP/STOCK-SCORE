import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useScoreBoardData } from '../../hooks/useScoreBoardData';
import type { ScoreBoardData } from '../../types/stock';

function rowKey(row: ScoreBoardData): string {
  return `${row.ticker}\u0000${row.companyName}`;
}

type CaseType = 'operating' | 'real-estate' | 'financial';
type FinancialSubcase = 'bank' | 'insurance' | 'other-financial';

/** Period column keys (local labels via i18n: FY-4 … LTM, FY+1 …) */
type PeriodKey = 'fy-4' | 'fy-3' | 'fy-2' | 'fy-1' | 'ltm' | 'fy+1' | 'fy+2' | 'fy+3';

const HISTORICAL_PERIODS: PeriodKey[] = ['fy-4', 'fy-3', 'fy-2', 'fy-1', 'ltm'];
const FORECAST_PERIODS: PeriodKey[] = ['fy+1', 'fy+2', 'fy+3'];
const ALL_PERIODS: PeriodKey[] = [...HISTORICAL_PERIODS, ...FORECAST_PERIODS];

const PERIOD_I18N_KEY: Record<PeriodKey, string> = {
  'fy-4': 'fyMinus4',
  'fy-3': 'fyMinus3',
  'fy-2': 'fyMinus2',
  'fy-1': 'fyMinus1',
  ltm: 'ltm',
  'fy+1': 'fyPlus1',
  'fy+2': 'fyPlus2',
  'fy+3': 'fyPlus3',
};

function createEmptyPeriodRow(): Record<PeriodKey, string> {
  return ALL_PERIODS.reduce(
    (acc, p) => {
      acc[p] = '';
      return acc;
    },
    {} as Record<PeriodKey, string>
  );
}

function periodColumnLabel(t: TFunction, period: PeriodKey): string {
  return t(`stockAnalysesView.${PERIOD_I18N_KEY[period]}`);
}

const selectClassName =
  'mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]';

const verticalInputClassName =
  'w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-black dark:text-white text-sm px-2 py-2 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500';

type ManualMatrixColumn = {
  id: string;
  header: string;
  fieldIdPrefix: string;
  getValue: (p: PeriodKey) => string;
  onChange: (p: PeriodKey, value: string) => void;
};

/**
 * Period as rows, metrics as columns (compact matrix).
 */
function ManualInputMatrixTable({
  periods,
  columns,
  t,
  ariaLabel,
}: {
  periods: PeriodKey[];
  columns: ManualMatrixColumn[];
  t: TFunction;
  ariaLabel: string;
}) {
  return (
    <div className="overflow-x-auto max-w-5xl rounded-md border border-gray-200 dark:border-gray-600">
      <table className="w-full min-w-[min(100%,20rem)] text-sm" aria-label={ariaLabel}>
        <thead className="bg-gray-50 dark:bg-gray-800/80">
          <tr className="border-b border-gray-200 dark:border-gray-600">
            <th
              scope="col"
              className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-[5.5rem] sm:w-24"
            >
              {t('stockAnalysesView.periodColumnHeader')}
            </th>
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className="px-2 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-900/30">
          {periods.map((p) => (
            <tr key={p}>
              <th
                scope="row"
                className="px-2 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 tabular-nums font-normal align-middle"
              >
                {periodColumnLabel(t, p)}
              </th>
              {columns.map((col) => (
                <td key={col.id} className="px-2 py-1.5 align-middle min-w-[6rem]">
                  <input
                    id={`${col.fieldIdPrefix}-${p}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={col.getValue(p)}
                    onChange={(e) => col.onChange(p, e.target.value)}
                    className={verticalInputClassName}
                    aria-label={`${col.header} ${periodColumnLabel(t, p)}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * List companies from existing Dashboard (Score Board) fetch.
 * Card overview shows company + ticker; price only in the inline detail panel. No new fetch, no Benjamin Graham, no Firestore.
 */
export default function StockAnalysesView() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useScoreBoardData();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [caseType, setCaseType] = useState<CaseType>('operating');
  const [financialSubcase, setFinancialSubcase] = useState<FinancialSubcase>('bank');
  const [revenueByPeriod, setRevenueByPeriod] = useState<Record<PeriodKey, string>>(createEmptyPeriodRow);
  const [navPerShareByPeriod, setNavPerShareByPeriod] = useState<Record<PeriodKey, string>>(createEmptyPeriodRow);
  const [roeByPeriod, setRoeByPeriod] = useState<Record<PeriodKey, string>>(createEmptyPeriodRow);
  const [totalDepositsByPeriod, setTotalDepositsByPeriod] = useState<Record<PeriodKey, string>>(
    createEmptyPeriodRow
  );
  const [lossRatioByPeriod, setLossRatioByPeriod] = useState<Record<PeriodKey, string>>(createEmptyPeriodRow);
  const [taxRateByPeriod, setTaxRateByPeriod] = useState<Record<PeriodKey, string>>(createEmptyPeriodRow);

  const selectedRow = useMemo(
    () => (selectedKey == null ? null : data.find((r) => rowKey(r) === selectedKey) ?? null),
    [data, selectedKey]
  );

  // Clear selection when the row is no longer in `data` (e.g. after refresh). setState in effect is intentional here.
  useEffect(() => {
    if (selectedKey != null && selectedRow == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync UI when data drops the selected company
      setSelectedKey(null);
    }
  }, [selectedKey, selectedRow]);

  const formatPrice = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return '—';
    }
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatFiveYearBeta = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return '—';
    }
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleOpenCard = useCallback((row: ScoreBoardData) => {
    setCaseType('operating');
    setFinancialSubcase('bank');
    setRevenueByPeriod(createEmptyPeriodRow());
    setNavPerShareByPeriod(createEmptyPeriodRow());
    setRoeByPeriod(createEmptyPeriodRow());
    setTotalDepositsByPeriod(createEmptyPeriodRow());
    setLossRatioByPeriod(createEmptyPeriodRow());
    setTaxRateByPeriod(createEmptyPeriodRow());
    setSelectedKey(rowKey(row));
  }, []);

  const handleBack = useCallback(() => {
    setSelectedKey(null);
  }, []);

  const count = data.length;

  return (
    <div className="h-full bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-white mb-2 tracking-tight">
          {t('navigation.stockAnalyses')}
        </h1>
        {!loading && !error && count > 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
            {t('stockAnalysesView.totalStocks', { count })}
          </p>
        )}
      </div>

      {loading && (
        <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
          {t('common.loading', 'Laddar...')}
        </p>
      )}

      {!loading && error && (
        <div
          className="rounded-lg border border-red-300 dark:border-red-600 bg-white dark:bg-gray-800 p-4 shadow-sm"
          role="alert"
        >
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">{t('aria.error', 'Error')}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{error}</p>
          <button
            type="button"
            onClick={() => void refetch(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors min-h-[44px]"
          >
            {t('offline.tryAgain', 'Try again')}
          </button>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('stockAnalysesView.noRows')}</p>
      )}

      {!loading && !error && selectedRow != null && (
        <section
          className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm max-w-5xl w-full"
          aria-label={t('stockAnalysesView.detailTitle')}
        >
          <button
            type="button"
            onClick={handleBack}
            className="mb-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] -ml-1 px-1"
          >
            {t('stockAnalysesView.backToList')}
          </button>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-black dark:text-white leading-snug mb-1">
                {selectedRow.companyName}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{selectedRow.ticker}</p>
            </div>
            <div className="shrink-0 flex flex-col gap-2 w-full sm:w-auto sm:max-w-xs sm:items-stretch">
              <div
                className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50/90 dark:bg-gray-900/40 px-3 py-2 sm:text-right"
                aria-label={t('stockAnalysesView.entryPrice')}
              >
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t('stockAnalysesView.entryPrice')}
                </div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums text-gray-400 dark:text-gray-500">—</div>
              </div>
              <div
                className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50/90 dark:bg-gray-900/40 px-3 py-2 sm:text-right"
                aria-label={t('stockAnalysesView.fiveYearBeta')}
              >
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {t('stockAnalysesView.fiveYearBeta')}
                </div>
                <div className="mt-0.5 text-base font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                  {formatFiveYearBeta(selectedRow.fiveYearBeta)}
                </div>
              </div>
            </div>
          </div>
          <p className="text-base text-gray-800 dark:text-gray-200 mb-6">
            <span className="text-gray-500 dark:text-gray-500 mr-2">{t('stockAnalysesView.price')}</span>
            {formatPrice(selectedRow.price)}
          </p>

          <div
            className="border-t border-gray-200 dark:border-gray-600 pt-4"
            role="group"
            aria-label={t('stockAnalysesView.analysisSetup')}
          >
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              {t('stockAnalysesView.analysisSetup')}
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="stock-analyses-case-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('stockAnalysesView.caseType')}
                </label>
                <select
                  id="stock-analyses-case-type"
                  className={selectClassName}
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value as CaseType)}
                >
                  <option value="operating">{t('stockAnalysesView.caseTypeOperating')}</option>
                  <option value="real-estate">{t('stockAnalysesView.caseTypeRealEstate')}</option>
                  <option value="financial">{t('stockAnalysesView.caseTypeFinancial')}</option>
                </select>
              </div>
              {caseType === 'financial' && (
                <div>
                  <label
                    htmlFor="stock-analyses-financial-subcase"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t('stockAnalysesView.financialSubcase')}
                  </label>
                  <select
                    id="stock-analyses-financial-subcase"
                    className={selectClassName}
                    value={financialSubcase}
                    onChange={(e) => setFinancialSubcase(e.target.value as FinancialSubcase)}
                  >
                    <option value="bank">{t('stockAnalysesView.financialSubcaseBank')}</option>
                    <option value="insurance">{t('stockAnalysesView.financialSubcaseInsurance')}</option>
                    <option value="other-financial">{t('stockAnalysesView.financialSubcaseOther')}</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div
            className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4"
            role="group"
            aria-label={t('stockAnalysesView.manualInputs')}
          >
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              {t('stockAnalysesView.manualInputs')}
            </h3>

            {caseType === 'operating' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('stockAnalysesView.sectionHistoricalData')}
                  </h4>
                  <ManualInputMatrixTable
                    periods={HISTORICAL_PERIODS}
                    columns={[
                      {
                        id: 'revenue',
                        header: t('stockAnalysesView.inputRevenue'),
                        fieldIdPrefix: 'mi-revenue-hist',
                        getValue: (p) => revenueByPeriod[p] ?? '',
                        onChange: (p, v) => setRevenueByPeriod((prev) => ({ ...prev, [p]: v })),
                      },
                    ]}
                    t={t}
                    ariaLabel={`${t('stockAnalysesView.sectionHistoricalData')} — ${t('stockAnalysesView.inputRevenue')}`}
                  />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('stockAnalysesView.sectionForecastData')}
                  </h4>
                  <ManualInputMatrixTable
                    periods={FORECAST_PERIODS}
                    columns={[
                      {
                        id: 'revenue',
                        header: t('stockAnalysesView.inputRevenue'),
                        fieldIdPrefix: 'mi-revenue-fc',
                        getValue: (p) => revenueByPeriod[p] ?? '',
                        onChange: (p, v) => setRevenueByPeriod((prev) => ({ ...prev, [p]: v })),
                      },
                    ]}
                    t={t}
                    ariaLabel={`${t('stockAnalysesView.sectionForecastData')} — ${t('stockAnalysesView.inputRevenue')}`}
                  />
                </div>
              </div>
            )}

            {caseType === 'real-estate' && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('stockAnalysesView.sectionHistoricalData')}
                </h4>
                <ManualInputMatrixTable
                  periods={HISTORICAL_PERIODS}
                  columns={[
                    {
                      id: 'nav',
                      header: t('stockAnalysesView.inputNavPerShare'),
                      fieldIdPrefix: 'mi-nav',
                      getValue: (p) => navPerShareByPeriod[p] ?? '',
                      onChange: (p, v) => setNavPerShareByPeriod((prev) => ({ ...prev, [p]: v })),
                    },
                  ]}
                  t={t}
                  ariaLabel={`${t('stockAnalysesView.sectionHistoricalData')} — ${t('stockAnalysesView.inputNavPerShare')}`}
                />
              </div>
            )}

            {caseType === 'financial' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('stockAnalysesView.sectionHistoricalData')}
                  </h4>
                  <ManualInputMatrixTable
                    periods={HISTORICAL_PERIODS}
                    columns={(() => {
                      const roeHist: ManualMatrixColumn = {
                        id: 'roe',
                        header: t('stockAnalysesView.inputRoeRatio'),
                        fieldIdPrefix: 'mi-fin-h-roe',
                        getValue: (p) => roeByPeriod[p] ?? '',
                        onChange: (p, v) => setRoeByPeriod((prev) => ({ ...prev, [p]: v })),
                      };
                      if (financialSubcase === 'bank') {
                        return [
                          roeHist,
                          {
                            id: 'deposits',
                            header: t('stockAnalysesView.inputTotalDeposits'),
                            fieldIdPrefix: 'mi-deposits',
                            getValue: (p) => totalDepositsByPeriod[p] ?? '',
                            onChange: (p, v) =>
                              setTotalDepositsByPeriod((prev) => ({ ...prev, [p]: v })),
                          },
                        ];
                      }
                      if (financialSubcase === 'insurance') {
                        return [
                          roeHist,
                          {
                            id: 'loss',
                            header: t('stockAnalysesView.inputLossRatio'),
                            fieldIdPrefix: 'mi-loss-ratio',
                            getValue: (p) => lossRatioByPeriod[p] ?? '',
                            onChange: (p, v) => setLossRatioByPeriod((prev) => ({ ...prev, [p]: v })),
                          },
                        ];
                      }
                      return [roeHist];
                    })()}
                    t={t}
                    ariaLabel={`${t('stockAnalysesView.sectionHistoricalData')}`}
                  />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('stockAnalysesView.sectionForecastData')}
                  </h4>
                  <ManualInputMatrixTable
                    periods={FORECAST_PERIODS}
                    columns={[
                      {
                        id: 'roe',
                        header: t('stockAnalysesView.inputRoeRatio'),
                        fieldIdPrefix: 'mi-fin-f-roe',
                        getValue: (p) => roeByPeriod[p] ?? '',
                        onChange: (p, v) => setRoeByPeriod((prev) => ({ ...prev, [p]: v })),
                      },
                      {
                        id: 'tax',
                        header: t('stockAnalysesView.inputTaxRate'),
                        fieldIdPrefix: 'mi-tax',
                        getValue: (p) => taxRateByPeriod[p] ?? '',
                        onChange: (p, v) => setTaxRateByPeriod((prev) => ({ ...prev, [p]: v })),
                      },
                    ]}
                    t={t}
                    ariaLabel={`${t('stockAnalysesView.sectionForecastData')}`}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {!loading && !error && data.length > 0 && selectedRow == null && (
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
          aria-label={t('navigation.stockAnalyses')}
        >
          {data.map((row) => {
            const key = rowKey(row);
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => handleOpenCard(row)}
                  className="w-full text-left rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 shadow-sm min-h-[88px] flex flex-col justify-center hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="text-base font-semibold text-black dark:text-white leading-snug line-clamp-2">
                    {row.companyName}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono mt-2">{row.ticker}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {t('stockAnalysesView.fiveYearBeta')}{' '}
                    <span className="text-gray-700 dark:text-gray-300 tabular-nums">
                      {formatFiveYearBeta(row.fiveYearBeta)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
