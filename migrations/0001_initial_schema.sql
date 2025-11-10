-- KitchenEye Database Schema - Initial Migration
-- Multi-tenant SaaS with gas monitoring, fridge inventory, and recipe management

-- ============================================================
-- ACCOUNTS & TENANTS
-- ============================================================

-- Accounts (top-level billing entities)
CREATE TABLE accounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  owner_email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'cancelled')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_accounts_owner_email ON accounts(owner_email);
CREATE INDEX idx_accounts_status ON accounts(status);

-- Tenants (organizations/households within an account)
CREATE TABLE tenants (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
  logo_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'enterprise')),
  limits_json TEXT NOT NULL DEFAULT '{}', -- JSON with limits per plan
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'trial')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_tenants_account ON tenants(account_id);
CREATE INDEX idx_tenants_status ON tenants(status);

-- ============================================================
-- USERS & RBAC
-- ============================================================

-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'banned')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at INTEGER
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- User-Tenant-Role mapping (RBAC)
CREATE TABLE user_tenant_roles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'ops', 'viewer')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_user_tenant_roles_user ON user_tenant_roles(user_id);
CREATE INDEX idx_user_tenant_roles_tenant ON user_tenant_roles(tenant_id);

-- ============================================================
-- CAMERAS & IMAGE CAPTURE
-- ============================================================

-- Cameras
CREATE TABLE cameras (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('gas', 'fridge')),
  schedule_cron TEXT NOT NULL, -- Cron expression for capture schedule
  location TEXT, -- Physical location description
  config_json TEXT DEFAULT '{}', -- Camera-specific config (thresholds, calibration)
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'error', 'calibrating')),
  last_capture_at INTEGER,
  last_health_check_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_cameras_tenant ON cameras(tenant_id);
CREATE INDEX idx_cameras_type ON cameras(type);
CREATE INDEX idx_cameras_status ON cameras(status);

-- Images (optional storage, metadata always kept)
CREATE TABLE images (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  message_id TEXT UNIQUE, -- For idempotency
  blob_url TEXT, -- R2 URL for full image (optional)
  thumb_url TEXT, -- R2 URL for thumbnail
  captured_at INTEGER NOT NULL,
  processed_at INTEGER,
  cv_status TEXT NOT NULL DEFAULT 'pending' CHECK(cv_status IN ('pending', 'processing', 'completed', 'failed')),
  confidence REAL, -- Overall CV confidence score
  metadata_json TEXT DEFAULT '{}', -- Additional metadata from edge
  ttl_expires_at INTEGER, -- Auto-delete timestamp
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_images_camera ON images(camera_id);
CREATE INDEX idx_images_message_id ON images(message_id);
CREATE INDEX idx_images_captured_at ON images(captured_at);
CREATE INDEX idx_images_ttl ON images(ttl_expires_at) WHERE ttl_expires_at IS NOT NULL;

-- ============================================================
-- GAS MONITORING
-- ============================================================

-- Gas level measurements
CREATE TABLE gas_levels (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  image_id TEXT REFERENCES images(id) ON DELETE SET NULL,
  level_pct REAL NOT NULL CHECK(level_pct >= 0 AND level_pct <= 100),
  status_enum TEXT NOT NULL CHECK(status_enum IN ('red', 'yellow', 'green')),
  confidence REAL,
  calibration_version TEXT,
  captured_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_gas_levels_camera ON gas_levels(camera_id);
CREATE INDEX idx_gas_levels_captured_at ON gas_levels(captured_at);
CREATE INDEX idx_gas_levels_status ON gas_levels(status_enum);

-- ============================================================
-- FRIDGE INVENTORY
-- ============================================================

-- Inventory items (catalog per tenant)
CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT, -- dairy, meat, vegetables, etc.
  critical INTEGER NOT NULL DEFAULT 0, -- 1 if this is a critical item
  unit TEXT, -- piece, kg, liter, etc.
  min_quantity REAL, -- Minimum desired quantity
  config_json TEXT DEFAULT '{}', -- Item-specific settings
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_inventory_items_tenant ON inventory_items(tenant_id);
CREATE INDEX idx_inventory_items_category ON inventory_items(category);
CREATE INDEX idx_inventory_items_critical ON inventory_items(critical);

-- Inventory snapshots (detection results)
CREATE TABLE inventory_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  image_id TEXT REFERENCES images(id) ON DELETE SET NULL,
  present INTEGER NOT NULL CHECK(present IN (0, 1, 2)), -- 0=absent, 1=low, 2=present
  confidence REAL,
  quantity REAL, -- Estimated quantity if detectable
  level_pct REAL, -- Percentage level (0-100)
  captured_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_inventory_snapshots_item ON inventory_snapshots(item_id);
CREATE INDEX idx_inventory_snapshots_captured_at ON inventory_snapshots(captured_at);
CREATE INDEX idx_inventory_snapshots_present ON inventory_snapshots(present);

-- ============================================================
-- RECIPES & INGREDIENTS
-- ============================================================

-- Recipes
CREATE TABLE recipes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  steps_md TEXT NOT NULL, -- Markdown formatted steps
  tags TEXT DEFAULT '[]', -- JSON array: ["fresco", "rapido", "proteico"]
  diet_flags TEXT DEFAULT '[]', -- JSON array: ["vegetarian", "vegan", "gluten-free"]
  intents TEXT DEFAULT '[]', -- JSON array: ["fresco", "reconfortante", "ninos"]
  cook_time_min INTEGER, -- Total cooking time in minutes
  prep_time_min INTEGER,
  servings INTEGER DEFAULT 4,
  difficulty TEXT CHECK(difficulty IN ('facil', 'media', 'avanzada')),
  hero_url TEXT, -- Hero image URL
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_recipes_tenant ON recipes(tenant_id);
CREATE INDEX idx_recipes_enabled ON recipes(enabled);
CREATE INDEX idx_recipes_cook_time ON recipes(cook_time_min);

-- Recipe ingredients mapping
CREATE TABLE recipe_ingredients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES inventory_items(id) ON DELETE SET NULL,
  ingredient_name TEXT NOT NULL, -- Name if not mapped to inventory item
  quantity REAL,
  unit TEXT,
  optional INTEGER NOT NULL DEFAULT 0,
  substitutes TEXT DEFAULT '[]', -- JSON array of substitute item_ids or names
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_item ON recipe_ingredients(item_id);
CREATE INDEX idx_recipe_ingredients_optional ON recipe_ingredients(optional);

-- ============================================================
-- USER PROFILES (for personalized recipes)
-- ============================================================

-- Member profiles within a tenant
CREATE TABLE profiles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  allergies TEXT DEFAULT '[]', -- JSON array: ["nuts", "dairy"]
  diets TEXT DEFAULT '[]', -- JSON array: ["vegetarian", "low-carb"]
  likes TEXT DEFAULT '[]', -- JSON array of liked ingredient/recipe IDs
  dislikes TEXT DEFAULT '[]', -- JSON array of disliked ingredient/recipe IDs
  spice_level TEXT CHECK(spice_level IN ('none', 'mild', 'medium', 'hot')),
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(tenant_id, member_name)
);

CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);

-- ============================================================
-- ALERTS & NOTIFICATIONS
-- ============================================================

-- Alerts
CREATE TABLE alerts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('gas_low', 'gas_critical', 'item_missing', 'item_low', 'camera_offline', 'limit_reached')),
  level TEXT NOT NULL CHECK(level IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  payload_json TEXT DEFAULT '{}', -- Additional alert data
  acknowledged INTEGER NOT NULL DEFAULT 0,
  acknowledged_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER -- Auto-dismiss timestamp
);

CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_level ON alerts(level);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- ============================================================
-- USAGE METERING & LIMITS
-- ============================================================

-- Usage meters (for enforcing free tier limits)
CREATE TABLE usage_meters (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- Format: YYYY-MM or YYYY-Www for weekly
  captures INTEGER NOT NULL DEFAULT 0,
  alerts_sent INTEGER NOT NULL DEFAULT 0,
  storage_mb REAL NOT NULL DEFAULT 0,
  api_calls INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(tenant_id, period)
);

CREATE INDEX idx_usage_meters_tenant ON usage_meters(tenant_id);
CREATE INDEX idx_usage_meters_period ON usage_meters(period);

-- ============================================================
-- AUDIT LOG
-- ============================================================

-- Audit logs (for security and compliance)
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor TEXT NOT NULL, -- Email or identifier
  action TEXT NOT NULL, -- create, update, delete, access, etc.
  resource_type TEXT NOT NULL, -- camera, recipe, alert, etc.
  resource_id TEXT,
  changes_json TEXT DEFAULT '{}', -- Before/after for updates
  ip_address TEXT,
  user_agent TEXT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_accounts_timestamp AFTER UPDATE ON accounts
BEGIN
  UPDATE accounts SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_tenants_timestamp AFTER UPDATE ON tenants
BEGIN
  UPDATE tenants SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_cameras_timestamp AFTER UPDATE ON cameras
BEGIN
  UPDATE cameras SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_inventory_items_timestamp AFTER UPDATE ON inventory_items
BEGIN
  UPDATE inventory_items SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_recipes_timestamp AFTER UPDATE ON recipes
BEGIN
  UPDATE recipes SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_profiles_timestamp AFTER UPDATE ON profiles
BEGIN
  UPDATE profiles SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER update_usage_meters_timestamp AFTER UPDATE ON usage_meters
BEGIN
  UPDATE usage_meters SET updated_at = unixepoch() WHERE id = NEW.id;
END;
