-- Sample recipes for KitchenEye
-- Replace TENANT_ID with actual tenant ID

-- Insert sample inventory items first
INSERT INTO inventory_items (tenant_id, name, category, critical) VALUES
('TENANT_ID', 'pollo', 'proteina', 1),
('TENANT_ID', 'arroz', 'granos', 1),
('TENANT_ID', 'tomate', 'vegetales', 0),
('TENANT_ID', 'cebolla', 'vegetales', 1),
('TENANT_ID', 'ajo', 'condimentos', 0),
('TENANT_ID', 'aceite', 'condimentos', 1),
('TENANT_ID', 'sal', 'condimentos', 1),
('TENANT_ID', 'frijoles', 'granos', 1),
('TENANT_ID', 'huevo', 'proteina', 1),
('TENANT_ID', 'leche', 'lacteos', 1),
('TENANT_ID', 'queso', 'lacteos', 0),
('TENANT_ID', 'aguacate', 'vegetales', 0),
('TENANT_ID', 'limon', 'frutas', 0),
('TENANT_ID', 'chile', 'condimentos', 0),
('TENANT_ID', 'cilantro', 'hierbas', 0);

-- Recipe 1: Arroz con Pollo
INSERT INTO recipes (tenant_id, title, description, steps_md, tags, diet_flags, intents, cook_time_min, prep_time_min, servings, difficulty, hero_url, enabled) VALUES
('TENANT_ID', 'Arroz con Pollo', 'Clásico platillo mexicano, reconfortante y nutritivo',
'1. Cortar el pollo en piezas medianas
2. Dorar el pollo en aceite hasta que esté dorado
3. Agregar arroz, tomate, cebolla y ajo picados
4. Añadir agua o caldo (2 tazas por cada taza de arroz)
5. Cocinar a fuego medio hasta que el arroz esté cocido (20-25 min)
6. Servir caliente con limón y cilantro',
'["reconfortante", "proteico", "familiar"]',
'[]',
'["reconfortante", "proteico"]',
35, 10, 4, 'facil',
'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800', 1);

-- Recipe 2: Huevos Rancheros
INSERT INTO recipes (tenant_id, title, description, steps_md, tags, diet_flags, intents, cook_time_min, prep_time_min, servings, difficulty, hero_url, enabled) VALUES
('TENANT_ID', 'Huevos Rancheros', 'Desayuno mexicano tradicional y rápido',
'1. Calentar tortillas en el comal
2. Freír huevos al gusto (estrellados o revueltos)
3. Preparar salsa con tomate, cebolla, chile y ajo
4. Calentar frijoles refritos
5. Montar: tortilla, frijoles, huevo y salsa
6. Servir con aguacate y cilantro',
'["rapido", "desayuno", "mexicano"]',
'["vegetarian"]',
'["rapido", "fresco"]',
15, 5, 2, 'facil',
'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=800', 1);

-- Recipe 3: Quesadillas de Queso
INSERT INTO recipes (tenant_id, title, description, steps_md, tags, diet_flags, intents, cook_time_min, prep_time_min, servings, difficulty, hero_url, enabled) VALUES
('TENANT_ID', 'Quesadillas de Queso', 'Rápido y perfecto para los niños',
'1. Calentar tortillas en el comal
2. Añadir queso rallado o en rebanadas
3. Doblar por la mitad
4. Cocinar hasta que el queso se derrita (2-3 min por lado)
5. Servir con crema y salsa',
'["rapido", "ninos", "sencillo"]',
'["vegetarian"]',
'["rapido", "ninos"]',
10, 5, 4, 'facil',
'https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=800', 1);

-- Recipe 4: Ensalada Fresca
INSERT INTO recipes (tenant_id, title, description, steps_md, tags, diet_flags, intents, cook_time_min, prep_time_min, servings, difficulty, hero_url, enabled) VALUES
('TENANT_ID', 'Ensalada Fresca con Aguacate', 'Ligera, saludable y refrescante',
'1. Lavar y cortar tomate en cubos
2. Picar cebolla finamente
3. Cortar aguacate en rebanadas
4. Mezclar todo en un bowl
5. Agregar limón, sal y cilantro
6. Mezclar suavemente y servir',
'["fresco", "saludable", "rapido", "ligero"]',
'["vegetarian", "vegan", "gluten-free"]',
'["fresco", "vegano"]',
5, 10, 2, 'facil',
'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800', 1);

-- Recipe 5: Frijoles Refritos
INSERT INTO recipes (tenant_id, title, description, steps_md, tags, diet_flags, intents, cook_time_min, prep_time_min, servings, difficulty, hero_url, enabled) VALUES
('TENANT_ID', 'Frijoles Refritos', 'Acompañamiento clásico mexicano',
'1. Calentar aceite en una sartén
2. Agregar frijoles cocidos con su caldo
3. Machacar con un machacador o tenedor
4. Cocinar moviendo constantemente hasta obtener consistencia cremosa
5. Agregar sal al gusto
6. Servir con queso rallado encima',
'["economico", "acompanamiento", "mexicano"]',
'["vegetarian"]',
'["economico"]',
15, 5, 6, 'facil',
'https://images.unsplash.com/photo-1600628421055-7c17cfa6f357?w=800', 1);

-- Add recipe ingredients (example for Arroz con Pollo)
-- Note: item_id should be replaced with actual IDs from inventory_items
INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit, optional, substitutes)
SELECT id, 'Pollo', 500, 'g', 0, '[]' FROM recipes WHERE title = 'Arroz con Pollo' AND tenant_id = 'TENANT_ID';

INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit, optional, substitutes)
SELECT id, 'Arroz', 2, 'tazas', 0, '[]' FROM recipes WHERE title = 'Arroz con Pollo' AND tenant_id = 'TENANT_ID';

INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit, optional, substitutes)
SELECT id, 'Tomate', 2, 'piezas', 0, '[]' FROM recipes WHERE title = 'Arroz con Pollo' AND tenant_id = 'TENANT_ID';

INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit, optional, substitutes)
SELECT id, 'Cebolla', 1, 'pieza', 0, '[]' FROM recipes WHERE title = 'Arroz con Pollo' AND tenant_id = 'TENANT_ID';

INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit, optional, substitutes)
SELECT id, 'Ajo', 2, 'dientes', 0, '[]' FROM recipes WHERE title = 'Arroz con Pollo' AND tenant_id = 'TENANT_ID';

INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity, unit, optional, substitutes)
SELECT id, 'Cilantro', 1, 'manojo', 1, '[]' FROM recipes WHERE title = 'Arroz con Pollo' AND tenant_id = 'TENANT_ID';
