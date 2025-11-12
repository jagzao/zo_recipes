/**
 * Analytics Utilities
 * Simple, privacy-focused analytics tracking
 */

/**
 * Analytics Manager
 */
export class Analytics {
  constructor(options = {}) {
    this.options = {
      endpoint: '/api/analytics',
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      enabled: true,
      debug: false,
      ...options,
    };

    this.queue = [];
    this.session = this.generateSessionId();
    this.startTime = Date.now();

    // Auto-flush interval
    if (this.options.enabled) {
      this.startAutoFlush();
    }

    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flush(true));
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush(true);
      }
    });
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Track an event
   */
  track(event, properties = {}) {
    if (!this.options.enabled) {
      return;
    }

    const eventData = {
      event,
      properties,
      timestamp: Date.now(),
      session: this.session,
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    if (this.options.debug) {
      console.log('[Analytics]', eventData);
    }

    this.queue.push(eventData);

    // Auto-flush if batch size reached
    if (this.queue.length >= this.options.batchSize) {
      this.flush();
    }

    return this;
  }

  /**
   * Track page view
   */
  page(pageName, properties = {}) {
    return this.track('page_view', {
      page: pageName || document.title,
      path: window.location.pathname,
      ...properties,
    });
  }

  /**
   * Track user action
   */
  action(action, category, label, value) {
    return this.track('user_action', {
      action,
      category,
      label,
      value,
    });
  }

  /**
   * Track click
   */
  click(element, properties = {}) {
    return this.track('click', {
      element: element.tagName,
      text: element.textContent?.substring(0, 100),
      id: element.id,
      className: element.className,
      ...properties,
    });
  }

  /**
   * Track form submission
   */
  form(formName, properties = {}) {
    return this.track('form_submit', {
      form: formName,
      ...properties,
    });
  }

  /**
   * Track error
   */
  error(error, context = {}) {
    return this.track('error', {
      message: error.message,
      stack: error.stack,
      ...context,
    });
  }

  /**
   * Track timing
   */
  timing(category, variable, time, label) {
    return this.track('timing', {
      category,
      variable,
      time,
      label,
    });
  }

  /**
   * Track conversion
   */
  conversion(event, value, currency = 'USD') {
    return this.track('conversion', {
      event,
      value,
      currency,
    });
  }

  /**
   * Identify user
   */
  identify(userId, traits = {}) {
    this.userId = userId;
    return this.track('identify', {
      userId,
      traits,
    });
  }

  /**
   * Flush events to server
   */
  async flush(useBeacon = false) {
    if (this.queue.length === 0) {
      return;
    }

    const events = [...this.queue];
    this.queue = [];

    const payload = {
      events,
      userId: this.userId,
      session: this.session,
    };

    try {
      if (useBeacon && navigator.sendBeacon) {
        // Use sendBeacon for better reliability on page unload
        navigator.sendBeacon(
          this.options.endpoint,
          JSON.stringify(payload)
        );
      } else {
        // Regular fetch
        await fetch(this.options.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('[Analytics] Failed to send events:', error);
      }
      // Re-queue events on failure
      this.queue.unshift(...events);
    }
  }

  /**
   * Start auto-flush interval
   */
  startAutoFlush() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.options.flushInterval);
  }

  /**
   * Stop auto-flush
   */
  stopAutoFlush() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled) {
    this.options.enabled = enabled;

    if (enabled) {
      this.startAutoFlush();
    } else {
      this.stopAutoFlush();
    }
  }

  /**
   * Get session duration
   */
  getSessionDuration() {
    return Date.now() - this.startTime;
  }
}

/**
 * Global analytics instance
 */
export const analytics = new Analytics();

/**
 * Auto-track clicks with data-track attribute
 * Usage: <button data-track="button_click" data-track-category="navigation">Click me</button>
 */
export function initAutoTracking() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-track]');
    if (target) {
      const event = target.dataset.track;
      const category = target.dataset.trackCategory;
      const label = target.dataset.trackLabel;
      const value = target.dataset.trackValue;

      analytics.action(event, category, label, value);
    }
  });

  // Track navigation
  let lastPath = window.location.pathname;
  new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      analytics.page();
    }
  }).observe(document.querySelector('title'), { subtree: true, characterData: true, childList: true });
}

/**
 * Track performance metrics
 */
export function trackPerformance() {
  if (!window.performance || !window.performance.timing) {
    return;
  }

  const timing = window.performance.timing;

  // Wait for page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      const metrics = {
        dns: timing.domainLookupEnd - timing.domainLookupStart,
        tcp: timing.connectEnd - timing.connectStart,
        ttfb: timing.responseStart - timing.requestStart,
        download: timing.responseEnd - timing.responseStart,
        dom: timing.domComplete - timing.domLoading,
        load: timing.loadEventEnd - timing.navigationStart,
      };

      Object.entries(metrics).forEach(([name, time]) => {
        analytics.timing('page_load', name, time);
      });
    }, 0);
  });
}

/**
 * Track scroll depth
 */
export function trackScrollDepth(thresholds = [25, 50, 75, 100]) {
  const tracked = new Set();

  function checkScroll() {
    const scrollPercent =
      (window.scrollY /
        (document.documentElement.scrollHeight - window.innerHeight)) *
      100;

    thresholds.forEach((threshold) => {
      if (scrollPercent >= threshold && !tracked.has(threshold)) {
        tracked.add(threshold);
        analytics.track('scroll_depth', { depth: threshold });
      }
    });
  }

  window.addEventListener('scroll', checkScroll, { passive: true });
}

/**
 * Track time on page
 */
export function trackTimeOnPage() {
  const startTime = Date.now();

  function sendTimeOnPage() {
    const timeOnPage = Date.now() - startTime;
    analytics.timing('engagement', 'time_on_page', timeOnPage);
  }

  window.addEventListener('beforeunload', sendTimeOnPage);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      sendTimeOnPage();
    }
  });
}

/**
 * Track engagement score
 */
export function trackEngagement() {
  let score = 0;
  const events = {
    click: 1,
    scroll: 0.5,
    mousemove: 0.1,
    keypress: 2,
  };

  Object.entries(events).forEach(([event, points]) => {
    window.addEventListener(
      event,
      () => {
        score += points;
      },
      { passive: true }
    );
  });

  // Send score on unload
  window.addEventListener('beforeunload', () => {
    analytics.track('engagement_score', { score });
  });
}

/**
 * Track errors automatically
 */
export function initErrorTracking() {
  window.addEventListener('error', (event) => {
    analytics.error(event.error, {
      type: 'uncaught_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    analytics.error(
      new Error(event.reason),
      {
        type: 'unhandled_rejection',
      }
    );
  });
}

/**
 * Example usage:
 *
 * // Track page view
 * analytics.page('Home');
 *
 * // Track user action
 * analytics.action('click', 'button', 'signup_button');
 *
 * // Track form submit
 * analytics.form('login_form', { success: true });
 *
 * // Track error
 * try {
 *   throw new Error('Something went wrong');
 * } catch (error) {
 *   analytics.error(error, { component: 'UserList' });
 * }
 *
 * // Identify user
 * analytics.identify('user_123', {
 *   email: 'user@example.com',
 *   plan: 'free'
 * });
 *
 * // Initialize auto-tracking
 * initAutoTracking();
 * initErrorTracking();
 * trackPerformance();
 * trackScrollDepth();
 */
