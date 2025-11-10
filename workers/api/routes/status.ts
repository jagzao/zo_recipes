/**
 * Status Routes
 * Get current state of gas, inventory, cameras, and alerts
 */

import type { D1Database } from '@cloudflare/workers-types';
import { queryOne, queryAll } from '../../utils/db';
import { success, errors } from '../../utils/response';

/**
 * GET /api/status/gas
 * Get latest gas levels for tenant
 */
export async function getGasStatus(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const cameraId = url.searchParams.get('camera_id');

    let sql = `
      SELECT
        gl.*,
        c.name as camera_name,
        c.location
      FROM gas_levels gl
      JOIN cameras c ON c.id = gl.camera_id
      WHERE c.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (cameraId) {
      sql += ` AND gl.camera_id = ?`;
      params.push(cameraId);
    }

    sql += `
      ORDER BY gl.captured_at DESC
      LIMIT 10
    `;

    const levels = await queryAll(env.DB, sql, params);

    return success(levels);
  } catch (err) {
    console.error('Get gas status error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/status/inventory
 * Get current inventory snapshot
 */
export async function getInventoryStatus(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    // Get latest snapshot per item
    const inventory = await queryAll(
      env.DB,
      `SELECT
         i.id,
         i.name,
         i.category,
         i.critical,
         s.present,
         s.confidence,
         s.captured_at,
         CASE s.present
           WHEN 2 THEN 'present'
           WHEN 1 THEN 'low'
           WHEN 0 THEN 'absent'
         END as status
       FROM inventory_items i
       LEFT JOIN (
         SELECT
           s1.item_id,
           s1.present,
           s1.confidence,
           s1.captured_at
         FROM inventory_snapshots s1
         INNER JOIN (
           SELECT item_id, MAX(captured_at) as max_captured
           FROM inventory_snapshots
           GROUP BY item_id
         ) s2 ON s1.item_id = s2.item_id AND s1.captured_at = s2.max_captured
       ) s ON s.item_id = i.id
       WHERE i.tenant_id = ?
       ORDER BY i.critical DESC, i.category, i.name`,
      [tenantId]
    );

    // Group by category
    const grouped: Record<string, any[]> = {};
    for (const item of inventory) {
      const category = (item as any).category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    }

    return success({
      items: inventory,
      by_category: grouped,
      summary: {
        total: inventory.length,
        present: inventory.filter((i: any) => i.present === 2).length,
        low: inventory.filter((i: any) => i.present === 1).length,
        absent: inventory.filter((i: any) => i.present === 0).length,
      },
    });
  } catch (err) {
    console.error('Get inventory status error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/status/cameras
 * Get camera health status
 */
export async function getCamerasStatus(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const cameras = await queryAll(
      env.DB,
      `SELECT
         c.*,
         COUNT(DISTINCT i.id) as total_captures,
         MAX(i.captured_at) as last_capture
       FROM cameras c
       LEFT JOIN images i ON i.camera_id = c.id
       WHERE c.tenant_id = ?
       GROUP BY c.id
       ORDER BY c.name`,
      [tenantId]
    );

    // Check for offline cameras (no capture in last 24h)
    const now = Math.floor(Date.now() / 1000);
    const offlineThreshold = 24 * 60 * 60; // 24 hours

    const camerasWithStatus = cameras.map((cam: any) => {
      const timeSinceCapture = cam.last_capture ? now - cam.last_capture : null;
      const isOffline = timeSinceCapture && timeSinceCapture > offlineThreshold;

      return {
        ...cam,
        is_offline: isOffline,
        time_since_capture_hours: timeSinceCapture
          ? Math.floor(timeSinceCapture / 3600)
          : null,
      };
    });

    return success({
      cameras: camerasWithStatus,
      summary: {
        total: cameras.length,
        active: camerasWithStatus.filter((c: any) => c.status === 'active').length,
        offline: camerasWithStatus.filter((c: any) => c.is_offline).length,
        error: camerasWithStatus.filter((c: any) => c.status === 'error').length,
      },
    });
  } catch (err) {
    console.error('Get cameras status error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/alerts
 * Get alerts for tenant
 */
export async function getAlerts(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const unacknowledgedOnly = url.searchParams.get('unacknowledged') === 'true';
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let sql = `
      SELECT * FROM alerts
      WHERE tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (unacknowledgedOnly) {
      sql += ` AND acknowledged = 0`;
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const alerts = await queryAll(env.DB, sql, params);

    return success({
      alerts,
      summary: {
        total: alerts.length,
        unacknowledged: alerts.filter((a: any) => a.acknowledged === 0).length,
        critical: alerts.filter((a: any) => a.level === 'critical').length,
      },
    });
  } catch (err) {
    console.error('Get alerts error:', err);
    return errors.serverError();
  }
}

/**
 * POST /api/alerts/:id/ack
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  alertId: string,
  userId: string
): Promise<Response> {
  try {
    // Verify alert belongs to tenant
    const alert = await queryOne(
      env.DB,
      'SELECT id FROM alerts WHERE id = ? AND tenant_id = ?',
      [alertId, tenantId]
    );

    if (!alert) {
      return errors.notFound('Alert');
    }

    // Acknowledge
    const result = await env.DB
      .prepare(
        `UPDATE alerts
         SET acknowledged = 1,
             acknowledged_by = ?,
             acknowledged_at = unixepoch()
         WHERE id = ?`
      )
      .bind(userId, alertId)
      .run();

    if (!result.success) {
      return errors.serverError('Failed to acknowledge alert');
    }

    return success({ acknowledged: true });
  } catch (err) {
    console.error('Acknowledge alert error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/health
 * System health check
 */
export async function healthCheck(
  request: Request,
  env: { DB: D1Database }
): Promise<Response> {
  try {
    // Simple DB health check
    const result = await env.DB.prepare('SELECT 1 as ok').first();

    return success({
      status: 'ok',
      timestamp: Date.now(),
      database: result ? 'connected' : 'error',
    });
  } catch (err) {
    return errors.serverError('System unhealthy');
  }
}
