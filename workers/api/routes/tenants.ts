/**
 * Tenant Management Routes
 * Tenant configuration and user invitations
 */

import type { D1Database } from '@cloudflare/workers-types';
import { Tenant, User, UserTenantRole } from '../../../shared/types';
import { queryOne, queryAll, insert, update, now, createAuditLog } from '../../utils/db';
import { success, errors } from '../../utils/response';
import { generateToken } from '../../utils/jwt';

/**
 * GET /api/tenants/:id
 * Get tenant details
 */
export async function getTenant(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const tenant = await queryOne<Tenant>(
      env.DB,
      'SELECT * FROM tenants WHERE id = ?',
      [tenantId]
    );

    if (!tenant) {
      return errors.notFound('Tenant');
    }

    // Get member count
    const memberCount = await queryOne<{ count: number }>(
      env.DB,
      'SELECT COUNT(*) as count FROM user_tenant_roles WHERE tenant_id = ?',
      [tenantId]
    );

    return success({
      ...tenant,
      limits: JSON.parse(tenant.limits_json),
      member_count: memberCount?.count || 0,
    });
  } catch (err) {
    console.error('Get tenant error:', err);
    return errors.serverError();
  }
}

/**
 * PATCH /api/tenants/:id
 * Update tenant settings
 */
export async function updateTenant(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  userId: string
): Promise<Response> {
  try {
    const tenant = await queryOne<Tenant>(
      env.DB,
      'SELECT * FROM tenants WHERE id = ?',
      [tenantId]
    );

    if (!tenant) {
      return errors.notFound('Tenant');
    }

    const body = await request.json() as Partial<{
      name: string;
      timezone: string;
      logo_url: string;
    }>;

    const updates: Record<string, any> = {};

    if (body.name) updates.name = body.name;
    if (body.timezone) updates.timezone = body.timezone;
    if (body.logo_url !== undefined) updates.logo_url = body.logo_url;

    if (Object.keys(updates).length === 0) {
      return errors.badRequest('No updates provided');
    }

    const success_update = await update(env.DB, 'tenants', tenantId, updates);

    if (!success_update) {
      return errors.serverError('Failed to update tenant');
    }

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'update',
      resource_type: 'tenant',
      resource_id: tenantId,
      changes_json: JSON.stringify(updates),
    });

    return success({ id: tenantId, ...updates });
  } catch (err) {
    console.error('Update tenant error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/tenants/:id/members
 * List all members of tenant
 */
export async function listTenantMembers(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const members = await queryAll(
      env.DB,
      `SELECT
         u.id,
         u.email,
         u.name,
         u.status,
         utr.role,
         utr.created_at as joined_at
       FROM user_tenant_roles utr
       JOIN users u ON u.id = utr.user_id
       WHERE utr.tenant_id = ?
       ORDER BY utr.created_at`,
      [tenantId]
    );

    return success(members);
  } catch (err) {
    console.error('List tenant members error:', err);
    return errors.serverError();
  }
}

/**
 * POST /api/tenants/:id/invite
 * Invite user to tenant
 */
export async function inviteUser(
  request: Request,
  env: { DB: D1Database; JWT_SECRET_KEY: string },
  tenantId: string,
  userId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      email: string;
      role: 'admin' | 'ops' | 'viewer';
      name?: string;
    };

    if (!body.email || !body.role) {
      return errors.badRequest('Email and role are required');
    }

    // Check if user already exists
    let user = await queryOne<User>(
      env.DB,
      'SELECT * FROM users WHERE email = ?',
      [body.email]
    );

    // Create user if doesn't exist
    if (!user) {
      const newUserId = await insert(env.DB, 'users', {
        email: body.email,
        name: body.name || null,
        status: 'active',
      });

      user = {
        id: newUserId,
        email: body.email,
        name: body.name,
        status: 'active',
        created_at: now(),
      } as User;
    }

    // Check if already a member
    const existing = await queryOne(
      env.DB,
      'SELECT id FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
      [user.id, tenantId]
    );

    if (existing) {
      return errors.conflict('User is already a member of this tenant');
    }

    // Add user to tenant
    await insert(env.DB, 'user_tenant_roles', {
      user_id: user.id,
      tenant_id: tenantId,
      role: body.role,
    });

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'invite',
      resource_type: 'user',
      resource_id: user.id,
      changes_json: JSON.stringify({ role: body.role }),
    });

    // Generate invitation token (7 days expiry)
    const inviteToken = await generateToken(
      {
        sub: user.id,
        email: user.email,
        tenant_id: tenantId,
        role: body.role,
      },
      env.JWT_SECRET_KEY,
      7 * 24 * 60 * 60 // 7 days
    );

    return success({
      user_id: user.id,
      email: body.email,
      role: body.role,
      invite_token: inviteToken,
      invite_url: `https://kitcheneye.app/accept-invite?token=${inviteToken}`,
    });
  } catch (err) {
    console.error('Invite user error:', err);
    return errors.serverError();
  }
}

/**
 * DELETE /api/tenants/:id/members/:userId
 * Remove member from tenant
 */
export async function removeTenantMember(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  targetUserId: string,
  actorUserId: string
): Promise<Response> {
  try {
    // Verify member exists
    const member = await queryOne(
      env.DB,
      'SELECT * FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
      [targetUserId, tenantId]
    );

    if (!member) {
      return errors.notFound('Member not found in this tenant');
    }

    // Don't allow removing yourself if you're the owner
    if (targetUserId === actorUserId) {
      const actorRole = await queryOne<{ role: string }>(
        env.DB,
        'SELECT role FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
        [actorUserId, tenantId]
      );

      if (actorRole?.role === 'owner') {
        return errors.badRequest('Owner cannot remove themselves');
      }
    }

    // Remove from tenant
    await env.DB
      .prepare('DELETE FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?')
      .bind(targetUserId, tenantId)
      .run();

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: actorUserId,
      actor: actorUserId,
      action: 'remove_member',
      resource_type: 'user',
      resource_id: targetUserId,
    });

    return success({ removed: true });
  } catch (err) {
    console.error('Remove tenant member error:', err);
    return errors.serverError();
  }
}

/**
 * PATCH /api/tenants/:id/members/:userId/role
 * Update member role
 */
export async function updateMemberRole(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  targetUserId: string,
  actorUserId: string
): Promise<Response> {
  try {
    const body = await request.json() as { role: string };

    if (!body.role) {
      return errors.badRequest('Role is required');
    }

    // Verify member exists
    const member = await queryOne(
      env.DB,
      'SELECT * FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ?',
      [targetUserId, tenantId]
    );

    if (!member) {
      return errors.notFound('Member not found in this tenant');
    }

    // Update role
    await env.DB
      .prepare('UPDATE user_tenant_roles SET role = ? WHERE user_id = ? AND tenant_id = ?')
      .bind(body.role, targetUserId, tenantId)
      .run();

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: actorUserId,
      actor: actorUserId,
      action: 'update_role',
      resource_type: 'user',
      resource_id: targetUserId,
      changes_json: JSON.stringify({ role: body.role }),
    });

    return success({ user_id: targetUserId, role: body.role });
  } catch (err) {
    console.error('Update member role error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/tenants/:id/usage
 * Get usage metrics for tenant
 */
export async function getTenantUsage(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || getCurrentPeriod();

    const usage = await queryOne(
      env.DB,
      'SELECT * FROM usage_meters WHERE tenant_id = ? AND period = ?',
      [tenantId, period]
    );

    // Get tenant limits
    const tenant = await queryOne<Tenant>(
      env.DB,
      'SELECT limits_json, plan FROM tenants WHERE id = ?',
      [tenantId]
    );

    const limits = tenant ? JSON.parse(tenant.limits_json) : {};

    return success({
      period,
      usage: usage || {
        captures: 0,
        alerts_sent: 0,
        storage_mb: 0,
        api_calls: 0,
      },
      limits: {
        max_captures_per_month: limits.max_captures_per_month || 1000,
        max_alerts_per_month: limits.max_alerts_per_month || 100,
        max_storage_mb: limits.max_storage_mb || 100,
      },
      plan: tenant?.plan || 'free',
    });
  } catch (err) {
    console.error('Get tenant usage error:', err);
    return errors.serverError();
  }
}

/**
 * Helper: Get current period (YYYY-MM)
 */
function getCurrentPeriod(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
