/**
 * Tests for Timing Utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  debounce,
  throttle,
  rafThrottle,
  delay,
  retryWithBackoff,
  RateLimiter,
  memoizeWithTTL,
  withTimeout,
} from '../public/utils/timing.js';

describe('Timing Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('debounce', () => {
    it('should debounce function calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call immediately with leading option', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100, { leading: true });

      debounced();
      expect(fn).toHaveBeenCalledTimes(1);

      debounced();
      debounced();
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1); // Still only 1 (leading)
    });

    it('should support maxWait option', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100, { maxWait: 200 });

      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(50);

      expect(fn).toHaveBeenCalledTimes(1); // Called due to maxWait
    });

    it('should cancel pending execution', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();
      vi.advanceTimersByTime(100);

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      throttled();
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect leading option', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100, { leading: false });

      throttled();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('delay', () => {
    it('should delay execution', async () => {
      const promise = delay(100);
      let resolved = false;

      promise.then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(100);

      expect(resolved).toBe(true);
    });
  });

  describe('RateLimiter', () => {
    it('should allow calls within limit', () => {
      const limiter = new RateLimiter(3, 1000);

      expect(limiter.isAllowed()).toBe(true);
      expect(limiter.isAllowed()).toBe(true);
      expect(limiter.isAllowed()).toBe(true);
      expect(limiter.isAllowed()).toBe(false);
    });

    it('should reset after time window', () => {
      const limiter = new RateLimiter(2, 1000);

      expect(limiter.isAllowed()).toBe(true);
      expect(limiter.isAllowed()).toBe(true);
      expect(limiter.isAllowed()).toBe(false);

      vi.advanceTimersByTime(1000);

      expect(limiter.isAllowed()).toBe(true);
    });

    it('should throw error when limit exceeded', () => {
      const limiter = new RateLimiter(1, 1000);
      const fn = vi.fn();

      limiter.tryCall(fn);
      expect(fn).toHaveBeenCalledTimes(1);

      expect(() => limiter.tryCall(fn)).toThrow('Rate limit exceeded');
    });
  });

  describe('memoizeWithTTL', () => {
    it('should cache results', () => {
      let callCount = 0;
      const fn = (x) => {
        callCount++;
        return x * 2;
      };

      const memoized = memoizeWithTTL(fn, { ttl: 1000 });

      expect(memoized(5)).toBe(10);
      expect(memoized(5)).toBe(10);
      expect(callCount).toBe(1); // Only called once
    });

    it('should expire after TTL', () => {
      let callCount = 0;
      const fn = (x) => {
        callCount++;
        return x * 2;
      };

      const memoized = memoizeWithTTL(fn, { ttl: 1000 });

      expect(memoized(5)).toBe(10);
      expect(callCount).toBe(1);

      vi.advanceTimersByTime(1001);

      expect(memoized(5)).toBe(10);
      expect(callCount).toBe(2); // Called again after TTL
    });

    it('should support custom key function', () => {
      let callCount = 0;
      const fn = (obj) => {
        callCount++;
        return obj.value;
      };

      const memoized = memoizeWithTTL(fn, {
        ttl: 1000,
        keyFn: (obj) => obj.id,
      });

      expect(memoized({ id: 1, value: 10 })).toBe(10);
      expect(memoized({ id: 1, value: 20 })).toBe(10); // Cached
      expect(callCount).toBe(1);
    });
  });

  describe('withTimeout', () => {
    it('should resolve if promise completes in time', async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve('success'), 50);
      });

      const result = await withTimeout(promise, 100);
      expect(result).toBe('success');
    });

    it('should reject if promise times out', async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve('success'), 200);
      });

      await expect(withTimeout(promise, 100)).rejects.toThrow('Operation timed out');
    });
  });
});
