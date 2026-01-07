import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { saveFilter, loadFilter, getSavedFilters, deleteFilter, SavedFilter } from '../services/filterStorageService';

export type FilterType = 'text' | 'number' | 'numberRange' | 'select' | 'boolean';

export interface FilterConfig {
  key: string;
  label: string;
  type: FilterType;
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export interface FilterValues {
  [key: string]: string | number | { min?: number; max?: number } | boolean | null;
}

interface AdvancedFiltersProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onClear: () => void;
  tableId?: string;
}

export default function AdvancedFilters({ filters, values, onChange, onClear, tableId }: AdvancedFiltersProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load saved filters when tableId changes or dropdown opens
  useEffect(() => {
    if (tableId && isOpen) {
      const filters = getSavedFilters(tableId);
      setSavedFilters(filters);
    }
  }, [tableId, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSaveFilterName('');
        setSaveError(null);
        setSaveSuccess(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSaveFilter = useCallback(() => {
    if (!tableId) {
      setSaveError('Tabell-ID saknas');
      return;
    }

    if (!saveFilterName.trim()) {
      setSaveError('Ange ett namn för filtret');
      return;
    }

    try {
      saveFilter(tableId, saveFilterName.trim(), values);
      setSaveFilterName('');
      setSaveError(null);
      setSaveSuccess(true);
      
      // Refresh saved filters list
      const updatedFilters = getSavedFilters(tableId);
      setSavedFilters(updatedFilters);
      
      // Clear success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Kunde inte spara filter');
      setSaveSuccess(false);
    }
  }, [tableId, saveFilterName, values]);

  const handleLoadFilter = useCallback((filterName: string) => {
    if (!tableId) return;
    
    const loadedValues = loadFilter(tableId, filterName);
    if (loadedValues) {
      onChange(loadedValues);
      setSaveError(null);
    }
  }, [tableId, onChange]);

  const handleDeleteFilter = useCallback((filterName: string) => {
    if (!tableId) return;
    
    if (window.confirm(`Är du säker på att du vill ta bort filtret "${filterName}"?`)) {
      deleteFilter(tableId, filterName);
      const updatedFilters = getSavedFilters(tableId);
      setSavedFilters(updatedFilters);
    }
  }, [tableId]);

  const handleFilterChange = (key: string, value: string | number | { min?: number; max?: number } | boolean | null) => {
    onChange({
      ...values,
      [key]: value === '' || value === null || (typeof value === 'object' && !value.min && !value.max) ? null : value,
    });
  };

  const hasActiveFilters = Object.values(values).some(
    (v) => v !== null && v !== '' && v !== undefined && (typeof v !== 'object' || v.min !== undefined || v.max !== undefined)
  );

  const activeFilterCount = Object.values(values).filter(
    (v) => v !== null && v !== '' && v !== undefined && (typeof v !== 'object' || v.min !== undefined || v.max !== undefined)
  ).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 sm:px-3 py-3 sm:py-2 text-sm font-medium rounded-md border transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95 flex items-center space-x-2 min-h-[44px] touch-manipulation ${
          hasActiveFilters
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
        title="Avancerade filter"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        <span>Filter</span>
        {activeFilterCount > 0 && (
          <span className="bg-blue-600 dark:bg-blue-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {activeFilterCount}
          </span>
        )}
        <svg
          className={`w-4 h-4 transition-transform duration-300 ease-in-out ${isOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-300 dark:border-gray-400 z-50 max-h-96 overflow-y-auto animate-fade-in-up transition-all duration-200">
          <div className="p-4 border-b border-gray-300 dark:border-gray-400">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Avancerade filter
              </h3>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    onClear();
                    setIsOpen(false);
                  }}
                  className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Rensa alla
                </button>
              )}
            </div>
          </div>
          <div className="p-4 space-y-4">
            {filters.map((filter) => {
              const currentValue = values[filter.key];

              return (
                <div key={filter.key}>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {filter.label}
                  </label>
                  
                  {filter.type === 'text' && (
                    <input
                      type="text"
                      value={(currentValue as string) || ''}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      placeholder={`Sök ${filter.label.toLowerCase()}...`}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-400 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-600 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}

                  {filter.type === 'number' && (
                    <input
                      type="number"
                      value={(currentValue as number) || ''}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="Värde..."
                      step={filter.step || 1}
                      min={filter.min}
                      max={filter.max}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-400 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-600 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}

                  {filter.type === 'numberRange' && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={typeof currentValue === 'object' && currentValue !== null ? (currentValue as { min?: number }).min || '' : ''}
                          onChange={(e) => handleFilterChange(filter.key, {
                            ...(typeof currentValue === 'object' && currentValue !== null ? currentValue : {}),
                            min: e.target.value ? parseFloat(e.target.value) : undefined,
                          })}
                          placeholder="Min"
                          step={filter.step || 1}
                          min={filter.min}
                          max={filter.max}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="text-gray-600 dark:text-gray-300">-</span>
                        <input
                          type="number"
                          value={typeof currentValue === 'object' && currentValue !== null ? (currentValue as { max?: number }).max || '' : ''}
                          onChange={(e) => handleFilterChange(filter.key, {
                            ...(typeof currentValue === 'object' && currentValue !== null ? currentValue : {}),
                            max: e.target.value ? parseFloat(e.target.value) : undefined,
                          })}
                          placeholder="Max"
                          step={filter.step || 1}
                          min={filter.min}
                          max={filter.max}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {filter.type === 'select' && filter.options && (
                    <select
                      value={String(currentValue || '')}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value === '' ? null : e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Alla</option>
                      {filter.options.map((option) => (
                        <option key={String(option.value)} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {filter.type === 'boolean' && (
                    <select
                      value={String(currentValue === null ? '' : currentValue)}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value === '' ? null : e.target.value === 'true')}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Alla</option>
                      <option value="true">Ja</option>
                      <option value="false">Nej</option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save and Load Filters Section */}
          {tableId && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-500 pt-4 mt-4">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                  Spara filter
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={saveFilterName}
                      onChange={(e) => {
                        setSaveFilterName(e.target.value);
                        setSaveError(null);
                        setSaveSuccess(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveFilter();
                        }
                      }}
                      placeholder="Namn på filter..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={handleSaveFilter}
                      disabled={!saveFilterName.trim()}
                      className="px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      Spara
                    </button>
                  </div>
                  {saveError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
                  )}
                  {saveSuccess && (
                    <p className="text-xs text-green-600 dark:text-green-400">Filter sparades!</p>
                  )}
                </div>
              </div>

              {/* Saved Filters List */}
              {savedFilters.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-500 pt-4 mt-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                    Sparade filter
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {savedFilters.map((savedFilter) => (
                      <div
                        key={savedFilter.name}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {savedFilter.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(savedFilter.createdAt).toLocaleDateString('sv-SE')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            onClick={() => handleLoadFilter(savedFilter.name)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all duration-200 hover:scale-110 active:scale-95"
                            title="Ladda filter"
                            aria-label={`Ladda filter ${savedFilter.name}`}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteFilter(savedFilter.name)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all duration-200 hover:scale-110 active:scale-95"
                            title="Ta bort filter"
                            aria-label={`Ta bort filter ${savedFilter.name}`}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

