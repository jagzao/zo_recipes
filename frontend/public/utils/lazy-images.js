/**
 * Lazy Image Loading Utility
 * Uses Intersection Observer for performance
 */

let imageObserver = null;

/**
 * Initialize lazy image loading
 * Call this after DOM content changes
 */
export function initLazyImages() {
  // Don't initialize if already exists
  if (imageObserver) {
    return;
  }

  // Check for browser support
  if (!('IntersectionObserver' in window)) {
    // Fallback: load all images immediately
    loadAllImages();
    return;
  }

  // Create observer
  imageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadImage(entry.target);
          imageObserver.unobserve(entry.target);
        }
      });
    },
    {
      // Start loading when image is 50px away from viewport
      rootMargin: '50px 0px',
      threshold: 0.01,
    }
  );

  // Observe all lazy images
  observeLazyImages();
}

/**
 * Observe all images with data-src attribute
 */
export function observeLazyImages() {
  const lazyImages = document.querySelectorAll('img[data-src]');

  lazyImages.forEach((img) => {
    if (imageObserver) {
      imageObserver.observe(img);
    }
  });
}

/**
 * Load a single image
 */
function loadImage(img) {
  const src = img.dataset.src;
  const srcset = img.dataset.srcset;

  if (!src) return;

  // Create new image to test loading
  const tempImg = new Image();

  tempImg.onload = () => {
    // Set actual src
    img.src = src;
    if (srcset) {
      img.srcset = srcset;
    }

    // Add loaded class for CSS transitions
    img.classList.add('loaded');
    img.classList.remove('lazy-loading');

    // Remove data attributes
    delete img.dataset.src;
    delete img.dataset.srcset;
  };

  tempImg.onerror = () => {
    // Set fallback image
    img.src = '/images/placeholder.png';
    img.classList.add('load-error');
    img.classList.remove('lazy-loading');
  };

  // Add loading class
  img.classList.add('lazy-loading');

  // Start loading
  tempImg.src = src;
}

/**
 * Load all images immediately (fallback)
 */
function loadAllImages() {
  const lazyImages = document.querySelectorAll('img[data-src]');

  lazyImages.forEach((img) => {
    loadImage(img);
  });
}

/**
 * Disconnect observer (cleanup)
 */
export function disconnectLazyImages() {
  if (imageObserver) {
    imageObserver.disconnect();
    imageObserver = null;
  }
}

/**
 * Preload critical images
 * Use for above-the-fold images
 */
export function preloadImages(urls) {
  urls.forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  });
}

/**
 * Create lazy image HTML
 * Helper function for rendering
 */
export function createLazyImage(src, alt = '', className = '') {
  return `
    <img
      data-src="${src}"
      alt="${alt}"
      class="lazy ${className}"
      loading="lazy"
      decoding="async"
    />
  `;
}

/**
 * Progressive image loading (blur-up technique)
 * Loads low-quality placeholder first
 */
export function createProgressiveImage(
  src,
  placeholderSrc,
  alt = '',
  className = ''
) {
  return `
    <div class="progressive-image ${className}">
      <img
        src="${placeholderSrc}"
        data-src="${src}"
        alt="${alt}"
        class="lazy progressive-image-placeholder"
        loading="lazy"
        decoding="async"
      />
    </div>
  `;
}
