/**
 * Cron Job Handlers
 * Scheduled tasks for gas monitoring (05:00) and fridge monitoring (every 4h)
 */

import type { D1Database } from '@cloudflare/workers-types';
import { queryAll, createAuditLog, now } from '../utils/db';

interface CronEvent {
  cron: string;
  scheduledTime: number;
}

/**
 * Main cron handler - routes to appropriate job
 */
export async function handleCron(
  event: CronEvent,
  env: { DB: D1Database }
): Promise<void> {
  console.log(`Cron triggered: ${event.cron} at ${new Date(event.scheduledTime)}`);

  try {
    // Gas monitoring at 05:00 daily (America/Mexico_City)
    if (event.cron === '0 5 * * *') {
      await processGasMonitoring(env.DB);
    }

    // Fridge monitoring every 4 hours
    if (event.cron === '0 */4 * * *') {
      await processFridgeMonitoring(env.DB);
    }
  } catch (err) {
    console.error('Cron job error:', err);
  }
}

/**
 * Process gas monitoring jobs for all active tenants
 */
async function processGasMonitoring(db: D1Database): Promise<void> {
  console.log('Starting gas monitoring job...');

  // Get all active gas cameras
  const cameras = await queryAll<{
    id: string;
    tenant_id: string;
    name: string;
    last_capture_at: number | null;
  }>(
    db,
    `SELECT c.id, c.tenant_id, c.name, c.last_capture_at
     FROM cameras c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.type = 'gas'
       AND c.status = 'active'
       AND t.status = 'active'`
  );

  console.log(`Found ${cameras.length} active gas cameras`);

  // Check for cameras that haven't captured recently (offline detection)
  const currentTime = now();
  const offlineThreshold = 48 * 60 * 60; // 48 hours

  for (const camera of cameras) {
    const timeSinceCapture = camera.last_capture_at
      ? currentTime - camera.last_capture_at
      : null;

    // Alert if camera is offline
    if (timeSinceCapture && timeSinceCapture > offlineThreshold) {
      console.log(`Camera ${camera.id} is offline (${Math.floor(timeSinceCapture / 3600)}h since last capture)`);

      // Create offline alert
      await db
        .prepare(
          `INSERT INTO alerts (tenant_id, type, level, title, message, payload_json, acknowledged)
           VALUES (?, 'camera_offline', 'warning', 'Camera Offline', ?, ?, 0)`
        )
        .bind(
          camera.tenant_id,
          `Gas camera "${camera.name}" has not captured data in ${Math.floor(timeSinceCapture / 3600)} hours`,
          JSON.stringify({
            camera_id: camera.id,
            camera_name: camera.name,
            hours_offline: Math.floor(timeSinceCapture / 3600),
          })
        )
        .run();

      // Update camera status
      await db
        .prepare('UPDATE cameras SET status = ? WHERE id = ?')
        .bind('error', camera.id)
        .run();
    }
  }

  // Log cron execution
  await createAuditLog(db, {
    actor: 'system:cron',
    action: 'gas_monitoring',
    resource_type: 'cron',
    changes_json: JSON.stringify({
      cameras_processed: cameras.length,
      timestamp: currentTime,
    }),
  });
}

/**
 * Process fridge monitoring jobs for all active tenants
 */
async function processFridgeMonitoring(db: D1Database): Promise<void> {
  console.log('Starting fridge monitoring job...');

  // Get all active fridge cameras
  const cameras = await queryAll<{
    id: string;
    tenant_id: string;
    name: string;
    last_capture_at: number | null;
  }>(
    db,
    `SELECT c.id, c.tenant_id, c.name, c.last_capture_at
     FROM cameras c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.type = 'fridge'
       AND c.status = 'active'
       AND t.status = 'active'`
  );

  console.log(`Found ${cameras.length} active fridge cameras`);

  // Check for offline cameras
  const currentTime = now();
  const offlineThreshold = 12 * 60 * 60; // 12 hours (3 missed cycles)

  for (const camera of cameras) {
    const timeSinceCapture = camera.last_capture_at
      ? currentTime - camera.last_capture_at
      : null;

    if (timeSinceCapture && timeSinceCapture > offlineThreshold) {
      console.log(`Camera ${camera.id} is offline`);

      await db
        .prepare(
          `INSERT INTO alerts (tenant_id, type, level, title, message, payload_json, acknowledged)
           VALUES (?, 'camera_offline', 'warning', 'Camera Offline', ?, ?, 0)`
        )
        .bind(
          camera.tenant_id,
          `Fridge camera "${camera.name}" has not captured data in ${Math.floor(timeSinceCapture / 3600)} hours`,
          JSON.stringify({
            camera_id: camera.id,
            camera_name: camera.name,
            hours_offline: Math.floor(timeSinceCapture / 3600),
          })
        )
        .run();

      await db
        .prepare('UPDATE cameras SET status = ? WHERE id = ?')
        .bind('error', camera.id)
        .run();
    }
  }

  // Log cron execution
  await createAuditLog(db, {
    actor: 'system:cron',
    action: 'fridge_monitoring',
    resource_type: 'cron',
    changes_json: JSON.stringify({
      cameras_processed: cameras.length,
      timestamp: currentTime,
    }),
  });
}

/**
 * Cleanup expired data (images with TTL, old audit logs)
 */
export async function cleanupExpiredData(db: D1Database): Promise<void> {
  const currentTime = now();

  // Delete expired images
  const expiredImages = await db
    .prepare('DELETE FROM images WHERE ttl_expires_at IS NOT NULL AND ttl_expires_at < ?')
    .bind(currentTime)
    .run();

  // Delete old audit logs (keep 90 days)
  const retentionPeriod = 90 * 24 * 60 * 60;
  const auditCutoff = currentTime - retentionPeriod;

  const expiredAudits = await db
    .prepare('DELETE FROM audit_logs WHERE timestamp < ?')
    .bind(auditCutoff)
    .run();

  console.log(`Cleanup: deleted ${expiredImages.meta?.changes || 0} expired images, ${expiredAudits.meta?.changes || 0} old audit logs`);
}
