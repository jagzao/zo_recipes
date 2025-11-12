/**
 * UI Store (Nanostores)
 * Manages application UI state
 */

import { atom, computed, map } from 'nanostores';

// ============================================
// ATOMS
// ============================================

export const $currentPage = atom('home');
export const $isLoading = atom(false);
export const $isSidebarOpen = atom(false);

// ============================================
// MAPS (Object stores)
// ============================================

// Active modals: { modalId: boolean }
export const $modals = map({});

// Toast notifications: array of { id, type, message }
export const $toasts = map({
  list: [],
  nextId: 1,
});

// ============================================
// COMPUTED
// ============================================

export const $hasActiveModal = computed($modals, (modals) =>
  Object.values(modals).some((isOpen) => isOpen)
);

export const $toastList = computed($toasts, (toasts) => toasts.list);

// ============================================
// ACTIONS - Page Navigation
// ============================================

/**
 * Navigate to a page
 */
export function navigateTo(page) {
  $currentPage.set(page);

  // Update URL hash without triggering hashchange
  history.replaceState(null, '', `#${page}`);
}

/**
 * Set loading state
 */
export function setLoading(isLoading) {
  $isLoading.set(isLoading);
}

// ============================================
// ACTIONS - Modals
// ============================================

/**
 * Open a modal
 */
export function openModal(modalId) {
  $modals.setKey(modalId, true);

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

/**
 * Close a modal
 */
export function closeModal(modalId) {
  $modals.setKey(modalId, false);

  // Re-enable body scroll if no modals are open
  setTimeout(() => {
    const modals = $modals.get();
    const hasOpenModal = Object.values(modals).some((isOpen) => isOpen);
    if (!hasOpenModal) {
      document.body.style.overflow = '';
    }
  }, 100);
}

/**
 * Close all modals
 */
export function closeAllModals() {
  $modals.set({});
  document.body.style.overflow = '';
}

// ============================================
// ACTIONS - Toast Notifications
// ============================================

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - Duration in ms (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  const toasts = $toasts.get();
  const id = toasts.nextId;

  const toast = {
    id,
    message,
    type,
    timestamp: Date.now(),
  };

  // Add toast to list
  $toasts.set({
    list: [...toasts.list, toast],
    nextId: id + 1,
  });

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  return id;
}

/**
 * Remove a toast by ID
 */
export function removeToast(id) {
  const toasts = $toasts.get();
  $toasts.set({
    ...toasts,
    list: toasts.list.filter((toast) => toast.id !== id),
  });
}

/**
 * Clear all toasts
 */
export function clearToasts() {
  $toasts.set({
    list: [],
    nextId: 1,
  });
}

// ============================================
// ACTIONS - Sidebar
// ============================================

/**
 * Toggle sidebar
 */
export function toggleSidebar() {
  $isSidebarOpen.set(!$isSidebarOpen.get());
}

/**
 * Close sidebar
 */
export function closeSidebar() {
  $isSidebarOpen.set(false);
}
