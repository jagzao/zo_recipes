/**
 * JWT Utilities for KitchenEye
 * Handles token generation and validation
 */

import { JWTClaims, Role } from '../../shared/types';

const ALGORITHM = 'HS256';

/**
 * Generate a JWT token for a user
 */
export async function generateToken(
  claims: Omit<JWTClaims, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds: number = 86400 // 24 hours default
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const fullClaims: JWTClaims = {
    ...claims,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = {
    alg: ALGORITHM,
    typ: 'JWT',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullClaims));
  const signature = await sign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<JWTClaims | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const expectedSignature = await sign(
      `${encodedHeader}.${encodedPayload}`,
      secret
    );

    if (signature !== expectedSignature) {
      return null;
    }

    // Decode and validate claims
    const claims = JSON.parse(base64UrlDecode(encodedPayload)) as JWTClaims;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) {
      return null;
    }

    return claims;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Create HMAC-SHA256 signature
 */
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );

  return base64UrlEncode(signature);
}

/**
 * Base64 URL-safe encode
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string;

  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    const bytes = new Uint8Array(data);
    base64 = btoa(String.fromCharCode(...bytes));
  }

  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 URL-safe decode
 */
function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/');

  // Pad with '=' to make length multiple of 4
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  return atob(base64);
}

/**
 * Extract token from Authorization header
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Check if user has required role for tenant
 */
export function hasPermission(
  claims: JWTClaims,
  requiredRole: Role
): boolean {
  const roleHierarchy: Record<Role, number> = {
    viewer: 1,
    ops: 2,
    admin: 3,
    owner: 4,
  };

  return roleHierarchy[claims.role] >= roleHierarchy[requiredRole];
}
