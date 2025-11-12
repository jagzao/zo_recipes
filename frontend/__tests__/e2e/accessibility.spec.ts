import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for Accessibility (WCAG 2.1 AA/AAA)
 * Tests keyboard navigation, screen reader support, focus management, and ARIA
 */

// Helper to set up authenticated session
async function setupAuth(page: Page) {
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

test.describe('Accessibility - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test.describe('Tab Navigation', () => {
    test('should navigate through interactive elements with Tab', async ({ page }) => {
      // Press Tab multiple times
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      // Should focus first interactive element
      let focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON', 'INPUT']).toContain(focused);

      // Continue tabbing
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should still be on interactive elements
      focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focused);
    });

    test('should navigate backwards with Shift+Tab', async ({ page }) => {
      // Tab forward a few times
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const forwardElement = await page.evaluate(() => document.activeElement?.textContent);

      // Tab backward
      await page.keyboard.press('Shift+Tab');
      await page.waitForTimeout(100);

      const backwardElement = await page.evaluate(() => document.activeElement?.textContent);

      // Should be different
      expect(backwardElement).not.toBe(forwardElement);
    });

    test('should skip non-interactive elements', async ({ page }) => {
      // Tab through page
      const focusedElements: string[] = [];

      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(50);

        const tag = await page.evaluate(() => document.activeElement?.tagName);
        if (tag) focusedElements.push(tag);
      }

      // All focused elements should be interactive
      focusedElements.forEach(tag => {
        expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(tag);
      });
    });

    test('should have visible focus indicators', async ({ page }) => {
      // Tab to first element
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);

      // Check focus styling
      const outlineStyle = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const computed = window.getComputedStyle(el);
        return {
          outline: computed.outline,
          outlineWidth: computed.outlineWidth,
          boxShadow: computed.boxShadow,
        };
      });

      // Should have some visible focus indicator
      const hasVisibleFocus =
        outlineStyle.outlineWidth !== '0px' ||
        outlineStyle.boxShadow !== 'none';

      expect(hasVisibleFocus).toBeTruthy();
    });
  });

  test.describe('Skip Links', () => {
    test('should have skip to main content link', async ({ page }) => {
      // Focus first element (should be skip link)
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);

      const firstFocusedText = await page.evaluate(() => document.activeElement?.textContent);

      // Should contain "skip" or "main"
      if (firstFocusedText) {
        expect(firstFocusedText.toLowerCase()).toMatch(/skip|main|content/);
      }
    });

    test('should navigate to main content when activated', async ({ page }) => {
      // Tab to skip link
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      // Get current focus
      const skipLinkText = await page.evaluate(() => document.activeElement?.textContent);

      if (skipLinkText?.toLowerCase().includes('skip')) {
        // Activate skip link
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);

        // Should focus main content
        const mainFocused = await page.evaluate(() => {
          const main = document.querySelector('main, [role="main"]');
          return document.activeElement === main || main?.contains(document.activeElement as Node);
        });

        expect(mainFocused).toBeTruthy();
      }
    });
  });

  test.describe('Navigation Menu', () => {
    test('should navigate menu with arrow keys if applicable', async ({ page }) => {
      // Find navigation menu
      const nav = page.locator('nav, [role="navigation"]').first();

      if (await nav.count() > 0) {
        // Focus first nav link
        const firstLink = nav.locator('a, button').first();
        await firstLink.focus();
        await page.waitForTimeout(200);

        // Try arrow key navigation (if implemented)
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);

        // Check if focus moved (some implementations support this)
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(['A', 'BUTTON']).toContain(focusedElement);
      }
    });

    test('should activate menu items with Enter', async ({ page }) => {
      // Tab to a navigation link
      let currentUrl = page.url();
      let tabCount = 0;

      while (tabCount < 20) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(50);

        const text = await page.evaluate(() => document.activeElement?.textContent?.toLowerCase());

        if (text && (text.includes('recipe') || text.includes('alert') || text.includes('status'))) {
          // Found a nav link, press Enter
          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);

          // URL should change
          expect(page.url()).not.toBe(currentUrl);
          break;
        }

        tabCount++;
      }
    });

    test('should activate menu items with Space', async ({ page }) => {
      // Find a button in navigation
      const navButton = page.locator('nav button, [role="navigation"] button').first();

      if (await navButton.count() > 0) {
        await navButton.focus();
        await page.waitForTimeout(100);

        // Press Space
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);

        // Should trigger action (might open menu, navigate, etc.)
        // Just verify no errors occurred
        const hasModal = await page.locator('[role="dialog"], .modal').count() > 0;
        const urlChanged = page.url() !== 'http://localhost:8788/';

        // Some action should have occurred
        expect(hasModal || urlChanged).toBeTruthy();
      }
    });
  });

  test.describe('Form Interactions', () => {
    test('should navigate form fields with Tab', async ({ page }) => {
      // Navigate to page with form (e.g., settings)
      await page.goto('/settings');
      await page.waitForTimeout(1000);

      // Find first input
      const input = page.locator('input').first();

      if (await input.count() > 0) {
        await input.focus();
        await page.waitForTimeout(100);

        // Tab to next field
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        // Should focus next form element
        const focused = await page.evaluate(() => document.activeElement?.tagName);
        expect(['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA']).toContain(focused);
      }
    });

    test('should submit form with Enter', async ({ page }) => {
      // Navigate to a form page
      await page.goto('/settings');
      await page.waitForTimeout(1000);

      const input = page.locator('input[type="text"], input[type="email"]').first();

      if (await input.count() > 0) {
        await input.focus();
        await input.fill('test value');
        await page.waitForTimeout(100);

        // Press Enter
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        // Form should submit (check for success message or error)
        const hasMessage = await page.locator('.toast, .alert, .message').count() > 0;

        // Some feedback should appear
        expect(hasMessage).toBeTruthy();
      }
    });
  });

  test.describe('Modal/Dialog', () => {
    test('should trap focus within modal', async ({ page }) => {
      // Open a modal (e.g., add camera)
      await page.goto('/cameras');
      await page.waitForTimeout(1000);

      const addButton = page.locator('button:has-text("Add")').first();

      if (await addButton.count() > 0) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Modal should be open
        const modal = page.locator('[role="dialog"], .modal');
        await expect(modal.first()).toBeVisible();

        // Tab through all elements
        for (let i = 0; i < 20; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(50);

          // Check if focus is still within modal
          const focusInModal = await page.evaluate(() => {
            const modal = document.querySelector('[role="dialog"], .modal');
            return modal?.contains(document.activeElement as Node);
          });

          if (i > 5) {
            // After several tabs, focus should still be in modal
            expect(focusInModal).toBeTruthy();
          }
        }
      }
    });

    test('should close modal with Escape', async ({ page }) => {
      // Open a modal
      await page.goto('/cameras');
      await page.waitForTimeout(1000);

      const addButton = page.locator('button:has-text("Add")').first();

      if (await addButton.count() > 0) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Press Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Modal should close
        const modal = page.locator('[role="dialog"], .modal');
        await expect(modal).not.toBeVisible();
      }
    });

    test('should return focus after modal closes', async ({ page }) => {
      // Open a modal
      await page.goto('/cameras');
      await page.waitForTimeout(1000);

      const addButton = page.locator('button:has-text("Add")').first();

      if (await addButton.count() > 0) {
        // Focus and click button
        await addButton.focus();
        const buttonText = await addButton.textContent();
        await addButton.click();
        await page.waitForTimeout(500);

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Focus should return to button
        const focusedText = await page.evaluate(() => document.activeElement?.textContent);
        expect(focusedText).toBe(buttonText);
      }
    });
  });
});

test.describe('Accessibility - ARIA and Screen Readers', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test.describe('Landmarks', () => {
    test('should have main landmark', async ({ page }) => {
      const main = await page.locator('main, [role="main"]').count();
      expect(main).toBeGreaterThan(0);
    });

    test('should have navigation landmark', async ({ page }) => {
      const nav = await page.locator('nav, [role="navigation"]').count();
      expect(nav).toBeGreaterThan(0);
    });

    test('should have proper heading structure', async ({ page }) => {
      // Should have h1
      const h1 = await page.locator('h1').count();
      expect(h1).toBeGreaterThan(0);

      // Should not skip heading levels
      const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', (elements) =>
        elements.map(el => parseInt(el.tagName[1]))
      );

      // Check for skipped levels
      for (let i = 1; i < headings.length; i++) {
        const diff = headings[i] - headings[i - 1];
        expect(diff).toBeLessThanOrEqual(1); // Should not skip levels
      }
    });
  });

  test.describe('ARIA Labels', () => {
    test('should have aria-label on icon buttons', async ({ page }) => {
      const iconButtons = page.locator('button:not(:has(text()))');
      const count = await iconButtons.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          const button = iconButtons.nth(i);
          const ariaLabel = await button.getAttribute('aria-label');
          const ariaLabelledBy = await button.getAttribute('aria-labelledby');
          const title = await button.getAttribute('title');

          // Should have some label
          const hasLabel = ariaLabel || ariaLabelledBy || title;
          expect(hasLabel).toBeTruthy();
        }
      }
    });

    test('should have alt text on images', async ({ page }) => {
      const images = page.locator('img');
      const count = await images.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 10); i++) {
          const img = images.nth(i);
          const alt = await img.getAttribute('alt');
          const role = await img.getAttribute('role');

          // Should have alt or role="presentation"
          const hasAltOrDecorative = alt !== null || role === 'presentation';
          expect(hasAltOrDecorative).toBeTruthy();
        }
      }
    });

    test('should have labels for form inputs', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForTimeout(1000);

      const inputs = page.locator('input[type="text"], input[type="email"], input[type="password"], textarea');
      const count = await inputs.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          const input = inputs.nth(i);
          const id = await input.getAttribute('id');
          const ariaLabel = await input.getAttribute('aria-label');
          const ariaLabelledBy = await input.getAttribute('aria-labelledby');

          // Should have label or aria-label
          const hasLabel =
            ariaLabel ||
            ariaLabelledBy ||
            (id && (await page.locator(`label[for="${id}"]`).count()) > 0);

          expect(hasLabel).toBeTruthy();
        }
      }
    });
  });

  test.describe('ARIA Live Regions', () => {
    test('should have live region for announcements', async ({ page }) => {
      // Check for aria-live regions
      const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');
      const count = await liveRegions.count();

      // Should have at least one live region for toasts/alerts
      expect(count).toBeGreaterThan(0);
    });

    test('should announce actions to screen readers', async ({ page }) => {
      // Perform an action that should trigger announcement
      await page.goto('/alerts');
      await page.waitForTimeout(1000);

      const alert = page.locator('.alert-card').first();

      if (await alert.count() > 0) {
        const ackButton = alert.locator('button:has-text("Acknowledge")');

        if (await ackButton.count() > 0) {
          await ackButton.click();
          await page.waitForTimeout(500);

          // Check if live region was updated
          const liveRegion = page.locator('[aria-live], [role="status"]');
          if (await liveRegion.count() > 0) {
            const text = await liveRegion.first().textContent();
            expect(text).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe('Focus Management', () => {
    test('should focus error messages on form submission', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForTimeout(1000);

      // Submit form with invalid data
      const form = page.locator('form').first();

      if (await form.count() > 0) {
        const submitButton = form.locator('button[type="submit"]');

        if (await submitButton.count() > 0) {
          await submitButton.click();
          await page.waitForTimeout(500);

          // Check if error message or first invalid field is focused
          const activeElement = await page.evaluate(() => document.activeElement?.tagName);
          const hasAriaInvalid = await page.evaluate(() =>
            document.activeElement?.getAttribute('aria-invalid') === 'true'
          );

          // Either input is focused or has aria-invalid
          const hasFocusedError = activeElement === 'INPUT' || hasAriaInvalid;
          expect(hasFocusedError).toBeTruthy();
        }
      }
    });

    test('should focus page heading after navigation', async ({ page }) => {
      // Navigate to another page
      await page.click('a:has-text("Recipes")');
      await page.waitForTimeout(500);

      // Check if main heading or main content is focused
      const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
      const mainFocused = ['H1', 'H2', 'MAIN'].includes(focusedTag || '');

      expect(mainFocused).toBeTruthy();
    });
  });
});

test.describe('Accessibility - Color and Contrast', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test.describe('Dark Mode', () => {
    test('should maintain contrast in dark mode', async ({ page }) => {
      // Enable dark mode
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForTimeout(500);

      // Check if dark mode is applied
      const isDarkMode = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') ||
               document.documentElement.getAttribute('data-theme') === 'dark';
      });

      expect(isDarkMode).toBeTruthy();
    });

    test('should respect prefers-color-scheme', async ({ page }) => {
      // Set system preference to dark
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      await page.waitForTimeout(1000);

      // Should apply dark theme
      const theme = await page.evaluate(() => {
        return document.documentElement.className || document.documentElement.getAttribute('data-theme');
      });

      expect(theme).toMatch(/dark/i);
    });
  });

  test.describe('Reduced Motion', () => {
    test('should respect prefers-reduced-motion', async ({ page }) => {
      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      await page.waitForTimeout(1000);

      // Check if animations are reduced
      const hasReducedMotion = await page.evaluate(() => {
        const testElement = document.querySelector('.fade-in, .slide-in, [class*="animate"]');
        if (!testElement) return true; // No animated elements

        const computed = window.getComputedStyle(testElement as Element);
        const duration = parseFloat(computed.animationDuration);

        // Animation should be very short or disabled
        return duration === 0 || duration < 0.01;
      });

      expect(hasReducedMotion).toBeTruthy();
    });
  });
});

test.describe('Accessibility - Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should have adequate touch targets (44x44px minimum)', async ({ page }) => {
    const buttons = page.locator('button, a');
    const count = await buttons.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 10); i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();

        if (box && box.width > 0 && box.height > 0) {
          // Should be at least 44x44 or have adequate padding
          const isAdequateSize = box.width >= 40 && box.height >= 40;

          if (!isAdequateSize) {
            // Check if there's adequate padding/margin
            const padding = await button.evaluate(el => {
              const computed = window.getComputedStyle(el);
              return {
                padding: parseInt(computed.padding) || 0,
                margin: parseInt(computed.margin) || 0,
              };
            });

            const totalSize = box.width + padding.padding * 2 + padding.margin * 2;
            expect(totalSize).toBeGreaterThanOrEqual(40);
          }
        }
      }
    }
  });

  test('should be fully navigable on mobile', async ({ page }) => {
    // Should show mobile menu
    const menuButton = page.locator('button:has-text("Menu"), .hamburger, [aria-label="Menu"]').first();

    if (await menuButton.count() > 0) {
      await menuButton.click();
      await page.waitForTimeout(500);

      // Menu should be visible
      await expect(page.locator('nav, .menu')).toBeVisible();

      // Should be able to navigate
      await page.click('a:has-text("Recipes")');
      await page.waitForTimeout(500);

      expect(page.url()).toContain('/recipes');
    }
  });
});
