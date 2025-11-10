/**
 * Database Utilities for D1
 * Helper functions for common DB operations
 */

import type { D1Database } from '@cloudflare/workers-types';

/**
 * Execute a query and return the first result
 */
export async function queryOne<T>(
  db: D1Database,
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const result = await db.prepare(sql).bind(...params).first<T>();
  return result || null;
}

/**
 * Execute a query and return all results
 */
export async function queryAll<T>(
  db: D1Database,
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const result = await db.prepare(sql).bind(...params).all<T>();
  return result.results || [];
}

/**
 * Execute an insert and return the inserted ID
 */
export async function insert(
  db: D1Database,
  table: string,
  data: Record<string, any>
): Promise<string> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');

  const sql = `
    INSERT INTO ${table} (${keys.join(', ')})
    VALUES (${placeholders})
    RETURNING id
  `;

  const result = await db.prepare(sql).bind(...values).first<{ id: string }>();
  return result?.id || '';
}

/**
 * Execute an update
 */
export async function update(
  db: D1Database,
  table: string,
  id: string,
  data: Record<string, any>
): Promise<boolean> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map(k => `${k} = ?`).join(', ');

  const sql = `
    UPDATE ${table}
    SET ${setClause}
    WHERE id = ?
  `;

  const result = await db.prepare(sql).bind(...values, id).run();
  return result.success;
}

/**
 * Execute a delete
 */
export async function deleteRecord(
  db: D1Database,
  table: string,
  id: string
): Promise<boolean> {
  const sql = `DELETE FROM ${table} WHERE id = ?`;
  const result = await db.prepare(sql).bind(id).run();
  return result.success;
}

/**
 * Execute multiple statements in a batch
 */
export async function batch(
  db: D1Database,
  statements: Array<{ sql: string; params?: any[] }>
): Promise<boolean> {
  const prepared = statements.map(stmt =>
    db.prepare(stmt.sql).bind(...(stmt.params || []))
  );

  const results = await db.batch(prepared);
  return results.every(r => r.success);
}

/**
 * Get current Unix timestamp
 */
export function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Parse JSON field safely
 */
export function parseJson<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Check if tenant exists and is active
 */
export async function validateTenant(
  db: D1Database,
  tenantId: string
): Promise<boolean> {
  const tenant = await queryOne<{ status: string }>(
    db,
    'SELECT status FROM tenants WHERE id = ? AND status = ?',
    [tenantId, 'active']
  );
  return tenant !== null;
}

/**
 * Check tenant limits for metering
 */
export async function checkTenantLimit(
  db: D1Database,
  tenantId: string,
  limitType: 'captures' | 'alerts' | 'storage',
  currentValue: number
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const tenant = await queryOne<{ limits_json: string; plan: string }>(
    db,
    'SELECT limits_json, plan FROM tenants WHERE id = ?',
    [tenantId]
  );

  if (!tenant) {
    return { allowed: false, limit: 0, current: currentValue };
  }

  const limits = parseJson(tenant.limits_json, {});

  // Default free tier limits
  const defaultLimits: Record<string, number> = {
    captures: 1000,
    alerts: 100,
    storage: 100, // MB
  };

  const limit = (limits as any)[`max_${limitType}_per_month`] || defaultLimits[limitType];
  const allowed = currentValue < limit;

  return { allowed, limit, current: currentValue };
}

/**
 * Create audit log entry
 */
export async function createAuditLog(
  db: D1Database,
  data: {
    tenant_id?: string;
    user_id?: string;
    actor: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    changes_json?: string;
    ip_address?: string;
    user_agent?: string;
  }
): Promise<void> {
  await insert(db, 'audit_logs', {
    ...data,
    changes_json: data.changes_json || '{}',
    timestamp: now(),
  });
}
