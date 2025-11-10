/**
 * Inventory Management Routes
 * CRUD operations for inventory items
 */

import type { D1Database } from '@cloudflare/workers-types';
import { InventoryItem } from '../../../shared/types';
import { queryOne, queryAll, insert, update, deleteRecord, createAuditLog } from '../../utils/db';
import { success, errors } from '../../utils/response';

/**
 * GET /api/inventory/items
 * List all inventory items for tenant
 */
export async function listInventoryItems(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    let sql = 'SELECT * FROM inventory_items WHERE tenant_id = ?';
    const params: any[] = [tenantId];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY critical DESC, name';

    const items = await queryAll<InventoryItem>(env.DB, sql, params);

    return success(items);
  } catch (err) {
    console.error('List inventory items error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/inventory/items/:id
 * Get single inventory item with recent snapshots
 */
export async function getInventoryItem(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  itemId: string
): Promise<Response> {
  try {
    const item = await queryOne<InventoryItem>(
      env.DB,
      'SELECT * FROM inventory_items WHERE id = ? AND tenant_id = ?',
      [itemId, tenantId]
    );

    if (!item) {
      return errors.notFound('Inventory item');
    }

    // Get recent snapshots
    const snapshots = await queryAll(
      env.DB,
      `SELECT * FROM inventory_snapshots
       WHERE item_id = ?
       ORDER BY captured_at DESC
       LIMIT 10`,
      [itemId]
    );

    return success({
      ...item,
      recent_snapshots: snapshots,
    });
  } catch (err) {
    console.error('Get inventory item error:', err);
    return errors.serverError();
  }
}

/**
 * POST /api/inventory/items
 * Create new inventory item
 */
export async function createInventoryItem(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  userId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      name: string;
      category?: string;
      critical?: boolean;
      unit?: string;
      min_quantity?: number;
    };

    if (!body.name) {
      return errors.badRequest('Item name is required');
    }

    // Check if item already exists
    const existing = await queryOne(
      env.DB,
      'SELECT id FROM inventory_items WHERE tenant_id = ? AND name = ?',
      [tenantId, body.name]
    );

    if (existing) {
      return errors.conflict('Item with this name already exists');
    }

    const itemId = await insert(env.DB, 'inventory_items', {
      tenant_id: tenantId,
      name: body.name,
      category: body.category || null,
      critical: body.critical ? 1 : 0,
      unit: body.unit || null,
      min_quantity: body.min_quantity || null,
      config_json: JSON.stringify({}),
    });

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'create',
      resource_type: 'inventory_item',
      resource_id: itemId,
    });

    return success({ id: itemId, ...body });
  } catch (err) {
    console.error('Create inventory item error:', err);
    return errors.serverError();
  }
}

/**
 * PATCH /api/inventory/items/:id
 * Update inventory item
 */
export async function updateInventoryItem(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  itemId: string,
  userId: string
): Promise<Response> {
  try {
    const item = await queryOne<InventoryItem>(
      env.DB,
      'SELECT * FROM inventory_items WHERE id = ? AND tenant_id = ?',
      [itemId, tenantId]
    );

    if (!item) {
      return errors.notFound('Inventory item');
    }

    const body = await request.json() as Partial<{
      name: string;
      category: string;
      critical: boolean;
      unit: string;
      min_quantity: number;
    }>;

    const updates: Record<string, any> = {};

    if (body.name) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.critical !== undefined) updates.critical = body.critical ? 1 : 0;
    if (body.unit !== undefined) updates.unit = body.unit;
    if (body.min_quantity !== undefined) updates.min_quantity = body.min_quantity;

    if (Object.keys(updates).length === 0) {
      return errors.badRequest('No updates provided');
    }

    const success_update = await update(env.DB, 'inventory_items', itemId, updates);

    if (!success_update) {
      return errors.serverError('Failed to update inventory item');
    }

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'update',
      resource_type: 'inventory_item',
      resource_id: itemId,
      changes_json: JSON.stringify(updates),
    });

    return success({ id: itemId, ...updates });
  } catch (err) {
    console.error('Update inventory item error:', err);
    return errors.serverError();
  }
}

/**
 * DELETE /api/inventory/items/:id
 * Delete inventory item
 */
export async function deleteInventoryItem(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  itemId: string,
  userId: string
): Promise<Response> {
  try {
    const item = await queryOne<InventoryItem>(
      env.DB,
      'SELECT * FROM inventory_items WHERE id = ? AND tenant_id = ?',
      [itemId, tenantId]
    );

    if (!item) {
      return errors.notFound('Inventory item');
    }

    const success_delete = await deleteRecord(env.DB, 'inventory_items', itemId);

    if (!success_delete) {
      return errors.serverError('Failed to delete inventory item');
    }

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'delete',
      resource_type: 'inventory_item',
      resource_id: itemId,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error('Delete inventory item error:', err);
    return errors.serverError();
  }
}

/**
 * POST /api/inventory/items/:id/snapshot
 * Manually record inventory snapshot
 */
export async function createSnapshot(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  itemId: string,
  userId: string
): Promise<Response> {
  try {
    const item = await queryOne<InventoryItem>(
      env.DB,
      'SELECT * FROM inventory_items WHERE id = ? AND tenant_id = ?',
      [itemId, tenantId]
    );

    if (!item) {
      return errors.notFound('Inventory item');
    }

    const body = await request.json() as {
      present: 0 | 1 | 2; // absent, low, present
      quantity?: number;
      notes?: string;
    };

    if (body.present === undefined) {
      return errors.badRequest('Present status is required');
    }

    const snapshotId = await insert(env.DB, 'inventory_snapshots', {
      item_id: itemId,
      present: body.present,
      confidence: 1.0, // Manual entry is 100% confident
      quantity: body.quantity || null,
      captured_at: Math.floor(Date.now() / 1000),
    });

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'manual_snapshot',
      resource_type: 'inventory_snapshot',
      resource_id: snapshotId,
      changes_json: JSON.stringify({ item_id: itemId, ...body }),
    });

    return success({ id: snapshotId, ...body });
  } catch (err) {
    console.error('Create snapshot error:', err);
    return errors.serverError();
  }
}
