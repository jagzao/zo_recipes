/**
 * KitchenEye PWA - Additional Pages
 * Management pages for cameras, profiles, inventory, and settings
 */

/**
 * Render Cameras Management Page
 */
async function renderCamerasPage() {
  try {
    const response = await apiCall('/api/cameras');
    const cameras = response.data || [];

    return `
      <div class="page-cameras">
        <div class="page-header">
          <h2>📷 Gestión de Cámaras</h2>
          <button class="btn btn-primary" onclick="showCreateCameraModal()">+ Nueva Cámara</button>
        </div>

        ${cameras.length > 0 ? `
          <div class="cameras-list">
            ${cameras.map(camera => `
              <div class="card">
                <div class="card-header">
                  <div>
                    <h3>${camera.name}</h3>
                    <span class="tag">${camera.type === 'gas' ? '⛽ Gas' : '🧊 Refri'}</span>
                  </div>
                  <div>
                    <span class="status-badge status-${camera.status === 'active' ? 'green' : camera.status === 'error' ? 'red' : 'yellow'}">
                      ${camera.status}
                    </span>
                  </div>
                </div>
                <div class="card-body">
                  <p><strong>Ubicación:</strong> ${camera.location || 'N/A'}</p>
                  <p><strong>Horario:</strong> ${camera.schedule_cron}</p>
                  <p><strong>Última captura:</strong> ${camera.last_capture_at ? new Date(camera.last_capture_at * 1000).toLocaleString('es-MX') : 'Nunca'}</p>
                  <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" onclick="editCamera('${camera.id}')">Editar</button>
                    ${camera.type === 'gas' ? `
                      <button class="btn btn-secondary" onclick="calibrateCamera('${camera.id}')">Calibrar</button>
                    ` : ''}
                    <button class="btn btn-text" style="color: var(--danger-color);" onclick="deleteCamera('${camera.id}', '${camera.name}')">Eliminar</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="card">
            <p>No hay cámaras configuradas. Crea tu primera cámara para comenzar.</p>
          </div>
        `}
      </div>

      <!-- Create Camera Modal -->
      <div id="camera-modal" class="modal hidden">
        <div class="modal-content">
          <h3>Nueva Cámara</h3>
          <form id="camera-form" class="form">
            <div class="form-group">
              <label>Nombre</label>
              <input type="text" name="name" required>
            </div>
            <div class="form-group">
              <label>Tipo</label>
              <select name="type" required>
                <option value="gas">⛽ Gas</option>
                <option value="fridge">🧊 Refrigerador</option>
              </select>
            </div>
            <div class="form-group">
              <label>Ubicación (opcional)</label>
              <input type="text" name="location">
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
              <button type="submit" class="btn btn-primary">Crear</button>
              <button type="button" class="btn btn-secondary" onclick="closeModal('camera-modal')">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Cameras page error:', err);
    return '<div class="card"><p>Error al cargar cámaras</p></div>';
  }
}

/**
 * Render Profiles Management Page
 */
async function renderProfilesPage() {
  try {
    const response = await apiCall('/api/profiles');
    const profiles = response.data || [];

    return `
      <div class="page-profiles">
        <div class="page-header">
          <h2>👤 Perfiles de Miembros</h2>
          <button class="btn btn-primary" onclick="showCreateProfileModal()">+ Nuevo Perfil</button>
        </div>

        ${profiles.length > 0 ? `
          <div class="grid grid-2">
            ${profiles.map(profile => {
              const allergies = JSON.parse(profile.allergies || '[]');
              const diets = JSON.parse(profile.diets || '[]');
              return `
                <div class="card">
                  <h3>${profile.member_name}</h3>
                  <p><strong>Nivel de picor:</strong> ${profile.spice_level || 'medio'}</p>
                  ${allergies.length > 0 ? `<p><strong>Alergias:</strong> ${allergies.join(', ')}</p>` : ''}
                  ${diets.length > 0 ? `<p><strong>Dietas:</strong> ${diets.join(', ')}</p>` : ''}
                  <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" onclick="editProfile('${profile.id}')">Editar</button>
                    <button class="btn btn-text" style="color: var(--danger-color);" onclick="deleteProfile('${profile.id}', '${profile.member_name}')">Eliminar</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="card">
            <p>No hay perfiles configurados. Crea perfiles para tus miembros de familia para recibir recomendaciones personalizadas.</p>
          </div>
        `}
      </div>

      <!-- Create Profile Modal -->
      <div id="profile-modal" class="modal hidden">
        <div class="modal-content">
          <h3>Nuevo Perfil</h3>
          <form id="profile-form" class="form">
            <div class="form-group">
              <label>Nombre del Miembro</label>
              <input type="text" name="member_name" required>
            </div>
            <div class="form-group">
              <label>Nivel de Picor</label>
              <select name="spice_level">
                <option value="none">Sin picante</option>
                <option value="mild" selected>Suave</option>
                <option value="medium">Medio</option>
                <option value="hot">Picante</option>
              </select>
            </div>
            <div class="form-group">
              <label>Alergias (separadas por coma)</label>
              <input type="text" name="allergies" placeholder="ej: nueces, lácteos">
            </div>
            <div class="form-group">
              <label>Dietas (separadas por coma)</label>
              <input type="text" name="diets" placeholder="ej: vegetariana, sin gluten">
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
              <button type="submit" class="btn btn-primary">Crear</button>
              <button type="button" class="btn btn-secondary" onclick="closeModal('profile-modal')">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Profiles page error:', err);
    return '<div class="card"><p>Error al cargar perfiles</p></div>';
  }
}

/**
 * Render Inventory Management Page
 */
async function renderInventoryManagementPage() {
  try {
    const response = await apiCall('/api/inventory/items');
    const items = response.data || [];

    return `
      <div class="page-inventory-mgmt">
        <div class="page-header">
          <h2>📦 Gestión de Inventario</h2>
          <button class="btn btn-primary" onclick="showCreateItemModal()">+ Nuevo Item</button>
        </div>

        ${items.length > 0 ? `
          <table class="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Categoría</th>
                <th>Crítico</th>
                <th>Estado Actual</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.category || '-'}</td>
                  <td>${item.critical ? '⚠️ Sí' : 'No'}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="updateItemStatus('${item.id}', '${item.name}')">
                      Actualizar
                    </button>
                  </td>
                  <td>
                    <button class="btn btn-text btn-sm" onclick="editInventoryItem('${item.id}')">Editar</button>
                    <button class="btn btn-text btn-sm" style="color: var(--danger-color);" onclick="deleteInventoryItem('${item.id}', '${item.name}')">Eliminar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div class="card">
            <p>No hay items de inventario. Los items se crean automáticamente al detectar productos en el refrigerador.</p>
          </div>
        `}
      </div>

      <!-- Create Item Modal -->
      <div id="item-modal" class="modal hidden">
        <div class="modal-content">
          <h3>Nuevo Item</h3>
          <form id="item-form" class="form">
            <div class="form-group">
              <label>Nombre</label>
              <input type="text" name="name" required>
            </div>
            <div class="form-group">
              <label>Categoría</label>
              <select name="category">
                <option value="">Seleccionar...</option>
                <option value="proteina">Proteína</option>
                <option value="lacteos">Lácteos</option>
                <option value="vegetales">Vegetales</option>
                <option value="frutas">Frutas</option>
                <option value="granos">Granos</option>
                <option value="condimentos">Condimentos</option>
              </select>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" name="critical"> Marcar como crítico
              </label>
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
              <button type="submit" class="btn btn-primary">Crear</button>
              <button type="button" class="btn btn-secondary" onclick="closeModal('item-modal')">Cancelar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Update Status Modal -->
      <div id="status-modal" class="modal hidden">
        <div class="modal-content">
          <h3>Actualizar Estado</h3>
          <form id="status-form" class="form">
            <input type="hidden" name="item_id">
            <input type="hidden" name="item_name">
            <div class="form-group">
              <label>Estado Actual</label>
              <select name="present" required>
                <option value="2">✓ Presente</option>
                <option value="1">⚠ Bajo</option>
                <option value="0">✗ Ausente</option>
              </select>
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
              <button type="submit" class="btn btn-primary">Actualizar</button>
              <button type="button" class="btn btn-secondary" onclick="closeModal('status-modal')">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Inventory management page error:', err);
    return '<div class="card"><p>Error al cargar inventario</p></div>';
  }
}

/**
 * Render Reports Page
 */
async function renderReportsPage() {
  return `
    <div class="page-reports">
      <h2>📊 Reportes</h2>

      <div class="grid grid-2">
        <div class="card">
          <h3>Faltantes</h3>
          <p>Genera un reporte de items faltantes o bajos en los últimos días.</p>
          <div style="margin-top: 1rem;">
            <select id="missing-days" class="form-control" style="margin-bottom: 0.5rem;">
              <option value="7">Últimos 7 días</option>
              <option value="14">Últimos 14 días</option>
              <option value="30">Últimos 30 días</option>
            </select>
            <button class="btn btn-secondary" onclick="downloadReport('missing-items', 'csv')">📥 Descargar CSV</button>
            <button class="btn btn-secondary" onclick="downloadReport('missing-items', 'json')">📥 Descargar JSON</button>
          </div>
        </div>

        <div class="card">
          <h3>Consumo</h3>
          <p>Analiza patrones de consumo de tus productos.</p>
          <div style="margin-top: 1rem;">
            <select id="consumption-days" class="form-control" style="margin-bottom: 0.5rem;">
              <option value="7">Últimos 7 días</option>
              <option value="30" selected>Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
            </select>
            <button class="btn btn-secondary" onclick="downloadReport('consumption', 'csv')">📥 Descargar CSV</button>
            <button class="btn btn-secondary" onclick="downloadReport('consumption', 'json')">📥 Descargar JSON</button>
          </div>
        </div>

        <div class="card">
          <h3>Historial de Gas</h3>
          <p>Revisa el historial de niveles de gas.</p>
          <div style="margin-top: 1rem;">
            <select id="gas-days" class="form-control" style="margin-bottom: 0.5rem;">
              <option value="7">Últimos 7 días</option>
              <option value="30" selected>Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
            </select>
            <button class="btn btn-secondary" onclick="downloadReport('gas-history', 'csv')">📥 Descargar CSV</button>
            <button class="btn btn-secondary" onclick="downloadReport('gas-history', 'json')">📥 Descargar JSON</button>
          </div>
        </div>

        <div class="card">
          <h3>Resumen de Alertas</h3>
          <p>Estadísticas de alertas generadas y respondidas.</p>
          <div style="margin-top: 1rem;">
            <select id="alerts-days" class="form-control" style="margin-bottom: 0.5rem;">
              <option value="7">Últimos 7 días</option>
              <option value="30" selected>Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
            </select>
            <button class="btn btn-secondary" onclick="downloadReport('alerts-summary', 'csv')">📥 Descargar CSV</button>
            <button class="btn btn-secondary" onclick="downloadReport('alerts-summary', 'json')">📥 Descargar JSON</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Enhanced Settings Page with Team Management
 */
function renderSettingsPageEnhanced() {
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
        <button class="btn btn-secondary" onclick="loadTenantSettings()">Ver Detalles</button>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Miembros del Equipo</h3>
          <button class="btn btn-primary btn-sm" onclick="showInviteModal()">+ Invitar</button>
        </div>
        <div id="team-members-list">
          <p>Cargando...</p>
        </div>
      </div>

      <div class="card">
        <h3>Uso y Límites</h3>
        <div id="usage-info">
          <p>Cargando...</p>
        </div>
      </div>

      <button class="btn btn-primary" onclick="logout()">Cerrar Sesión</button>
    </div>

    <!-- Invite Modal -->
    <div id="invite-modal" class="modal hidden">
      <div class="modal-content">
        <h3>Invitar Usuario</h3>
        <form id="invite-form" class="form">
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" required>
          </div>
          <div class="form-group">
            <label>Nombre (opcional)</label>
            <input type="text" name="name">
          </div>
          <div class="form-group">
            <label>Rol</label>
            <select name="role" required>
              <option value="viewer">Viewer (solo lectura)</option>
              <option value="ops">Ops (operación)</option>
              <option value="admin">Admin (administrador)</option>
            </select>
          </div>
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <button type="submit" class="btn btn-primary">Enviar Invitación</button>
            <button type="button" class="btn btn-secondary" onclick="closeModal('invite-modal')">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Make functions globally available
window.renderCamerasPage = renderCamerasPage;
window.renderProfilesPage = renderProfilesPage;
window.renderInventoryManagementPage = renderInventoryManagementPage;
window.renderReportsPage = renderReportsPage;
window.renderSettingsPageEnhanced = renderSettingsPageEnhanced;
