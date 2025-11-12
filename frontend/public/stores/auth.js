/**
 * Authentication Store (Nanostores)
 * Lightweight state management for auth - 1KB
 */

import { atom, computed } from 'nanostores';

// ============================================
// ATOMS (Writable stores)
// ============================================

export const $token = atom(localStorage.getItem('token'));
export const $user = atom(JSON.parse(localStorage.getItem('user') || 'null'));
export const $tenant = atom(JSON.parse(localStorage.getItem('tenant') || 'null'));

// ============================================
// COMPUTED (Derived stores)
// ============================================

export const $isAuthenticated = computed($token, (token) => !!token);

export const $userRole = computed($user, (user) => user?.role || 'viewer');

export const $canManageCameras = computed($userRole, (role) =>
  ['owner', 'admin', 'ops'].includes(role)
);

export const $canManageTeam = computed($userRole, (role) =>
  ['owner', 'admin'].includes(role)
);

export const $canViewReports = computed($userRole, (role) =>
  ['owner', 'admin', 'ops'].includes(role)
);

export const $isOwner = computed($userRole, (role) => role === 'owner');

// ============================================
// ACTIONS
// ============================================

/**
 * Set authentication data
 */
export function setAuth({ token, user, tenant }) {
  if (token) {
    $token.set(token);
    localStorage.setItem('token', token);
  }

  if (user) {
    $user.set(user);
    localStorage.setItem('user', JSON.stringify(user));
  }

  if (tenant) {
    $tenant.set(tenant);
    localStorage.setItem('tenant', JSON.stringify(tenant));
  }
}

/**
 * Clear authentication data
 */
export function clearAuth() {
  $token.set(null);
  $user.set(null);
  $tenant.set(null);

  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('tenant');
}

/**
 * Update user profile
 */
export function updateUser(updates) {
  const currentUser = $user.get();
  const updatedUser = { ...currentUser, ...updates };
  $user.set(updatedUser);
  localStorage.setItem('user', JSON.stringify(updatedUser));
}

/**
 * Switch tenant
 */
export function switchTenant(tenant) {
  $tenant.set(tenant);
  localStorage.setItem('tenant', JSON.stringify(tenant));
}
