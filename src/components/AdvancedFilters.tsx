import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { saveFilter, loadFilter, getSavedFilters, deleteFilter, SavedFilter } from '../services/filterStorageService';
import { getAllTemplates, loadTemplate, saveTemplate, deleteTemplate, FilterTemplate } from '../services/filterTemplateService';
import { validateTextInput, validateNumberInput, validateNumberRange, validateSelectInput, validateFilterName } from '../utils/inputValidator';
import { useNotifications } from '../contexts/NotificationContext';
import { FilterConfig, FilterValues, FilterType } from '../types/filters';

// Re-export for backward compatibility
export type { FilterType, FilterConfig, FilterValues };

interface AdvancedFiltersProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onClear: () => void;
  tableId?: string;
}

export default function AdvancedFilters({ filters, values, onChange, onClear, tableId }: AdvancedFiltersProps) {
  const { t } = useTranslation();
  const { createNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<FilterTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Load saved filters and templates when tableId changes or dropdown opens
  useEffect(() => {
    if (tableId && isOpen) {
      const filters = getSavedFilters(tableId);
      setSavedFilters(filters);
      const allTemplates = getAllTemplates(tableId);
      setTemplates(allTemplates);
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

    const trimmedName = saveFilterName.trim();
    const nameValidation = validateFilterName(trimmedName);
    if (!nameValidation.isValid) {
      setSaveError(nameValidation.error || 'Ogiltigt filternamn');
      return;
    }

    try {
      saveFilter(tableId, trimmedName, values);
      setSaveFilterName('');
      setSaveError(null);
      setSaveSuccess(true);
      
      // Refresh saved filters list
      const updatedFilters = getSavedFilters(tableId);
      setSavedFilters(updatedFilters);
      
      // Show notification
      createNotification(
        'success',
        'Filter Saved',
        `Filter "${trimmedName}" has been saved successfully`,
        {
          showDesktop: false,
          persistent: false,
        }
      );
      
      // Clear success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Kunde inte spara filter';
      setSaveError(errorMessage);
      setSaveSuccess(false);
      
      createNotification(
        'error',
        'Filter Save Failed',
        errorMessage,
        {
          showDesktop: true,
          persistent: false,
        }
      );
    }
  }, [tableId, saveFilterName, values, createNotification]);

  const handleLoadFilter = useCallback((filterName: string) => {
    if (!tableId) return;
    
    const loadedValues = loadFilter(tableId, filterName);
    if (loadedValues) {
      onChange(loadedValues);
      setSaveError(null);
    }
  }, [tableId, onChange]);

  const handleLoadTemplate = useCallback((templateId: string) => {
    if (!tableId) return;
    
    const loadedValues = loadTemplate(tableId, templateId);
    if (loadedValues) {
      onChange(loadedValues);
      setSaveError(null);
      setIsOpen(false);
    }
  }, [tableId, onChange]);

  const handleSaveAsTemplate = useCallback(() => {
    if (!tableId) {
      setSaveError('Tabell-ID saknas');
      return;
    }

    const trimmedName = saveFilterName.trim();
    const nameValidation = validateFilterName(trimmedName);
    if (!nameValidation.isValid) {
      setSaveError(nameValidation.error || 'Ogiltigt templatenamn');
      return;
    }

    try {
      saveTemplate(tableId, trimmedName, values);
      setSaveFilterName('');
      setSaveError(null);
      setSaveSuccess(true);
      
      // Refresh templates list
      const allTemplates = getAllTemplates(tableId);
      setTemplates(allTemplates);
      
      createNotification(
        'success',
        'Template Saved',
        `Template "${trimmedName}" has been saved successfully`,
        {
          showDesktop: false,
          persistent: false,
        }
      );
      
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Kunde inte spara template';
      setSaveError(errorMessage);
      setSaveSuccess(false);
      
      createNotification(
        'error',
        'Template Save Failed',
        errorMessage,
        {
          showDesktop: true,
          persistent: false,
        }
      );
    }
  }, [tableId, saveFilterName, values, createNotification]);

  const handleDeleteFilter = useCallback((filterName: string) => {
    if (!tableId) return;
    
    if (window.confirm(`Är du säker på att du vill ta bort filtret "${filterName}"?`)) {
      deleteFilter(tableId, filterName);
      const updatedFilters = getSavedFilters(tableId);
      setSavedFilters(updatedFilters);
    }
  }, [tableId]);

  const handleFilterChange = (key: string, value: string | number | { min?: number; max?: number } | boolean | null) => {
    const filter = filters.find((f) => f.key === key);
    if (!filter) {
      onChange({
        ...values,
        [key]: value === '' || value === null || (typeof value === 'object' && !value.min && !value.max) ? null : value,
      });
      return;
    }

    // Validate based on filter type
    let validationError: string | undefined;
    const errors = { ...validationErrors };

    if (filter.type === 'text') {
      const result = validateTextInput(value as string, { maxLength: 200 });
      if (!result.isValid) {
        validationError = result.error;
      } else {
        delete errors[key];
      }
    } else if (filter.type === 'number') {
      const result = validateNumberInput(value as number, {
        min: filter.min,
        max: filter.max,
        allowDecimal: filter.step !== undefined && filter.step < 1,
        maxDecimals: filter.step !== undefined && filter.step < 1 ? 2 : 0,
      });
      if (!result.isValid) {
        validationError = result.error;
      } else {
        delete errors[key];
      }
    } else if (filter.type === 'numberRange') {
      const rangeValue = typeof value === 'object' && value !== null ? value : { min: undefined, max: undefined };
      const result = validateNumberRange(rangeValue, {
        min: filter.min,
        max: filter.max,
      });
      if (!result.isValid) {
        validationError = result.error;
      } else {
        delete errors[key];
      }
    } else if (filter.type === 'select' && filter.options) {
      const result = validateSelectInput(value as string | number, filter.options.map((opt) => opt.value));
      if (!result.isValid) {
        validationError = result.error;
      } else {
        delete errors[key];
      }
    }

    if (validationError) {
      errors[key] = validationError;
    } else {
      delete errors[key];
    }

    setValidationErrors(errors);

    // Only update values if validation passes or value is empty/null
    const isEmpty = value === '' || value === null || (typeof value === 'object' && !value.min && !value.max);
    if (isEmpty || !validationError) {
      onChange({
        ...values,
        [key]: isEmpty ? null : value,
      });
    }
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
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400'
            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
        title="Avancerade filter"
        aria-label={t('aria.filterButton')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
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
          aria-hidden="true"
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
              <h3 className="text-sm font-semibold text-black dark:text-white">
                Avancerade filter
              </h3>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    onClear();
                    setIsOpen(false);
                  }}
                  className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all duration-200 hover:scale-105 active:scale-95"
                  aria-label={t('aria.clearFilters')}
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
                    <div>
                      <input
                        type="text"
                        value={(currentValue as string) || ''}
                        onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                        placeholder={`Sök ${filter.label.toLowerCase()}...`}
                        className={`w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-600 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:border-blue-500 ${
                          validationErrors[filter.key]
                            ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-400 focus:ring-blue-500'
                        }`}
                        aria-label={filter.label}
                        aria-invalid={!!validationErrors[filter.key]}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && !e.shiftKey) {
                            // Allow normal tab navigation
                            return;
                          }
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Find next filter input and focus it
                            const filterInputs = Array.from(dropdownRef.current?.querySelectorAll('input, select') || []) as HTMLElement[];
                            const currentIndex = filterInputs.indexOf(e.currentTarget);
                            if (currentIndex < filterInputs.length - 1) {
                              filterInputs[currentIndex + 1]?.focus();
                            }
                          }
                        }}
                      />
                      {validationErrors[filter.key] && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                          {validationErrors[filter.key]}
                        </p>
                      )}
                    </div>
                  )}

                  {filter.type === 'number' && (
                    <div>
                      <input
                        type="number"
                        value={(currentValue as number) || ''}
                        onChange={(e) => handleFilterChange(filter.key, e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Värde..."
                        step={filter.step || 1}
                        min={filter.min}
                        max={filter.max}
                        className={`w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-600 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:border-blue-500 ${
                          validationErrors[filter.key]
                            ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 dark:border-gray-400 focus:ring-blue-500'
                        }`}
                        aria-label={filter.label}
                        aria-invalid={!!validationErrors[filter.key]}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Find next filter input and focus it
                            const filterInputs = Array.from(dropdownRef.current?.querySelectorAll('input, select') || []) as HTMLElement[];
                            const currentIndex = filterInputs.indexOf(e.currentTarget);
                            if (currentIndex < filterInputs.length - 1) {
                              filterInputs[currentIndex + 1]?.focus();
                            }
                          }
                        }}
                      />
                      {validationErrors[filter.key] && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                          {validationErrors[filter.key]}
                        </p>
                      )}
                    </div>
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
                          className={`flex-1 px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:border-blue-500 ${
                            validationErrors[filter.key]
                              ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                              : 'border-gray-300 dark:border-gray-500 focus:ring-blue-500'
                          }`}
                          aria-label={`${filter.label} minimum`}
                          aria-invalid={!!validationErrors[filter.key]}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              // Focus next input in the same range or next filter
                              const filterInputs = Array.from(dropdownRef.current?.querySelectorAll('input, select') || []) as HTMLElement[];
                              const currentIndex = filterInputs.indexOf(e.currentTarget);
                              if (currentIndex < filterInputs.length - 1) {
                                filterInputs[currentIndex + 1]?.focus();
                              }
                            }
                          }}
                        />
                        <span className="text-gray-600 dark:text-gray-300" aria-hidden="true">-</span>
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
                          className={`flex-1 px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:border-blue-500 ${
                            validationErrors[filter.key]
                              ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                              : 'border-gray-300 dark:border-gray-500 focus:ring-blue-500'
                          }`}
                          aria-label={`${filter.label} maximum`}
                          aria-invalid={!!validationErrors[filter.key]}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              // Find next filter input and focus it
                              const filterInputs = Array.from(dropdownRef.current?.querySelectorAll('input, select') || []) as HTMLElement[];
                              const currentIndex = filterInputs.indexOf(e.currentTarget);
                              if (currentIndex < filterInputs.length - 1) {
                                filterInputs[currentIndex + 1]?.focus();
                              }
                            }
                          }}
                        />
                      </div>
                      {validationErrors[filter.key] && (
                        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                          {validationErrors[filter.key]}
                        </p>
                      )}
                    </div>
                  )}

                  {filter.type === 'select' && filter.options && (
                    <select
                      value={String(currentValue || '')}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value === '' ? null : e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label={filter.label}
                      tabIndex={0}
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label={filter.label}
                      tabIndex={0}
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

          {/* Filter Templates Section */}
          {tableId && templates.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-500 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  {t('filters.templates', 'Filter Templates')}
                </h4>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showTemplates ? t('common.hide', 'Hide') : t('common.show', 'Show')}
                </button>
              </div>
              {showTemplates && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black dark:text-white truncate">
                          {template.name}
                        </p>
                        {template.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {template.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleLoadTemplate(template.id)}
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all duration-200 hover:scale-110 active:scale-95 ml-2"
                        title={t('filters.loadTemplate', 'Load template')}
                        aria-label={`${t('filters.loadTemplate', 'Load template')} ${template.name}`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Save and Load Filters Section */}
          {tableId && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-500 pt-4 mt-4">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                  {t('filters.saveFilter', 'Spara filter')}
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
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      aria-label="Filter name"
                    />
                    <button
                      onClick={handleSaveFilter}
                      disabled={!saveFilterName.trim()}
                      className="px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
                      aria-label={t('aria.saveFilter')}
                    >
                      {t('filters.save', 'Spara')}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleSaveAsTemplate}
                      disabled={!saveFilterName.trim()}
                      className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200"
                      aria-label={t('filters.saveAsTemplate', 'Save as Template')}
                    >
                      {t('filters.saveAsTemplate', 'Save as Template')}
                    </button>
                  </div>
                  {saveError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
                  )}
                  {saveSuccess && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {t('filters.filterSaved', 'Filter sparades!')}
                    </p>
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
                          <p className="text-sm font-medium text-black dark:text-white truncate">
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
                            aria-label={`${t('aria.loadFilter')} ${savedFilter.name}`}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
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
                            aria-label={`${t('aria.deleteFilter')} ${savedFilter.name}`}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
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

