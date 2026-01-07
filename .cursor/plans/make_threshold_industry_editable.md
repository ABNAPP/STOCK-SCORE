# Make Threshold Industry Columns Editable

## Overview
Make all columns in the Threshold Industry table editable except "Industry" and "Antal" (count). Users should be able to manually edit IRR, LEVERAGE F2, RO40, Cash/SDebt, and Current Ratio values.

## Changes Required

### 1. Update ThresholdIndustryTable Component
- **File**: `src/components/ThresholdIndustryTable.tsx`
- Add state management using `useState` to store edited values (similar to EntryExitTable)
- Create a Map to store edited values keyed by industry name
- Initialize state from props data when data changes
- Add handler function `handleThresholdChange` to update values
- Replace static table cells with input fields for: irr, leverageF2, ro40, cashSdebt, currentRatio
- Keep "Industry" and "Antal" columns as read-only (no input fields)
- Use same input styling pattern as EntryExitTable (number inputs with proper styling)

### 2. Implementation Details
- Use `industry` as the key for storing edited values (since it's unique)
- Input fields should be type="number" for numeric columns
- Handle empty values (show empty string when 0, allow user to clear)
- Use `onClick={(e) => e.stopPropagation()}` to prevent row click events when editing
- Maintain the same visual styling and layout as current table

## Implementation Notes

- Follow the same pattern used in EntryExitTable for manual editing
- State should persist during the session (values are stored in component state)
- No need to persist to backend or localStorage unless specified
- Input fields should have proper focus styling and dark mode support
- Keep sorting functionality working with edited values

