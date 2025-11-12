/**
 * Web Vitals Monitoring
 * Track Core Web Vitals for performance optimization
 */

import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

// Store vitals data
const vitalsData = {
  CLS: null, // Cumulative Layout Shift
  FID: null, // First Input Delay
  LCP: null, // Largest Contentful Paint
  FCP: null, // First Contentful Paint
  TTFB: null, // Time to First Byte
};

/**
 * Initialize Web Vitals monitoring
 * @param {Object} options - Configuration options
 * @param {boolean} options.logToConsole - Log metrics to console (default: false)
 * @param {boolean} options.sendToAnalytics - Send to analytics endpoint (default: true)
 * @param {string} options.analyticsEndpoint - Analytics API endpoint
 */
export function initWebVitals(options = {}) {
  const config = {
    logToConsole: false,
    sendToAnalytics: true,
    analyticsEndpoint: '/api/vitals',
    ...options,
  };

  // Track CLS (Cumulative Layout Shift)
  onCLS((metric) => {
    handleMetric('CLS', metric, config);
  });

  // Track FID (First Input Delay)
  onFID((metric) => {
    handleMetric('FID', metric, config);
  });

  // Track LCP (Largest Contentful Paint)
  onLCP((metric) => {
    handleMetric('LCP', metric, config);
  });

  // Track FCP (First Contentful Paint)
  onFCP((metric) => {
    handleMetric('FCP', metric, config);
  });

  // Track TTFB (Time to First Byte)
  onTTFB((metric) => {
    handleMetric('TTFB', metric, config);
  });
}

/**
 * Handle a metric result
 */
function handleMetric(name, metric, config) {
  // Store metric
  vitalsData[name] = metric;

  // Log to console if enabled
  if (config.logToConsole) {
    console.log(`[Web Vitals] ${name}:`, {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
    });
  }

  // Send to analytics
  if (config.sendToAnalytics) {
    sendMetricToAnalytics(name, metric, config.analyticsEndpoint);
  }

  // Store in session storage for debugging
  try {
    const stored = JSON.parse(sessionStorage.getItem('webVitals') || '{}');
    stored[name] = {
      value: metric.value,
      rating: metric.rating,
      timestamp: Date.now(),
    };
    sessionStorage.setItem('webVitals', JSON.stringify(stored));
  } catch (error) {
    // Ignore storage errors
  }
}

/**
 * Send metric to analytics endpoint
 */
function sendMetricToAnalytics(name, metric, endpoint) {
  // Use sendBeacon for better reliability (won't block page unload)
  if (navigator.sendBeacon) {
    const data = JSON.stringify({
      name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
    });

    navigator.sendBeacon(endpoint, data);
  } else {
    // Fallback to fetch
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        url: window.location.href,
        timestamp: Date.now(),
      }),
      keepalive: true,
    }).catch(() => {
      // Ignore errors - don't affect user experience
    });
  }
}

/**
 * Get all vitals data
 */
export function getVitalsData() {
  return { ...vitalsData };
}

/**
 * Get rating for a metric value
 * @param {string} metric - Metric name (CLS, FID, LCP, etc.)
 * @param {number} value - Metric value
 * @returns {'good' | 'needs-improvement' | 'poor'}
 */
export function getMetricRating(metric, value) {
  const thresholds = {
    CLS: { good: 0.1, poor: 0.25 },
    FID: { good: 100, poor: 300 },
    LCP: { good: 2500, poor: 4000 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
  };

  const threshold = thresholds[metric];
  if (!threshold) return 'unknown';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Display vitals in console (for debugging)
 */
export function displayVitals() {
  console.group('📊 Web Vitals');

  Object.entries(vitalsData).forEach(([name, metric]) => {
    if (metric) {
      const emoji =
        metric.rating === 'good'
          ? '✅'
          : metric.rating === 'needs-improvement'
          ? '⚠️'
          : '❌';

      console.log(
        `${emoji} ${name}: ${Math.round(metric.value)}${
          name === 'CLS' ? '' : 'ms'
        } (${metric.rating})`
      );
    }
  });

  console.groupEnd();
}

/**
 * Check if performance is good
 */
export function hasGoodPerformance() {
  return Object.values(vitalsData).every((metric) => {
    return !metric || metric.rating === 'good';
  });
}

/**
 * Get performance score (0-100)
 */
export function getPerformanceScore() {
  const metrics = Object.values(vitalsData).filter((m) => m);

  if (metrics.length === 0) return 0;

  const scores = metrics.map((metric) => {
    if (metric.rating === 'good') return 100;
    if (metric.rating === 'needs-improvement') return 50;
    return 0;
  });

  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Export vitals data as JSON
 */
export function exportVitalsData() {
  const data = {
    vitals: vitalsData,
    performance: {
      score: getPerformanceScore(),
      isGood: hasGoodPerformance(),
    },
    metadata: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      connection: navigator.connection
        ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt,
          }
        : null,
    },
  };

  return JSON.stringify(data, null, 2);
}
