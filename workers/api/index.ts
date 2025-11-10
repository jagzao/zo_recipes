/**
 * KitchenEye API Worker
 * Main entry point for Cloudflare Workers API
 */

import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { handleCors } from '../utils/response';
import { errors } from '../utils/response';
import { authenticate, AuthContext, requireRole } from './middleware/auth';
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

      if (path === '/api/auth/signup' && request.method === 'POST') {
        return await signup(request, env);
      }

      if (path === '/api/auth/login' && request.method === 'POST') {
        return await login(request, env);
      }

      // Ingestion endpoint (secured with camera signature, not JWT)
      if (path === '/api/ingest/result' && request.method === 'POST') {
        return await ingestResult(request, env);
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

  // Auth routes
  if (path === '/api/auth/switch-tenant' && method === 'POST') {
    return await switchTenant(request, env, context.userId);
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
    const alertId = path.split('/')[3];
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
    const recipeId = path.split('/')[3];
    return await getRecipe(request, env, context.tenantId, recipeId);
  }

  // Not found
  return errors.notFound('Endpoint');
}
