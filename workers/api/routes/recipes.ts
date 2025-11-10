/**
 * Recipe Routes
 * Smart recipe matching based on inventory and preferences
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  Recipe,
  RecipeWithScore,
  RecipeQuery,
  Profile,
  InventorySnapshot,
} from '../../../shared/types';
import { queryOne, queryAll, parseJson } from '../../utils/db';
import { success, errors } from '../../utils/response';

/**
 * GET /api/recipes
 * Search recipes with smart matching
 */
export async function searchRecipes(
  request: Request,
  env: { DB: D1Database },
  tenantId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const memberId = url.searchParams.get('member_id');
    const intent = url.searchParams.get('intent');
    const maxTime = url.searchParams.get('max_time');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Get member profile if specified
    let profile: Profile | null = null;
    if (memberId) {
      profile = await queryOne<Profile>(
        env.DB,
        'SELECT * FROM profiles WHERE id = ? AND tenant_id = ?',
        [memberId, tenantId]
      );
    }

    // Build recipe query
    let sql = `
      SELECT * FROM recipes
      WHERE tenant_id = ? AND enabled = 1
    `;
    const params: any[] = [tenantId];

    // Filter by intent
    if (intent) {
      sql += ` AND json_extract(intents, '$') LIKE ?`;
      params.push(`%"${intent}"%`);
    }

    // Filter by cooking time
    if (maxTime) {
      sql += ` AND cook_time_min <= ?`;
      params.push(parseInt(maxTime));
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const recipes = await queryAll<Recipe>(env.DB, sql, params);

    // Get current inventory snapshot
    const inventoryMap = await getCurrentInventory(env.DB, tenantId);

    // Score and rank recipes
    const scoredRecipes = await Promise.all(
      recipes.map(recipe => scoreRecipe(env.DB, recipe, inventoryMap, profile))
    );

    // Sort by score descending
    scoredRecipes.sort((a, b) => b.score - a.score);

    return success(scoredRecipes);
  } catch (err) {
    console.error('Recipe search error:', err);
    return errors.serverError();
  }
}

/**
 * GET /api/recipes/:id
 * Get single recipe with details
 */
export async function getRecipe(
  request: Request,
  env: { DB: D1Database },
  tenantId: string,
  recipeId: string
): Promise<Response> {
  try {
    const recipe = await queryOne<Recipe>(
      env.DB,
      'SELECT * FROM recipes WHERE id = ? AND tenant_id = ?',
      [recipeId, tenantId]
    );

    if (!recipe) {
      return errors.notFound('Recipe');
    }

    // Get ingredients
    const ingredients = await queryAll<any>(
      env.DB,
      `SELECT ri.*, ii.name as item_name, ii.category
       FROM recipe_ingredients ri
       LEFT JOIN inventory_items ii ON ii.id = ri.item_id
       WHERE ri.recipe_id = ?`,
      [recipeId]
    );

    // Get current inventory
    const inventoryMap = await getCurrentInventory(env.DB, tenantId);

    // Check ingredient availability
    const ingredientsWithStatus = ingredients.map(ing => {
      const available = ing.item_id && inventoryMap.has(ing.item_id);
      const present = available ? inventoryMap.get(ing.item_id) : 0;

      return {
        ...ing,
        available: present === 2,
        low: present === 1,
        missing: present === 0,
        substitutes: parseJson(ing.substitutes, []),
      };
    });

    return success({
      ...recipe,
      ingredients: ingredientsWithStatus,
      tags: parseJson(recipe.tags, []),
      diet_flags: parseJson(recipe.diet_flags, []),
      intents: parseJson(recipe.intents, []),
    });
  } catch (err) {
    console.error('Get recipe error:', err);
    return errors.serverError();
  }
}

/**
 * Score a recipe based on available ingredients and preferences
 */
async function scoreRecipe(
  db: D1Database,
  recipe: Recipe,
  inventoryMap: Map<string, number>,
  profile: Profile | null
): Promise<RecipeWithScore> {
  // Get recipe ingredients
  const ingredients = await queryAll<{
    id: string;
    item_id?: string;
    ingredient_name: string;
    optional: number;
    substitutes: string;
  }>(
    db,
    'SELECT * FROM recipe_ingredients WHERE recipe_id = ?',
    [recipe.id]
  );

  let score = 0;
  const missing: string[] = [];
  const available: string[] = [];

  let totalRequired = 0;
  let availableRequired = 0;

  for (const ing of ingredients) {
    if (ing.optional) continue;

    totalRequired++;

    if (ing.item_id && inventoryMap.has(ing.item_id)) {
      const present = inventoryMap.get(ing.item_id)!;
      if (present === 2) {
        availableRequired++;
        available.push(ing.ingredient_name);
      } else if (present === 1) {
        // Low stock - partial credit
        availableRequired += 0.5;
        available.push(ing.ingredient_name);
      } else {
        missing.push(ing.ingredient_name);
      }
    } else {
      // Check substitutes
      const substitutes = parseJson<string[]>(ing.substitutes, []);
      let substituteAvailable = false;

      for (const subId of substitutes) {
        if (inventoryMap.has(subId) && inventoryMap.get(subId) === 2) {
          substituteAvailable = true;
          availableRequired += 0.8; // Substitute gets slightly lower score
          break;
        }
      }

      if (!substituteAvailable) {
        missing.push(ing.ingredient_name);
      }
    }
  }

  // Base score: percentage of available ingredients
  const matchPct = totalRequired > 0 ? (availableRequired / totalRequired) * 100 : 0;
  score = matchPct;

  // Boost score based on profile preferences
  if (profile) {
    const recipeTags = parseJson<string[]>(recipe.tags, []);
    const likes = parseJson<string[]>(profile.likes, []);
    const dislikes = parseJson<string[]>(profile.dislikes, []);

    // Boost for liked tags
    const likedMatch = recipeTags.filter(tag => likes.includes(tag)).length;
    score += likedMatch * 5;

    // Penalize for disliked tags
    const dislikedMatch = recipeTags.filter(tag => dislikes.includes(tag)).length;
    score -= dislikedMatch * 10;

    // Check allergies
    const allergies = parseJson<string[]>(profile.allergies, []);
    const recipeDiets = parseJson<string[]>(recipe.diet_flags, []);

    for (const allergy of allergies) {
      if (!recipeDiets.includes(`no-${allergy}`)) {
        score -= 50; // Heavy penalty for potential allergen
      }
    }
  }

  // Generate explanation
  const explanation = generateExplanation(matchPct, missing, available);

  return {
    ...recipe,
    score: Math.max(0, score),
    missing_ingredients: missing,
    available_ingredients: available,
    match_explanation: explanation,
  };
}

/**
 * Get current inventory snapshot (latest detection per item)
 */
async function getCurrentInventory(
  db: D1Database,
  tenantId: string
): Promise<Map<string, number>> {
  const snapshots = await queryAll<{
    item_id: string;
    present: number;
    captured_at: number;
  }>(
    db,
    `SELECT
       s.item_id,
       s.present,
       s.captured_at
     FROM inventory_snapshots s
     INNER JOIN inventory_items i ON i.id = s.item_id
     INNER JOIN (
       SELECT item_id, MAX(captured_at) as max_captured
       FROM inventory_snapshots
       GROUP BY item_id
     ) latest ON latest.item_id = s.item_id AND latest.max_captured = s.captured_at
     WHERE i.tenant_id = ?`,
    [tenantId]
  );

  const map = new Map<string, number>();
  for (const snap of snapshots) {
    map.set(snap.item_id, snap.present);
  }

  return map;
}

/**
 * Generate human-readable explanation
 */
function generateExplanation(
  matchPct: number,
  missing: string[],
  available: string[]
): string {
  if (matchPct === 100) {
    return `Tienes todos los ingredientes necesarios (${available.length} de ${available.length})`;
  }

  if (matchPct >= 75) {
    return `Tienes la mayoría de ingredientes (${matchPct.toFixed(0)}%). Te faltan: ${missing.slice(0, 3).join(', ')}`;
  }

  if (matchPct >= 50) {
    return `Tienes algunos ingredientes (${matchPct.toFixed(0)}%). Podrías necesitar comprar: ${missing.slice(0, 3).join(', ')}`;
  }

  return `Te faltan varios ingredientes (${matchPct.toFixed(0)}% disponible). Considera otra receta.`;
}
