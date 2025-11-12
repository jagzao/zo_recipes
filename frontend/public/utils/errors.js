/**
 * Error Handling Utilities
 * Error boundaries, error logging, and graceful error handling
 */

/**
 * Error Boundary for vanilla JavaScript
 * Wraps async functions with error handling
 */
export class ErrorBoundary {
  constructor(options = {}) {
    this.options = {
      fallback: null,
      onError: null,
      logErrors: true,
      ...options,
    };

    this.errors = [];
  }

  /**
   * Wrap an async function with error handling
   */
  wrap(fn) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, { function: fn.name, args });
        return this.options.fallback || null;
      }
    };
  }

  /**
   * Wrap a sync function with error handling
   */
  wrapSync(fn) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handleError(error, { function: fn.name, args });
        return this.options.fallback || null;
      }
    };
  }

  /**
   * Handle error
   */
  handleError(error, context = {}) {
    const errorInfo = {
      error,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // Store error
    this.errors.push(errorInfo);

    // Log error
    if (this.options.logErrors) {
      console.error('[ErrorBoundary]', error, context);
    }

    // Call error callback
    if (this.options.onError) {
      this.options.onError(error, context);
    }

    return errorInfo;
  }

  /**
   * Get all errors
   */
  getErrors() {
    return [...this.errors];
  }

  /**
   * Clear errors
   */
  clearErrors() {
    this.errors = [];
  }

  /**
   * Render error UI
   */
  renderError(error, container) {
    if (this.options.fallback) {
      if (typeof this.options.fallback === 'function') {
        container.innerHTML = this.options.fallback(error);
      } else if (typeof this.options.fallback === 'string') {
        container.innerHTML = this.options.fallback;
      }
    } else {
      container.innerHTML = this.defaultErrorUI(error);
    }
  }

  /**
   * Default error UI
   */
  defaultErrorUI(error) {
    return `
      <div class="error-boundary">
        <div class="error-icon">⚠️</div>
        <h3>Something went wrong</h3>
        <p class="error-message">${this.sanitizeHTML(error.message)}</p>
        <button onclick="window.location.reload()" class="btn btn-primary">
          Reload Page
        </button>
      </div>
    `;
  }

  /**
   * Sanitize HTML to prevent XSS
   */
  sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

/**
 * Global error logger
 */
export class ErrorLogger {
  constructor(options = {}) {
    this.options = {
      endpoint: '/api/errors',
      batchSize: 10,
      flushInterval: 30000,
      maxErrors: 100,
      ...options,
    };

    this.errors = [];
    this.setupGlobalHandlers();
    this.startAutoFlush();
  }

  /**
   * Setup global error handlers
   */
  setupGlobalHandlers() {
    // Catch uncaught errors
    window.addEventListener('error', (event) => {
      this.log(event.error || new Error(event.message), {
        type: 'uncaught',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.log(
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason)),
        {
          type: 'unhandled_rejection',
        }
      );
    });
  }

  /**
   * Log an error
   */
  log(error, context = {}) {
    if (this.errors.length >= this.options.maxErrors) {
      // Remove oldest error
      this.errors.shift();
    }

    const errorEntry = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.errors.push(errorEntry);

    // Auto-flush if batch size reached
    if (this.errors.length >= this.options.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush errors to server
   */
  async flush() {
    if (this.errors.length === 0) {
      return;
    }

    const errors = [...this.errors];
    this.errors = [];

    try {
      await fetch(this.options.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors }),
        keepalive: true,
      });
    } catch (error) {
      console.error('[ErrorLogger] Failed to send errors:', error);
      // Re-queue errors
      this.errors.unshift(...errors);
    }
  }

  /**
   * Start auto-flush interval
   */
  startAutoFlush() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.options.flushInterval);

    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flush());
  }

  /**
   * Get logged errors
   */
  getErrors() {
    return [...this.errors];
  }

  /**
   * Clear errors
   */
  clear() {
    this.errors = [];
  }
}

/**
 * Safe async wrapper
 * Returns [error, data] tuple (Go-style)
 */
export async function safe(promise) {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error, null];
  }
}

/**
 * Retry function with error handling
 */
export async function retry(fn, options = {}) {
  const {
    retries = 3,
    delay = 1000,
    backoff = 2,
    onRetry,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(backoff, attempt))
        );
      }
    }
  }

  throw lastError;
}

/**
 * Circuit breaker pattern
 * Prevents cascading failures
 */
export class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.options = {
      threshold: 5, // Failures before opening
      timeout: 60000, // Time in open state (ms)
      resetTimeout: 10000, // Time in half-open state
      ...options,
    };

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  /**
   * Execute function through circuit breaker
   */
  async execute(...args) {
    if (this.state === 'OPEN') {
      // Check if we should try half-open
      if (Date.now() - this.lastFailureTime >= this.options.timeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await this.fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle success
   */
  onSuccess() {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;

      // Close circuit after successful attempts
      if (this.successCount >= 2) {
        this.state = 'CLOSED';
      }
    }
  }

  /**
   * Handle failure
   */
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.threshold) {
      this.state = 'OPEN';
    }
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }
}

/**
 * Error notification helper
 */
export function showErrorNotification(error, options = {}) {
  const {
    title = 'Error',
    duration = 5000,
    type = 'error',
    onClose,
  } = options;

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type} fade-in`;
  notification.innerHTML = `
    <div class="notification-content">
      <strong>${title}</strong>
      <p>${error.message}</p>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">×</button>
  `;

  document.body.appendChild(notification);

  // Auto-remove
  if (duration > 0) {
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        notification.remove();
        if (onClose) onClose();
      }, 300);
    }, duration);
  }

  return notification;
}

/**
 * Error recovery helper
 * Attempts to recover from errors
 */
export class ErrorRecovery {
  constructor() {
    this.strategies = new Map();
  }

  /**
   * Register recovery strategy
   */
  register(errorType, strategy) {
    this.strategies.set(errorType, strategy);
    return this;
  }

  /**
   * Attempt recovery
   */
  async recover(error) {
    const errorType = error.name || 'Error';

    if (this.strategies.has(errorType)) {
      const strategy = this.strategies.get(errorType);
      return await strategy(error);
    }

    // Default recovery
    return this.defaultRecovery(error);
  }

  /**
   * Default recovery strategy
   */
  async defaultRecovery(error) {
    console.error('[ErrorRecovery] No recovery strategy for:', error);
    return false;
  }
}

/**
 * Global instances
 */
export const errorBoundary = new ErrorBoundary();
export const errorLogger = new ErrorLogger();
export const errorRecovery = new ErrorRecovery();

/**
 * Example usage:
 *
 * // Error boundary
 * const boundary = new ErrorBoundary({
 *   onError: (error) => showToast(error.message, 'error'),
 *   fallback: '<p>Something went wrong. Please try again.</p>'
 * });
 *
 * const safeFunction = boundary.wrap(async () => {
 *   const data = await fetchData();
 *   return data;
 * });
 *
 * // Safe wrapper
 * const [error, data] = await safe(fetchData());
 * if (error) {
 *   console.error('Failed:', error);
 * } else {
 *   console.log('Success:', data);
 * }
 *
 * // Retry with backoff
 * const data = await retry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   {
 *     retries: 3,
 *     delay: 1000,
 *     onRetry: (attempt) => console.log(`Retry ${attempt}`)
 *   }
 * );
 *
 * // Circuit breaker
 * const breaker = new CircuitBreaker(fetchData, {
 *   threshold: 5,
 *   timeout: 60000
 * });
 *
 * try {
 *   const data = await breaker.execute();
 * } catch (error) {
 *   console.error('Circuit breaker prevented execution');
 * }
 *
 * // Error recovery
 * errorRecovery.register('NetworkError', async (error) => {
 *   // Attempt to reconnect
 *   await retryConnection();
 *   return true;
 * });
 *
 * if (await errorRecovery.recover(error)) {
 *   console.log('Recovered from error!');
 * }
 */
