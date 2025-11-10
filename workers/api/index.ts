/**
 * KitchenEye API Worker
 * Main entry point for Cloudflare Workers API
 */

import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { handleCors } from '../utils/response';
import { errors } from '../utils/response';
import { authenticate, AuthContext, requireRole } from './middleware/auth';
import { rateLimitByTenant, rateLimitByIP, rateLimitByCamera } from './middleware/ratelimit';
import { handleCron } from './cron';

// Route handlers
import { signup, login, switchTenant } from './routes/auth';
import { ingestResult, healthCheck as ingestHealthCheck } from './routes/ingest';
import { searchRecipes, getRecipe } from './routes/recipes';
import {
  getGasStatus,
  getInventoryStatus,
  getCamerasStatus,
  getAlerts,
  acknowledgeAlert,
  healthCheck,
} from './routes/status';
import {
  listCameras,
  getCamera,
  createCamera,
  updateCamera,
  deleteCamera,
  calibrateCamera,
} from './routes/cameras';
import {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
} from './routes/profiles';
import {
  listInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  createSnapshot,
} from './routes/inventory';
import {
  getMissingItemsReport,
  getConsumptionReport,
  getGasHistoryReport,
  getAlertsSummaryReport,
} from './routes/reports';
import {
  getTenant,
  updateTenant,
  listTenantMembers,
  inviteUser,
  removeTenantMember,
  updateMemberRole,
  getTenantUsage,
} from './routes/tenants';

interface Env {
  DB: D1Database;
  CONFIG_KV: KVNamespace;
  IMAGES_R2: R2Bucket;
  JWT_SECRET_KEY: string;
  ENVIRONMENT: string;
  DEFAULT_TIMEZONE: string;
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    const corsResponse = handleCors(request);
    if (corsResponse) {
      return corsResponse;
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Public routes (no auth required)
      if (path === '/api/health') {
        return await healthCheck(request, env);
      }

      // Auth routes with IP-based rate limiting
      if (path === '/api/auth/signup' && request.method === 'POST') {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateLimitResponse = await rateLimitByIP(env.CONFIG_KV, ip);
        if (rateLimitResponse) return rateLimitResponse;

        return await signup(request, env);
      }

      if (path === '/api/auth/login' && request.method === 'POST') {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateLimitResponse = await rateLimitByIP(env.CONFIG_KV, ip);
        if (rateLimitResponse) return rateLimitResponse;

        return await login(request, env);
      }

      // Ingestion endpoint (secured with camera signature, not JWT)
      if (path === '/api/ingest/result' && request.method === 'POST') {
        // Rate limit by camera
        const payload = await request.json();
        const cameraId = (payload as any).camera_id;
        if (cameraId) {
          const rateLimitResponse = await rateLimitByCamera(env.CONFIG_KV, cameraId);
          if (rateLimitResponse) return rateLimitResponse;
        }

        // Re-create request with the body
        const newRequest = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(payload),
        });

        return await ingestResult(newRequest, env);
      }

      if (path === '/api/ingest/health' && request.method === 'POST') {
        return await ingestHealthCheck(request, env);
      }

      // All other routes require authentication
      const authResult = await authenticate(request, env);
      if (authResult instanceof Response) {
        return authResult;
      }

      const context = authResult as AuthContext;

      // Apply tenant-based rate limiting
      const rateLimitResponse = await rateLimitByTenant(env.CONFIG_KV, context.tenantId);
      if (rateLimitResponse) return rateLimitResponse;

      // Route to handlers
      return await router(request, env, context, path);
    } catch (err) {
      console.error('Request error:', err);
      return errors.serverError();
    }
  },

  /**
   * Scheduled cron handler
   */
  async scheduled(event: any, env: Env): Promise<void> {
    await handleCron(event, env);
  },
};

/**
 * Router for authenticated routes
 */
async function router(
  request: Request,
  env: Env,
  context: AuthContext,
  path: string
): Promise<Response> {
  const method = request.method;
  const parts = path.split('/').filter(p => p);

  // Auth routes
  if (path === '/api/auth/switch-tenant' && method === 'POST') {
    return await switchTenant(request, env, context.userId);
  }

  // Tenant routes
  if (parts[0] === 'api' && parts[1] === 'tenants' && parts[2]) {
    const tenantId = parts[2];

    // Verify tenant access
    if (tenantId !== context.tenantId) {
      return errors.forbidden('Access denied to this tenant');
    }

    if (parts.length === 3 && method === 'GET') {
      return await getTenant(request, env, tenantId);
    }

    if (parts.length === 3 && method === 'PATCH') {
      const roleCheck = requireRole(context, 'admin');
      if (roleCheck) return roleCheck;
      return await updateTenant(request, env, tenantId, context.userId);
    }

    if (parts[3] === 'members' && method === 'GET') {
      return await listTenantMembers(request, env, tenantId);
    }

    if (parts[3] === 'invite' && method === 'POST') {
      const roleCheck = requireRole(context, 'admin');
      if (roleCheck) return roleCheck;
      return await inviteUser(request, env, tenantId, context.userId);
    }

    if (parts[3] === 'members' && parts[4] && method === 'DELETE') {
      const roleCheck = requireRole(context, 'admin');
      if (roleCheck) return roleCheck;
      return await removeTenantMember(request, env, tenantId, parts[4], context.userId);
    }

    if (parts[3] === 'members' && parts[4] && parts[5] === 'role' && method === 'PATCH') {
      const roleCheck = requireRole(context, 'admin');
      if (roleCheck) return roleCheck;
      return await updateMemberRole(request, env, tenantId, parts[4], context.userId);
    }

    if (parts[3] === 'usage' && method === 'GET') {
      return await getTenantUsage(request, env, tenantId);
    }
  }

  // Camera routes
  if (parts[0] === 'api' && parts[1] === 'cameras') {
    if (parts.length === 2 && method === 'GET') {
      return await listCameras(request, env, context.tenantId);
    }

    if (parts.length === 2 && method === 'POST') {
      const roleCheck = requireRole(context, 'admin');
      if (roleCheck) return roleCheck;
      return await createCamera(request, env, context.tenantId, context.userId);
    }

    if (parts[2] && method === 'GET') {
      return await getCamera(request, env, context.tenantId, parts[2]);
    }

    if (parts[2] && method === 'PATCH') {
      const roleCheck = requireRole(context, 'ops');
      if (roleCheck) return roleCheck;
      return await updateCamera(request, env, context.tenantId, parts[2], context.userId);
    }

    if (parts[2] && method === 'DELETE') {
      const roleCheck = requireRole(context, 'admin');
      if (roleCheck) return roleCheck;
      return await deleteCamera(request, env, context.tenantId, parts[2], context.userId);
    }

    if (parts[2] && parts[3] === 'calibrate' && method === 'POST') {
      const roleCheck = requireRole(context, 'ops');
      if (roleCheck) return roleCheck;
      return await calibrateCamera(request, env, context.tenantId, parts[2], context.userId);
    }
  }

  // Profile routes
  if (parts[0] === 'api' && parts[1] === 'profiles') {
    if (parts.length === 2 && method === 'GET') {
      return await listProfiles(request, env, context.tenantId);
    }

    if (parts.length === 2 && method === 'POST') {
      return await createProfile(request, env, context.tenantId, context.userId);
    }

    if (parts[2] && method === 'GET') {
      return await getProfile(request, env, context.tenantId, parts[2]);
    }

    if (parts[2] && method === 'PATCH') {
      return await updateProfile(request, env, context.tenantId, parts[2], context.userId);
    }

    if (parts[2] && method === 'DELETE') {
      return await deleteProfile(request, env, context.tenantId, parts[2], context.userId);
    }
  }

  // Inventory routes
  if (parts[0] === 'api' && parts[1] === 'inventory') {
    if (parts[2] === 'items' && parts.length === 3 && method === 'GET') {
      return await listInventoryItems(request, env, context.tenantId);
    }

    if (parts[2] === 'items' && parts.length === 3 && method === 'POST') {
      return await createInventoryItem(request, env, context.tenantId, context.userId);
    }

    if (parts[2] === 'items' && parts[3] && parts.length === 4 && method === 'GET') {
      return await getInventoryItem(request, env, context.tenantId, parts[3]);
    }

    if (parts[2] === 'items' && parts[3] && parts.length === 4 && method === 'PATCH') {
      return await updateInventoryItem(request, env, context.tenantId, parts[3], context.userId);
    }

    if (parts[2] === 'items' && parts[3] && parts.length === 4 && method === 'DELETE') {
      return await deleteInventoryItem(request, env, context.tenantId, parts[3], context.userId);
    }

    if (parts[2] === 'items' && parts[3] && parts[4] === 'snapshot' && method === 'POST') {
      return await createSnapshot(request, env, context.tenantId, parts[3], context.userId);
    }
  }

  // Report routes
  if (parts[0] === 'api' && parts[1] === 'reports') {
    if (parts[2] === 'missing-items' && method === 'GET') {
      return await getMissingItemsReport(request, env, context.tenantId);
    }

    if (parts[2] === 'consumption' && method === 'GET') {
      return await getConsumptionReport(request, env, context.tenantId);
    }

    if (parts[2] === 'gas-history' && method === 'GET') {
      return await getGasHistoryReport(request, env, context.tenantId);
    }

    if (parts[2] === 'alerts-summary' && method === 'GET') {
      return await getAlertsSummaryReport(request, env, context.tenantId);
    }
  }

  // Status routes
  if (path === '/api/status/gas' && method === 'GET') {
    return await getGasStatus(request, env, context.tenantId);
  }

  if (path === '/api/status/inventory' && method === 'GET') {
    return await getInventoryStatus(request, env, context.tenantId);
  }

  if (path === '/api/status/cameras' && method === 'GET') {
    return await getCamerasStatus(request, env, context.tenantId);
  }

  // Alerts routes
  if (path === '/api/alerts' && method === 'GET') {
    return await getAlerts(request, env, context.tenantId);
  }

  if (path.startsWith('/api/alerts/') && path.endsWith('/ack') && method === 'POST') {
    const alertId = parts[2];
    return await acknowledgeAlert(
      request,
      env,
      context.tenantId,
      alertId,
      context.userId
    );
  }

  // Recipe routes
  if (path === '/api/recipes' && method === 'GET') {
    return await searchRecipes(request, env, context.tenantId);
  }

  if (path.startsWith('/api/recipes/') && method === 'GET') {
    const recipeId = parts[2];
    return await getRecipe(request, env, context.tenantId, recipeId);
  }

  // Not found
  return errors.notFound('Endpoint');
}
