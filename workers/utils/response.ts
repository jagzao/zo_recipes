/**
 * API Response Utilities
 * Standardized response formatting
 */

import { ApiResponse, PaginatedResponse } from '../../shared/types';

/**
 * Create a successful API response
 */
export function success<T>(data: T, meta?: Record<string, any>): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      ...meta,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Create a paginated API response
 */
export function paginated<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  }
): Response {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination: {
      ...pagination,
      has_more: pagination.page * pagination.limit < pagination.total,
    },
    meta: {
      timestamp: Date.now(),
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Create an error response
 */
export function error(
  code: string,
  message: string,
  status: number = 400,
  details?: any
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: Date.now(),
    },
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Common error responses
 */
export const errors = {
  unauthorized: () =>
    error('UNAUTHORIZED', 'Authentication required', 401),

  forbidden: (message = 'Access denied') =>
    error('FORBIDDEN', message, 403),

  notFound: (resource = 'Resource') =>
    error('NOT_FOUND', `${resource} not found`, 404),

  badRequest: (message: string, details?: any) =>
    error('BAD_REQUEST', message, 400, details),

  conflict: (message: string) =>
    error('CONFLICT', message, 409),

  rateLimited: (retryAfter?: number) => {
    const response = error(
      'RATE_LIMITED',
      'Too many requests, please try again later',
      429
    );

    if (retryAfter) {
      const headers = new Headers(response.headers);
      headers.set('Retry-After', retryAfter.toString());
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    return response;
  },

  limitExceeded: (limitType: string, limit: number) =>
    error(
      'LIMIT_EXCEEDED',
      `${limitType} limit exceeded (max: ${limit})`,
      402
    ),

  serverError: (message = 'Internal server error') =>
    error('INTERNAL_ERROR', message, 500),
};

/**
 * CORS headers for responses
 */
export function corsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight
 */
export function handleCors(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request.headers.get('Origin') || undefined),
    });
  }
  return null;
}
