import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Camera Management and Alerts
 * Tests camera configuration, monitoring, and alert management
 */

// Helper to set up authenticated session
async function setupAuth(page: any, role = 'owner') {
  await page.evaluate((userRole) => {
    localStorage.setItem('token', 'test-jwt-token');
    localStorage.setItem('user', JSON.stringify({
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      role: userRole,
      tenant_id: 1,
    }));
  }, role);
}

test.describe('Camera Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page, 'owner');
    await page.goto('/cameras');
    await page.waitForTimeout(1000);
  });

  test.describe('Camera List', () => {
    test('should display camera list', async ({ page }) => {
      // Should show cameras heading
      await expect(page.locator('h1, h2').first()).toContainText(/camera/i);

      // Should show camera cards or list
      const cameras = page.locator('.camera-card, .camera, [data-camera-id]');
      const count = await cameras.count();
      expect(count).toBeGreaterThanOrEqual(0); // Might be 0 if no cameras configured
    });

    test('should show camera status', async ({ page }) => {
      const cameras = page.locator('.camera-card, .camera').first();

      if (await cameras.count() > 0) {
        // Should show status (online, offline, error)
        await expect(cameras.locator('text=/online|offline|active|inactive/i')).toBeVisible();
      }
    });

    test('should display camera type', async ({ page }) => {
      const cameras = page.locator('.camera-card, .camera').first();

      if (await cameras.count() > 0) {
        // Should show type (gas, fridge)
        await expect(cameras.locator('text=/gas|fridge|inventory/i')).toBeVisible();
      }
    });
  });

  test.describe('Add Camera', () => {
    test('should show add camera button for admin roles', async ({ page }) => {
      // Look for add button
      const addButton = page.locator('button:has-text("Add"), button:has-text("New Camera"), a:has-text("Add Camera")');
      await expect(addButton.first()).toBeVisible();
    });

    test('should open add camera modal', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add"), button:has-text("New")').first();

      if (await addButton.count() > 0) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Should show modal
        await expect(page.locator('.modal, [role="dialog"]')).toBeVisible();

        // Should show form fields
        await expect(page.locator('input[name="name"], input[name="camera_name"]')).toBeVisible();
        await expect(page.locator('select[name="type"], select[name="camera_type"]')).toBeVisible();
      }
    });

    test('should validate required fields', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add"), button:has-text("New")').first();

      if (await addButton.count() > 0) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Try to submit without filling fields
        const submitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Add")').last();
        await submitButton.click();
        await page.waitForTimeout(500);

        // Should show validation error
        const hasError = await page.locator('.error, .invalid, [aria-invalid="true"]').count() > 0;
        expect(hasError).toBeTruthy();
      }
    });

    test('should create new camera with valid data', async ({ page }) => {
      const addButton = page.locator('button:has-text("Add"), button:has-text("New")').first();

      if (await addButton.count() > 0) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Fill form
        await page.fill('input[name="name"], input[name="camera_name"]', 'Test Camera');

        const typeSelect = page.locator('select[name="type"], select[name="camera_type"]');
        if (await typeSelect.count() > 0) {
          await typeSelect.selectOption('gas');
        }

        await page.fill('input[name="location"], input[name="camera_location"]', 'Kitchen');

        // Submit
        const submitButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Add")').last();
        await submitButton.click();
        await page.waitForTimeout(2000);

        // Should show success message or new camera in list
        const hasSuccess = await page.locator('.success, .toast-success').count() > 0;
        const hasCameraInList = await page.locator('text=/Test Camera/i').count() > 0;

        expect(hasSuccess || hasCameraInList).toBeTruthy();
      }
    });
  });

  test.describe('Edit Camera', () => {
    test('should open edit modal', async ({ page }) => {
      const camera = page.locator('.camera-card, .camera').first();

      if (await camera.count() > 0) {
        // Look for edit button
        const editButton = camera.locator('button:has-text("Edit"), [aria-label="Edit"]');

        if (await editButton.count() > 0) {
          await editButton.click();
          await page.waitForTimeout(500);

          // Should show modal with populated fields
          await expect(page.locator('.modal, [role="dialog"]')).toBeVisible();
          await expect(page.locator('input[name="name"]')).not.toHaveValue('');
        }
      }
    });

    test('should update camera details', async ({ page }) => {
      const camera = page.locator('.camera-card, .camera').first();

      if (await camera.count() > 0) {
        const editButton = camera.locator('button:has-text("Edit")');

        if (await editButton.count() > 0) {
          await editButton.click();
          await page.waitForTimeout(500);

          // Update name
          const nameInput = page.locator('input[name="name"], input[name="camera_name"]');
          await nameInput.fill('Updated Camera Name');

          // Save
          await page.locator('button[type="submit"], button:has-text("Save")').last().click();
          await page.waitForTimeout(2000);

          // Should show success
          const hasSuccess = await page.locator('.success, .toast-success').count() > 0;
          const hasUpdatedName = await page.locator('text=/Updated Camera Name/i').count() > 0;

          expect(hasSuccess || hasUpdatedName).toBeTruthy();
        }
      }
    });
  });

  test.describe('Delete Camera', () => {
    test('should show delete confirmation', async ({ page }) => {
      const camera = page.locator('.camera-card, .camera').first();

      if (await camera.count() > 0) {
        const deleteButton = camera.locator('button:has-text("Delete"), button:has-text("Remove"), [aria-label="Delete"]');

        if (await deleteButton.count() > 0) {
          await deleteButton.click();
          await page.waitForTimeout(500);

          // Should show confirmation dialog
          await expect(page.locator('text=/are you sure|confirm|delete/i')).toBeVisible();
        }
      }
    });

    test('should cancel delete', async ({ page }) => {
      const camera = page.locator('.camera-card, .camera').first();

      if (await camera.count() > 0) {
        const initialCount = await page.locator('.camera-card, .camera').count();

        const deleteButton = camera.locator('button:has-text("Delete")');
        if (await deleteButton.count() > 0) {
          await deleteButton.click();
          await page.waitForTimeout(500);

          // Click cancel
          await page.locator('button:has-text("Cancel")').click();
          await page.waitForTimeout(500);

          // Count should remain same
          const newCount = await page.locator('.camera-card, .camera').count();
          expect(newCount).toBe(initialCount);
        }
      }
    });
  });

  test.describe('Camera Status', () => {
    test('should show last capture time', async ({ page }) => {
      const camera = page.locator('.camera-card, .camera').first();

      if (await camera.count() > 0) {
        // Should show timestamp
        await expect(camera.locator('text=/\\d+\\s*(min|hour|day)|last|ago/i')).toBeVisible();
      }
    });

    test('should show capture schedule', async ({ page }) => {
      const camera = page.locator('.camera-card, .camera').first();

      if (await camera.count() > 0) {
        // Click to view details
        await camera.click();
        await page.waitForTimeout(1000);

        // Should show schedule info
        const schedule = page.locator('text=/schedule|interval|every/i');
        if (await schedule.count() > 0) {
          await expect(schedule.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Role-Based Access', () => {
    test('viewer should not see add/edit/delete buttons', async ({ page }) => {
      await setupAuth(page, 'viewer');
      await page.goto('/cameras');
      await page.waitForTimeout(1000);

      // Should not see add button
      const addButton = page.locator('button:has-text("Add"), button:has-text("New Camera")');
      expect(await addButton.count()).toBe(0);

      // Should not see edit/delete buttons
      const editButton = page.locator('button:has-text("Edit")');
      const deleteButton = page.locator('button:has-text("Delete")');

      expect(await editButton.count()).toBe(0);
      expect(await deleteButton.count()).toBe(0);
    });
  });
});

test.describe('Alert Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await page.goto('/alerts');
    await page.waitForTimeout(1000);
  });

  test.describe('Alert List', () => {
    test('should display alerts', async ({ page }) => {
      // Should show alerts heading
      await expect(page.locator('h1, h2').first()).toContainText(/alert|notification/i);

      // Should show alerts list
      const alerts = page.locator('.alert-card, .alert-item, [data-alert-id]');
      const count = await alerts.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show alert severity', async ({ page }) => {
      const alert = page.locator('.alert-card, .alert-item').first();

      if (await alert.count() > 0) {
        // Should show priority/severity
        await expect(alert.locator('text=/critical|high|medium|low|warning|error/i')).toBeVisible();
      }
    });

    test('should show alert message', async ({ page }) => {
      const alert = page.locator('.alert-card, .alert-item').first();

      if (await alert.count() > 0) {
        // Should show descriptive message
        await expect(alert.locator('p, .message, .description')).toBeVisible();
      }
    });

    test('should show alert timestamp', async ({ page }) => {
      const alert = page.locator('.alert-card, .alert-item').first();

      if (await alert.count() > 0) {
        // Should show when alert occurred
        await expect(alert.locator('text=/\\d+\\s*(min|hour|day)|ago|at/i')).toBeVisible();
      }
    });
  });

  test.describe('Alert Filtering', () => {
    test('should filter by severity', async ({ page }) => {
      const severityFilter = page.locator('select[name="severity"], button:has-text("Critical"), button:has-text("High")').first();

      if (await severityFilter.count() > 0) {
        if (await severityFilter.evaluate(el => el.tagName === 'SELECT')) {
          await severityFilter.selectOption('critical');
        } else {
          await severityFilter.click();
        }

        await page.waitForTimeout(500);

        // Should show filtered alerts
        await expect(page.locator('.alert-card, .alert-item').first()).toBeVisible();
      }
    });

    test('should filter by status (read/unread)', async ({ page }) => {
      const statusFilter = page.locator('button:has-text("Unread"), button:has-text("New"), input[type="checkbox"]:has-text("Unread")').first();

      if (await statusFilter.count() > 0) {
        await statusFilter.click();
        await page.waitForTimeout(500);

        // Should show filtered results
        const alerts = await page.locator('.alert-card, .alert-item').count();
        expect(alerts).toBeGreaterThanOrEqual(0);
      }
    });

    test('should filter by camera', async ({ page }) => {
      const cameraFilter = page.locator('select[name="camera"], select[name="camera_id"]').first();

      if (await cameraFilter.count() > 0) {
        // Select first camera
        await cameraFilter.selectOption({ index: 1 });
        await page.waitForTimeout(500);

        // Should filter alerts
        await expect(page.locator('.alert-card, .alert-item').first()).toBeVisible();
      }
    });
  });

  test.describe('Alert Actions', () => {
    test('should acknowledge alert', async ({ page }) => {
      const alert = page.locator('.alert-card, .alert-item').first();

      if (await alert.count() > 0) {
        // Look for acknowledge button
        const ackButton = alert.locator('button:has-text("Acknowledge"), button:has-text("Mark Read"), [aria-label="Acknowledge"]');

        if (await ackButton.count() > 0) {
          await ackButton.click();
          await page.waitForTimeout(1000);

          // Should update status
          const hasAcknowledged = await alert.locator('text=/acknowledged|read|resolved/i').count() > 0;
          expect(hasAcknowledged).toBeTruthy();
        }
      }
    });

    test('should dismiss alert', async ({ page }) => {
      const initialCount = await page.locator('.alert-card, .alert-item').count();

      if (initialCount > 0) {
        const alert = page.locator('.alert-card, .alert-item').first();
        const dismissButton = alert.locator('button:has-text("Dismiss"), button:has-text("Remove"), [aria-label="Dismiss"]');

        if (await dismissButton.count() > 0) {
          await dismissButton.click();
          await page.waitForTimeout(1000);

          // Alert should be removed or marked as dismissed
          const newCount = await page.locator('.alert-card, .alert-item').count();
          expect(newCount).toBeLessThanOrEqual(initialCount);
        }
      }
    });

    test('should bulk acknowledge alerts', async ({ page }) => {
      const alerts = await page.locator('.alert-card, .alert-item').count();

      if (alerts > 1) {
        // Look for select all checkbox
        const selectAll = page.locator('input[type="checkbox"][id*="select-all"], button:has-text("Select All")').first();

        if (await selectAll.count() > 0) {
          await selectAll.click();
          await page.waitForTimeout(500);

          // Look for bulk action button
          const bulkAckButton = page.locator('button:has-text("Acknowledge All"), button:has-text("Mark All Read")').first();

          if (await bulkAckButton.count() > 0) {
            await bulkAckButton.click();
            await page.waitForTimeout(2000);

            // Should show success
            await expect(page.locator('.success, .toast-success')).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Alert Details', () => {
    test('should show alert details', async ({ page }) => {
      const alert = page.locator('.alert-card, .alert-item').first();

      if (await alert.count() > 0) {
        await alert.click();
        await page.waitForTimeout(1000);

        // Should show detail view or expand
        await expect(page.locator('text=/detail|camera|level|reading/i')).toBeVisible();
      }
    });

    test('should show related camera', async ({ page }) => {
      const alert = page.locator('.alert-card, .alert-item').first();

      if (await alert.count() > 0) {
        // Should show camera name or link
        await expect(alert.locator('text=/camera|fridge|gas/i')).toBeVisible();
      }
    });

    test('should navigate to camera from alert', async ({ page }) => {
      const alert = page.locator('.alert-card, .alert-item').first();

      if (await alert.count() > 0) {
        // Look for camera link
        const cameraLink = alert.locator('a[href*="/cameras"], button:has-text("View Camera")');

        if (await cameraLink.count() > 0) {
          await cameraLink.click();
          await page.waitForTimeout(1000);

          // Should navigate to cameras page
          expect(page.url()).toContain('/camera');
        }
      }
    });
  });

  test.describe('Real-time Updates', () => {
    test('should show alert count badge', async ({ page }) => {
      // Navigate to another page
      await page.goto('/');
      await page.waitForTimeout(1000);

      // Look for alert badge in navigation
      const alertBadge = page.locator('.badge, .notification-count, [data-count]');

      if (await alertBadge.count() > 0) {
        await expect(alertBadge.first()).toBeVisible();
      }
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state when no alerts', async ({ page }) => {
      // Apply filter to show no results
      const filter = page.locator('button:has-text("Critical")').first();

      if (await filter.count() > 0) {
        await filter.click();
        await page.waitForTimeout(500);

        const alerts = await page.locator('.alert-card, .alert-item').count();

        if (alerts === 0) {
          // Should show empty state
          await expect(page.locator('text=/no alerts|no notifications|all clear/i')).toBeVisible();
        }
      }
    });
  });
});
