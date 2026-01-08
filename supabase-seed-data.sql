-- =====================================================
-- SEED DATA - Stock Reconciliation System
-- =====================================================
-- This file contains sample data for testing
-- Run this AFTER running supabase-schema.sql
-- =====================================================

-- =====================================================
-- SAMPLE LOCATIONS
-- =====================================================

INSERT INTO locations (name, description, active, sort_order) VALUES
  ('Bar', 'Main bar area', true, 1),
  ('Cellar', 'Wine and beer cellar', true, 2),
  ('Kitchen', 'Kitchen storage', true, 3),
  ('Back Office', 'Office stock storage', true, 4),
  ('Front Display', 'Customer-facing display area', true, 5);

-- =====================================================
-- SAMPLE PRODUCTS
-- =====================================================

-- Spirits
INSERT INTO products (barcode, product_code, product_name, current_stock, unit_value, stock_group, category, supplier, pack_size, active) VALUES
  ('5000299605059', 'SP001', 'Gordon''s London Dry Gin 700ml', 12, 18.50, 'Spirits', 'Gin', 'Diageo', '700ml', true),
  ('5000299295717', 'SP002', 'Tanqueray London Dry Gin 700ml', 8, 22.00, 'Spirits', 'Gin', 'Diageo', '700ml', true),
  ('5000281045535', 'SP003', 'Bombay Sapphire Gin 700ml', 15, 24.50, 'Spirits', 'Gin', 'Bacardi', '700ml', true),
  ('5000281023137', 'SP004', 'Bacardi Carta Blanca 700ml', 20, 16.50, 'Spirits', 'Rum', 'Bacardi', '700ml', true),
  ('5010677715027', 'SP005', 'Captain Morgan Spiced Gold 700ml', 10, 17.00, 'Spirits', 'Rum', 'Diageo', '700ml', true),
  ('5000299225011', 'SP006', 'Smirnoff Red Label Vodka 700ml', 25, 15.50, 'Spirits', 'Vodka', 'Diageo', '700ml', true),
  ('5000299605325', 'SP007', 'Johnnie Walker Red Label 700ml', 18, 19.00, 'Spirits', 'Whisky', 'Diageo', '700ml', true),
  ('5000299605349', 'SP008', 'Johnnie Walker Black Label 700ml', 12, 28.00, 'Spirits', 'Whisky', 'Diageo', '700ml', true),
  ('5000281038643', 'SP009', 'Martini Rosso 1L', 6, 8.50, 'Spirits', 'Vermouth', 'Bacardi', '1L', true),
  ('5000281038650', 'SP010', 'Martini Bianco 1L', 6, 8.50, 'Spirits', 'Vermouth', 'Bacardi', '1L', true);

-- Wines
INSERT INTO products (barcode, product_code, product_name, current_stock, unit_value, stock_group, category, supplier, pack_size, active) VALUES
  ('5010677405010', 'WN001', 'Hardys Chardonnay 750ml', 24, 9.50, 'Wine', 'White Wine', 'Accolade', '750ml', true),
  ('5010677405027', 'WN002', 'Hardys Shiraz 750ml', 18, 9.50, 'Wine', 'Red Wine', 'Accolade', '750ml', true),
  ('3760130450221', 'WN003', 'Oyster Bay Sauvignon Blanc 750ml', 20, 12.50, 'Wine', 'White Wine', 'Delegat', '750ml', true),
  ('9300727610027', 'WN004', 'Oyster Bay Pinot Noir 750ml', 15, 14.00, 'Wine', 'Red Wine', 'Delegat', '750ml', true),
  ('8032605130127', 'WN005', 'Prosecco DOC 750ml', 30, 10.50, 'Wine', 'Sparkling', 'Various', '750ml', true);

-- Beers
INSERT INTO products (barcode, product_code, product_name, current_stock, unit_value, stock_group, category, supplier, pack_size, active) VALUES
  ('5010275030511', 'BR001', 'Heineken Lager 330ml Bottle', 144, 1.20, 'Beer', 'Lager', 'Heineken', '330ml', true),
  ('5000213102350', 'BR002', 'Guinness Draught 440ml Can', 96, 1.80, 'Beer', 'Stout', 'Diageo', '440ml', true),
  ('5000213102534', 'BR003', 'Guinness Original 500ml Bottle', 72, 2.00, 'Beer', 'Stout', 'Diageo', '500ml', true),
  ('5010296511451', 'BR004', 'Stella Artois 330ml Bottle', 120, 1.30, 'Beer', 'Lager', 'AB InBev', '330ml', true),
  ('5000213101728', 'BR005', 'Budweiser 330ml Bottle', 96, 1.25, 'Beer', 'Lager', 'AB InBev', '330ml', true);

-- Soft Drinks
INSERT INTO products (barcode, product_code, product_name, current_stock, unit_value, stock_group, category, supplier, pack_size, active) VALUES
  ('5000112576269', 'SD001', 'Coca-Cola 330ml Can', 240, 0.45, 'Soft Drinks', 'Cola', 'Coca-Cola', '330ml', true),
  ('5000112637588', 'SD002', 'Diet Coke 330ml Can', 180, 0.45, 'Soft Drinks', 'Cola', 'Coca-Cola', '330ml', true),
  ('5000112548495', 'SD003', 'Sprite 330ml Can', 144, 0.45, 'Soft Drinks', 'Lemonade', 'Coca-Cola', '330ml', true),
  ('5000112548532', 'SD004', 'Fanta Orange 330ml Can', 120, 0.45, 'Soft Drinks', 'Orange', 'Coca-Cola', '330ml', true),
  ('5449000013163', 'SD005', 'Schweppes Tonic Water 200ml', 96, 0.60, 'Soft Drinks', 'Mixer', 'Coca-Cola', '200ml', true),
  ('5449000013194', 'SD006', 'Schweppes Ginger Ale 200ml', 72, 0.60, 'Soft Drinks', 'Mixer', 'Coca-Cola', '200ml', true),
  ('5000112637595', 'SD007', 'Schweppes Lemonade 200ml', 72, 0.60, 'Soft Drinks', 'Mixer', 'Coca-Cola', '200ml', true);

-- Kegs
INSERT INTO products (barcode, product_code, product_name, current_stock, unit_value, stock_group, category, supplier, pack_size, active) VALUES
  ('KEG001', 'KG001', 'Heineken Keg 50L', 2, 180.00, 'Kegs', 'Lager', 'Heineken', '50L', true),
  ('KEG002', 'KG002', 'Guinness Keg 30L', 3, 220.00, 'Kegs', 'Stout', 'Diageo', '30L', true),
  ('KEG003', 'KG003', 'Stella Artois Keg 50L', 2, 185.00, 'Kegs', 'Lager', 'AB InBev', '50L', true),
  ('KEG004', 'KG004', 'Budweiser Keg 30L', 1, 140.00, 'Kegs', 'Lager', 'AB InBev', '30L', true);

-- =====================================================
-- SAMPLE TEMPLATES
-- =====================================================

-- Bar Template (Draft)
DO $$
DECLARE
  template_id UUID;
BEGIN
  INSERT INTO templates (name, location, status)
  VALUES ('Daily Bar Count', 'Bar', 'draft')
  RETURNING id INTO template_id;

  -- Add template items
  INSERT INTO template_items (template_id, barcode, product_name, par_level, sort_order)
  SELECT
    template_id,
    barcode,
    product_name,
    CASE
      WHEN stock_group = 'Spirits' THEN 10
      WHEN stock_group = 'Soft Drinks' THEN 50
      ELSE 20
    END as par_level,
    ROW_NUMBER() OVER (ORDER BY product_name) as sort_order
  FROM products
  WHERE stock_group IN ('Spirits', 'Soft Drinks')
  AND active = true
  LIMIT 20;
END $$;

-- Cellar Template (Draft)
DO $$
DECLARE
  template_id UUID;
BEGIN
  INSERT INTO templates (name, location, status)
  VALUES ('Weekly Cellar Stock', 'Cellar', 'draft')
  RETURNING id INTO template_id;

  INSERT INTO template_items (template_id, barcode, product_name, par_level, sort_order)
  SELECT
    template_id,
    barcode,
    product_name,
    CASE
      WHEN stock_group = 'Wine' THEN 24
      WHEN stock_group = 'Beer' THEN 96
      ELSE 30
    END as par_level,
    ROW_NUMBER() OVER (ORDER BY product_name) as sort_order
  FROM products
  WHERE stock_group IN ('Wine', 'Beer', 'Kegs')
  AND active = true;
END $$;

-- =====================================================
-- SAMPLE RECIPES
-- =====================================================

-- Mojito Recipe
DO $$
DECLARE
  recipe_id UUID;
BEGIN
  INSERT INTO recipes (name, location, status)
  VALUES ('Classic Mojito', 'Bar', 'live')
  RETURNING id INTO recipe_id;

  INSERT INTO recipe_ingredients (recipe_id, barcode, ingredient_name, quantity_per_batch, is_filler, sort_order)
  VALUES
    (recipe_id, '5000281023137', 'Bacardi Carta Blanca', 50, false, 1),
    (recipe_id, '5449000013194', 'Schweppes Soda Water', 100, false, 2),
    (recipe_id, NULL, 'Fresh Mint', 10, true, 3),
    (recipe_id, NULL, 'Lime Juice', 30, true, 4),
    (recipe_id, NULL, 'Sugar Syrup', 20, true, 5);
END $$;

-- Gin & Tonic Recipe
DO $$
DECLARE
  recipe_id UUID;
BEGIN
  INSERT INTO recipes (name, location, status)
  VALUES ('Gin & Tonic', 'Bar', 'live')
  RETURNING id INTO recipe_id;

  INSERT INTO recipe_ingredients (recipe_id, barcode, ingredient_name, quantity_per_batch, is_filler, sort_order)
  VALUES
    (recipe_id, '5000299605059', 'Gordon''s Gin', 50, false, 1),
    (recipe_id, '5449000013163', 'Schweppes Tonic Water', 150, false, 2),
    (recipe_id, NULL, 'Fresh Lime', 1, true, 3);
END $$;

-- =====================================================
-- APP SETTINGS
-- =====================================================

-- Add some default settings (already in schema, but can be updated)
UPDATE app_settings
SET value = '"2.0.0"'
WHERE key = 'app_version';

UPDATE app_settings
SET value = 'false'
WHERE key = 'lock_mode_enabled';

-- =====================================================
-- SUMMARY
-- =====================================================

DO $$
DECLARE
  product_count INTEGER;
  location_count INTEGER;
  template_count INTEGER;
  recipe_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO product_count FROM products;
  SELECT COUNT(*) INTO location_count FROM locations;
  SELECT COUNT(*) INTO template_count FROM templates;
  SELECT COUNT(*) INTO recipe_count FROM recipes;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Seed data loaded successfully!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Products: %', product_count;
  RAISE NOTICE 'Locations: %', location_count;
  RAISE NOTICE 'Templates: %', template_count;
  RAISE NOTICE 'Recipes: %', recipe_count;
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Next step: Create your admin user in Authentication → Users';
  RAISE NOTICE '===========================================';
END $$;
