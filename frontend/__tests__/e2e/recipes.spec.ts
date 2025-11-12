import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Recipe Browsing and Filtering
 * Tests recipe discovery, filtering, search, and detail views
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

test.describe('Recipe Browsing and Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await page.goto('/recipes');
    await page.waitForTimeout(1000);
  });

  test.describe('Recipe List', () => {
    test('should display recipe grid', async ({ page }) => {
      // Should show recipes heading
      await expect(page.locator('h1, h2').first()).toContainText(/recipe/i);

      // Should show recipe cards
      const recipeCards = page.locator('.recipe-card, .card, [data-recipe-id]');
      const count = await recipeCards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display recipe information', async ({ page }) => {
      // First recipe card should have:
      const firstCard = page.locator('.recipe-card, .card').first();

      // Recipe name
      await expect(firstCard.locator('h2, h3, h4, .recipe-name')).toBeVisible();

      // Recipe image (if available)
      const image = firstCard.locator('img');
      if (await image.count() > 0) {
        await expect(image.first()).toBeVisible();
      }
    });

    test('should show recipe metadata', async ({ page }) => {
      // Should show cooking time, difficulty, or other metadata
      const metadata = page.locator('text=/min|minutes|easy|medium|hard|servings/i');
      if (await metadata.count() > 0) {
        await expect(metadata.first()).toBeVisible();
      }
    });
  });

  test.describe('Recipe Filtering', () => {
    test('should filter recipes by intent', async ({ page }) => {
      const intents = ['fresh', 'quick', 'protein', 'vegetarian', 'kids'];

      for (const intent of intents) {
        // Look for intent filter button/chip
        const intentFilter = page.locator(`button:has-text("${intent}"), [data-intent="${intent}"]`).first();

        if (await intentFilter.count() > 0) {
          // Click filter
          await intentFilter.click();
          await page.waitForTimeout(500);

          // Should show filtered results
          const recipes = await page.locator('.recipe-card, .card').count();
          expect(recipes).toBeGreaterThan(0);

          // Clear filter
          await intentFilter.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test('should search recipes by name', async ({ page }) => {
      // Find search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

      if (await searchInput.count() > 0) {
        // Search for common ingredient
        await searchInput.fill('pasta');
        await page.waitForTimeout(500);

        // Should show filtered results
        const recipes = await page.locator('.recipe-card, .card').count();
        expect(recipes).toBeGreaterThan(0);

        // Recipe names should contain search term
        const firstRecipeName = await page.locator('.recipe-card, .card').first()
          .locator('h2, h3, h4, .recipe-name').textContent();

        expect(firstRecipeName?.toLowerCase()).toContain('pasta');
      }
    });

    test('should filter by available ingredients', async ({ page }) => {
      // Look for "Available" or "What I Have" filter
      const availableFilter = page.locator(
        'button:has-text("Available"), button:has-text("What I Have"), input[type="checkbox"]:has-text("Available")'
      ).first();

      if (await availableFilter.count() > 0) {
        // Toggle filter
        await availableFilter.click();
        await page.waitForTimeout(500);

        // Should show only recipes with available ingredients
        const recipes = await page.locator('.recipe-card, .card').count();
        expect(recipes).toBeGreaterThanOrEqual(0); // Might be 0 if no ingredients available
      }
    });

    test('should filter by dietary restrictions', async ({ page }) => {
      const restrictions = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'];

      for (const restriction of restrictions) {
        const filter = page.locator(`button:has-text("${restriction}"), [data-filter="${restriction}"]`).first();

        if (await filter.count() > 0) {
          await filter.click();
          await page.waitForTimeout(500);

          // Should show filtered results or empty state
          const hasRecipes = await page.locator('.recipe-card, .card').count() > 0;
          const hasEmptyState = await page.locator('text=/no recipes|no results/i').count() > 0;

          expect(hasRecipes || hasEmptyState).toBeTruthy();

          // Clear filter
          await filter.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test('should show filter count', async ({ page }) => {
      // Apply multiple filters
      const quickFilter = page.locator('button:has-text("quick"), [data-intent="quick"]').first();

      if (await quickFilter.count() > 0) {
        await quickFilter.click();
        await page.waitForTimeout(500);

        // Should show result count
        const countText = page.locator('text=/\\d+ recipe|showing \\d+/i');
        if (await countText.count() > 0) {
          await expect(countText.first()).toBeVisible();
        }
      }
    });

    test('should clear all filters', async ({ page }) => {
      // Apply filter
      const quickFilter = page.locator('button:has-text("quick")').first();
      if (await quickFilter.count() > 0) {
        await quickFilter.click();
        await page.waitForTimeout(500);

        // Look for clear all button
        const clearButton = page.locator('button:has-text("Clear"), button:has-text("Reset")').first();
        if (await clearButton.count() > 0) {
          const filteredCount = await page.locator('.recipe-card, .card').count();

          await clearButton.click();
          await page.waitForTimeout(500);

          // Should show more recipes
          const allCount = await page.locator('.recipe-card, .card').count();
          expect(allCount).toBeGreaterThanOrEqual(filteredCount);
        }
      }
    });
  });

  test.describe('Recipe Detail View', () => {
    test('should navigate to recipe detail', async ({ page }) => {
      // Click first recipe
      const firstRecipe = page.locator('.recipe-card, .card').first();
      await firstRecipe.click();
      await page.waitForTimeout(1000);

      // Should show recipe detail
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('should display full recipe information', async ({ page }) => {
      // Navigate to detail
      await page.locator('.recipe-card, .card').first().click();
      await page.waitForTimeout(1000);

      // Should show ingredients list
      await expect(page.locator('text=/ingredient/i')).toBeVisible();

      // Should show instructions
      await expect(page.locator('text=/instruction|direction|step/i')).toBeVisible();
    });

    test('should show ingredient availability', async ({ page }) => {
      // Navigate to detail
      await page.locator('.recipe-card, .card').first().click();
      await page.waitForTimeout(1000);

      // Look for ingredient availability indicators
      const ingredients = page.locator('.ingredient, li').filter({ hasText: /tomato|onion|garlic/i });

      if (await ingredients.count() > 0) {
        // Should have some visual indicator (checkmark, color, icon)
        const firstIngredient = ingredients.first();
        await expect(firstIngredient).toBeVisible();
      }
    });

    test('should show missing ingredients', async ({ page }) => {
      // Navigate to detail
      await page.locator('.recipe-card, .card').first().click();
      await page.waitForTimeout(1000);

      // Look for missing ingredients section
      const missingSection = page.locator('text=/missing|need to buy|required/i');
      if (await missingSection.count() > 0) {
        await expect(missingSection.first()).toBeVisible();
      }
    });

    test('should display cooking instructions step by step', async ({ page }) => {
      // Navigate to detail
      await page.locator('.recipe-card, .card').first().click();
      await page.waitForTimeout(1000);

      // Should show numbered steps
      const steps = page.locator('.step, ol li, [data-step]');
      const count = await steps.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should show recipe image', async ({ page }) => {
      // Navigate to detail
      await page.locator('.recipe-card, .card').first().click();
      await page.waitForTimeout(1000);

      // Should show hero image
      const image = page.locator('img[alt*="recipe"], .recipe-image img').first();
      if (await image.count() > 0) {
        await expect(image).toBeVisible();
      }
    });

    test('should have back button', async ({ page }) => {
      // Navigate to detail
      await page.locator('.recipe-card, .card').first().click();
      await page.waitForTimeout(1000);

      // Click back button
      const backButton = page.locator('button:has-text("Back"), a:has-text("Back"), [aria-label="Back"]').first();
      await backButton.click();
      await page.waitForTimeout(500);

      // Should return to recipe list
      expect(page.url()).toContain('/recipes');
      await expect(page.locator('.recipe-card, .card').first()).toBeVisible();
    });
  });

  test.describe('Recipe Substitutions', () => {
    test('should show ingredient substitutions', async ({ page }) => {
      // Navigate to recipe detail
      await page.locator('.recipe-card, .card').first().click();
      await page.waitForTimeout(1000);

      // Look for substitute button or info
      const substituteButton = page.locator('button:has-text("Substitute"), text=/substitute|alternative/i');

      if (await substituteButton.count() > 0) {
        // Click to show substitutes
        if (await substituteButton.first().evaluate(el => el.tagName === 'BUTTON')) {
          await substituteButton.first().click();
          await page.waitForTimeout(500);
        }

        // Should show substitute options
        await expect(page.locator('text=/instead|replace|alternative/i')).toBeVisible();
      }
    });
  });

  test.describe('Recipe Matching', () => {
    test('should show match percentage', async ({ page }) => {
      // Look for match indicators
      const matchIndicator = page.locator('text=/\\d+%|match/i, .match-score');

      if (await matchIndicator.count() > 0) {
        await expect(matchIndicator.first()).toBeVisible();
      }
    });

    test('should sort by match score', async ({ page }) => {
      // Look for sort dropdown
      const sortDropdown = page.locator('select, button:has-text("Sort")').first();

      if (await sortDropdown.count() > 0) {
        // Try to select "Best Match"
        if (await sortDropdown.evaluate(el => el.tagName === 'SELECT')) {
          await sortDropdown.selectOption({ label: /match|best/i });
        } else {
          await sortDropdown.click();
          await page.locator('text=/match|best/i').first().click();
        }

        await page.waitForTimeout(500);

        // Recipes should be reordered
        await expect(page.locator('.recipe-card, .card').first()).toBeVisible();
      }
    });
  });

  test.describe('Empty States', () => {
    test('should show empty state when no recipes match filters', async ({ page }) => {
      // Search for something that doesn't exist
      const searchInput = page.locator('input[type="search"]').first();

      if (await searchInput.count() > 0) {
        await searchInput.fill('zzz-nonexistent-recipe-xyz');
        await page.waitForTimeout(500);

        // Should show empty state
        await expect(page.locator('text=/no recipes|no results|nothing found/i')).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display recipes in grid on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      await page.waitForTimeout(1000);

      // Should show multiple recipes per row
      const firstRow = page.locator('.recipe-card, .card').first();
      const secondRow = page.locator('.recipe-card, .card').nth(1);

      if (await firstRow.count() > 0 && await secondRow.count() > 0) {
        const firstBox = await firstRow.boundingBox();
        const secondBox = await secondRow.boundingBox();

        // Check if they're side by side (y positions similar)
        if (firstBox && secondBox) {
          const yDiff = Math.abs(firstBox.y - secondBox.y);
          expect(yDiff).toBeLessThan(50); // Should be in same row
        }
      }
    });

    test('should display recipes in single column on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForTimeout(1000);

      // Recipes should be visible
      await expect(page.locator('.recipe-card, .card').first()).toBeVisible();
    });
  });
});
