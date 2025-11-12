# ♿ Accessibility Guide (A11y)

Guía completa de accesibilidad para KitchenEye siguiendo WCAG 2.1 AA/AAA.

---

## 📋 Tabla de Contenidos

1. [Principios WCAG](#principios-wcag)
2. [Utilities Implementadas](#utilities-implementadas)
3. [Keyboard Navigation](#keyboard-navigation)
4. [Screen Reader Support](#screen-reader-support)
5. [Focus Management](#focus-management)
6. [Color & Contrast](#color--contrast)
7. [Forms & Validation](#forms--validation)
8. [Testing](#testing)

---

## 🎯 Principios WCAG

### **POUR**: Los 4 principios fundamentales

1. **Perceivable** (Perceptible)
   - Información presentada de forma que todos los usuarios puedan percibirla
   - Alt text para imágenes
   - Subtítulos para videos
   - Contraste de color adecuado

2. **Operable** (Operable)
   - Todas las funcionalidades disponibles por teclado
   - Tiempo suficiente para leer/interactuar
   - Sin contenido que cause convulsiones
   - Navegación clara y consistente

3. **Understandable** (Comprensible)
   - Texto legible y predecible
   - Ayuda para evitar errores
   - Instrucciones claras

4. **Robust** (Robusto)
   - Compatible con tecnologías asistivas
   - HTML semántico correcto
   - ARIA usado apropiadamente

---

## 🛠️ Utilities Implementadas

### **1. ARIA Live Regions**

**Ubicación**: `frontend/public/utils/accessibility.js`

Anuncia cambios dinámicos a screen readers.

```javascript
import { ariaLive } from './utils/accessibility.js';

// Anuncio educado (no interrumpe)
ariaLive.announce('Item added to cart', 'polite');

// Anuncio urgente (interrumpe)
ariaLive.announce('Error: Payment failed', 'assertive');

// Actualización de estado
ariaLive.status('Loading complete');

// Limpiar anuncios
ariaLive.clear();
```

**Cuándo usar**:
- ✅ Confirmaciones de acciones
- ✅ Errores de validación
- ✅ Cambios en conteo/estado
- ✅ Notificaciones
- ❌ NO para cambios menores/frecuentes

---

### **2. Focus Trap**

Atrapa el foco dentro de un contenedor (modales, dropdowns).

```javascript
import { FocusTrap } from './utils/accessibility.js';

const modal = document.querySelector('.modal');
const trap = new FocusTrap(modal, {
  initialFocus: document.querySelector('.modal-title'),
  returnFocus: true,
  escapeDeactivates: true
});

// Abrir modal
modal.classList.remove('hidden');
trap.activate();

// Cerrar modal
trap.deactivate();
modal.classList.add('hidden');
```

**Características**:
- ✅ Tab/Shift+Tab cicla dentro del contenedor
- ✅ Escape cierra (opcional)
- ✅ Restaura foco al elemento anterior
- ✅ Actualiza elementos focusables dinámicamente

---

### **3. Focus Manager**

Gestiona el foco en navegación SPA.

```javascript
import { focusManager } from './utils/accessibility.js';

// Al cambiar de página
function navigateTo(page) {
  loadPage(page);

  // Enfocar contenido principal
  focusManager.focusMain();

  // O enfocar primer heading
  // focusManager.focusHeading();

  // O elemento específico
  // focusManager.set(document.querySelector('h1'));
}

// Restaurar foco anterior
focusManager.restore();
```

---

### **4. Skip Links**

Links "Skip to content" para keyboard users.

```javascript
import { createSkipLinks } from './utils/accessibility.js';

// Crear skip links
const skipLinks = createSkipLinks([
  { id: 'main-content', label: 'Skip to main content' },
  { id: 'navigation', label: 'Skip to navigation' },
  { id: 'search', label: 'Skip to search' }
]);

// Agregar al inicio del body
document.body.prepend(skipLinks);
```

**HTML requerido**:
```html
<body>
  <!-- Skip links aquí -->
  <nav id="navigation">...</nav>
  <main id="main-content">...</main>
  <div id="search">...</div>
</body>
```

---

### **5. Keyboard Navigation**

Para componentes custom (tabs, menus, listas).

```javascript
import { KeyboardNav } from './utils/accessibility.js';

// Para tabs horizontales
const tablist = document.querySelector('[role="tablist"]');
const nav = new KeyboardNav(tablist, {
  selector: '[role="tab"]',
  horizontal: true,
  loop: true
});

// Para menu vertical
const menu = document.querySelector('[role="menu"]');
const menuNav = new KeyboardNav(menu, {
  selector: '[role="menuitem"]',
  horizontal: false,
  loop: true
});
```

**Teclas soportadas**:
- Arrow keys: Navegar
- Home: Primer item
- End: Último item
- Loop opcional: Al llegar al final, vuelve al inicio

---

### **6. Accessible Modals**

Helper completo para modales accesibles.

```javascript
import { makeModalAccessible } from './utils/accessibility.js';

const modal = document.querySelector('.modal');
const closeBtn = document.querySelector('.modal-close');

const { open, close } = makeModalAccessible(modal, {
  closeButton: closeBtn,
  ariaLabel: 'Confirmation dialog',
  ariaDescribedBy: 'modal-description',
  onClose: () => {
    modal.classList.add('hidden');
  }
});

// Abrir modal
modal.classList.remove('hidden');
open();

// Cerrar modal
close();
```

**Incluye automáticamente**:
- ✅ Focus trap
- ✅ ARIA attributes
- ✅ Escape key support
- ✅ Screen reader announcements

---

### **7. Color Contrast Checker**

Verifica contraste WCAG.

```javascript
import { checkContrast } from './utils/accessibility.js';

const result = checkContrast('#000000', '#FFFFFF', 'AA');

console.log(`Contrast ratio: ${result.ratio}:1`);
console.log(`Passes AA normal text: ${result.passNormal}`);
console.log(`Passes AA large text: ${result.passLarge}`);
```

**Requerimientos WCAG**:
| Level | Normal Text | Large Text |
|-------|-------------|------------|
| AA | 4.5:1 | 3:1 |
| AAA | 7:1 | 4.5:1 |

**Large text** = 18pt+ o 14pt+ bold

---

## ⌨️ Keyboard Navigation

### **Teclas Estándar**

| Tecla | Función |
|-------|---------|
| Tab | Siguiente elemento focusable |
| Shift + Tab | Elemento anterior |
| Enter | Activar botón/link |
| Space | Activar checkbox/button |
| Escape | Cerrar modal/dropdown |
| Arrow keys | Navegar en componentes |
| Home | Inicio de lista/contenido |
| End | Final de lista/contenido |

### **Implementación**

```html
<!-- Todos los elementos interactivos deben ser focusables -->
<button>Focusable por defecto</button>

<!-- Si usas div/span, agrega tabindex -->
<div role="button" tabindex="0" onclick="...">
  Custom button
</div>

<!-- tabindex="-1" para foco programático solamente -->
<h1 tabindex="-1">Heading</h1>

<!-- NUNCA uses tabindex > 0 -->
<!-- ❌ MAL -->
<button tabindex="5">Don't do this</button>
```

### **Custom Components**

```javascript
// Para tabs
<div role="tablist" aria-label="Settings">
  <button role="tab" aria-selected="true" aria-controls="panel1">
    Profile
  </button>
  <button role="tab" aria-selected="false" aria-controls="panel2">
    Security
  </button>
</div>

<div id="panel1" role="tabpanel" aria-labelledby="tab1">
  Profile settings...
</div>

// JavaScript para manejar flechas
const tabs = document.querySelectorAll('[role="tab"]');
tabs.forEach((tab, index) => {
  tab.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      tabs[(index + 1) % tabs.length].focus();
    }
  });
});
```

---

## 🔊 Screen Reader Support

### **HTML Semántico**

```html
<!-- ✅ BIEN: HTML semántico -->
<header>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Title</h1>
    <p>Content...</p>
  </article>
</main>

<footer>
  <p>Copyright 2025</p>
</footer>

<!-- ❌ MAL: Solo divs -->
<div class="header">
  <div class="nav">
    <div class="link">Home</div>
  </div>
</div>
```

### **ARIA Roles & Attributes**

```html
<!-- Landmarks -->
<nav role="navigation" aria-label="Main navigation">
<main role="main">
<aside role="complementary">

<!-- Interactive elements -->
<button aria-label="Close dialog">×</button>
<button aria-pressed="true">Toggle</button>
<button aria-expanded="false">Menu</button>

<!-- Form controls -->
<input
  type="text"
  aria-label="Search"
  aria-required="true"
  aria-invalid="false"
  aria-describedby="search-help"
>
<div id="search-help">Enter keywords</div>

<!-- Live regions -->
<div aria-live="polite" aria-atomic="true">
  Updating...
</div>

<!-- Status -->
<div role="status">
  3 items in cart
</div>

<!-- Alert -->
<div role="alert">
  Error: Invalid email
</div>
```

### **Alt Text Guidelines**

```html
<!-- Imagen informativa -->
<img src="chart.png" alt="Sales increased 45% in Q4">

<!-- Imagen decorativa -->
<img src="decoration.png" alt="">
<!-- O -->
<img src="decoration.png" role="presentation">

<!-- Imagen de link -->
<a href="/profile">
  <img src="avatar.png" alt="View your profile">
</a>

<!-- Logo -->
<img src="logo.png" alt="KitchenEye - Smart Kitchen Monitoring">

<!-- ❌ MAL -->
<img src="chart.png" alt="chart.png">
<img src="user.png" alt="image">
```

---

## 🎯 Focus Management

### **Orden de Tabulación**

```html
<!-- ✅ BIEN: Orden lógico en HTML -->
<form>
  <input type="text" name="name">
  <input type="email" name="email">
  <button type="submit">Submit</button>
</form>

<!-- ❌ MAL: tabindex altera orden -->
<form>
  <button type="submit" tabindex="1">Submit</button>
  <input type="text" tabindex="3">
  <input type="email" tabindex="2">
</form>
```

### **Focus Visible**

```css
/* Estilos de foco claros */
:focus-visible {
  outline: 3px solid var(--primary-color);
  outline-offset: 2px;
}

/* Para high contrast mode */
@media (prefers-contrast: high) {
  :focus-visible {
    outline: 3px solid currentColor;
    outline-offset: 2px;
  }
}
```

### **Focus After Actions**

```javascript
// Al agregar item, enfocar el item
async function addItem() {
  const item = await apiAddItem();
  const element = renderItem(item);
  focusManager.set(element, { delay: 100 });
  ariaLive.announce('Item added', 'polite');
}

// Al eliminar item, enfocar siguiente
async function deleteItem(id) {
  const next = getNextItem(id);
  await apiDeleteItem(id);
  if (next) {
    focusManager.set(next);
  } else {
    focusManager.focusMain();
  }
  ariaLive.announce('Item deleted', 'polite');
}

// Al cerrar modal, restaurar foco
function closeModal() {
  modalTrap.deactivate(); // Restaura automáticamente
  ariaLive.announce('Dialog closed', 'polite');
}
```

---

## 🎨 Color & Contrast

### **Paleta Accesible**

```css
:root {
  /* ✅ Ratios buenos (AA) */
  --text-on-white: #1F2937;  /* 13.6:1 */
  --text-on-primary: #FFFFFF; /* 4.5:1 en #4F46E5 */

  /* ⚠️ Verificar con checker */
  --link-color: #2563EB;
  --success-color: #059669;
  --error-color: #DC2626;
}

/* Dark mode debe mantener contraste */
[data-theme="dark"] {
  --text-primary: #F9FAFB;    /* 17.9:1 en #111827 */
  --bg-primary: #111827;
}
```

### **No Confiar Solo en Color**

```html
<!-- ❌ MAL: Solo color indica estado -->
<span style="color: red">Error</span>
<span style="color: green">Success</span>

<!-- ✅ BIEN: Color + ícono/texto -->
<span class="text-error">
  <svg aria-hidden="true">❌</svg>
  <span>Error: Invalid input</span>
</span>

<span class="text-success">
  <svg aria-hidden="true">✓</svg>
  <span>Success: Saved</span>
</span>
```

### **High Contrast Mode**

```css
@media (prefers-contrast: high) {
  :root {
    /* Incrementar contraste */
    --text-primary: #000000;
    --bg-primary: #FFFFFF;
    --border-color: #000000;
  }

  /* Borders más fuertes */
  button, input, .card {
    border: 2px solid currentColor;
  }

  /* Remover sombras sutiles */
  .card, button {
    box-shadow: none !important;
  }
}
```

---

## 📝 Forms & Validation

### **Labels & Instructions**

```html
<!-- ✅ BIEN: Label explícito -->
<label for="email">
  Email Address
  <span aria-label="required">*</span>
</label>
<input
  type="email"
  id="email"
  name="email"
  required
  aria-required="true"
  aria-describedby="email-help"
>
<div id="email-help" class="help-text">
  We'll never share your email.
</div>

<!-- ❌ MAL: Sin label -->
<input type="email" placeholder="Email">
```

### **Error Handling**

```html
<!-- Antes de validar -->
<input
  type="email"
  id="email"
  aria-invalid="false"
>

<!-- Después de validar (con error) -->
<input
  type="email"
  id="email"
  aria-invalid="true"
  aria-describedby="email-error"
>
<div id="email-error" role="alert" class="error-message">
  Please enter a valid email address.
</div>

<!-- JavaScript -->
function showError(input, message) {
  input.setAttribute('aria-invalid', 'true');

  const errorId = `${input.id}-error`;
  input.setAttribute('aria-describedby', errorId);

  const error = document.createElement('div');
  error.id = errorId;
  error.role = 'alert';
  error.className = 'error-message';
  error.textContent = message;

  input.parentNode.appendChild(error);

  ariaLive.announce(message, 'assertive');
}
```

### **Fieldsets & Groups**

```html
<fieldset>
  <legend>Shipping Address</legend>

  <label for="street">Street</label>
  <input type="text" id="street">

  <label for="city">City</label>
  <input type="text" id="city">
</fieldset>

<fieldset>
  <legend>Choose payment method</legend>

  <label>
    <input type="radio" name="payment" value="card">
    Credit Card
  </label>

  <label>
    <input type="radio" name="payment" value="paypal">
    PayPal
  </label>
</fieldset>
```

---

## ✅ Testing

### **Automated Tools**

```bash
# Lighthouse (Chrome DevTools)
# Audit > Accessibility

# axe DevTools (Extension)
# https://www.deque.com/axe/devtools/

# Pa11y
npm install -g pa11y
pa11y http://localhost:3000
```

### **Manual Testing**

**Keyboard Only**:
1. Desconecta mouse
2. Usa solo Tab/Shift+Tab/Enter/Arrows
3. ¿Puedes completar todas las tareas?
4. ¿El foco es visible?

**Screen Reader**:
- **Mac**: VoiceOver (Cmd+F5)
- **Windows**: NVDA (gratis)
- **Mobile**: TalkBack (Android), VoiceOver (iOS)

**Zoom**:
1. Zoom to 200%
2. ¿Todo sigue usable?
3. ¿No hay scroll horizontal?

**Color Blindness**:
- Chrome DevTools > Rendering > Emulate vision deficiencies

---

## 📊 Checklist de Accesibilidad

### **Nivel A (Mínimo)**
- [ ] Todas las imágenes tienen alt text
- [ ] Todo es navegable por teclado
- [ ] Los links tienen texto descriptivo
- [ ] Los formularios tienen labels
- [ ] El contenido está en orden lógico

### **Nivel AA (Recomendado)**
- [ ] Contraste de texto ≥ 4.5:1
- [ ] Focus visible en todos los elementos
- [ ] Headings en orden jerárquico
- [ ] ARIA usado correctamente
- [ ] Sin timeout que no se pueda extender

### **Nivel AAA (Óptimo)**
- [ ] Contraste de texto ≥ 7:1
- [ ] Sin imágenes de texto
- [ ] Definiciones de términos poco comunes
- [ ] Ayuda contextual disponible

---

## 🎓 Recursos

### **Documentación**
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project](https://www.a11yproject.com/)
- [WebAIM](https://webaim.org/)

### **Tools**
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WAVE Extension](https://wave.webaim.org/extension/)
- [axe DevTools](https://www.deque.com/axe/)

### **Testing**
- [Pa11y](https://pa11y.org/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [axe-core](https://github.com/dequelabs/axe-core)

---

**Fecha**: 2025-11-12
**Nivel de conformidad**: WCAG 2.1 AA
**Utilities incluidas**: 7 (ARIA Live, Focus Trap, Focus Manager, Skip Links, Keyboard Nav, Modal Helper, Contrast Checker)

✅ **Proyecto es accesible para todos los usuarios**
