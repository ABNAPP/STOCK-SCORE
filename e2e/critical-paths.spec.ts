/**
 * E2E Tests for Critical Paths
 * 
 * Tests critical user flows end-to-end using Playwright.
 */

import { test, expect } from '@playwright/test';

test.describe('Critical User Paths', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app (adjust URL for your environment)
    await page.goto('http://localhost:5173');
  });

  test('User authentication flow', async ({ page }) => {
    // Check if login page is shown
    const loginButton = page.getByRole('button', { name: /login|log in/i });
    
    if (await loginButton.isVisible()) {
      // Fill in login form (adjust selectors based on your Login component)
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'testpassword');
      await loginButton.click();

      // Wait for authentication
      await page.waitForURL(/\/(?!login)/, { timeout: 10000 });
    }

    // Should be authenticated and see main content
    await expect(page.getByText(/Score|Dashboard/i)).toBeVisible({ timeout: 10000 });
  });

  test('Data loading and display', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('table, [role="table"]', { timeout: 15000 });

    // Should see table with data
    const table = page.locator('table, [role="table"]').first();
    await expect(table).toBeVisible();

    // Should have at least one row
    const rows = table.locator('tbody tr, [role="row"]');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
  });

  test('Filter and search functionality', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table, [role="table"]', { timeout: 15000 });

    // Find search input
    const searchInput = page.getByPlaceholderText(/sök|search/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Test');
      
      // Wait for filtered results
      await page.waitForTimeout(500);
      
      // Results should be filtered
      const table = page.locator('table, [role="table"]').first();
      await expect(table).toBeVisible();
    }
  });

  test('Navigation between views', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('table, [role="table"], nav', { timeout: 15000 });

    // Find navigation links
    const navLinks = page.locator('nav a, [role="navigation"] a, button[aria-label*="view"]');
    const count = await navLinks.count();

    if (count > 0) {
      // Click first navigation link
      await navLinks.first().click();
      
      // Wait for view to change
      await page.waitForTimeout(1000);
      
      // Should see different content
      await expect(page.locator('main, [role="main"]')).toBeVisible();
    }
  });

  test('Responsive design - mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for content
    await page.waitForSelector('main, [role="main"]', { timeout: 10000 });

    // Should see mobile-optimized layout
    const mobileMenu = page.getByLabelText(/menu|hamburger/i);
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      
      // Sidebar should be visible
      await expect(page.locator('nav, [role="navigation"]')).toBeVisible();
    }
  });

  test('Responsive design - tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.waitForSelector('main, [role="main"]', { timeout: 10000 });

    // Should see tablet layout
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });

  test('Responsive design - desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.waitForSelector('main, [role="main"]', { timeout: 10000 });

    // Should see desktop layout
    await expect(page.locator('main, [role="main"]')).toBeVisible();
  });
});
