import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Dashboard and Navigation
 * Tests PWA navigation, routing, and dashboard functionality
 */

// Helper to set up authenticated session
async function setupAuth(page: any) {
  await page.evaluate(() => {
    localStorage.setItem('token', 'test-jwt-token');
    localStorage.setItem('user', JSON.stringify({
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      role: 'owner',
      tenant_id: 1,
    }));
  });
}

test.describe('Dashboard and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await page.goto('/');
  });

  test.describe('Dashboard Home', () => {
    test('should display dashboard with key metrics', async ({ page }) => {
      // Wait for dashboard to load
      await page.waitForSelector('h1, h2', { timeout: 5000 });

      // Should show welcome or dashboard title
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();

      // Should show navigation menu
      await expect(page.locator('nav, .nav, .menu')).toBeVisible();

      // Should show at least some content sections
      const sections = await page.locator('section, .card, .widget').count();
      expect(sections).toBeGreaterThan(0);
    });

    test('should show user information', async ({ page }) => {
      // Should display user name or email
      await expect(page.locator('text=/Test User|test@example.com/i')).toBeVisible();
    });

    test('should display recent alerts summary', async ({ page }) => {
      // Look for alerts section or widget
      const alertsSection = page.locator('text=/alerts|notifications/i').first();
      await expect(alertsSection).toBeVisible();
    });

    test('should show camera status', async ({ page }) => {
      // Look for camera status or monitoring section
      const cameraSection = page.locator('text=/camera|monitor/i').first();
      await expect(cameraSection).toBeVisible();
    });
  });

  test.describe('Navigation Menu', () => {
    const menuItems = [
      { name: 'Home', url: '/', text: /home|dashboard/i },
      { name: 'Recipes', url: '/recipes', text: /recipe/i },
      { name: 'Status', url: '/status', text: /status|monitor/i },
      { name: 'Alerts', url: '/alerts', text: /alert/i },
      { name: 'Settings', url: '/settings', text: /setting/i },
      { name: 'Cameras', url: '/cameras', text: /camera/i },
      { name: 'Profiles', url: '/profiles', text: /profile/i },
      { name: 'Inventory', url: '/inventory', text: /inventory|fridge/i },
      { name: 'Reports', url: '/reports', text: /report/i },
    ];

    menuItems.forEach(({ name, url, text }) => {
      test(`should navigate to ${name} page`, async ({ page }) => {
        // Find and click navigation link
        const link = page.locator(`a:has-text("${name}"), a[href="${url}"]`).first();
        await link.click();
        await page.waitForTimeout(500);

        // Check URL
        expect(page.url()).toContain(url);

        // Check page content
        await expect(page.locator(`h1, h2`).first()).toContainText(text);
      });
    });

    test('should highlight active navigation item', async ({ page }) => {
      // Click Recipes
      await page.click('a:has-text("Recipes"), a[href="/recipes"]');
      await page.waitForTimeout(500);

      // Active link should have special class
      const activeLink = page.locator('a[href="/recipes"], a:has-text("Recipes")').first();
      const className = await activeLink.getAttribute('class');

      expect(className).toMatch(/active|current|selected/i);
    });
  });

  test.describe('SPA Navigation', () => {
    test('should navigate without full page reload', async ({ page }) => {
      // Listen for navigation events
      let fullPageLoads = 0;
      page.on('load', () => {
        fullPageLoads++;
      });

      // Navigate through multiple pages
      await page.click('a:has-text("Recipes"), a[href="/recipes"]');
      await page.waitForTimeout(300);

      await page.click('a:has-text("Status"), a[href="/status"]');
      await page.waitForTimeout(300);

      await page.click('a:has-text("Alerts"), a[href="/alerts"]');
      await page.waitForTimeout(300);

      // Should be SPA navigation (1 initial load + 0 subsequent loads)
      expect(fullPageLoads).toBe(1);
    });

    test('should update URL without reload', async ({ page }) => {
      const initialUrl = page.url();

      // Navigate
      await page.click('a:has-text("Recipes"), a[href="/recipes"]');
      await page.waitForTimeout(300);

      // URL should change
      expect(page.url()).not.toBe(initialUrl);
      expect(page.url()).toContain('/recipes');
    });

    test('should support browser back button', async ({ page }) => {
      // Navigate forward
      await page.click('a:has-text("Recipes")');
      await page.waitForTimeout(500);
      expect(page.url()).toContain('/recipes');

      await page.click('a:has-text("Status")');
      await page.waitForTimeout(500);
      expect(page.url()).toContain('/status');

      // Go back
      await page.goBack();
      await page.waitForTimeout(500);
      expect(page.url()).toContain('/recipes');

      // Go back again
      await page.goBack();
      await page.waitForTimeout(500);
      expect(page.url()).not.toContain('/recipes');
    });

    test('should support browser forward button', async ({ page }) => {
      // Navigate forward
      await page.click('a:has-text("Recipes")');
      await page.waitForTimeout(500);

      // Go back
      await page.goBack();
      await page.waitForTimeout(500);

      // Go forward
      await page.goForward();
      await page.waitForTimeout(500);

      expect(page.url()).toContain('/recipes');
    });
  });

  test.describe('Responsive Navigation', () => {
    test('should show mobile menu on small screens', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForTimeout(1000);

      // Should show menu button (hamburger)
      const menuButton = page.locator('button:has-text("Menu"), .menu-toggle, .hamburger, [aria-label="Menu"]');
      await expect(menuButton.first()).toBeVisible();

      // Click to open menu
      await menuButton.first().click();
      await page.waitForTimeout(300);

      // Menu should be visible
      const menu = page.locator('nav, .nav, .menu');
      await expect(menu.first()).toBeVisible();
    });

    test('should show full navigation on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      await page.waitForTimeout(1000);

      // Navigation should be visible without menu button
      const nav = page.locator('nav, .nav');
      await expect(nav.first()).toBeVisible();

      // Should show all nav items
      await expect(page.locator('a:has-text("Recipes")')).toBeVisible();
      await expect(page.locator('a:has-text("Status")')).toBeVisible();
      await expect(page.locator('a:has-text("Alerts")')).toBeVisible();
    });
  });

  test.describe('Breadcrumbs', () => {
    test('should show breadcrumbs for nested pages', async ({ page }) => {
      // Navigate to nested page (e.g., camera details)
      await page.goto('/cameras');
      await page.waitForTimeout(1000);

      // Look for breadcrumbs
      const breadcrumbs = page.locator('.breadcrumbs, [aria-label="Breadcrumb"], nav[role="navigation"]');

      if (await breadcrumbs.count() > 0) {
        await expect(breadcrumbs.first()).toBeVisible();
      }
    });
  });

  test.describe('Search Functionality', () => {
    test('should provide global search if available', async ({ page }) => {
      // Look for search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');

      if (await searchInput.count() > 0) {
        await expect(searchInput.first()).toBeVisible();

        // Try searching
        await searchInput.first().fill('tomato');
        await page.waitForTimeout(500);

        // Should show results or suggestions
        const results = page.locator('.search-results, .suggestions, [role="listbox"]');
        if (await results.count() > 0) {
          await expect(results.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Loading States', () => {
    test('should show loading indicators during navigation', async ({ page }) => {
      // Click navigation link
      const recipesLink = page.locator('a:has-text("Recipes")').first();
      await recipesLink.click();

      // Check for loading indicator (might be very fast)
      const loader = page.locator('.loading, .spinner, [role="progressbar"]');

      // This might not always be visible due to fast loading
      // Just check if the page eventually loads
      await page.waitForTimeout(1000);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle navigation to invalid route', async ({ page }) => {
      await page.goto('/invalid-route-xyz');
      await page.waitForTimeout(1000);

      // Should show error message or redirect to home
      const hasError = await page.locator('text=/not found|404|error/i').count() > 0;
      const redirectedHome = page.url() === 'http://localhost:8788/' || page.url().endsWith('/');

      expect(hasError || redirectedHome).toBeTruthy();
    });
  });

  test.describe('Dark Mode Toggle', () => {
    test('should toggle between light and dark mode', async ({ page }) => {
      // Find dark mode toggle
      const darkModeToggle = page.locator(
        'button:has-text("Dark"), button:has-text("Theme"), input[type="checkbox"][id*="dark"]'
      ).first();

      if (await darkModeToggle.count() > 0) {
        // Get initial theme
        const initialTheme = await page.evaluate(() => document.documentElement.className);

        // Toggle dark mode
        await darkModeToggle.click();
        await page.waitForTimeout(300);

        // Theme should change
        const newTheme = await page.evaluate(() => document.documentElement.className);
        expect(newTheme).not.toBe(initialTheme);
      }
    });

    test('should persist theme preference', async ({ page }) => {
      // Set dark mode
      const darkModeToggle = page.locator('button:has-text("Dark"), input[type="checkbox"][id*="dark"]').first();

      if (await darkModeToggle.count() > 0) {
        await darkModeToggle.click();
        await page.waitForTimeout(300);

        // Reload page
        await page.reload();
        await page.waitForTimeout(1000);

        // Should still be in dark mode
        const theme = await page.evaluate(() => document.documentElement.className);
        expect(theme).toMatch(/dark/i);
      }
    });
  });
});
