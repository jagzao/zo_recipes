/**
 * Rate Limiting Middleware
 * Uses KV for distributed rate limiting
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import { errors } from '../../utils/response';

interface RateLimitConfig {
  requests: number;
  window: number; // seconds
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  api: { requests: 100, window: 60 }, // 100 req/min per tenant
  auth: { requests: 10, window: 60 }, // 10 req/min per IP
  ingest: { requests: 1000, window: 3600 }, // 1000 req/hour per camera
};

/**
 * Rate limit by tenant ID
 */
export async function rateLimitByTenant(
  kv: KVNamespace,
  tenantId: string,
  limit: RateLimitConfig = DEFAULT_LIMITS.api
): Promise<Response | null> {
  const key = `ratelimit:tenant:${tenantId}`;
  return await checkRateLimit(kv, key, limit);
}

/**
 * Rate limit by IP address (for auth endpoints)
 */
export async function rateLimitByIP(
  kv: KVNamespace,
  ip: string,
  limit: RateLimitConfig = DEFAULT_LIMITS.auth
): Promise<Response | null> {
  const key = `ratelimit:ip:${ip}`;
  return await checkRateLimit(kv, key, limit);
}

/**
 * Rate limit by camera ID (for ingestion)
 */
export async function rateLimitByCamera(
  kv: KVNamespace,
  cameraId: string,
  limit: RateLimitConfig = DEFAULT_LIMITS.ingest
): Promise<Response | null> {
  const key = `ratelimit:camera:${cameraId}`;
  return await checkRateLimit(kv, key, limit);
}

/**
 * Core rate limiting logic
 */
async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: RateLimitConfig
): Promise<Response | null> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - limit.window;

  // Get current count
  const data = await kv.get(key, 'json') as { count: number; reset: number } | null;

  if (!data || data.reset < now) {
    // First request or window expired - reset
    await kv.put(
      key,
      JSON.stringify({ count: 1, reset: now + limit.window }),
      { expirationTtl: limit.window + 60 } // Extra 60s for safety
    );
    return null; // Allow request
  }

  if (data.count >= limit.requests) {
    // Rate limit exceeded
    const retryAfter = data.reset - now;
    return errors.rateLimited(retryAfter);
  }

  // Increment counter
  await kv.put(
    key,
    JSON.stringify({ count: data.count + 1, reset: data.reset }),
    { expirationTtl: limit.window + 60 }
  );

  return null; // Allow request
}

/**
 * Get current rate limit status
 */
export async function getRateLimitStatus(
  kv: KVNamespace,
  key: string,
  limit: RateLimitConfig
): Promise<{
  remaining: number;
  reset: number;
  limit: number;
}> {
  const data = await kv.get(key, 'json') as { count: number; reset: number } | null;
  const now = Math.floor(Date.now() / 1000);

  if (!data || data.reset < now) {
    return {
      remaining: limit.requests,
      reset: now + limit.window,
      limit: limit.requests,
    };
  }

  return {
    remaining: Math.max(0, limit.requests - data.count),
    reset: data.reset,
    limit: limit.requests,
  };
}
