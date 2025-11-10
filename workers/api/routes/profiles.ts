/**
 * Profile Management Routes
 * CRUD operations for member profiles
 */

import type { D1Database } from '@cloudflare/workers-types';
import { Profile } from '../../../shared/types';
import { queryOne, queryAll, insert, update, deleteRecord, createAuditLog } from '../../utils/db';
import { success, errors } from '../../utils/response';

/**
 * GET /api/profiles
 * List all profiles for tenant
 */
export async function listProfiles(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const profiles = await queryAll<Profile>(
      env.DB,
      'SELECT * FROM profiles WHERE tenant_id = ? ORDER BY member_name',
      [tenantId]
    );

    return success(profiles);
  } catch (err) {
    console.error('List profiles error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/profiles/:id
 * Get single profile
 */
export async function getProfile(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  profileId: string
): Promise<Response> {
  try {
    const profile = await queryOne<Profile>(
      env.DB,
      'SELECT * FROM profiles WHERE id = ? AND tenant_id = ?',
      [profileId, tenantId]
    );

    if (!profile) {
      return errors.notFound('Profile');
    }

    return success({
      ...profile,
      allergies: JSON.parse(profile.allergies),
      diets: JSON.parse(profile.diets),
      likes: JSON.parse(profile.likes),
      dislikes: JSON.parse(profile.dislikes),
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return errors.serverError();
  }
}

/**
 * POST /api/profiles
 * Create new profile
 */
export async function createProfile(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  userId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      member_name: string;
      allergies?: string[];
      diets?: string[];
      likes?: string[];
      dislikes?: string[];
      spice_level?: 'none' | 'mild' | 'medium' | 'hot';
      notes?: string;
    };

    if (!body.member_name) {
      return errors.badRequest('Member name is required');
    }

    // Check if profile already exists
    const existing = await queryOne(
      env.DB,
      'SELECT id FROM profiles WHERE tenant_id = ? AND member_name = ?',
      [tenantId, body.member_name]
    );

    if (existing) {
      return errors.conflict('Profile with this name already exists');
    }

    const profileId = await insert(env.DB, 'profiles', {
      tenant_id: tenantId,
      member_name: body.member_name,
      allergies: JSON.stringify(body.allergies || []),
      diets: JSON.stringify(body.diets || []),
      likes: JSON.stringify(body.likes || []),
      dislikes: JSON.stringify(body.dislikes || []),
      spice_level: body.spice_level || 'mild',
      notes: body.notes || null,
    });

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'create',
      resource_type: 'profile',
      resource_id: profileId,
    });

    return success({ id: profileId, ...body });
  } catch (err) {
    console.error('Create profile error:', err);
    return errors.serverError();
  }
}

/**
 * PATCH /api/profiles/:id
 * Update profile
 */
export async function updateProfile(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  profileId: string,
  userId: string
): Promise<Response> {
  try {
    const profile = await queryOne<Profile>(
      env.DB,
      'SELECT * FROM profiles WHERE id = ? AND tenant_id = ?',
      [profileId, tenantId]
    );

    if (!profile) {
      return errors.notFound('Profile');
    }

    const body = await request.json() as Partial<{
      member_name: string;
      allergies: string[];
      diets: string[];
      likes: string[];
      dislikes: string[];
      spice_level: 'none' | 'mild' | 'medium' | 'hot';
      notes: string;
    }>;

    const updates: Record<string, any> = {};

    if (body.member_name) updates.member_name = body.member_name;
    if (body.allergies) updates.allergies = JSON.stringify(body.allergies);
    if (body.diets) updates.diets = JSON.stringify(body.diets);
    if (body.likes) updates.likes = JSON.stringify(body.likes);
    if (body.dislikes) updates.dislikes = JSON.stringify(body.dislikes);
    if (body.spice_level) updates.spice_level = body.spice_level;
    if (body.notes !== undefined) updates.notes = body.notes;

    if (Object.keys(updates).length === 0) {
      return errors.badRequest('No updates provided');
    }

    const success_update = await update(env.DB, 'profiles', profileId, updates);

    if (!success_update) {
      return errors.serverError('Failed to update profile');
    }

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'update',
      resource_type: 'profile',
      resource_id: profileId,
      changes_json: JSON.stringify(updates),
    });

    return success({ id: profileId, ...updates });
  } catch (err) {
    console.error('Update profile error:', err);
    return errors.serverError();
  }
}

/**
 * DELETE /api/profiles/:id
 * Delete profile
 */
export async function deleteProfile(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  profileId: string,
  userId: string
): Promise<Response> {
  try {
    const profile = await queryOne<Profile>(
      env.DB,
      'SELECT * FROM profiles WHERE id = ? AND tenant_id = ?',
      [profileId, tenantId]
    );

    if (!profile) {
      return errors.notFound('Profile');
    }

    const success_delete = await deleteRecord(env.DB, 'profiles', profileId);

    if (!success_delete) {
      return errors.serverError('Failed to delete profile');
    }

    await createAuditLog(env.DB, {
      tenant_id: tenantId,
      user_id: userId,
      actor: userId,
      action: 'delete',
      resource_type: 'profile',
      resource_id: profileId,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error('Delete profile error:', err);
    return errors.serverError();
  }
}
