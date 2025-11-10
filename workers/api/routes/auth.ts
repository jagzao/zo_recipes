/**
 * Authentication Routes
 * Handles user signup, login, and token management
 */

import type { D1Database } from '@cloudflare/workers-types';
import { generateToken } from '../../utils/jwt';
import { queryOne, insert, now } from '../../utils/db';
import { success, errors } from '../../utils/response';
import { User, Account, Tenant } from '../../../shared/types';

/**
 * POST /api/auth/signup
 * Create a new account with initial tenant
 */
export async function signup(
  request: Request,
  env: { DB: D1Database; JWT_SECRET_KEY: string }
): Promise<Response> {
  try {
    const body = await request.json() as {
      email: string;
      name?: string;
      tenant_name: string;
    };

    if (!body.email || !body.tenant_name) {
      return errors.badRequest('Email and tenant name are required');
    }

    // Check if user already exists
    const existingUser = await queryOne<User>(
      env.DB,
      'SELECT * FROM users WHERE email = ?',
      [body.email]
    );

    if (existingUser) {
      return errors.conflict('User already exists');
    }

    // Create account
    const accountId = await insert(env.DB, 'accounts', {
      owner_email: body.email,
      status: 'active',
    });

    // Create user
    const userId = await insert(env.DB, 'users', {
      email: body.email,
      name: body.name || null,
      status: 'active',
    });

    // Create initial tenant
    const tenantId = await insert(env.DB, 'tenants', {
      account_id: accountId,
      name: body.tenant_name,
      timezone: 'America/Mexico_City',
      plan: 'free',
      limits_json: JSON.stringify({
        max_cameras: 3,
        max_captures_per_month: 1000,
        max_alerts_per_month: 100,
        max_storage_mb: 100,
        retention_days: 7,
      }),
      status: 'trial',
    });

    // Assign owner role
    await insert(env.DB, 'user_tenant_roles', {
      user_id: userId,
      tenant_id: tenantId,
      role: 'owner',
    });

    // Generate JWT
    const token = await generateToken(
      {
        sub: userId,
        email: body.email,
        tenant_id: tenantId,
        role: 'owner',
      },
      env.JWT_SECRET_KEY
    );

    return success({
      token,
      user: {
        id: userId,
        email: body.email,
        name: body.name,
      },
      tenant: {
        id: tenantId,
        name: body.tenant_name,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return errors.serverError();
  }
}

/**
 * POST /api/auth/login
 * Simple email-based login (passwordless for MVP)
 */
export async function login(
  request: Request,
  env: { DB: D1Database; JWT_SECRET_KEY: string }
): Promise<Response> {
  try {
    const body = await request.json() as {
      email: string;
      tenant_id?: string;
    };

    if (!body.email) {
      return errors.badRequest('Email is required');
    }

    // Find user
    const user = await queryOne<User>(
      env.DB,
      'SELECT * FROM users WHERE email = ? AND status = ?',
      [body.email, 'active']
    );

    if (!user) {
      return errors.unauthorized();
    }

    // Get user's tenants and roles
    const roles = await env.DB
      .prepare(
        `SELECT utr.*, t.name as tenant_name
         FROM user_tenant_roles utr
         JOIN tenants t ON t.id = utr.tenant_id
         WHERE utr.user_id = ? AND t.status = ?`
      )
      .bind(user.id, 'active')
      .all();

    if (!roles.results || roles.results.length === 0) {
      return errors.forbidden('No active tenants found');
    }

    // Use specified tenant or default to first one
    let selectedRole = roles.results[0] as any;
    if (body.tenant_id) {
      const found = roles.results.find((r: any) => r.tenant_id === body.tenant_id);
      if (found) {
        selectedRole = found;
      }
    }

    // Update last login
    await env.DB
      .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .bind(now(), user.id)
      .run();

    // Generate JWT
    const token = await generateToken(
      {
        sub: user.id,
        email: user.email,
        tenant_id: selectedRole.tenant_id,
        role: selectedRole.role,
      },
      env.JWT_SECRET_KEY
    );

    return success({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      tenant: {
        id: selectedRole.tenant_id,
        name: selectedRole.tenant_name,
      },
      available_tenants: roles.results.map((r: any) => ({
        id: r.tenant_id,
        name: r.tenant_name,
        role: r.role,
      })),
    });
  } catch (err) {
    console.error('Login error:', err);
    return errors.serverError();
  }
}

/**
 * POST /api/auth/switch-tenant
 * Switch active tenant (generate new token)
 */
export async function switchTenant(
  request: Request,
  env: { DB: D1Database; JWT_SECRET_KEY: string },
  userId: string
): Promise<Response> {
  try {
    const body = await request.json() as { tenant_id: string };

    if (!body.tenant_id) {
      return errors.badRequest('Tenant ID is required');
    }

    // Verify user has access to this tenant
    const role = await queryOne<{ role: string; user_id: string; tenant_id: string }>(
      env.DB,
      `SELECT utr.role, utr.user_id, utr.tenant_id, u.email
       FROM user_tenant_roles utr
       JOIN users u ON u.id = utr.user_id
       WHERE utr.user_id = ? AND utr.tenant_id = ?`,
      [userId, body.tenant_id]
    );

    if (!role) {
      return errors.forbidden('Access denied to this tenant');
    }

    // Get user email
    const user = await queryOne<User>(
      env.DB,
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return errors.notFound('User');
    }

    // Generate new JWT
    const token = await generateToken(
      {
        sub: userId,
        email: user.email,
        tenant_id: body.tenant_id,
        role: role.role as any,
      },
      env.JWT_SECRET_KEY
    );

    return success({ token });
  } catch (err) {
    console.error('Switch tenant error:', err);
    return errors.serverError();
  }
}
