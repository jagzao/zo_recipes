/**
 * Request Utilities
 * Request deduplication, offline queue, and advanced fetch utilities
 */

/**
 * Request Deduplicator
 * Prevents duplicate in-flight requests
 */
export class RequestDeduplicator {
  constructor() {
    this.pending = new Map();
  }

  /**
   * Execute request with deduplication
   * @param {string} key - Unique key for this request
   * @param {Function} requestFn - Function that returns a Promise
   * @returns {Promise} - Shared promise for all callers
   */
  async dedupe(key, requestFn) {
    // Return existing pending request
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    // Create new request
    const promise = requestFn()
      .then((result) => {
        this.pending.delete(key);
        return result;
      })
      .catch((error) => {
        this.pending.delete(key);
        throw error;
      });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Clear specific key
   */
  clear(key) {
    this.pending.delete(key);
  }

  /**
   * Clear all pending requests
   */
  clearAll() {
    this.pending.clear();
  }

  /**
   * Check if request is pending
   */
  isPending(key) {
    return this.pending.has(key);
  }

  /**
   * Get all pending keys
   */
  getPendingKeys() {
    return Array.from(this.pending.keys());
  }
}

/**
 * Global deduplicator instance
 */
export const requestDedup = new RequestDeduplicator();

/**
 * Deduplicated fetch
 * Automatically deduplicates identical requests
 *
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @param {Object} dedupOptions - Deduplication options
 * @returns {Promise} - Fetch promise
 */
export function dedupFetch(url, options = {}, dedupOptions = {}) {
  const { key = `${options.method || 'GET'}:${url}`, dedup = requestDedup } = dedupOptions;

  return dedup.dedupe(key, () => fetch(url, options));
}

/**
 * Offline Queue
 * Queues requests when offline and retries when back online
 */
export class OfflineQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processing = false;
    this.options = {
      maxSize: 100,
      maxRetries: 3,
      retryDelay: 1000,
      storageKey: 'offline-queue',
      ...options,
    };

    // Load queue from storage
    this.loadFromStorage();

    // Listen for online/offline events
    window.addEventListener('online', () => this.processQueue());
    window.addEventListener('offline', () => this.onOffline());
  }

  /**
   * Add request to queue
   */
  async enqueue(request) {
    // Check queue size
    if (this.queue.length >= this.options.maxSize) {
      throw new Error('Queue is full');
    }

    const queuedRequest = {
      id: `${Date.now()}_${Math.random()}`,
      ...request,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
    };

    this.queue.push(queuedRequest);
    this.saveToStorage();

    // Try to process if online
    if (navigator.onLine) {
      this.processQueue();
    }

    return queuedRequest.id;
  }

  /**
   * Process queue
   */
  async processQueue() {
    if (this.processing || !navigator.onLine) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && navigator.onLine) {
      const request = this.queue[0];

      try {
        // Execute request
        const result = await this.executeRequest(request);

        // Success - remove from queue
        this.queue.shift();
        this.saveToStorage();

        // Call success callback
        if (request.onSuccess) {
          request.onSuccess(result);
        }
      } catch (error) {
        // Increment retries
        request.retries++;

        if (request.retries >= this.options.maxRetries) {
          // Max retries reached - remove and call error callback
          this.queue.shift();
          this.saveToStorage();

          if (request.onError) {
            request.onError(error);
          }
        } else {
          // Retry later
          await new Promise((resolve) =>
            setTimeout(resolve, this.options.retryDelay)
          );
        }
      }
    }

    this.processing = false;
  }

  /**
   * Execute a queued request
   */
  async executeRequest(request) {
    const { url, method = 'GET', body, headers = {} } = request;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Handle offline event
   */
  onOffline() {
    console.log('[OfflineQueue] Device went offline');
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      size: this.queue.length,
      processing: this.processing,
      online: navigator.onLine,
      items: this.queue.map((r) => ({
        id: r.id,
        url: r.url,
        method: r.method,
        retries: r.retries,
        timestamp: r.timestamp,
      })),
    };
  }

  /**
   * Clear queue
   */
  clear() {
    this.queue = [];
    this.saveToStorage();
  }

  /**
   * Save queue to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(
        this.options.storageKey,
        JSON.stringify(
          this.queue.map((r) => ({
            id: r.id,
            url: r.url,
            method: r.method,
            body: r.body,
            headers: r.headers,
            timestamp: r.timestamp,
            retries: r.retries,
          }))
        )
      );
    } catch (error) {
      console.error('[OfflineQueue] Failed to save to storage:', error);
    }
  }

  /**
   * Load queue from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.options.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load from storage:', error);
    }
  }
}

/**
 * Global offline queue instance
 */
export const offlineQueue = new OfflineQueue();

/**
 * Fetch with automatic offline queueing
 */
export async function fetchWithQueue(url, options = {}, queueOptions = {}) {
  if (!navigator.onLine) {
    // Queue for later
    return offlineQueue.enqueue({
      url,
      method: options.method || 'GET',
      body: options.body,
      headers: options.headers,
      ...queueOptions,
    });
  }

  // Execute immediately
  return fetch(url, options);
}

/**
 * Batch Requests
 * Combine multiple requests into a single batch
 */
export class BatchRequester {
  constructor(options = {}) {
    this.options = {
      batchSize: 10,
      batchDelay: 50, // ms
      endpoint: '/api/batch',
      ...options,
    };

    this.queue = [];
    this.timer = null;
  }

  /**
   * Add request to batch
   */
  async request(url, options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        url,
        options,
        resolve,
        reject,
      });

      // Schedule batch
      this.scheduleBatch();
    });
  }

  /**
   * Schedule batch execution
   */
  scheduleBatch() {
    if (this.timer) {
      return;
    }

    this.timer = setTimeout(() => {
      this.executeBatch();
    }, this.options.batchDelay);
  }

  /**
   * Execute batch
   */
  async executeBatch() {
    this.timer = null;

    if (this.queue.length === 0) {
      return;
    }

    // Take items from queue
    const batch = this.queue.splice(0, this.options.batchSize);

    try {
      // Send batch request
      const response = await fetch(this.options.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map((r) => ({
            url: r.url,
            method: r.options.method || 'GET',
            body: r.options.body,
            headers: r.options.headers,
          })),
        }),
      });

      const results = await response.json();

      // Resolve individual promises
      batch.forEach((item, index) => {
        const result = results[index];
        if (result.success) {
          item.resolve(result.data);
        } else {
          item.reject(new Error(result.error));
        }
      });
    } catch (error) {
      // Reject all on batch error
      batch.forEach((item) => item.reject(error));
    }

    // Process remaining queue
    if (this.queue.length > 0) {
      this.scheduleBatch();
    }
  }
}

/**
 * Request cache with stale-while-revalidate
 */
export class RequestCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.options = {
      maxAge: 60000, // 1 minute
      maxSize: 100,
      ...options,
    };
  }

  /**
   * Fetch with cache
   */
  async fetch(key, fetchFn, options = {}) {
    const { maxAge = this.options.maxAge, force = false } = options;

    const cached = this.cache.get(key);
    const now = Date.now();

    // Return fresh cache
    if (cached && !force && now - cached.timestamp < maxAge) {
      return cached.data;
    }

    // Return stale cache while revalidating
    if (cached && now - cached.timestamp < maxAge * 2) {
      // Return stale data immediately
      const staleData = cached.data;

      // Revalidate in background
      fetchFn()
        .then((data) => {
          this.set(key, data);
        })
        .catch(() => {
          // Keep stale data on error
        });

      return staleData;
    }

    // Fetch fresh data
    const data = await fetchFn();
    this.set(key, data);
    return data;
  }

  /**
   * Set cache entry
   */
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Enforce max size (LRU)
    if (this.cache.size > this.options.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Get cache entry
   */
  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    return cached.data;
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Delete entry
   */
  delete(key) {
    this.cache.delete(key);
  }
}

/**
 * Global request cache
 */
export const requestCache = new RequestCache();

/**
 * Example usage:
 *
 * // Request deduplication
 * const data1 = dedupFetch('/api/users/1');
 * const data2 = dedupFetch('/api/users/1'); // Reuses same request
 *
 * // Offline queue
 * await fetchWithQueue('/api/sync', {
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'test' })
 * }, {
 *   onSuccess: () => console.log('Synced!'),
 *   onError: (err) => console.error('Failed:', err)
 * });
 *
 * // Request cache with SWR
 * const data = await requestCache.fetch(
 *   'users-list',
 *   () => fetch('/api/users').then(r => r.json()),
 *   { maxAge: 60000 }
 * );
 */
