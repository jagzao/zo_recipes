import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Authentication Flows
 * Tests signup, login, logout, and session persistence
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test.describe('Signup Flow', () => {
    test('should show signup form on initial visit', async ({ page }) => {
      // Check for signup elements
      await expect(page.locator('h1')).toContainText(/sign up|create account/i);
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="tenant_name"]')).toBeVisible();
      await expect(page.locator('input[name="owner_name"]')).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      // Fill invalid email
      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="tenant_name"]', 'Test Company');
      await page.fill('input[name="owner_name"]', 'Test Owner');

      // Try to submit
      await page.click('button[type="submit"]');

      // Check for validation message
      const emailInput = page.locator('input[name="email"]');
      const validationMessage = await emailInput.evaluate(
        (el: HTMLInputElement) => el.validationMessage
      );
      expect(validationMessage).toBeTruthy();
    });

    test('should create new account with valid data', async ({ page }) => {
      const timestamp = Date.now();
      const email = `test${timestamp}@example.com`;

      // Fill signup form
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="tenant_name"]', 'Test Company');
      await page.fill('input[name="owner_name"]', 'Test Owner');

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for success message or redirect
      await page.waitForTimeout(2000);

      // Should show success message or redirect to dashboard
      const hasSuccessMessage = await page.locator('.toast, .alert').count() > 0;
      const isOnDashboard = page.url().includes('/dashboard') || page.url().includes('/home');

      expect(hasSuccessMessage || isOnDashboard).toBeTruthy();
    });

    test('should show error for duplicate email', async ({ page }) => {
      const email = 'existing@example.com';

      // First signup
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="tenant_name"]', 'Test Company');
      await page.fill('input[name="owner_name"]', 'Test Owner');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Try to signup again with same email
      await page.goto('/');
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="tenant_name"]', 'Another Company');
      await page.fill('input[name="owner_name"]', 'Another Owner');
      await page.click('button[type="submit"]');

      // Should show error
      await expect(page.locator('.error, .alert-error, .toast-error')).toBeVisible();
    });
  });

  test.describe('Login Flow', () => {
    test('should allow login with magic link token', async ({ page, context }) => {
      // In a real scenario, this would come from email
      // For testing, we can use a known token or create one via API
      const mockToken = 'test-token-123';

      // Navigate with token
      await page.goto(`/?token=${mockToken}`);
      await page.waitForTimeout(2000);

      // Check if redirected or authenticated
      const hasToken = await context.cookies().then(cookies =>
        cookies.some(c => c.name === 'token' || c.name === 'auth_token')
      );
      const isAuthenticated = await page.evaluate(() => !!localStorage.getItem('token'));

      // Should store token
      expect(hasToken || isAuthenticated).toBeTruthy();
    });

    test('should persist session after page reload', async ({ page, context }) => {
      // Set auth token in localStorage
      await page.evaluate(() => {
        localStorage.setItem('token', 'test-jwt-token');
        localStorage.setItem('user', JSON.stringify({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'owner',
        }));
      });

      // Reload page
      await page.reload();
      await page.waitForTimeout(1000);

      // Should still be authenticated
      const isAuthenticated = await page.evaluate(() => !!localStorage.getItem('token'));
      expect(isAuthenticated).toBeTruthy();

      // Should show dashboard/home instead of login
      await expect(page.locator('h1')).not.toContainText(/sign up|log in/i);
    });
  });

  test.describe('Logout Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Set up authenticated session
      await page.evaluate(() => {
        localStorage.setItem('token', 'test-jwt-token');
        localStorage.setItem('user', JSON.stringify({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'owner',
        }));
      });
      await page.goto('/');
    });

    test('should logout and clear session', async ({ page }) => {
      // Find and click logout button
      const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign Out")');
      await logoutButton.click();
      await page.waitForTimeout(1000);

      // Should clear localStorage
      const hasToken = await page.evaluate(() => !!localStorage.getItem('token'));
      expect(hasToken).toBeFalsy();

      // Should redirect to login/signup
      await expect(page.locator('h1')).toContainText(/sign up|log in|welcome/i);
    });

    test('should not allow access to protected pages after logout', async ({ page }) => {
      // Logout
      const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign Out")');
      await logoutButton.click();
      await page.waitForTimeout(1000);

      // Try to access protected page
      await page.goto('/settings');
      await page.waitForTimeout(1000);

      // Should redirect to login or show error
      const url = page.url();
      const isOnLogin = url.includes('login') || url === 'http://localhost:8788/';
      expect(isOnLogin).toBeTruthy();
    });
  });

  test.describe('Session Timeout', () => {
    test('should handle expired token gracefully', async ({ page }) => {
      // Set expired token
      await page.evaluate(() => {
        localStorage.setItem('token', 'expired-jwt-token');
        localStorage.setItem('user', JSON.stringify({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'owner',
        }));
      });

      // Navigate to protected page
      await page.goto('/settings');
      await page.waitForTimeout(2000);

      // Should redirect to login or show error
      const hasError = await page.locator('.error, .alert-error').count() > 0;
      const isOnLogin = page.url().includes('login') || page.url() === 'http://localhost:8788/';

      expect(hasError || isOnLogin).toBeTruthy();
    });
  });

  test.describe('Role-Based Access', () => {
    const roles = [
      { role: 'owner', canAccessSettings: true },
      { role: 'admin', canAccessSettings: true },
      { role: 'ops', canAccessSettings: false },
      { role: 'viewer', canAccessSettings: false },
    ];

    roles.forEach(({ role, canAccessSettings }) => {
      test(`should ${canAccessSettings ? 'allow' : 'deny'} ${role} access to settings`, async ({ page }) => {
        // Set up session with specific role
        await page.evaluate((userRole) => {
          localStorage.setItem('token', 'test-jwt-token');
          localStorage.setItem('user', JSON.stringify({
            id: 1,
            email: 'test@example.com',
            name: 'Test User',
            role: userRole,
          }));
        }, role);

        // Navigate to settings
        await page.goto('/settings');
        await page.waitForTimeout(1000);

        if (canAccessSettings) {
          // Should show settings page
          await expect(page.locator('h1')).toContainText(/settings|configuration/i);
        } else {
          // Should show error or redirect
          const hasError = await page.locator('.error, .alert').count() > 0;
          const isNotOnSettings = !page.url().includes('/settings');
          expect(hasError || isNotOnSettings).toBeTruthy();
        }
      });
    });
  });
});
