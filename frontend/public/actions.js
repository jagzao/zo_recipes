/**
 * KitchenEye PWA - Actions and Handlers
 * Form handlers, modal management, and API actions
 */

// ============================================================
// MODAL MANAGEMENT
// ============================================================

function showModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// ============================================================
// CAMERA MANAGEMENT
// ============================================================

function showCreateCameraModal() {
  showModal('camera-modal');
  const form = document.getElementById('camera-form');
  form.reset();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      type: formData.get('type'),
      location: formData.get('location') || undefined,
    };

    try {
      const response = await apiCall('/api/cameras', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.success) {
        showToast('Cámara creada exitosamente', 'success');
        closeModal('camera-modal');
        loadPage('cameras');
      } else {
        showToast(response.error?.message || 'Error al crear cámara', 'error');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    }
  };
}

async function deleteCamera(cameraId, cameraName) {
  if (!confirm(`¿Estás seguro de eliminar la cámara "${cameraName}"?`)) return;

  try {
    const response = await apiCall(`/api/cameras/${cameraId}`, {
      method: 'DELETE',
    });

    if (response.success) {
      showToast('Cámara eliminada', 'success');
      loadPage('cameras');
    } else {
      showToast(response.error?.message || 'Error al eliminar', 'error');
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

// ============================================================
// PROFILE MANAGEMENT
// ============================================================

function showCreateProfileModal() {
  showModal('profile-modal');
  const form = document.getElementById('profile-form');
  form.reset();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const allergiesStr = formData.get('allergies') || '';
    const dietsStr = formData.get('diets') || '';

    const data = {
      member_name: formData.get('member_name'),
      spice_level: formData.get('spice_level'),
      allergies: allergiesStr ? allergiesStr.split(',').map(s => s.trim()) : [],
      diets: dietsStr ? dietsStr.split(',').map(s => s.trim()) : [],
    };

    try {
      const response = await apiCall('/api/profiles', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.success) {
        showToast('Perfil creado exitosamente', 'success');
        closeModal('profile-modal');
        loadPage('profiles');
      } else {
        showToast(response.error?.message || 'Error al crear perfil', 'error');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    }
  };
}

async function deleteProfile(profileId, profileName) {
  if (!confirm(`¿Estás seguro de eliminar el perfil de "${profileName}"?`)) return;

  try {
    const response = await apiCall(`/api/profiles/${profileId}`, {
      method: 'DELETE',
    });

    if (response.success) {
      showToast('Perfil eliminado', 'success');
      loadPage('profiles');
    } else {
      showToast(response.error?.message || 'Error al eliminar', 'error');
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

// ============================================================
// INVENTORY MANAGEMENT
// ============================================================

function showCreateItemModal() {
  showModal('item-modal');
  const form = document.getElementById('item-form');
  form.reset();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const data = {
      name: formData.get('name'),
      category: formData.get('category') || undefined,
      critical: formData.get('critical') === 'on',
    };

    try {
      const response = await apiCall('/api/inventory/items', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.success) {
        showToast('Item creado exitosamente', 'success');
        closeModal('item-modal');
        loadPage('inventory-mgmt');
      } else {
        showToast(response.error?.message || 'Error al crear item', 'error');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    }
  };
}

function updateItemStatus(itemId, itemName) {
  showModal('status-modal');
  const form = document.getElementById('status-form');
  form.elements['item_id'].value = itemId;
  form.elements['item_name'].value = itemName;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const data = {
      present: parseInt(formData.get('present')),
    };

    try {
      const response = await apiCall(`/api/inventory/items/${itemId}/snapshot`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.success) {
        showToast('Estado actualizado', 'success');
        closeModal('status-modal');
        loadPage('inventory-mgmt');
      } else {
        showToast(response.error?.message || 'Error al actualizar', 'error');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    }
  };
}

async function deleteInventoryItem(itemId, itemName) {
  if (!confirm(`¿Estás seguro de eliminar "${itemName}"?`)) return;

  try {
    const response = await apiCall(`/api/inventory/items/${itemId}`, {
      method: 'DELETE',
    });

    if (response.success) {
      showToast('Item eliminado', 'success');
      loadPage('inventory-mgmt');
    } else {
      showToast(response.error?.message || 'Error al eliminar', 'error');
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

// ============================================================
// REPORTS
// ============================================================

async function downloadReport(reportType, format) {
  const daysSelectors = {
    'missing-items': 'missing-days',
    'consumption': 'consumption-days',
    'gas-history': 'gas-days',
    'alerts-summary': 'alerts-days',
  };

  const selectorId = daysSelectors[reportType];
  const days = document.getElementById(selectorId)?.value || '30';

  const url = `${API_BASE}/api/reports/${reportType}?days=${days}&format=${format}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${state.token}`,
      },
    });

    if (response.ok) {
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${reportType}-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Reporte descargado', 'success');
    } else {
      showToast('Error al descargar reporte', 'error');
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

// ============================================================
// TEAM MANAGEMENT
// ============================================================

async function loadTenantSettings() {
  try {
    const [membersResponse, usageResponse] = await Promise.all([
      apiCall(`/api/tenants/${state.tenant.id}/members`),
      apiCall(`/api/tenants/${state.tenant.id}/usage`),
    ]);

    // Update members list
    const members = membersResponse.data || [];
    const membersList = document.getElementById('team-members-list');
    if (membersList) {
      membersList.innerHTML = members.length > 0 ? `
        <table class="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${members.map(m => `
              <tr>
                <td>${m.email}</td>
                <td>${m.name || '-'}</td>
                <td>${m.role}</td>
                <td>
                  ${m.role !== 'owner' ? `
                    <button class="btn btn-text btn-sm" style="color: var(--danger-color);" onclick="removeMember('${m.id}', '${m.email}')">Eliminar</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>No hay miembros adicionales</p>';
    }

    // Update usage info
    const usage = usageResponse.data;
    const usageInfo = document.getElementById('usage-info');
    if (usageInfo && usage) {
      usageInfo.innerHTML = `
        <p><strong>Plan:</strong> ${usage.plan}</p>
        <p><strong>Capturas:</strong> ${usage.usage.captures} / ${usage.limits.max_captures_per_month}</p>
        <p><strong>Alertas:</strong> ${usage.usage.alerts_sent} / ${usage.limits.max_alerts_per_month}</p>
        <p><strong>Almacenamiento:</strong> ${usage.usage.storage_mb.toFixed(2)} MB / ${usage.limits.max_storage_mb} MB</p>
      `;
    }
  } catch (err) {
    console.error('Error loading tenant settings:', err);
  }
}

function showInviteModal() {
  showModal('invite-modal');
  const form = document.getElementById('invite-form');
  form.reset();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const data = {
      email: formData.get('email'),
      name: formData.get('name') || undefined,
      role: formData.get('role'),
    };

    try {
      const response = await apiCall(`/api/tenants/${state.tenant.id}/invite`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.success) {
        showToast('Invitación enviada', 'success');
        closeModal('invite-modal');
        loadTenantSettings();

        // Show invite URL
        alert(`Invitación creada.\n\nURL de invitación:\n${response.data.invite_url}\n\nComparte este link con el usuario invitado.`);
      } else {
        showToast(response.error?.message || 'Error al invitar', 'error');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    }
  };
}

async function removeMember(userId, userEmail) {
  if (!confirm(`¿Eliminar a ${userEmail} del equipo?`)) return;

  try {
    const response = await apiCall(`/api/tenants/${state.tenant.id}/members/${userId}`, {
      method: 'DELETE',
    });

    if (response.success) {
      showToast('Miembro eliminado', 'success');
      loadTenantSettings();
    } else {
      showToast(response.error?.message || 'Error al eliminar', 'error');
    }
  } catch (err) {
    showToast('Error de conexión', 'error');
  }
}

// Make functions globally available
window.showModal = showModal;
window.closeModal = closeModal;
window.showCreateCameraModal = showCreateCameraModal;
window.deleteCamera = deleteCamera;
window.showCreateProfileModal = showCreateProfileModal;
window.deleteProfile = deleteProfile;
window.showCreateItemModal = showCreateItemModal;
window.updateItemStatus = updateItemStatus;
window.deleteInventoryItem = deleteInventoryItem;
window.downloadReport = downloadReport;
window.loadTenantSettings = loadTenantSettings;
window.showInviteModal = showInviteModal;
window.removeMember = removeMember;
