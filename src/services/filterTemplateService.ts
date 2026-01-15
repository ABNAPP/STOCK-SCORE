/**
 * Filter Template Service
 * 
 * Provides functionality to save and load filter templates.
 * Templates are predefined filter combinations that can be quickly applied.
 */

import { FilterValues } from '../types/filters';
import { saveFilter, loadFilter, getSavedFilters, SavedFilter } from './filterStorageService';
import { logger } from '../utils/logger';

export interface FilterTemplate {
  id: string;
  name: string;
  description?: string;
  filter: FilterValues;
  category?: string;
  isSystem?: boolean; // System templates cannot be deleted
}

const SYSTEM_TEMPLATES_KEY = 'filterTemplates:system';
const USER_TEMPLATES_KEY = 'filterTemplates:user';

/**
 * Get system filter templates (predefined)
 */
export function getSystemTemplates(): FilterTemplate[] {
  return [
    {
      id: 'high-score',
      name: 'High Score Stocks',
      description: 'Stocks with score > 80',
      filter: { score: { min: 80 } },
      category: 'score',
      isSystem: true,
    },
    {
      id: 'medium-score',
      name: 'Medium Score Stocks',
      description: 'Stocks with score 50-80',
      filter: { score: { min: 50, max: 80 } },
      category: 'score',
      isSystem: true,
    },
    {
      id: 'low-score',
      name: 'Low Score Stocks',
      description: 'Stocks with score < 50',
      filter: { score: { max: 50 } },
      category: 'score',
      isSystem: true,
    },
    {
      id: 'low-pe',
      name: 'Low P/E Stocks',
      description: 'Stocks with P/E < 10',
      filter: { pe: { max: 10 } },
      category: 'pe',
      isSystem: true,
    },
    {
      id: 'high-pe',
      name: 'High P/E Stocks',
      description: 'Stocks with P/E > 20',
      filter: { pe: { min: 20 } },
      category: 'pe',
      isSystem: true,
    },
  ];
}

/**
 * Get user-created templates for a table
 */
export function getUserTemplates(tableId: string): FilterTemplate[] {
  try {
    const savedFilters = getSavedFilters(tableId);
    return savedFilters
      .filter((filter) => filter.name.startsWith('template:'))
      .map((filter) => ({
        id: filter.name,
        name: filter.name.replace('template:', ''),
        filter: filter.values,
        category: 'user',
        isSystem: false,
      }));
  } catch (error) {
    logger.error('Error getting user templates', error, {
      component: 'filterTemplateService',
      operation: 'getUserTemplates',
      tableId,
    });
    return [];
  }
}

/**
 * Get all templates (system + user) for a table
 */
export function getAllTemplates(tableId: string): FilterTemplate[] {
  const systemTemplates = getSystemTemplates();
  const userTemplates = getUserTemplates(tableId);
  return [...systemTemplates, ...userTemplates];
}

/**
 * Save a user template
 */
export function saveTemplate(tableId: string, name: string, filter: FilterValues, description?: string): void {
  try {
    // Prefix with 'template:' to distinguish from regular saved filters
    const templateName = `template:${name}`;
    saveFilter(tableId, templateName, filter);
    logger.debug(`Template saved: ${templateName}`, {
      component: 'filterTemplateService',
      operation: 'saveTemplate',
      tableId,
      name,
    });
  } catch (error) {
    logger.error('Error saving template', error, {
      component: 'filterTemplateService',
      operation: 'saveTemplate',
      tableId,
      name,
    });
    throw error;
  }
}

/**
 * Load a template
 */
export function loadTemplate(tableId: string, templateId: string): FilterValues | null {
  try {
    // Check if it's a system template
    const systemTemplates = getSystemTemplates();
    const systemTemplate = systemTemplates.find((t) => t.id === templateId);
    if (systemTemplate) {
      return systemTemplate.filter;
    }

    // Check user templates
    const templateName = templateId.startsWith('template:') ? templateId : `template:${templateId}`;
    return loadFilter(tableId, templateName);
  } catch (error) {
    logger.error('Error loading template', error, {
      component: 'filterTemplateService',
      operation: 'loadTemplate',
      tableId,
      templateId,
    });
    return null;
  }
}

/**
 * Delete a user template
 */
export function deleteTemplate(tableId: string, templateId: string): void {
  try {
    // System templates cannot be deleted
    const systemTemplates = getSystemTemplates();
    if (systemTemplates.find((t) => t.id === templateId)) {
      throw new Error('Cannot delete system template');
    }

    const templateName = templateId.startsWith('template:') ? templateId : `template:${templateId}`;
    const savedFilters = getSavedFilters(tableId);
    const filter = savedFilters.find((f) => f.name === templateName);
    if (filter) {
      // Use the existing deleteFilter function
      const { deleteFilter } = require('./filterStorageService');
      deleteFilter(tableId, templateName);
    }
  } catch (error) {
    logger.error('Error deleting template', error, {
      component: 'filterTemplateService',
      operation: 'deleteTemplate',
      tableId,
      templateId,
    });
    throw error;
  }
}
