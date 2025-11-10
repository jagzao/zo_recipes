/**
 * Authentication Middleware
 * Validates JWT and attaches user context to request
 */

import type { D1Database } from '@cloudflare/workers-types';
import { JWTClaims, Role } from '../../../shared/types';
import { verifyToken, extractToken, hasPermission } from '../../utils/jwt';
import { errors } from '../../utils/response';

export interface AuthContext {
  claims: JWTClaims;
  userId: string;
  tenantId: string;
  role: Role;
}

/**
 * Authenticate request and return context
 */
export async function authenticate(
  request: Request,
  env: { JWT_SECRET_KEY: string }
): Promise<AuthContext | Response> {
  const token = extractToken(request);

  if (!token) {
    return errors.unauthorized();
  }

  const claims = await verifyToken(token, env.JWT_SECRET_KEY);

  if (!claims) {
    return errors.unauthorized();
  }

  return {
    claims,
    userId: claims.sub,
    tenantId: claims.tenant_id,
    role: claims.role,
  };
}

/**
 * Require specific role or higher
 */
export function requireRole(context: AuthContext, requiredRole: Role): Response | null {
  if (!hasPermission(context.claims, requiredRole)) {
    return errors.forbidden(`Required role: ${requiredRole}`);
  }
  return null;
}

/**
 * Extract tenant ID from request (query param or auth context)
 */
export function getTenantId(request: Request, context?: AuthContext): string | null {
  if (context) {
    return context.tenantId;
  }

  const url = new URL(request.url);
  return url.searchParams.get('tenant_id');
}
