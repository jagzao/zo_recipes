/**
 * KitchenEye - Shared TypeScript Types
 * Used across Workers, Edge CV, and PWA Frontend
 */

// ============================================================
// ACCOUNTS & TENANTS
// ============================================================

export type AccountStatus = 'active' | 'suspended' | 'cancelled';
export type TenantStatus = 'active' | 'suspended' | 'trial';
export type PlanType = 'free' | 'pro' | 'enterprise';

export interface Account {
  id: string;
  owner_email: string;
  status: AccountStatus;
  created_at: number;
  updated_at: number;
}

export interface PlanLimits {
  max_tenants?: number;
  max_cameras?: number;
  max_captures_per_month?: number;
  max_alerts_per_month?: number;
  max_storage_mb?: number;
  retention_days?: number;
  api_rate_limit?: number;
}

export interface Tenant {
  id: string;
  account_id: string;
  name: string;
  timezone: string;
  logo_url?: string;
  plan: PlanType;
  limits_json: string; // JSON-encoded PlanLimits
  status: TenantStatus;
  created_at: number;
  updated_at: number;
}

// ============================================================
// USERS & RBAC
// ============================================================

export type UserStatus = 'active' | 'inactive' | 'banned';
export type Role = 'owner' | 'admin' | 'ops' | 'viewer';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  status: UserStatus;
  created_at: number;
  last_login_at?: number;
}

export interface UserTenantRole {
  id: string;
  user_id: string;
  tenant_id: string;
  role: Role;
  created_at: number;
}

// ============================================================
// CAMERAS & IMAGES
// ============================================================

export type CameraType = 'gas' | 'fridge';
export type CameraStatus = 'active' | 'inactive' | 'error' | 'calibrating';
export type CVStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Camera {
  id: string;
  tenant_id: string;
  name: string;
  type: CameraType;
  schedule_cron: string;
  location?: string;
  config_json: string;
  status: CameraStatus;
  last_capture_at?: number;
  last_health_check_at?: number;
  created_at: number;
  updated_at: number;
}

export interface CameraConfig {
  thresholds?: {
    gas_red?: number;
    gas_yellow?: number;
    gas_green?: number;
  };
  calibration?: {
    marker_position?: { x: number; y: number };
    reference_height?: number;
  };
  smoothing?: {
    min_consecutive_detections?: number;
  };
  retention?: {
    store_images?: boolean;
    store_thumbnails?: boolean;
    ttl_days?: number;
  };
}

export interface Image {
  id: string;
  camera_id: string;
  message_id?: string;
  blob_url?: string;
  thumb_url?: string;
  captured_at: number;
  processed_at?: number;
  cv_status: CVStatus;
  confidence?: number;
  metadata_json: string;
  ttl_expires_at?: number;
  created_at: number;
}

// ============================================================
// GAS MONITORING
// ============================================================

export type GasStatus = 'red' | 'yellow' | 'green';

export interface GasLevel {
  id: string;
  camera_id: string;
  image_id?: string;
  level_pct: number;
  status_enum: GasStatus;
  confidence?: number;
  calibration_version?: string;
  captured_at: number;
  created_at: number;
}

// ============================================================
// FRIDGE INVENTORY
// ============================================================

export type InventoryPresence = 0 | 1 | 2; // 0=absent, 1=low, 2=present

export interface InventoryItem {
  id: string;
  tenant_id: string;
  name: string;
  category?: string;
  critical: number; // 0 or 1 (boolean in SQLite)
  unit?: string;
  min_quantity?: number;
  config_json: string;
  created_at: number;
  updated_at: number;
}

export interface InventorySnapshot {
  id: string;
  item_id: string;
  image_id?: string;
  present: InventoryPresence;
  confidence?: number;
  quantity?: number;
  level_pct?: number;
  captured_at: number;
  created_at: number;
}

// ============================================================
// RECIPES
// ============================================================

export type Difficulty = 'facil' | 'media' | 'avanzada';

export interface Recipe {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  steps_md: string;
  tags: string; // JSON array
  diet_flags: string; // JSON array
  intents: string; // JSON array
  cook_time_min?: number;
  prep_time_min?: number;
  servings?: number;
  difficulty?: Difficulty;
  hero_url?: string;
  enabled: number;
  created_at: number;
  updated_at: number;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  item_id?: string;
  ingredient_name: string;
  quantity?: number;
  unit?: string;
  optional: number;
  substitutes: string; // JSON array
  notes?: string;
  created_at: number;
}

export interface RecipeWithScore extends Recipe {
  score: number;
  missing_ingredients: string[];
  available_ingredients: string[];
  match_explanation: string;
}

// ============================================================
// PROFILES
// ============================================================

export type SpiceLevel = 'none' | 'mild' | 'medium' | 'hot';

export interface Profile {
  id: string;
  tenant_id: string;
  member_name: string;
  allergies: string; // JSON array
  diets: string; // JSON array
  likes: string; // JSON array
  dislikes: string; // JSON array
  spice_level?: SpiceLevel;
  notes?: string;
  created_at: number;
  updated_at: number;
}

// ============================================================
// ALERTS
// ============================================================

export type AlertType =
  | 'gas_low'
  | 'gas_critical'
  | 'item_missing'
  | 'item_low'
  | 'camera_offline'
  | 'limit_reached';

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  tenant_id: string;
  type: AlertType;
  level: AlertLevel;
  title: string;
  message?: string;
  payload_json: string;
  acknowledged: number;
  acknowledged_by?: string;
  acknowledged_at?: number;
  created_at: number;
  expires_at?: number;
}

// ============================================================
// USAGE & METERING
// ============================================================

export interface UsageMeter {
  id: string;
  tenant_id: string;
  period: string; // YYYY-MM or YYYY-Www
  captures: number;
  alerts_sent: number;
  storage_mb: number;
  api_calls: number;
  created_at: number;
  updated_at: number;
}

// ============================================================
// AUDIT
// ============================================================

export interface AuditLog {
  id: string;
  tenant_id?: string;
  user_id?: string;
  actor: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  changes_json: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: number;
}

// ============================================================
// API PAYLOADS (Edge → Worker)
// ============================================================

export interface IngestPayload {
  message_id: string; // For idempotency
  camera_id: string;
  captured_at: number; // Unix timestamp
  type: CameraType;
  results: GasResult | FridgeResult;
  thumbnail?: string; // Base64-encoded thumbnail (optional)
  metadata?: {
    device_id?: string;
    firmware_version?: string;
    cv_model_version?: string;
  };
}

export interface GasResult {
  level_pct: number;
  confidence: number;
  calibration_version: string;
  status: GasStatus;
}

export interface FridgeResult {
  detections: FridgeDetection[];
  total_items: number;
  confidence: number;
}

export interface FridgeDetection {
  item_name: string;
  present: InventoryPresence;
  confidence: number;
  quantity?: number;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================================
// API RESPONSES
// ============================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: number;
    request_id?: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

// ============================================================
// JWT CLAIMS
// ============================================================

export interface JWTClaims {
  sub: string; // User ID
  email: string;
  tenant_id: string;
  role: Role;
  iat: number; // Issued at
  exp: number; // Expiration
}

// ============================================================
// RECIPE MATCHING
// ============================================================

export type RecipeIntent =
  | 'fresco'
  | 'rapido'
  | 'reconfortante'
  | 'proteico'
  | 'economico'
  | 'vegano'
  | 'ninos';

export interface RecipeQuery {
  tenant_id: string;
  member_id?: string;
  intents?: RecipeIntent[];
  max_time_min?: number;
  max_results?: number;
  exclude_allergies?: boolean;
}

export interface RecipeMatchResult {
  recipe: Recipe;
  score: number;
  match_pct: number;
  missing_critical: string[];
  missing_optional: string[];
  substitutes_available: Record<string, string[]>;
  explanation: string;
}
