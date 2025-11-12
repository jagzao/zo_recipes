# 🛠️ Advanced Utilities Guide

Guía completa de todas las utilidades avanzadas implementadas en KitchenEye.

---

## 📋 Tabla de Contenidos

1. [Optimistic UI](#optimistic-ui)
2. [Timing Utilities](#timing-utilities)
3. [Request Management](#request-management)
4. [Analytics](#analytics)
5. [Keyboard Shortcuts](#keyboard-shortcuts)
6. [Error Handling](#error-handling)

---

## 🎯 Optimistic UI

**Ubicación**: `frontend/public/utils/optimistic.js`

Implementa actualizaciones instantáneas de UI con rollback automático en caso de error.

### OptimisticList

Gestiona listas con operaciones optimistas (add, update, delete).

```javascript
import { OptimisticList } from './utils/optimistic.js';

// Crear lista
const recipeList = new OptimisticList(initialRecipes);

// Suscribirse a cambios
recipeList.subscribe((items) => {
  renderRecipes(items);
});

// Agregar item
await recipeList.add(
  { name: 'New Recipe', ingredients: [] },
  (item) => fetch('/api/recipes', {
    method: 'POST',
    body: JSON.stringify(item)
  }).then(r => r.json())
);

// Actualizar item
await recipeList.update(
  recipeId,
  { name: 'Updated Name' },
  (id, updates) => fetch(`/api/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  }).then(r => r.json())
);

// Eliminar item
await recipeList.delete(
  recipeId,
  (id) => fetch(`/api/recipes/${id}`, {
    method: 'DELETE'
  })
);
```

### optimisticUpdate

Para actualizaciones simples fuera de listas.

```javascript
import { optimisticUpdate } from './utils/optimistic.js';

// Like button
await optimisticUpdate(
  () => setLiked(true),
  () => fetch('/api/like', { method: 'POST' }),
  () => setLiked(false),
  {
    onSuccess: () => showToast('Liked!', 'success'),
    onError: () => showToast('Failed to like', 'error')
  }
);
```

### optimisticToggle

Para toggles (switches, checkboxes).

```javascript
import { optimisticToggle } from './utils/optimistic.js';

await optimisticToggle(
  isEnabled,
  (value) => setIsEnabled(value),
  (value) => fetch('/api/toggle', {
    method: 'POST',
    body: JSON.stringify({ enabled: value })
  })
);
```

---

## ⏱️ Timing Utilities

**Ubicación**: `frontend/public/utils/timing.js`

### Debounce

Retrasa la ejecución hasta que pase un tiempo sin llamadas.

**Perfecto para**: Search inputs, window resize, form validation.

```javascript
import { debounce } from './utils/timing.js';

// Search input
const debouncedSearch = debounce((query) => {
  fetchSearchResults(query);
}, 500);

input.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});

// Con opciones avanzadas
const debouncedSave = debounce(
  saveDocument,
  1000,
  {
    leading: true,  // Ejecutar inmediatamente en el primer call
    trailing: true, // Ejecutar después del delay
    maxWait: 5000   // Forzar ejecución después de maxWait
  }
);
```

### Throttle

Limita ejecuciones a una vez por intervalo.

**Perfecto para**: Scroll events, mouse move, resize.

```javascript
import { throttle } from './utils/timing.js';

// Scroll handler
const throttledScroll = throttle(() => {
  updateScrollPosition();
}, 200);

window.addEventListener('scroll', throttledScroll);
```

### RAF Throttle

Throttle optimizado para animaciones (60fps).

```javascript
import { rafThrottle } from './utils/timing.js';

const rafScroll = rafThrottle((scrollY) => {
  parallaxElement.style.transform = `translateY(${scrollY * 0.5}px)`;
});

window.addEventListener('scroll', () => {
  rafScroll(window.scrollY);
});
```

### Retry with Backoff

Reintenta operaciones con delay exponencial.

```javascript
import { retryWithBackoff } from './utils/timing.js';

const data = await retryWithBackoff(
  () => fetch('/api/data').then(r => r.json()),
  {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    factor: 2,
    onRetry: (attempt, delay) => {
      console.log(`Retry ${attempt} in ${delay}ms`);
    }
  }
);
```

### Memoize with TTL

Cachea resultados con tiempo de vida.

```javascript
import { memoizeWithTTL } from './utils/timing.js';

const cachedFetch = memoizeWithTTL(
  fetchExpensiveData,
  {
    ttl: 60000,      // 1 minuto
    maxSize: 100,    // Max 100 entries
    keyFn: (...args) => JSON.stringify(args)
  }
);

// Primer call: fetch real
const data1 = await cachedFetch(userId);

// Segundo call dentro de 1min: cached
const data2 = await cachedFetch(userId);
```

### Rate Limiter

Limita llamadas por ventana de tiempo.

```javascript
import { RateLimiter } from './utils/timing.js';

const limiter = new RateLimiter(5, 60000); // 5 llamadas por minuto

if (limiter.isAllowed()) {
  makeAPICall();
}

// O con try/catch
try {
  limiter.tryCall(() => makeAPICall());
} catch (error) {
  showToast('Too many requests', 'error');
}
```

---

## 🌐 Request Management

**Ubicación**: `frontend/public/utils/requests.js`

### Request Deduplication

Previene requests duplicados en vuelo.

```javascript
import { dedupFetch, requestDedup } from './utils/requests.js';

// Dedup automático
const data = await dedupFetch('/api/users/1');

// Manual con custom key
await requestDedup.dedupe('user-data', () => {
  return fetch('/api/user').then(r => r.json());
});

// Múltiples calls al mismo tiempo = 1 request real
Promise.all([
  dedupFetch('/api/users/1'),
  dedupFetch('/api/users/1'),
  dedupFetch('/api/users/1')
]); // Solo 1 request HTTP
```

### Offline Queue

Encola requests cuando está offline y los reintenta al volver online.

```javascript
import { offlineQueue, fetchWithQueue } from './utils/requests.js';

// Fetch con queue automático
await fetchWithQueue(
  '/api/sync',
  {
    method: 'POST',
    body: JSON.stringify({ data: 'test' })
  },
  {
    onSuccess: (result) => {
      showToast('Synced!', 'success');
    },
    onError: (error) => {
      showToast('Sync failed', 'error');
    }
  }
);

// Check queue status
const status = offlineQueue.getStatus();
console.log(`Queue: ${status.size} items, online: ${status.online}`);

// Clear queue
offlineQueue.clear();
```

### Request Cache (SWR)

Cachea requests con estrategia stale-while-revalidate.

```javascript
import { requestCache } from './utils/requests.js';

// Fetch con cache
const users = await requestCache.fetch(
  'users-list',
  () => fetch('/api/users').then(r => r.json()),
  {
    maxAge: 60000 // 1 minuto
  }
);

// Si datos tienen < 1min: cached
// Si datos tienen 1-2min: stale (retorna inmediato + revalida en background)
// Si datos tienen > 2min: fetch nuevo
```

---

## 📊 Analytics

**Ubicación**: `frontend/public/utils/analytics.js`

### Analytics Manager

Sistema completo de tracking de eventos.

```javascript
import { analytics } from './utils/analytics.js';

// Track page view
analytics.page('Home Page');

// Track user action
analytics.action('click', 'button', 'signup_cta');

// Track form submit
analytics.form('login_form', { success: true });

// Track click
analytics.click(buttonElement, { section: 'hero' });

// Track error
try {
  throw new Error('Something failed');
} catch (error) {
  analytics.error(error, { component: 'RecipeList' });
}

// Track timing
analytics.timing('api', 'fetch_recipes', 1234, 'success');

// Track conversion
analytics.conversion('purchase', 49.99, 'USD');

// Identify user
analytics.identify('user_123', {
  email: 'user@example.com',
  plan: 'free',
  signupDate: '2025-01-01'
});
```

### Auto-tracking

Track clicks automáticamente con `data-track`.

```javascript
import { initAutoTracking } from './utils/analytics.js';

// Inicializar
initAutoTracking();
```

```html
<!-- HTML -->
<button
  data-track="button_click"
  data-track-category="navigation"
  data-track-label="go_to_recipes"
>
  Ver Recetas
</button>
```

### Performance Tracking

```javascript
import { trackPerformance } from './utils/analytics.js';

trackPerformance(); // Auto-track page load metrics
```

### Scroll Depth Tracking

```javascript
import { trackScrollDepth } from './utils/analytics.js';

trackScrollDepth([25, 50, 75, 100]); // Track cuando alcanza cada %
```

### Error Tracking

```javascript
import { initErrorTracking } from './utils/analytics.js';

initErrorTracking(); // Auto-track todos los errores
```

---

## ⌨️ Keyboard Shortcuts

**Ubicación**: `frontend/public/utils/keyboard.js`

### KeyboardShortcuts Manager

Sistema completo de shortcuts.

```javascript
import { keyboard, commonShortcuts } from './utils/keyboard.js';

// Habilitar shortcuts
keyboard.enable();

// Registrar shortcuts personalizados
keyboard.register('ctrl+s', () => {
  saveDocument();
}, { description: 'Save document' });

keyboard.register('/', () => {
  openSearch();
}, {
  description: 'Open search',
  enableInInputs: false // No ejecutar en inputs
});

keyboard.register('escape', () => {
  closeModal();
}, { description: 'Close modal' });

// Usar shortcuts comunes
commonShortcuts.search(() => openSearchModal());
commonShortcuts.save(() => saveDocument());
commonShortcuts.help(() => showShortcutsModal());

// Mostrar shortcuts disponibles
const shortcuts = keyboard.getShortcuts();
shortcuts.forEach(s => {
  console.log(`${s.keys}: ${s.description}`);
});
```

### Command Palette

Paleta de comandos searchable (Cmd+K style).

```javascript
import { CommandPalette } from './utils/keyboard.js';

const palette = new CommandPalette();

// Registrar comandos
palette.register('search', {
  name: 'Search Recipes',
  description: 'Search through all recipes',
  keywords: ['find', 'lookup', 'search'],
  shortcut: 'ctrl+k',
  icon: '🔍',
  handler: () => openSearch()
});

palette.register('new-recipe', {
  name: 'New Recipe',
  description: 'Create a new recipe',
  keywords: ['create', 'add', 'new'],
  shortcut: 'ctrl+n',
  icon: '➕',
  handler: () => createNewRecipe()
});

// Buscar comandos
const results = palette.search('recipe');

// Ejecutar comando
palette.execute('search');
```

### Konami Code

¡Easter egg!

```javascript
import { detectKonamiCode } from './utils/keyboard.js';

detectKonamiCode(() => {
  console.log('🎮 Konami Code activated!');
  showSecretFeature();
});
```

---

## 🛡️ Error Handling

**Ubicación**: `frontend/public/utils/errors.js`

### Error Boundary

Envuelve funciones con manejo de errores.

```javascript
import { ErrorBoundary } from './utils/errors.js';

const boundary = new ErrorBoundary({
  onError: (error, context) => {
    showToast(error.message, 'error');
    analytics.error(error, context);
  },
  fallback: '<p>Something went wrong. Please try again.</p>'
});

// Wrap async function
const safeLoadRecipes = boundary.wrap(async () => {
  const recipes = await fetch('/api/recipes').then(r => r.json());
  renderRecipes(recipes);
});

// Wrap sync function
const safeRender = boundary.wrapSync(() => {
  renderComplexUI();
});
```

### Safe Wrapper (Go-style)

Retorna `[error, data]` tuple.

```javascript
import { safe } from './utils/errors.js';

const [error, data] = await safe(
  fetch('/api/data').then(r => r.json())
);

if (error) {
  console.error('Failed:', error);
  return;
}

console.log('Success:', data);
```

### Retry

```javascript
import { retry } from './utils/errors.js';

const data = await retry(
  () => fetch('/api/data').then(r => r.json()),
  {
    retries: 3,
    delay: 1000,
    backoff: 2,
    onRetry: (attempt, error) => {
      console.log(`Retry ${attempt}: ${error.message}`);
    }
  }
);
```

### Circuit Breaker

Previene cascading failures.

```javascript
import { CircuitBreaker } from './utils/errors.js';

const breaker = new CircuitBreaker(
  () => fetch('/api/data').then(r => r.json()),
  {
    threshold: 5,     // Open después de 5 fallos
    timeout: 60000,   // Stay open por 1 minuto
    resetTimeout: 10000
  }
);

try {
  const data = await breaker.execute();
  console.log('Success:', data);
} catch (error) {
  if (breaker.getState().state === 'OPEN') {
    console.log('Circuit breaker is OPEN, using fallback');
    useFallbackData();
  }
}
```

### Error Logger

Logging global de errores.

```javascript
import { errorLogger } from './utils/errors.js';

// Logs automáticamente todos los errores
// Uncaught errors, unhandled rejections, etc.

// Log manual
errorLogger.log(new Error('Custom error'), {
  component: 'RecipeList',
  action: 'fetch'
});

// Ver errors
const errors = errorLogger.getErrors();

// Clear errors
errorLogger.clear();
```

### Error Recovery

Estrategias de recuperación automática.

```javascript
import { errorRecovery } from './utils/errors.js';

// Registrar estrategia de recuperación
errorRecovery.register('NetworkError', async (error) => {
  console.log('Attempting to recover from network error...');
  await retryConnection();
  return true; // Recovered
});

errorRecovery.register('AuthError', async (error) => {
  console.log('Attempting to re-authenticate...');
  await refreshToken();
  return true;
});

// Intentar recuperación
try {
  await fetchData();
} catch (error) {
  const recovered = await errorRecovery.recover(error);

  if (recovered) {
    // Retry original operation
    await fetchData();
  } else {
    showError(error);
  }
}
```

---

## 🎯 Patrones de Uso Comunes

### Patrón 1: Search con Debounce + Analytics

```javascript
import { debounce } from './utils/timing.js';
import { analytics } from './utils/analytics.js';

const debouncedSearch = debounce(async (query) => {
  analytics.action('search', 'recipes', query);

  const results = await fetch(`/api/recipes/search?q=${query}`)
    .then(r => r.json());

  renderResults(results);
}, 500);

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});
```

### Patrón 2: Optimistic Delete + Offline Queue

```javascript
import { OptimisticList } from './utils/optimistic.js';
import { fetchWithQueue } from './utils/requests.js';

const recipeList = new OptimisticList(recipes);

async function deleteRecipe(id) {
  await recipeList.delete(
    id,
    (id) => fetchWithQueue(`/api/recipes/${id}`, {
      method: 'DELETE'
    }, {
      onSuccess: () => showToast('Recipe deleted', 'success'),
      onError: () => showToast('Failed to delete', 'error')
    })
  );
}
```

### Patrón 3: Request Dedup + Cache

```javascript
import { dedupFetch } from './utils/requests.js';
import { memoizeWithTTL } from './utils/timing.js';

const cachedFetch = memoizeWithTTL(
  (url) => dedupFetch(url).then(r => r.json()),
  { ttl: 30000 }
);

// Todos estos calls compartirán el mismo request Y el mismo cache
await Promise.all([
  cachedFetch('/api/recipes'),
  cachedFetch('/api/recipes'),
  cachedFetch('/api/recipes')
]);
```

### Patrón 4: Error Boundary + Circuit Breaker

```javascript
import { ErrorBoundary } from './utils/errors.js';
import { CircuitBreaker } from './utils/errors.js';

const breaker = new CircuitBreaker(fetchAPIData, {
  threshold: 5,
  timeout: 60000
});

const boundary = new ErrorBoundary({
  onError: (error) => {
    if (breaker.getState().state === 'OPEN') {
      showToast('Service temporarily unavailable', 'warning');
    } else {
      showToast(error.message, 'error');
    }
  }
});

const safeLoadData = boundary.wrap(async () => {
  return await breaker.execute();
});
```

### Patrón 5: Keyboard Shortcuts + Command Palette

```javascript
import { keyboard, CommandPalette } from './utils/keyboard.js';

const palette = new CommandPalette();

// Registrar comandos
palette.register('search', {
  name: 'Search',
  shortcut: 'ctrl+k',
  handler: openSearch
});

palette.register('save', {
  name: 'Save',
  shortcut: 'ctrl+s',
  handler: saveDocument
});

// Habilitar shortcuts
keyboard.enable();
```

---

## 📦 Resumen de Archivos

| Archivo | Tamaño | Descripción |
|---------|--------|-------------|
| `utils/optimistic.js` | ~250 líneas | Optimistic UI updates |
| `utils/timing.js` | ~350 líneas | Debounce, throttle, retry, memoize |
| `utils/requests.js` | ~400 líneas | Dedup, offline queue, cache |
| `utils/analytics.js` | ~350 líneas | Analytics tracking |
| `utils/keyboard.js` | ~450 líneas | Keyboard shortcuts |
| `utils/errors.js` | ~450 líneas | Error handling |
| **Total** | **~2,250 líneas** | **6 utilidades** |

---

## 🚀 Quick Start

```javascript
// app.js - inicialización

import { keyboard, commonShortcuts } from './utils/keyboard.js';
import { analytics, initAutoTracking, initErrorTracking } from './utils/analytics.js';
import { errorLogger } from './utils/errors.js';

// Habilitar keyboard shortcuts
keyboard.enable();
commonShortcuts.search(() => openSearch());
commonShortcuts.save(() => saveDocument());

// Habilitar analytics
initAutoTracking();
initErrorTracking();

// Track page view
analytics.page();

// Listo! Todas las utilidades están disponibles
```

---

## 💡 Tips y Mejores Prácticas

### 1. Optimistic UI
- ✅ Úsalo para acciones frecuentes (like, delete, toggle)
- ✅ Siempre implementa rollback
- ❌ No uses para operaciones críticas (pagos, autenticación)

### 2. Debounce vs Throttle
- **Debounce**: Cuando solo importa el último valor (search, form validation)
- **Throttle**: Cuando quieres limitar frecuencia pero no perder eventos (scroll, resize)

### 3. Request Deduplication
- ✅ Perfecto para components que llaman misma API
- ✅ Usa custom keys para diferentes contextos
- ❌ No uses para mutaciones (POST, PUT, DELETE)

### 4. Analytics
- ✅ Track eventos importantes (conversions, errors)
- ✅ Usa `data-track` para clicks simples
- ❌ No tracks excesivos (performance)

### 5. Keyboard Shortcuts
- ✅ Usa shortcuts estándar (ctrl+s, ctrl+k)
- ✅ Desactiva en inputs por defecto
- ❌ No sobrescribas shortcuts del navegador

### 6. Error Handling
- ✅ Siempre usa try/catch en async code
- ✅ Implementa fallbacks para failures
- ✅ Log errores para debugging

---

**Fecha**: 2025-11-12
**Versión**: 1.0
**Total de utilidades**: 6 archivos, ~2,250 líneas

✅ **Todas las utilidades son production-ready y zero-dependency**
