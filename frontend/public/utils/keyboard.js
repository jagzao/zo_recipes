/**
 * Keyboard Shortcuts Manager
 * Easy keyboard shortcut registration and management
 */

export class KeyboardShortcuts {
  constructor(options = {}) {
    this.shortcuts = new Map();
    this.options = {
      preventDefault: true,
      enableInInputs: false,
      ...options,
    };

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.enabled = false;
  }

  /**
   * Start listening for shortcuts
   */
  enable() {
    if (!this.enabled) {
      document.addEventListener('keydown', this.handleKeyDown);
      this.enabled = true;
    }
    return this;
  }

  /**
   * Stop listening for shortcuts
   */
  disable() {
    if (this.enabled) {
      document.removeEventListener('keydown', this.handleKeyDown);
      this.enabled = false;
    }
    return this;
  }

  /**
   * Register a keyboard shortcut
   * @param {string} keys - Key combination (e.g., 'ctrl+s', 'cmd+k', 'escape')
   * @param {Function} handler - Callback function
   * @param {Object} options - Options for this shortcut
   */
  register(keys, handler, options = {}) {
    const normalized = this.normalizeKeys(keys);

    this.shortcuts.set(normalized, {
      handler,
      description: options.description || '',
      preventDefault: options.preventDefault ?? this.options.preventDefault,
      enableInInputs: options.enableInInputs ?? this.options.enableInInputs,
      scope: options.scope || 'global',
    });

    return this;
  }

  /**
   * Unregister a shortcut
   */
  unregister(keys) {
    const normalized = this.normalizeKeys(keys);
    this.shortcuts.delete(normalized);
    return this;
  }

  /**
   * Handle keydown event
   */
  handleKeyDown(event) {
    // Check if we should ignore this event
    if (this.shouldIgnore(event)) {
      return;
    }

    const keys = this.getKeysFromEvent(event);
    const shortcut = this.shortcuts.get(keys);

    if (shortcut) {
      // Check if shortcut is enabled in current context
      if (!shortcut.enableInInputs && this.isInputElement(event.target)) {
        return;
      }

      // Prevent default if needed
      if (shortcut.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }

      // Execute handler
      shortcut.handler(event);
    }
  }

  /**
   * Check if event should be ignored
   */
  shouldIgnore(event) {
    // Ignore if modifier key only
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      return true;
    }

    // Ignore if composition is in progress (for CJK input)
    if (event.isComposing) {
      return true;
    }

    return false;
  }

  /**
   * Check if element is an input
   */
  isInputElement(element) {
    const tagName = element.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      element.isContentEditable
    );
  }

  /**
   * Get key combination from event
   */
  getKeysFromEvent(event) {
    const parts = [];

    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    if (event.metaKey) parts.push('cmd');

    // Add the main key
    const key = event.key.toLowerCase();
    parts.push(key);

    return parts.join('+');
  }

  /**
   * Normalize key combination string
   */
  normalizeKeys(keys) {
    const parts = keys
      .toLowerCase()
      .split('+')
      .map((k) => k.trim());

    // Reorder modifiers
    const order = ['ctrl', 'alt', 'shift', 'cmd'];
    const modifiers = parts.filter((k) => order.includes(k)).sort((a, b) => {
      return order.indexOf(a) - order.indexOf(b);
    });

    const mainKey = parts.find((k) => !order.includes(k));

    return [...modifiers, mainKey].join('+');
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts(scope = null) {
    const shortcuts = [];

    for (const [keys, data] of this.shortcuts.entries()) {
      if (!scope || data.scope === scope) {
        shortcuts.push({
          keys,
          description: data.description,
          scope: data.scope,
        });
      }
    }

    return shortcuts;
  }

  /**
   * Clear all shortcuts
   */
  clear() {
    this.shortcuts.clear();
    return this;
  }
}

/**
 * Global keyboard shortcuts instance
 */
export const keyboard = new KeyboardShortcuts();

/**
 * Common shortcuts registry
 */
export const commonShortcuts = {
  // Navigation
  goHome: () => keyboard.register('g+h', () => {}, { description: 'Go to home' }),
  goBack: () => keyboard.register('escape', () => history.back(), { description: 'Go back' }),

  // Search
  search: (handler) =>
    keyboard.register(
      'ctrl+k',
      handler,
      { description: 'Open search' }
    ).register('cmd+k', handler, { description: 'Open search (Mac)' }),

  // Save
  save: (handler) =>
    keyboard.register('ctrl+s', handler, { description: 'Save' }).register(
      'cmd+s',
      handler,
      { description: 'Save (Mac)' }
    ),

  // Undo/Redo
  undo: (handler) =>
    keyboard.register('ctrl+z', handler, { description: 'Undo' }).register(
      'cmd+z',
      handler,
      { description: 'Undo (Mac)' }
    ),

  redo: (handler) =>
    keyboard.register('ctrl+y', handler, { description: 'Redo' }).register(
      'cmd+shift+z',
      handler,
      { description: 'Redo (Mac)' }
    ),

  // Copy/Paste (if you need custom handlers)
  copy: (handler) =>
    keyboard.register('ctrl+c', handler, { preventDefault: false }),

  paste: (handler) =>
    keyboard.register('ctrl+v', handler, { preventDefault: false }),

  // Help
  help: (handler) =>
    keyboard.register('shift+/', handler, { description: 'Show help' }),

  // Escape to close
  escape: (handler) =>
    keyboard.register('escape', handler, { description: 'Close/Cancel' }),
};

/**
 * Keyboard shortcut modal helper
 */
export function createShortcutsModal() {
  const shortcuts = keyboard.getShortcuts();

  if (shortcuts.length === 0) {
    return '<p>No keyboard shortcuts registered</p>';
  }

  const html = `
    <div class="shortcuts-modal">
      <h2>Keyboard Shortcuts</h2>
      <div class="shortcuts-list">
        ${shortcuts
          .map(
            (s) => `
          <div class="shortcut-item">
            <span class="shortcut-keys">
              ${s.keys
                .split('+')
                .map((k) => `<kbd>${k}</kbd>`)
                .join(' + ')}
            </span>
            <span class="shortcut-description">${s.description}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;

  return html;
}

/**
 * Sequence detector (for easter eggs!)
 * Detects key sequences like "up up down down left right left right b a"
 */
export class SequenceDetector {
  constructor(sequence, callback, options = {}) {
    this.sequence = sequence.toLowerCase().split(' ');
    this.callback = callback;
    this.options = {
      timeout: 1000, // Reset after 1 second of inactivity
      ...options,
    };

    this.current = [];
    this.timer = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();

    // Add to current sequence
    this.current.push(key);

    // Reset timer
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.current = [];
    }, this.options.timeout);

    // Check if sequence matches
    if (this.current.length > this.sequence.length) {
      this.current.shift();
    }

    if (this.current.join(' ') === this.sequence.join(' ')) {
      this.callback();
      this.current = [];
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    clearTimeout(this.timer);
  }
}

/**
 * Konami Code detector
 */
export function detectKonamiCode(callback) {
  return new SequenceDetector(
    'arrowup arrowup arrowdown arrowdown arrowleft arrowright arrowleft arrowright b a',
    callback
  );
}

/**
 * Command palette helper
 * Creates a searchable command palette
 */
export class CommandPalette {
  constructor() {
    this.commands = new Map();
    this.isOpen = false;
  }

  /**
   * Register a command
   */
  register(id, command) {
    this.commands.set(id, {
      id,
      name: command.name,
      description: command.description || '',
      keywords: command.keywords || [],
      handler: command.handler,
      shortcut: command.shortcut,
      icon: command.icon,
    });

    // Register keyboard shortcut if provided
    if (command.shortcut) {
      keyboard.register(command.shortcut, command.handler);
    }

    return this;
  }

  /**
   * Unregister command
   */
  unregister(id) {
    const command = this.commands.get(id);
    if (command && command.shortcut) {
      keyboard.unregister(command.shortcut);
    }
    this.commands.delete(id);
    return this;
  }

  /**
   * Search commands
   */
  search(query) {
    if (!query) {
      return Array.from(this.commands.values());
    }

    const lowerQuery = query.toLowerCase();

    return Array.from(this.commands.values()).filter((cmd) => {
      return (
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery) ||
        cmd.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Execute command
   */
  execute(id) {
    const command = this.commands.get(id);
    if (command) {
      command.handler();
    }
  }

  /**
   * Open palette (implement UI separately)
   */
  open() {
    this.isOpen = true;
    // Implement UI rendering
  }

  /**
   * Close palette
   */
  close() {
    this.isOpen = false;
    // Implement UI cleanup
  }
}

/**
 * Example usage:
 *
 * // Enable keyboard shortcuts
 * keyboard.enable();
 *
 * // Register shortcuts
 * keyboard.register('ctrl+s', () => {
 *   console.log('Save!');
 * }, { description: 'Save current document' });
 *
 * keyboard.register('/', () => {
 *   openSearch();
 * }, { description: 'Open search', enableInInputs: false });
 *
 * // Use common shortcuts
 * commonShortcuts.search(() => openSearch());
 * commonShortcuts.save(() => saveDocument());
 * commonShortcuts.help(() => showHelp());
 *
 * // Show shortcuts modal
 * const html = createShortcutsModal();
 * modal.show(html);
 *
 * // Detect Konami code
 * detectKonamiCode(() => {
 *   console.log('🎮 Konami code activated!');
 *   activateEasterEgg();
 * });
 *
 * // Command palette
 * const palette = new CommandPalette();
 * palette.register('search', {
 *   name: 'Search...',
 *   description: 'Search recipes',
 *   keywords: ['find', 'lookup'],
 *   shortcut: 'ctrl+k',
 *   handler: () => openSearch()
 * });
 */
