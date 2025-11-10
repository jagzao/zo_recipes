/**
 * KitchenEye PWA - Main Application Logic
 */

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787'
  : 'https://api.kitcheneye.com';

// Application State
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  tenant: JSON.parse(localStorage.getItem('tenant') || 'null'),
  currentPage: 'home',
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initApp();
});

/**
 * Initialize Service Worker for PWA
 */
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('Service Worker registered', reg))
      .catch((err) => console.error('Service Worker registration failed', err));
  }
}

/**
 * Initialize Application
 */
function initApp() {
  const loginScreen = document.getElementById('login-screen');
  const mainScreen = document.getElementById('main-screen');
  const loading = document.getElementById('loading');

  // Check authentication
  setTimeout(() => {
    loading.classList.add('hidden');

    if (state.token && state.user) {
      showMainScreen();
    } else {
      showLoginScreen();
    }
  }, 500);

  // Setup event listeners
  setupLoginForm();
  setupSignupForm();
  setupNavigation();
}

/**
 * Show Login Screen
 */
function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('main-screen').classList.add('hidden');
}

/**
 * Show Main Screen
 */
function showMainScreen() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('main-screen').classList.remove('hidden');
  loadPage('home');
}

/**
 * Setup Login Form
 */
function setupLoginForm() {
  const form = document.getElementById('login-form');
  const signupBtn = document.getElementById('signup-btn');
  const signupContainer = document.getElementById('signup-form-container');
  const cancelSignup = document.getElementById('cancel-signup');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (result.success) {
        state.token = result.data.token;
        state.user = result.data.user;
        state.tenant = result.data.tenant;

        localStorage.setItem('token', state.token);
        localStorage.setItem('user', JSON.stringify(state.user));
        localStorage.setItem('tenant', JSON.stringify(state.tenant));

        showToast('¡Bienvenido de vuelta!', 'success');
        showMainScreen();
      } else {
        showToast(result.error.message || 'Error al iniciar sesión', 'error');
      }
    } catch (err) {
      console.error('Login error:', err);
      showToast('Error de conexión. Intenta de nuevo.', 'error');
    }
  });

  signupBtn.addEventListener('click', () => {
    form.classList.add('hidden');
    signupBtn.classList.add('hidden');
    signupContainer.classList.remove('hidden');
  });

  cancelSignup.addEventListener('click', () => {
    form.classList.remove('hidden');
    signupBtn.classList.remove('hidden');
    signupContainer.classList.add('hidden');
  });
}

/**
 * Setup Signup Form
 */
function setupSignupForm() {
  const form = document.getElementById('signup-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('signup-email').value;
    const name = document.getElementById('signup-name').value;
    const tenantName = document.getElementById('tenant-name').value;

    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, tenant_name: tenantName }),
      });

      const result = await response.json();

      if (result.success) {
        state.token = result.data.token;
        state.user = result.data.user;
        state.tenant = result.data.tenant;

        localStorage.setItem('token', state.token);
        localStorage.setItem('user', JSON.stringify(state.user));
        localStorage.setItem('tenant', JSON.stringify(state.tenant));

        showToast('¡Cuenta creada exitosamente!', 'success');
        showMainScreen();
      } else {
        showToast(result.error.message || 'Error al registrar', 'error');
      }
    } catch (err) {
      console.error('Signup error:', err);
      showToast('Error de conexión. Intenta de nuevo.', 'error');
    }
  });
}

/**
 * Setup Navigation
 */
function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;

      // Update active state
      navLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');

      // Load page
      loadPage(page);
    });
  });
}

/**
 * Load Page Content
 */
async function loadPage(page) {
  state.currentPage = page;
  const content = document.getElementById('page-content');

  switch (page) {
    case 'home':
      content.innerHTML = await renderHomePage();
      break;
    case 'recipes':
      content.innerHTML = await renderRecipesPage();
      break;
    case 'status':
      content.innerHTML = await renderStatusPage();
      break;
    case 'alerts':
      content.innerHTML = await renderAlertsPage();
      break;
    case 'settings':
      content.innerHTML = renderSettingsPage();
      break;
    default:
      content.innerHTML = '<p>Página no encontrada</p>';
  }
}

/**
 * Render Home Page
 */
async function renderHomePage() {
  try {
    // Fetch quick summary
    const [recipes, alerts, inventory] = await Promise.all([
      apiCall('/api/recipes?limit=5'),
      apiCall('/api/alerts?unacknowledged=true&limit=5'),
      apiCall('/api/status/inventory'),
    ]);

    const recipesData = recipes.data || [];
    const alertsData = alerts.data?.alerts || [];
    const inventorySummary = inventory.data?.summary || {};

    return `
      <div class="page-home">
        <h2>Bienvenido, ${state.user.name || state.user.email} 👋</h2>
        <p class="text-secondary">Aquí está el resumen de tu cocina</p>

        ${alertsData.length > 0 ? `
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">🔔 Alertas Pendientes</h3>
              <span class="status-badge status-red">${alertsData.length}</span>
            </div>
            <div class="card-body">
              ${alertsData.slice(0, 3).map(alert => `
                <div style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                  <strong>${alert.title}</strong>
                  <p style="font-size: 0.875rem; color: var(--text-secondary);">${alert.message || ''}</p>
                </div>
              `).join('')}
              <a href="#alerts" class="nav-link" data-page="alerts" style="margin-top: 0.5rem; display: inline-block;">Ver todas →</a>
            </div>
          </div>
        ` : ''}

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📦 Estado del Inventario</h3>
          </div>
          <div class="card-body">
            <div style="display: flex; gap: 1rem; justify-content: space-around;">
              <div style="text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: var(--secondary-color);">${inventorySummary.present || 0}</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">Disponibles</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: var(--warning-color);">${inventorySummary.low || 0}</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">Bajos</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: var(--danger-color);">${inventorySummary.absent || 0}</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">Faltantes</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">🍳 Recetas Sugeridas</h3>
          </div>
          <div class="card-body">
            ${recipesData.length > 0 ? `
              <div class="grid grid-2">
                ${recipesData.map(recipe => renderRecipeCard(recipe)).join('')}
              </div>
            ` : '<p>No hay recetas disponibles</p>'}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Home page error:', err);
    return '<div class="card"><p>Error al cargar la página</p></div>';
  }
}

/**
 * Render Recipes Page
 */
async function renderRecipesPage() {
  try {
    const response = await apiCall('/api/recipes?limit=20');
    const recipes = response.data || [];

    return `
      <div class="page-recipes">
        <h2>📖 Recetas</h2>

        <div class="filters" style="margin-bottom: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn btn-secondary" onclick="filterRecipes('fresco')">🥗 Fresco</button>
          <button class="btn btn-secondary" onclick="filterRecipes('rapido')">⚡ Rápido</button>
          <button class="btn btn-secondary" onclick="filterRecipes('proteico')">🥩 Proteico</button>
          <button class="btn btn-secondary" onclick="filterRecipes('ninos')">👶 Para Niños</button>
        </div>

        ${recipes.length > 0 ? `
          <div class="grid grid-2">
            ${recipes.map(recipe => renderRecipeCard(recipe)).join('')}
          </div>
        ` : '<div class="card"><p>No hay recetas disponibles</p></div>'}
      </div>
    `;
  } catch (err) {
    console.error('Recipes page error:', err);
    return '<div class="card"><p>Error al cargar recetas</p></div>';
  }
}

/**
 * Render Status Page
 */
async function renderStatusPage() {
  try {
    const [gas, inventory, cameras] = await Promise.all([
      apiCall('/api/status/gas'),
      apiCall('/api/status/inventory'),
      apiCall('/api/status/cameras'),
    ]);

    const gasData = gas.data || [];
    const inventoryData = inventory.data || {};
    const camerasData = cameras.data || {};

    return `
      <div class="page-status">
        <h2>📊 Estado del Sistema</h2>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">⛽ Nivel de Gas</h3>
          </div>
          <div class="card-body">
            ${gasData.length > 0 ? `
              ${gasData[0] ? `
                <div style="text-align: center;">
                  <div style="font-size: 3rem; font-weight: bold;">${gasData[0].level_pct.toFixed(1)}%</div>
                  <div class="status-badge status-${gasData[0].status_enum}" style="margin-top: 0.5rem;">
                    ${gasData[0].status_enum === 'green' ? '✓ Normal' : gasData[0].status_enum === 'yellow' ? '⚠ Bajo' : '❗ Crítico'}
                  </div>
                </div>
              ` : '<p>Sin datos</p>'}
            ` : '<p>No hay cámaras de gas configuradas</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">🥕 Inventario del Refri</h3>
          </div>
          <div class="card-body">
            ${inventoryData.items && inventoryData.items.length > 0 ? `
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid var(--border-color);">
                    <th style="text-align: left; padding: 0.5rem;">Item</th>
                    <th style="text-align: center; padding: 0.5rem;">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  ${inventoryData.items.slice(0, 10).map(item => `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                      <td style="padding: 0.5rem;">${item.name}</td>
                      <td style="text-align: center; padding: 0.5rem;">
                        <span class="status-badge status-${item.status === 'present' ? 'green' : item.status === 'low' ? 'yellow' : 'red'}">
                          ${item.status === 'present' ? '✓' : item.status === 'low' ? '⚠' : '✗'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p>Sin datos de inventario</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📷 Estado de Cámaras</h3>
          </div>
          <div class="card-body">
            ${camerasData.cameras && camerasData.cameras.length > 0 ? `
              ${camerasData.cameras.map(cam => `
                <div style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                  <strong>${cam.name}</strong> (${cam.type})
                  <span class="status-badge status-${cam.is_offline ? 'red' : cam.status === 'active' ? 'green' : 'yellow'}" style="float: right;">
                    ${cam.is_offline ? 'Offline' : cam.status}
                  </span>
                </div>
              `).join('')}
            ` : '<p>No hay cámaras configuradas</p>'}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Status page error:', err);
    return '<div class="card"><p>Error al cargar estado</p></div>';
  }
}

/**
 * Render Alerts Page
 */
async function renderAlertsPage() {
  try {
    const response = await apiCall('/api/alerts?limit=50');
    const alerts = response.data?.alerts || [];

    return `
      <div class="page-alerts">
        <h2>🔔 Alertas</h2>

        ${alerts.length > 0 ? `
          <div class="alerts-list">
            ${alerts.map(alert => `
              <div class="card" style="border-left: 4px solid var(--${alert.level === 'critical' ? 'danger' : alert.level === 'warning' ? 'warning' : 'secondary'}-color);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                  <div>
                    <h4>${alert.title}</h4>
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">${alert.message || ''}</p>
                    <small style="color: var(--text-secondary);">${new Date(alert.created_at * 1000).toLocaleString('es-MX')}</small>
                  </div>
                  ${!alert.acknowledged ? `
                    <button class="btn btn-secondary" onclick="acknowledgeAlert('${alert.id}')">Reconocer</button>
                  ` : '<span class="status-badge status-green">✓ Reconocida</span>'}
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<div class="card"><p>No hay alertas</p></div>'}
      </div>
    `;
  } catch (err) {
    console.error('Alerts page error:', err);
    return '<div class="card"><p>Error al cargar alertas</p></div>';
  }
}

/**
 * Render Settings Page
 */
function renderSettingsPage() {
  return `
    <div class="page-settings">
      <h2>⚙️ Configuración</h2>

      <div class="card">
        <h3>Usuario</h3>
        <p><strong>Email:</strong> ${state.user.email}</p>
        <p><strong>Nombre:</strong> ${state.user.name || 'N/A'}</p>
      </div>

      <div class="card">
        <h3>Tenant</h3>
        <p><strong>Nombre:</strong> ${state.tenant.name}</p>
        <p><strong>ID:</strong> ${state.tenant.id}</p>
      </div>

      <button class="btn btn-primary" onclick="logout()">Cerrar Sesión</button>
    </div>
  `;
}

/**
 * Render Recipe Card
 */
function renderRecipeCard(recipe) {
  const cookTime = recipe.cook_time_min || 30;
  const score = recipe.score !== undefined ? Math.round(recipe.score) : 100;

  return `
    <div class="recipe-card">
      <img src="${recipe.hero_url || '/placeholder-recipe.jpg'}" alt="${recipe.title}" class="recipe-image" />
      <div class="recipe-content">
        <h4 class="recipe-title">${recipe.title}</h4>
        <div class="recipe-meta">
          <span>⏱ ${cookTime} min</span>
          <span>🍽 ${recipe.servings || 4} porciones</span>
          ${score < 100 ? `<span>📊 ${score}% match</span>` : ''}
        </div>
        ${recipe.match_explanation ? `
          <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
            ${recipe.match_explanation}
          </p>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * API Call Helper
 */
async function apiCall(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
      ...options.headers,
    },
  });

  return await response.json();
}

/**
 * Filter Recipes
 */
async function filterRecipes(intent) {
  const response = await apiCall(`/api/recipes?intent=${intent}&limit=20`);
  const recipes = response.data || [];

  const grid = document.querySelector('.page-recipes .grid');
  if (grid) {
    grid.innerHTML = recipes.map(recipe => renderRecipeCard(recipe)).join('');
  }
}

/**
 * Acknowledge Alert
 */
async function acknowledgeAlert(alertId) {
  try {
    await apiCall(`/api/alerts/${alertId}/ack`, { method: 'POST' });
    showToast('Alerta reconocida', 'success');
    loadPage('alerts'); // Reload
  } catch (err) {
    showToast('Error al reconocer alerta', 'error');
  }
}

/**
 * Logout
 */
function logout() {
  localStorage.clear();
  state.token = null;
  state.user = null;
  state.tenant = null;
  showLoginScreen();
  showToast('Sesión cerrada', 'success');
}

/**
 * Show Toast Notification
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Expose functions globally for inline event handlers
window.filterRecipes = filterRecipes;
window.acknowledgeAlert = acknowledgeAlert;
window.logout = logout;
