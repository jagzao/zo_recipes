/**
 * Notification Routes
 * Web push notifications and preferences
 */

import type { D1Database } from '@cloudflare/workers-types';
import { queryOne, queryAll, insert, update, createAuditLog } from '../../utils/db';
import { success, errors } from '../../utils/response';

/**
 * POST /api/notifications/subscribe
 * Subscribe to web push notifications
 */
export async function subscribe(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  userId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    };

    if (!body.endpoint || !body.keys) {
      return errors.badRequest('Invalid subscription data');
    }

    // Store subscription
    const subscriptionId = await insert(env.DB, 'notification_subscriptions', {
      user_id: userId,
      tenant_id: tenantId,
      endpoint: body.endpoint,
      p256dh_key: body.keys.p256dh,
      auth_key: body.keys.auth,
      enabled: 1,
    });

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'subscribe_notifications',
      resource_type: 'notification_subscription',
      resource_id: subscriptionId,
    });

    return success({ subscribed: true, id: subscriptionId });
  } catch (err) {
    console.error('Subscribe error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/notifications/preferences
 * Get notification preferences
 */
export async function getPreferences(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  userId: string
): Promise<Response> {
  try {
    const prefs = await queryOne(
      env.DB,
      'SELECT * FROM notification_preferences WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId]
    );

    if (!prefs) {
      // Return defaults
      return success({
        email_enabled: true,
        push_enabled: true,
        alert_types: {
          gas_low: true,
          gas_critical: true,
          item_missing: true,
          item_low: true,
          camera_offline: true,
          limit_reached: true,
        },
      });
    }

    return success({
      ...prefs,
      alert_types: JSON.parse((prefs as any).alert_types_json || '{}'),
    });
  } catch (err) {
    console.error('Get preferences error:', err);
    return errors.serverError();
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update notification preferences
 */
export async function updatePreferences(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  userId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      email_enabled?: boolean;
      push_enabled?: boolean;
      alert_types?: Record<string, boolean>;
    };

    // Check if preferences exist
    const existing = await queryOne(
      env.DB,
      'SELECT id FROM notification_preferences WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId]
    );

    if (existing) {
      // Update
      const updates: Record<string, any> = {};
      if (body.email_enabled !== undefined) updates.email_enabled = body.email_enabled ? 1 : 0;
      if (body.push_enabled !== undefined) updates.push_enabled = body.push_enabled ? 1 : 0;
      if (body.alert_types) updates.alert_types_json = JSON.stringify(body.alert_types);

      await update(env.DB, 'notification_preferences', (existing as any).id, updates);
    } else {
      // Insert
      await insert(env.DB, 'notification_preferences', {
        user_id: userId,
        tenant_id: tenantId,
        email_enabled: body.email_enabled !== undefined ? (body.email_enabled ? 1 : 0) : 1,
        push_enabled: body.push_enabled !== undefined ? (body.push_enabled ? 1 : 0) : 1,
        alert_types_json: body.alert_types ? JSON.stringify(body.alert_types) : '{}',
      });
    }

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'update_preferences',
      resource_type: 'notification_preferences',
      changes_json: JSON.stringify(body),
    });

    return success({ updated: true });
  } catch (err) {
    console.error('Update preferences error:', err);
    return errors.serverError();
  }
}

/**
 * Send notification to user
 * Called internally when alerts are created
 */
export async function sendNotificationToUser(
  db: D1Database,
  userId: string,
  tenantId: string,
  alertType: string,
  title: string,
  message: string
): Promise<void> {
  try {
    // Get user preferences
    const prefs = await queryOne<{
      push_enabled: number;
      alert_types_json: string;
    }>(
      db,
      'SELECT push_enabled, alert_types_json FROM notification_preferences WHERE user_id = ? AND tenant_id = ?',
      [userId, tenantId]
    );

    // Check if notifications are enabled for this alert type
    if (prefs) {
      const alertTypes = JSON.parse(prefs.alert_types_json || '{}');
      if (!prefs.push_enabled || !alertTypes[alertType]) {
        return; // User has disabled this notification type
      }
    }

    // Get active subscriptions
    const subscriptions = await queryAll<{
      endpoint: string;
      p256dh_key: string;
      auth_key: string;
    }>(
      db,
      'SELECT endpoint, p256dh_key, auth_key FROM notification_subscriptions WHERE user_id = ? AND tenant_id = ? AND enabled = 1',
      [userId, tenantId]
    );

    // Send web push notifications
    for (const sub of subscriptions) {
      try {
        // In production, use web-push library
        // For now, we'll just log it
        console.log(`[Web Push] Sending notification to ${sub.endpoint}:`, {
          title,
          body: message,
        });

        // TODO: Implement actual web push using VAPID keys
        // const webpush = require('web-push');
        // await webpush.sendNotification(sub, JSON.stringify({ title, body: message }));
      } catch (err) {
        console.error('Failed to send web push:', err);
        // Mark subscription as invalid if it fails
        await db
          .prepare('UPDATE notification_subscriptions SET enabled = 0 WHERE endpoint = ?')
          .bind(sub.endpoint)
          .run();
      }
    }
  } catch (err) {
    console.error('Send notification error:', err);
  }
}
