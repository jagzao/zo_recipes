/**
 * Ingestion Routes
 * Handles data ingestion from edge CV devices
 */

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { IngestPayload, GasResult, FridgeResult } from '../../../shared/types';
import { queryOne, insert, now, batch, createAuditLog } from '../../utils/db';
import { success, errors } from '../../utils/response';

/**
 * POST /api/ingest/result
 * Receive and process CV results from edge devices
 */
export async function ingestResult(
  request: Request,
  env: { DB: D1Database; IMAGES_R2: R2Bucket }
): Promise<Response> {
  try {
    const payload = await request.json() as IngestPayload;

    // Validate payload
    if (!payload.message_id || !payload.camera_id || !payload.captured_at) {
      return errors.badRequest('Missing required fields');
    }

    // Check for duplicate (idempotency)
    const existingImage = await queryOne(
      env.DB,
      'SELECT id FROM images WHERE message_id = ?',
      [payload.message_id]
    );

    if (existingImage) {
      return success({
        status: 'duplicate',
        message: 'Result already processed',
        image_id: (existingImage as any).id
      });
    }

    // Verify camera exists and is active
    const camera = await queryOne<{
      id: string;
      tenant_id: string;
      type: string;
      status: string;
      config_json: string;
    }>(
      env.DB,
      'SELECT * FROM cameras WHERE id = ? AND status = ?',
      [payload.camera_id, 'active']
    );

    if (!camera) {
      return errors.notFound('Camera not found or inactive');
    }

    // Verify camera type matches payload
    if (camera.type !== payload.type) {
      return errors.badRequest('Camera type mismatch');
    }

    // Store thumbnail in R2 if provided
    let thumbUrl: string | null = null;
    if (payload.thumbnail) {
      try {
        const thumbKey = `thumbnails/${camera.tenant_id}/${payload.camera_id}/${payload.message_id}.jpg`;
        const thumbBuffer = Uint8Array.from(atob(payload.thumbnail), c => c.charCodeAt(0));

        await env.IMAGES_R2.put(thumbKey, thumbBuffer, {
          httpMetadata: {
            contentType: 'image/jpeg',
          },
          customMetadata: {
            camera_id: payload.camera_id,
            tenant_id: camera.tenant_id,
            captured_at: payload.captured_at.toString(),
          },
        });

        thumbUrl = `r2://${thumbKey}`;
      } catch (err) {
        console.error('Failed to store thumbnail:', err);
        // Continue processing even if thumbnail storage fails
      }
    }

    // Create image record
    const imageId = await insert(env.DB, 'images', {
      camera_id: payload.camera_id,
      message_id: payload.message_id,
      thumb_url: thumbUrl,
      captured_at: payload.captured_at,
      processed_at: now(),
      cv_status: 'completed',
      confidence: payload.type === 'gas'
        ? (payload.results as GasResult).confidence
        : (payload.results as FridgeResult).confidence,
      metadata_json: JSON.stringify(payload.metadata || {}),
    });

    // Process based on camera type
    if (payload.type === 'gas') {
      await processGasResult(
        env.DB,
        camera,
        imageId,
        payload.results as GasResult,
        payload.captured_at
      );
    } else if (payload.type === 'fridge') {
      await processFridgeResult(
        env.DB,
        camera,
        imageId,
        payload.results as FridgeResult,
        payload.captured_at
      );
    }

    // Update camera last capture time
    await env.DB
      .prepare('UPDATE cameras SET last_capture_at = ? WHERE id = ?')
      .bind(now(), camera.id)
      .run();

    // Audit log
    await createAuditLog(env.DB, {
      tenant_id: camera.tenant_id,
      actor: `camera:${camera.id}`,
      action: 'ingest',
      resource_type: 'image',
      resource_id: imageId,
      ip_address: request.headers.get('CF-Connecting-IP') || undefined,
    });

    return success({
      status: 'processed',
      image_id: imageId,
      camera_id: camera.id,
      type: payload.type,
    });
  } catch (err) {
    console.error('Ingest error:', err);
    return errors.serverError('Failed to process ingestion');
  }
}

/**
 * Process gas level results
 */
async function processGasResult(
  db: D1Database,
  camera: { id: string; tenant_id: string; config_json: string },
  imageId: string,
  result: GasResult,
  capturedAt: number
): Promise<void> {
  // Insert gas level record
  await insert(db, 'gas_levels', {
    camera_id: camera.id,
    image_id: imageId,
    level_pct: result.level_pct,
    status_enum: result.status,
    confidence: result.confidence,
    calibration_version: result.calibration_version,
    captured_at: capturedAt,
  });

  // Check if alert needed based on thresholds
  const config = JSON.parse(camera.config_json || '{}');
  const thresholds = config.thresholds || {
    gas_red: 15,
    gas_yellow: 35,
  };

  if (result.level_pct < thresholds.gas_red) {
    // Critical alert
    await insert(db, 'alerts', {
      tenant_id: camera.tenant_id,
      type: 'gas_critical',
      level: 'critical',
      title: 'Gas Level Critical',
      message: `Gas level is at ${result.level_pct.toFixed(1)}% - immediate refill needed`,
      payload_json: JSON.stringify({
        camera_id: camera.id,
        level_pct: result.level_pct,
        image_id: imageId,
      }),
      acknowledged: 0,
    });
  } else if (result.level_pct < thresholds.gas_yellow) {
    // Warning alert
    await insert(db, 'alerts', {
      tenant_id: camera.tenant_id,
      type: 'gas_low',
      level: 'warning',
      title: 'Gas Level Low',
      message: `Gas level is at ${result.level_pct.toFixed(1)}% - consider refilling soon`,
      payload_json: JSON.stringify({
        camera_id: camera.id,
        level_pct: result.level_pct,
        image_id: imageId,
      }),
      acknowledged: 0,
    });
  }
}

/**
 * Process fridge inventory results
 */
async function processFridgeResult(
  db: D1Database,
  camera: { id: string; tenant_id: string; config_json: string },
  imageId: string,
  result: FridgeResult,
  capturedAt: number
): Promise<void> {
  const statements = [];

  for (const detection of result.detections) {
    // Find or create inventory item
    let item = await queryOne<{ id: string; critical: number }>(
      db,
      'SELECT id, critical FROM inventory_items WHERE tenant_id = ? AND name = ?',
      [camera.tenant_id, detection.item_name]
    );

    if (!item) {
      // Auto-create item if not exists
      const itemId = await insert(db, 'inventory_items', {
        tenant_id: camera.tenant_id,
        name: detection.item_name,
        category: null,
        critical: 0,
      });
      item = { id: itemId, critical: 0 };
    }

    // Insert snapshot
    statements.push({
      sql: `INSERT INTO inventory_snapshots
            (item_id, image_id, present, confidence, quantity, level_pct, captured_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        item.id,
        imageId,
        detection.present,
        detection.confidence,
        detection.quantity || null,
        null, // level_pct not used for now
        capturedAt,
      ],
    });

    // Check for missing/low items (need smoothing - check last 2 captures)
    if (detection.present === 0 || detection.present === 1) {
      const recentSnapshots = await db
        .prepare(
          `SELECT present FROM inventory_snapshots
           WHERE item_id = ?
           ORDER BY captured_at DESC
           LIMIT 2`
        )
        .bind(item.id)
        .all();

      // If last 2 captures show absent/low, trigger alert
      if (
        recentSnapshots.results &&
        recentSnapshots.results.length >= 1 &&
        (recentSnapshots.results[0] as any).present <= 1
      ) {
        const alertType = detection.present === 0 ? 'item_missing' : 'item_low';
        const alertLevel = item.critical ? 'critical' : 'warning';

        await insert(db, 'alerts', {
          tenant_id: camera.tenant_id,
          type: alertType,
          level: alertLevel,
          title: detection.present === 0 ? 'Item Missing' : 'Item Running Low',
          message: `${detection.item_name} is ${detection.present === 0 ? 'missing' : 'running low'} in your fridge`,
          payload_json: JSON.stringify({
            camera_id: camera.id,
            item_id: item.id,
            item_name: detection.item_name,
            image_id: imageId,
          }),
          acknowledged: 0,
        });
      }
    }
  }

  // Batch insert snapshots
  if (statements.length > 0) {
    await batch(db, statements);
  }
}

/**
 * POST /api/ingest/health
 * Health check from edge device
 */
export async function healthCheck(
  request: Request,
  env: { DB: D1Database }
): Promise<Response> {
  try {
    const body = await request.json() as {
      camera_id: string;
      status: 'ok' | 'error';
      metadata?: Record<string, any>;
    };

    if (!body.camera_id) {
      return errors.badRequest('Camera ID is required');
    }

    // Update camera health check timestamp
    await env.DB
      .prepare('UPDATE cameras SET last_health_check_at = ? WHERE id = ?')
      .bind(now(), body.camera_id)
      .run();

    // If error status, update camera status
    if (body.status === 'error') {
      await env.DB
        .prepare('UPDATE cameras SET status = ? WHERE id = ?')
        .bind('error', body.camera_id)
        .run();
    }

    return success({ status: 'ok' });
  } catch (err) {
    console.error('Health check error:', err);
    return errors.serverError();
  }
}
