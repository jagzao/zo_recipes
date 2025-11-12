/**
 * Timing Utilities
 * Debounce, throttle, and other timing-related utilities
 */

/**
 * Debounce a function
 * Delays execution until after wait milliseconds have elapsed since the last call
 * Perfect for: search inputs, window resize, scroll events
 *
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {Object} options - Configuration options
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait = 300, options = {}) {
  const { leading = false, trailing = true, maxWait } = options;

  let timeout;
  let lastCallTime;
  let lastInvokeTime = 0;
  let lastArgs;
  let lastThis;
  let result;

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    // Restart timer
    timeout = setTimeout(timerExpired, remainingWait(time));
  }

  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function leadingEdge(time) {
    lastInvokeTime = time;
    timeout = setTimeout(timerExpired, wait);
    return leading ? invokeFunc(time) : result;
  }

  function trailingEdge(time) {
    timeout = undefined;
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timeout = undefined;
  }

  function flush() {
    return timeout === undefined ? result : trailingEdge(Date.now());
  }

  function pending() {
    return timeout !== undefined;
  }

  function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timeout === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxWait) {
        timeout = setTimeout(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timeout === undefined) {
      timeout = setTimeout(timerExpired, wait);
    }
    return result;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;

  return debounced;
}

/**
 * Throttle a function
 * Ensures function is called at most once per wait period
 * Perfect for: scroll events, mouse move, resize
 *
 * @param {Function} func - Function to throttle
 * @param {number} wait - Wait time in milliseconds
 * @param {Object} options - Configuration options
 * @returns {Function} - Throttled function
 */
export function throttle(func, wait = 300, options = {}) {
  const { leading = true, trailing = true } = options;

  return debounce(func, wait, {
    leading,
    trailing,
    maxWait: wait,
  });
}

/**
 * Request Animation Frame throttle
 * Throttles to browser paint cycles (~60fps)
 * Perfect for: scroll animations, drag operations
 *
 * @param {Function} func - Function to throttle
 * @returns {Function} - RAF throttled function
 */
export function rafThrottle(func) {
  let rafId = null;
  let lastArgs = null;

  function throttled(...args) {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, lastArgs);
        rafId = null;
      });
    }
  }

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  return throttled;
}

/**
 * Delay execution
 * Returns a promise that resolves after specified time
 *
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise} - Resolves after delay
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 *
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Configuration options
 * @returns {Promise} - Resolves with result or rejects after max retries
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    onRetry,
  } = options;

  let lastError;
  let currentDelay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt + 1, currentDelay, error);
        }

        await delay(currentDelay);
        currentDelay = Math.min(currentDelay * factor, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Rate limiter
 * Limits function calls to specified rate
 */
export class RateLimiter {
  constructor(maxCalls, timeWindow) {
    this.maxCalls = maxCalls;
    this.timeWindow = timeWindow;
    this.calls = [];
  }

  /**
   * Check if call is allowed
   */
  isAllowed() {
    const now = Date.now();
    this.calls = this.calls.filter((time) => now - time < this.timeWindow);
    return this.calls.length < this.maxCalls;
  }

  /**
   * Try to execute function
   */
  tryCall(func) {
    if (this.isAllowed()) {
      this.calls.push(Date.now());
      return func();
    }
    throw new Error('Rate limit exceeded');
  }

  /**
   * Reset rate limiter
   */
  reset() {
    this.calls = [];
  }
}

/**
 * Timeout wrapper
 * Wraps a promise with timeout
 *
 * @param {Promise} promise - Promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Error message
 * @returns {Promise} - Resolves/rejects with timeout
 */
export function withTimeout(promise, ms, message = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

/**
 * Memoize with TTL (Time To Live)
 *
 * @param {Function} func - Function to memoize
 * @param {Object} options - Configuration options
 * @returns {Function} - Memoized function
 */
export function memoizeWithTTL(func, options = {}) {
  const { ttl = 5000, maxSize = 100, keyFn = (...args) => JSON.stringify(args) } = options;

  const cache = new Map();

  function cleanup() {
    const now = Date.now();
    for (const [key, { timestamp }] of cache.entries()) {
      if (now - timestamp > ttl) {
        cache.delete(key);
      }
    }

    // Enforce max size (LRU)
    if (cache.size > maxSize) {
      const entriesToDelete = cache.size - maxSize;
      const keys = Array.from(cache.keys());
      for (let i = 0; i < entriesToDelete; i++) {
        cache.delete(keys[i]);
      }
    }
  }

  function memoized(...args) {
    const key = keyFn(...args);
    const now = Date.now();

    if (cache.has(key)) {
      const { value, timestamp } = cache.get(key);
      if (now - timestamp < ttl) {
        return value;
      }
      cache.delete(key);
    }

    const value = func.apply(this, args);
    cache.set(key, { value, timestamp: now });

    // Periodic cleanup
    if (Math.random() < 0.1) {
      cleanup();
    }

    return value;
  }

  memoized.clear = () => cache.clear();
  memoized.delete = (...args) => cache.delete(keyFn(...args));
  memoized.has = (...args) => cache.has(keyFn(...args));

  return memoized;
}

/**
 * Example usage:
 *
 * // Debounce search input
 * const debouncedSearch = debounce((query) => {
 *   fetchResults(query);
 * }, 500);
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 *
 * // Throttle scroll handler
 * const throttledScroll = throttle(() => {
 *   console.log('Scrolled!');
 * }, 200);
 * window.addEventListener('scroll', throttledScroll);
 *
 * // RAF throttle for animations
 * const rafScroll = rafThrottle((scrollY) => {
 *   element.style.transform = `translateY(${scrollY}px)`;
 * });
 * window.addEventListener('scroll', () => rafScroll(window.scrollY));
 *
 * // Retry with backoff
 * const data = await retryWithBackoff(
 *   () => fetch('/api/data').then(r => r.json()),
 *   {
 *     maxRetries: 3,
 *     initialDelay: 1000,
 *     onRetry: (attempt) => console.log(`Retry ${attempt}`)
 *   }
 * );
 *
 * // Rate limiter
 * const limiter = new RateLimiter(5, 60000); // 5 calls per minute
 * limiter.tryCall(() => makeAPICall());
 *
 * // Memoize with TTL
 * const cachedFetch = memoizeWithTTL(fetchData, { ttl: 60000 }); // 1 minute
 */
