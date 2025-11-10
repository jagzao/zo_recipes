/**
 * Camera Management Routes
 * CRUD operations for cameras
 */

import type { D1Database } from '@cloudflare/workers-types';
import { Camera } from '../../../shared/types';
import { queryOne, queryAll, insert, update, deleteRecord, now, createAuditLog } from '../../utils/db';
import { success, errors } from '../../utils/response';

/**
 * GET /api/cameras
 * List all cameras for tenant
 */
export async function listCameras(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const cameras = await queryAll<Camera>(
      env.DB,
      `SELECT * FROM cameras WHERE tenant_id = ? ORDER BY name`,
      [tenantId]
    );

    return success(cameras);
  } catch (err) {
    console.error('List cameras error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/cameras/:id
 * Get single camera details
 */
export async function getCamera(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  cameraId: string
): Promise<Response> {
  try {
    const camera = await queryOne<Camera>(
      env.DB,
      'SELECT * FROM cameras WHERE id = ? AND tenant_id = ?',
      [cameraId, tenantId]
    );

    if (!camera) {
      return errors.notFound('Camera');
    }

    return success(camera);
  } catch (err) {
    console.error('Get camera error:', err);
    return errors.serverError();
  }
}

/**
 * POST /api/cameras
 * Create new camera
 */
export async function createCamera(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  userId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      name: string;
      type: 'gas' | 'fridge';
      location?: string;
      schedule_cron?: string;
      config?: Record<string, any>;
    };

    if (!body.name || !body.type) {
      return errors.badRequest('Name and type are required');
    }

    // Default schedule based on type
    const defaultSchedule = body.type === 'gas' ? '0 5 * * *' : '0 */4 * * *';

    const cameraId = await insert(env.DB, 'cameras', {
      tenant_id: tenantId,
      name: body.name,
      type: body.type,
      location: body.location || null,
      schedule_cron: body.schedule_cron || defaultSchedule,
      config_json: JSON.stringify(body.config || {}),
      status: 'active',
    });

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'create',
      resource_type: 'camera',
      resource_id: cameraId,
    });

    return success({ id: cameraId, ...body });
  } catch (err) {
    console.error('Create camera error:', err);
    return errors.serverError();
  }
}

/**
 * PATCH /api/cameras/:id
 * Update camera
 */
export async function updateCamera(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  cameraId: string,
  userId: string
): Promise<Response> {
  try {
    // Verify camera exists and belongs to tenant
    const camera = await queryOne<Camera>(
      env.DB,
      'SELECT * FROM cameras WHERE id = ? AND tenant_id = ?',
      [cameraId, tenantId]
    );

    if (!camera) {
      return errors.notFound('Camera');
    }

    const body = await request.json() as Partial<{
      name: string;
      location: string;
      schedule_cron: string;
      config: Record<string, any>;
      status: string;
    }>;

    const updates: Record<string, any> = {};

    if (body.name) updates.name = body.name;
    if (body.location !== undefined) updates.location = body.location;
    if (body.schedule_cron) updates.schedule_cron = body.schedule_cron;
    if (body.config) updates.config_json = JSON.stringify(body.config);
    if (body.status) updates.status = body.status;

    if (Object.keys(updates).length === 0) {
      return errors.badRequest('No updates provided');
    }

    const success_update = await update(env.DB, 'cameras', cameraId, updates);

    if (!success_update) {
      return errors.serverError('Failed to update camera');
    }

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'update',
      resource_type: 'camera',
      resource_id: cameraId,
      changes_json: JSON.stringify(updates),
    });

    return success({ id: cameraId, ...updates });
  } catch (err) {
    console.error('Update camera error:', err);
    return errors.serverError();
  }
}

/**
 * DELETE /api/cameras/:id
 * Delete camera
 */
export async function deleteCamera(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  cameraId: string,
  userId: string
): Promise<Response> {
  try {
    // Verify camera exists and belongs to tenant
    const camera = await queryOne<Camera>(
      env.DB,
      'SELECT * FROM cameras WHERE id = ? AND tenant_id = ?',
      [cameraId, tenantId]
    );

    if (!camera) {
      return errors.notFound('Camera');
    }

    const success_delete = await deleteRecord(env.DB, 'cameras', cameraId);

    if (!success_delete) {
      return errors.serverError('Failed to delete camera');
    }

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'delete',
      resource_type: 'camera',
      resource_id: cameraId,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error('Delete camera error:', err);
    return errors.serverError();
  }
}

/**
 * POST /api/cameras/:id/calibrate
 * Calibrate gas camera
 */
export async function calibrateCamera(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  cameraId: string,
  userId: string
): Promise<Response> {
  try {
    const camera = await queryOne<Camera>(
      env.DB,
      'SELECT * FROM cameras WHERE id = ? AND tenant_id = ? AND type = ?',
      [cameraId, tenantId, 'gas']
    );

    if (!camera) {
      return errors.notFound('Gas camera');
    }

    const body = await request.json() as {
      marker_x: number;
      marker_y: number;
      marker_height: number;
      red_threshold?: number;
      yellow_threshold?: number;
    };

    const config = JSON.parse(camera.config_json || '{}');
    config.calibration = {
      marker_position: { x: body.marker_x, y: body.marker_y },
      reference_height: body.marker_height,
      calibrated_at: now(),
    };

    if (body.red_threshold) {
      config.thresholds = config.thresholds || {};
      config.thresholds.gas_red = body.red_threshold;
    }

    if (body.yellow_threshold) {
      config.thresholds = config.thresholds || {};
      config.thresholds.gas_yellow = body.yellow_threshold;
    }

    await update(env.DB, 'cameras', cameraId, {
      config_json: JSON.stringify(config),
      status: 'active',
    });

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'calibrate',
      resource_type: 'camera',
      resource_id: cameraId,
      changes_json: JSON.stringify(body),
    });

    return success({ calibrated: true, config });
  } catch (err) {
    console.error('Calibrate camera error:', err);
    return errors.serverError();
  }
}
