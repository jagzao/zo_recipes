/**
 * Reports Routes
 * Generate and export reports in various formats
 */

import type { D1Database } from '@cloudflare/workers-types';
import { queryAll, now } from '../../utils/db';
import { success, errors } from '../../utils/response';

/**
 * GET /api/reports/missing-items
 * Generate missing items report (CSV or JSON)
 */
export async function getMissingItemsReport(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json'; // json or csv
    const days = parseInt(url.searchParams.get('days') || '7');

    const since = now() - (days * 24 * 60 * 60);

    // Get items that were missing in recent snapshots
    const missing = await queryAll(
      env.DB,
      `SELECT
         i.name,
         i.category,
         i.critical,
         COUNT(*) as missing_count,
         MAX(s.captured_at) as last_seen_missing
       FROM inventory_items i
       JOIN inventory_snapshots s ON s.item_id = i.id
       WHERE i.tenant_id = ?
         AND s.captured_at >= ?
         AND s.present IN (0, 1)
       GROUP BY i.id
       ORDER BY i.critical DESC, missing_count DESC`,
      [tenantId, since]
    );

    if (format === 'csv') {
      return generateCSV(missing, 'missing-items');
    }

    return success({
      period_days: days,
      generated_at: now(),
      items: missing,
    });
  } catch (err) {
    console.error('Missing items report error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/reports/consumption
 * Generate consumption report
 */
export async function getConsumptionReport(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const days = parseInt(url.searchParams.get('days') || '30');

    const since = now() - (days * 24 * 60 * 60);

    // Calculate consumption patterns
    const consumption = await queryAll(
      env.DB,
      `SELECT
         i.name,
         i.category,
         COUNT(CASE WHEN s.present = 2 THEN 1 END) as times_present,
         COUNT(CASE WHEN s.present = 0 THEN 1 END) as times_absent,
         COUNT(*) as total_checks
       FROM inventory_items i
       JOIN inventory_snapshots s ON s.item_id = i.id
       WHERE i.tenant_id = ?
         AND s.captured_at >= ?
       GROUP BY i.id
       ORDER BY i.category, i.name`,
      [tenantId, since]
    );

    if (format === 'csv') {
      return generateCSV(consumption, 'consumption');
    }

    return success({
      period_days: days,
      generated_at: now(),
      items: consumption,
    });
  } catch (err) {
    console.error('Consumption report error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/reports/gas-history
 * Generate gas level history report
 */
export async function getGasHistoryReport(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const days = parseInt(url.searchParams.get('days') || '30');
    const cameraId = url.searchParams.get('camera_id');

    const since = now() - (days * 24 * 60 * 60);

    let sql = `
      SELECT
        c.name as camera_name,
        gl.level_pct,
        gl.status_enum,
        gl.captured_at,
        datetime(gl.captured_at, 'unixepoch') as captured_date
      FROM gas_levels gl
      JOIN cameras c ON c.id = gl.camera_id
      WHERE c.tenant_id = ?
        AND gl.captured_at >= ?
    `;
    const params: any[] = [tenantId, since];

    if (cameraId) {
      sql += ' AND gl.camera_id = ?';
      params.push(cameraId);
    }

    sql += ' ORDER BY gl.captured_at DESC';

    const history = await queryAll(env.DB, sql, params);

    if (format === 'csv') {
      return generateCSV(history, 'gas-history');
    }

    return success({
      period_days: days,
      generated_at: now(),
      records: history,
    });
  } catch (err) {
    console.error('Gas history report error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/reports/alerts-summary
 * Generate alerts summary report
 */
export async function getAlertsSummaryReport(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const days = parseInt(url.searchParams.get('days') || '30');

    const since = now() - (days * 24 * 60 * 60);

    const summary = await queryAll(
      env.DB,
      `SELECT
         type,
         level,
         COUNT(*) as count,
         COUNT(CASE WHEN acknowledged = 1 THEN 1 END) as acknowledged_count,
         AVG(CASE
           WHEN acknowledged = 1 AND acknowledged_at IS NOT NULL
           THEN acknowledged_at - created_at
         END) as avg_response_time_sec
       FROM alerts
       WHERE tenant_id = ?
         AND created_at >= ?
       GROUP BY type, level
       ORDER BY level DESC, count DESC`,
      [tenantId, since]
    );

    if (format === 'csv') {
      return generateCSV(summary, 'alerts-summary');
    }

    return success({
      period_days: days,
      generated_at: now(),
      summary,
    });
  } catch (err) {
    console.error('Alerts summary report error:', err);
    return errors.serverError();
  }
}

/**
 * Helper: Generate CSV response
 */
function generateCSV(data: any[], filename: string): Response {
  if (!data || data.length === 0) {
    return new Response('No data available', { status: 404 });
  }

  // Get headers from first row
  const headers = Object.keys(data[0]);

  // Build CSV
  let csv = headers.join(',') + '\n';

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csv += values.join(',') + '\n';
  }

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}-${Date.now()}.csv"`,
    },
  });
}
