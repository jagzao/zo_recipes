/**
 * Accessibility Utilities (A11y)
 * WCAG 2.1 AA/AAA compliance helpers
 */

/**
 * ARIA Live Region Manager
 * Announces dynamic content to screen readers
 */
export class AriaLive {
  constructor() {
    this.regions = new Map();
    this.init();
  }

  /**
   * Initialize ARIA live regions
   */
  init() {
    // Create polite region
    this.createRegion('polite', 'polite');

    // Create assertive region
    this.createRegion('assertive', 'assertive');

    // Create status region
    this.createRegion('status', 'polite', 'status');
  }

  /**
   * Create ARIA live region
   */
  createRegion(id, politeness = 'polite', role = 'log') {
    if (this.regions.has(id)) {
      return this.regions.get(id);
    }

    const region = document.createElement('div');
    region.id = `aria-live-${id}`;
    region.setAttribute('aria-live', politeness);
    region.setAttribute('aria-atomic', 'true');
    region.setAttribute('role', role);
    region.className = 'sr-only'; // Screen reader only
    region.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;

    document.body.appendChild(region);
    this.regions.set(id, region);

    return region;
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   * @param {string} priority - 'polite' | 'assertive'
   */
  announce(message, priority = 'polite') {
    const region = this.regions.get(priority) || this.regions.get('polite');

    // Clear previous message
    region.textContent = '';

    // Set new message after brief delay (ensures screen reader picks it up)
    setTimeout(() => {
      region.textContent = message;
    }, 100);
  }

  /**
   * Announce status update
   */
  status(message) {
    this.announce(message, 'status');
  }

  /**
   * Clear all announcements
   */
  clear() {
    this.regions.forEach((region) => {
      region.textContent = '';
    });
  }
}

/**
 * Global ARIA live instance
 */
export const ariaLive = new AriaLive();

/**
 * Focus Trap
 * Traps keyboard focus within a container (for modals, dropdowns)
 */
export class FocusTrap {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      initialFocus: null,
      returnFocus: true,
      escapeDeactivates: true,
      ...options,
    };

    this.previouslyFocused = null;
    this.isActive = false;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFocusIn = this.handleFocusIn.bind(this);
  }

  /**
   * Activate focus trap
   */
  activate() {
    if (this.isActive) return;

    // Store currently focused element
    this.previouslyFocused = document.activeElement;

    // Get focusable elements
    this.updateFocusableElements();

    // Add event listeners
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('focusin', this.handleFocusIn);

    // Set initial focus
    const initialFocus =
      this.options.initialFocus ||
      this.focusableElements[0] ||
      this.element;

    if (initialFocus) {
      initialFocus.focus();
    }

    this.isActive = true;
  }

  /**
   * Deactivate focus trap
   */
  deactivate() {
    if (!this.isActive) return;

    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('focusin', this.handleFocusIn);

    // Return focus
    if (this.options.returnFocus && this.previouslyFocused) {
      this.previouslyFocused.focus();
    }

    this.isActive = false;
  }

  /**
   * Get all focusable elements in container
   */
  updateFocusableElements() {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    this.focusableElements = Array.from(
      this.element.querySelectorAll(selector)
    ).filter((el) => {
      return (
        el.offsetWidth > 0 &&
        el.offsetHeight > 0 &&
        !el.hasAttribute('hidden')
      );
    });
  }

  /**
   * Handle keydown events
   */
  handleKeyDown(event) {
    if (event.key === 'Tab') {
      this.handleTab(event);
    } else if (event.key === 'Escape' && this.options.escapeDeactivates) {
      event.preventDefault();
      this.deactivate();

      // Trigger custom event
      this.element.dispatchEvent(new CustomEvent('focustrap:escape'));
    }
  }

  /**
   * Handle tab navigation
   */
  handleTab(event) {
    this.updateFocusableElements();

    if (this.focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = this.focusableElements[0];
    const lastElement =
      this.focusableElements[this.focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  /**
   * Handle focus in events (keep focus within trap)
   */
  handleFocusIn(event) {
    if (!this.element.contains(event.target)) {
      event.preventDefault();
      if (this.focusableElements.length > 0) {
        this.focusableElements[0].focus();
      }
    }
  }
}

/**
 * Focus Manager
 * Manages focus for SPA navigation
 */
export class FocusManager {
  constructor() {
    this.focusHistory = [];
  }

  /**
   * Set focus to element
   */
  set(element, options = {}) {
    const { preventScroll = false, delay = 0 } = options;

    setTimeout(() => {
      if (element) {
        // Make element focusable if needed
        if (element.tabIndex === -1) {
          element.setAttribute('tabindex', '-1');
        }

        element.focus({ preventScroll });

        // Store in history
        this.focusHistory.push(element);
      }
    }, delay);
  }

  /**
   * Focus first heading in container
   */
  focusHeading(container = document) {
    const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      this.set(heading);
      return true;
    }
    return false;
  }

  /**
   * Focus main content
   */
  focusMain() {
    const main =
      document.querySelector('main') || document.querySelector('[role="main"]');

    if (main) {
      this.set(main);
      return true;
    }
    return false;
  }

  /**
   * Restore previous focus
   */
  restore() {
    if (this.focusHistory.length > 1) {
      const previous = this.focusHistory[this.focusHistory.length - 2];
      if (previous && document.contains(previous)) {
        previous.focus();
      }
    }
  }

  /**
   * Clear focus history
   */
  clear() {
    this.focusHistory = [];
  }
}

/**
 * Global focus manager
 */
export const focusManager = new FocusManager();

/**
 * Skip Links Manager
 * Manages "Skip to content" links for keyboard navigation
 */
export function createSkipLinks(targets = []) {
  const defaultTargets = [
    { id: 'main-content', label: 'Skip to main content' },
    { id: 'main-navigation', label: 'Skip to navigation' },
    ...targets,
  ];

  const container = document.createElement('div');
  container.className = 'skip-links';
  container.setAttribute('role', 'navigation');
  container.setAttribute('aria-label', 'Skip links');

  defaultTargets.forEach(({ id, label }) => {
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.className = 'skip-link';
    link.textContent = label;

    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(id);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
        target.scrollIntoView();
      }
    });

    container.appendChild(link);
  });

  return container;
}

/**
 * Color Contrast Checker
 * Check if color combination meets WCAG standards
 */
export function checkContrast(foreground, background, level = 'AA') {
  const getLuminance = (color) => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    // Calculate relative luminance
    const [rs, gs, bs] = [r, g, b].map((val) => {
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);

  const ratio =
    (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  const thresholds = {
    AA: { normal: 4.5, large: 3 },
    AAA: { normal: 7, large: 4.5 },
  };

  return {
    ratio: ratio.toFixed(2),
    passNormal: ratio >= thresholds[level].normal,
    passLarge: ratio >= thresholds[level].large,
    level,
  };
}

/**
 * Accessible Modal Helper
 */
export function makeModalAccessible(modal, options = {}) {
  const {
    closeButton,
    onClose,
    ariaLabel = 'Dialog',
    ariaDescribedBy,
  } = options;

  // Set ARIA attributes
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', ariaLabel);

  if (ariaDescribedBy) {
    modal.setAttribute('aria-describedby', ariaDescribedBy);
  }

  // Create focus trap
  const trap = new FocusTrap(modal, {
    escapeDeactivates: true,
    returnFocus: true,
  });

  // Handle close button
  if (closeButton) {
    closeButton.setAttribute('aria-label', 'Close dialog');
    closeButton.addEventListener('click', () => {
      trap.deactivate();
      if (onClose) onClose();
    });
  }

  // Listen for escape key
  modal.addEventListener('focustrap:escape', () => {
    if (onClose) onClose();
  });

  return {
    open: () => {
      trap.activate();
      ariaLive.announce('Dialog opened', 'polite');
    },
    close: () => {
      trap.deactivate();
      if (onClose) onClose();
      ariaLive.announce('Dialog closed', 'polite');
    },
  };
}

/**
 * Keyboard Navigation Helper
 * For custom components (tabs, menus, etc.)
 */
export class KeyboardNav {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      selector: '[role="menuitem"], [role="tab"], [role="option"]',
      loop: true,
      horizontal: false,
      ...options,
    };

    this.currentIndex = 0;
    this.items = [];

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.init();
  }

  /**
   * Initialize keyboard navigation
   */
  init() {
    this.updateItems();
    this.container.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Update list of navigable items
   */
  updateItems() {
    this.items = Array.from(
      this.container.querySelectorAll(this.options.selector)
    ).filter((item) => !item.hasAttribute('disabled'));

    // Set tabindex
    this.items.forEach((item, index) => {
      item.setAttribute('tabindex', index === this.currentIndex ? '0' : '-1');
    });
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(event) {
    const { key } = event;
    const { horizontal, loop } = this.options;

    const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const firstKey = 'Home';
    const lastKey = 'End';

    let handled = false;

    if (key === nextKey) {
      this.next();
      handled = true;
    } else if (key === prevKey) {
      this.previous();
      handled = true;
    } else if (key === firstKey) {
      this.first();
      handled = true;
    } else if (key === lastKey) {
      this.last();
      handled = true;
    }

    if (handled) {
      event.preventDefault();
      this.items[this.currentIndex].focus();
    }
  }

  /**
   * Navigate to next item
   */
  next() {
    if (this.currentIndex < this.items.length - 1) {
      this.currentIndex++;
    } else if (this.options.loop) {
      this.currentIndex = 0;
    }
    this.updateFocus();
  }

  /**
   * Navigate to previous item
   */
  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else if (this.options.loop) {
      this.currentIndex = this.items.length - 1;
    }
    this.updateFocus();
  }

  /**
   * Navigate to first item
   */
  first() {
    this.currentIndex = 0;
    this.updateFocus();
  }

  /**
   * Navigate to last item
   */
  last() {
    this.currentIndex = this.items.length - 1;
    this.updateFocus();
  }

  /**
   * Update focus state
   */
  updateFocus() {
    this.items.forEach((item, index) => {
      item.setAttribute('tabindex', index === this.currentIndex ? '0' : '-1');
    });
  }

  /**
   * Destroy keyboard navigation
   */
  destroy() {
    this.container.removeEventListener('keydown', this.handleKeyDown);
  }
}

/**
 * Example usage:
 *
 * // Announce to screen readers
 * ariaLive.announce('Item added to cart', 'polite');
 * ariaLive.announce('Error: Form submission failed', 'assertive');
 *
 * // Focus trap for modal
 * const modal = document.querySelector('.modal');
 * const trap = new FocusTrap(modal);
 * trap.activate(); // Trap focus
 * trap.deactivate(); // Release focus
 *
 * // Focus management
 * focusManager.focusMain(); // Focus main content
 * focusManager.focusHeading(); // Focus first heading
 *
 * // Skip links
 * const skipLinks = createSkipLinks();
 * document.body.prepend(skipLinks);
 *
 * // Check color contrast
 * const result = checkContrast('#000000', '#FFFFFF', 'AA');
 * console.log(`Contrast ratio: ${result.ratio}:1`);
 * console.log(`Passes AA: ${result.passNormal}`);
 *
 * // Accessible modal
 * const { open, close } = makeModalAccessible(modal, {
 *   closeButton: document.querySelector('.modal-close'),
 *   ariaLabel: 'Confirmation dialog',
 *   onClose: () => console.log('Modal closed')
 * });
 * open();
 *
 * // Keyboard navigation for tabs
 * const tabs = document.querySelector('[role="tablist"]');
 * const nav = new KeyboardNav(tabs, {
 *   selector: '[role="tab"]',
 *   horizontal: true
 * });
 */
