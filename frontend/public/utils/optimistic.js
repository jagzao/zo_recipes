/**
 * Optimistic UI Utilities
 * Implement instant UI updates with rollback on failure
 */

/**
 * Execute an optimistic update with automatic rollback
 * @param {Function} updateFn - Function to update UI optimistically
 * @param {Function} asyncFn - Async function to execute (API call)
 * @param {Function} rollbackFn - Function to rollback on error
 * @param {Object} options - Configuration options
 * @returns {Promise} - Resolves with API result or rejects with error
 */
export async function optimisticUpdate(
  updateFn,
  asyncFn,
  rollbackFn,
  options = {}
) {
  const { timeout = 10000, onError, onSuccess } = options;

  // Take snapshot of current state
  const snapshot = rollbackFn ? rollbackFn() : null;

  try {
    // Execute optimistic update immediately
    updateFn();

    // Execute async operation with timeout
    const result = await Promise.race([
      asyncFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);

    // Success callback
    if (onSuccess) {
      onSuccess(result);
    }

    return result;
  } catch (error) {
    // Rollback on error
    if (rollbackFn && snapshot) {
      rollbackFn(snapshot);
    }

    // Error callback
    if (onError) {
      onError(error);
    }

    throw error;
  }
}

/**
 * Optimistic list operations
 */
export class OptimisticList {
  constructor(initialItems = []) {
    this.items = [...initialItems];
    this.listeners = new Set();
    this.pendingOps = new Map();
  }

  /**
   * Subscribe to changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notify() {
    this.listeners.forEach((cb) => cb(this.items));
  }

  /**
   * Add item optimistically
   */
  async add(item, asyncFn) {
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const optimisticItem = { ...item, id: tempId, _optimistic: true };

    // Add immediately
    this.items.push(optimisticItem);
    this.notify();

    try {
      // Execute async operation
      const result = await asyncFn(item);

      // Replace temp item with real item
      const index = this.items.findIndex((i) => i.id === tempId);
      if (index !== -1) {
        this.items[index] = { ...result, _optimistic: false };
        this.notify();
      }

      return result;
    } catch (error) {
      // Remove on error
      this.items = this.items.filter((i) => i.id !== tempId);
      this.notify();
      throw error;
    }
  }

  /**
   * Update item optimistically
   */
  async update(id, updates, asyncFn) {
    const index = this.items.findIndex((i) => i.id === id);
    if (index === -1) throw new Error('Item not found');

    // Store original
    const original = { ...this.items[index] };

    // Update immediately
    this.items[index] = { ...this.items[index], ...updates, _optimistic: true };
    this.notify();

    try {
      // Execute async operation
      const result = await asyncFn(id, updates);

      // Update with server response
      const currentIndex = this.items.findIndex((i) => i.id === id);
      if (currentIndex !== -1) {
        this.items[currentIndex] = { ...result, _optimistic: false };
        this.notify();
      }

      return result;
    } catch (error) {
      // Rollback on error
      const currentIndex = this.items.findIndex((i) => i.id === id);
      if (currentIndex !== -1) {
        this.items[currentIndex] = original;
        this.notify();
      }
      throw error;
    }
  }

  /**
   * Delete item optimistically
   */
  async delete(id, asyncFn) {
    const index = this.items.findIndex((i) => i.id === id);
    if (index === -1) throw new Error('Item not found');

    // Store original
    const original = { ...this.items[index] };

    // Mark as deleted immediately
    this.items[index] = { ...this.items[index], _deleting: true };
    this.notify();

    // Remove from UI after a brief delay (smooth animation)
    setTimeout(() => {
      this.items = this.items.filter((i) => i.id !== id);
      this.notify();
    }, 300);

    try {
      // Execute async operation
      await asyncFn(id);
      return true;
    } catch (error) {
      // Restore on error
      this.items = this.items.filter((i) => i.id !== id);
      this.items.splice(index, 0, original);
      this.notify();
      throw error;
    }
  }

  /**
   * Get all items
   */
  getItems() {
    return [...this.items];
  }

  /**
   * Set items
   */
  setItems(items) {
    this.items = [...items];
    this.notify();
  }

  /**
   * Clear all items
   */
  clear() {
    this.items = [];
    this.notify();
  }
}

/**
 * Optimistic toggle (for checkboxes, switches)
 */
export async function optimisticToggle(
  currentValue,
  updateFn,
  asyncFn,
  options = {}
) {
  const newValue = !currentValue;

  return optimisticUpdate(
    () => updateFn(newValue),
    () => asyncFn(newValue),
    () => updateFn(currentValue),
    options
  );
}

/**
 * Batch optimistic updates
 */
export class OptimisticBatch {
  constructor() {
    this.operations = [];
    this.snapshots = [];
  }

  /**
   * Add operation to batch
   */
  add(updateFn, asyncFn, rollbackFn) {
    this.operations.push({ updateFn, asyncFn, rollbackFn });
  }

  /**
   * Execute all operations
   */
  async execute(options = {}) {
    const { stopOnError = false } = options;

    // Execute all updates immediately
    this.operations.forEach(({ updateFn }) => {
      updateFn();
    });

    const results = [];
    const errors = [];

    // Execute all async operations
    for (let i = 0; i < this.operations.length; i++) {
      try {
        const result = await this.operations[i].asyncFn();
        results.push(result);
      } catch (error) {
        errors.push({ index: i, error });

        // Rollback this operation
        if (this.operations[i].rollbackFn) {
          this.operations[i].rollbackFn();
        }

        // Stop on first error if requested
        if (stopOnError) {
          // Rollback all previous operations
          for (let j = 0; j < i; j++) {
            if (this.operations[j].rollbackFn) {
              this.operations[j].rollbackFn();
            }
          }
          throw error;
        }
      }
    }

    return { results, errors };
  }

  /**
   * Clear batch
   */
  clear() {
    this.operations = [];
    this.snapshots = [];
  }
}

/**
 * Example usage:
 *
 * // Simple optimistic update
 * await optimisticUpdate(
 *   () => setLiked(true),
 *   () => apiCall('/api/like', { postId: 123 }),
 *   () => setLiked(false),
 *   {
 *     onError: (err) => showToast('Failed to like', 'error'),
 *     onSuccess: () => showToast('Liked!', 'success')
 *   }
 * );
 *
 * // Optimistic list
 * const list = new OptimisticList(initialItems);
 * list.subscribe((items) => renderList(items));
 *
 * await list.add(
 *   { name: 'New Item' },
 *   (item) => fetch('/api/items', { method: 'POST', body: JSON.stringify(item) })
 * );
 *
 * // Optimistic toggle
 * await optimisticToggle(
 *   isEnabled,
 *   (value) => setIsEnabled(value),
 *   (value) => fetch('/api/toggle', { method: 'POST', body: JSON.stringify({ enabled: value }) })
 * );
 */
