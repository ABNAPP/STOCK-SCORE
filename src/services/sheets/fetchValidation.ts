/**
 * CSV response validation for fetch service.
 */

/**
 * Validates CSV text to ensure it's not HTML or empty
 *
 * Checks if the response is valid CSV data and not an HTML login page.
 * Throws descriptive errors if validation fails.
 *
 * @param csvText - The CSV text to validate
 * @throws {Error} If the text is empty, HTML, or doesn't appear to be valid CSV
 */
export function validateCSVText(csvText: string): void {
  if (!csvText || csvText.trim().length === 0) {
    throw new Error('Empty response from server');
  }

  const trimmedText = csvText.trim().toLowerCase();
  if (
    trimmedText.startsWith('<!doctype html') ||
    trimmedText.startsWith('<html') ||
    csvText.includes('accounts.google.com') ||
    csvText.includes('Sign in') ||
    csvText.includes('signin') ||
    csvText.includes('Google Account')
  ) {
    throw new Error(
      'Received HTML login page instead of CSV data. ' +
        'The Google Sheet is not publicly accessible. ' +
        'SOLUTION: Go to your Google Sheet → Click "Share" button → ' +
        'Change to "Anyone with the link" → Set permission to "Viewer" → Save. ' +
        'Then refresh this page.'
    );
  }

  if (!csvText.includes(',') && csvText.length > 100) {
    throw new Error('Response does not appear to be valid CSV data');
  }
}
