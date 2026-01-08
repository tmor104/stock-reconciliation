-- =====================================================
-- STOCK RECONCILIATION SYSTEM - SUPABASE SCHEMA
-- =====================================================
-- This schema replaces Google Sheets with PostgreSQL
-- Designed for offline-first React app with Supabase
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================
-- Note: Supabase Auth handles users table automatically
-- We extend it with a profiles table for app-specific data

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PRODUCTS DATABASE
-- =====================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode TEXT UNIQUE NOT NULL,
  product_code TEXT,
  product_name TEXT NOT NULL,
  current_stock NUMERIC(10, 2) DEFAULT 0,
  unit_value NUMERIC(10, 2) DEFAULT 0,
  stock_group TEXT,
  category TEXT,
  supplier TEXT,
  pack_size TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_stock_group ON products(stock_group);
CREATE INDEX idx_products_active ON products(active);

-- =====================================================
-- LOCATIONS
-- =====================================================

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_locations_active ON locations(active);

-- =====================================================
-- STOCKTAKES
-- =====================================================

CREATE TABLE stocktakes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  stage INT NOT NULL DEFAULT 1 CHECK (stage >= 1 AND stage <= 7),
  created_by UUID REFERENCES profiles(id),
  folder_id TEXT, -- For Google Drive integration if needed
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stocktakes_stage ON stocktakes(stage);
CREATE INDEX idx_stocktakes_status ON stocktakes(status);
CREATE INDEX idx_stocktakes_created_by ON stocktakes(created_by);

-- =====================================================
-- SCANS (Barcode Scans)
-- =====================================================

CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stocktake_id UUID REFERENCES stocktakes(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  location TEXT,
  scanned_by UUID REFERENCES profiles(id),
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scans_stocktake ON scans(stocktake_id);
CREATE INDEX idx_scans_barcode ON scans(barcode);
CREATE INDEX idx_scans_location ON scans(location);
CREATE INDEX idx_scans_scanned_by ON scans(scanned_by);
CREATE INDEX idx_scans_synced ON scans(synced);

-- =====================================================
-- MANUAL ENTRIES
-- =====================================================

CREATE TABLE manual_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stocktake_id UUID REFERENCES stocktakes(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  location TEXT,
  entered_by UUID REFERENCES profiles(id),
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_manual_entries_stocktake ON manual_entries(stocktake_id);
CREATE INDEX idx_manual_entries_location ON manual_entries(location);
CREATE INDEX idx_manual_entries_entered_by ON manual_entries(entered_by);

-- =====================================================
-- KEGS
-- =====================================================

CREATE TABLE kegs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stocktake_id UUID REFERENCES stocktakes(id) ON DELETE CASCADE,
  keg_name TEXT NOT NULL,
  location TEXT NOT NULL,
  count NUMERIC(10, 2) NOT NULL,
  counted_by UUID REFERENCES profiles(id),
  counted_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kegs_stocktake ON kegs(stocktake_id);
CREATE INDEX idx_kegs_location ON kegs(location);
CREATE INDEX idx_kegs_counted_by ON kegs(counted_by);

-- =====================================================
-- TEMPLATES
-- =====================================================

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, location)
);

CREATE INDEX idx_templates_location ON templates(location);
CREATE INDEX idx_templates_status ON templates(status);

-- Template Items (products in a template)
CREATE TABLE template_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL,
  par_level NUMERIC(10, 2) DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_template_items_template ON template_items(template_id);
CREATE INDEX idx_template_items_product ON template_items(product_id);

-- =====================================================
-- RECIPES (for batch counting)
-- =====================================================

CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, location)
);

CREATE INDEX idx_recipes_location ON recipes(location);
CREATE INDEX idx_recipes_status ON recipes(status);

-- Recipe Ingredients
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  barcode TEXT,
  ingredient_name TEXT NOT NULL,
  quantity_per_batch NUMERIC(10, 2) NOT NULL,
  is_filler BOOLEAN DEFAULT FALSE, -- Fillers are not tracked in inventory
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_product ON recipe_ingredients(product_id);

-- =====================================================
-- BATCHES (batch counts for a stocktake)
-- =====================================================

CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stocktake_id UUID REFERENCES stocktakes(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id),
  recipe_name TEXT NOT NULL,
  batch_count NUMERIC(10, 2) NOT NULL, -- How many batches were made
  location TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_batches_stocktake ON batches(stocktake_id);
CREATE INDEX idx_batches_recipe ON batches(recipe_id);
CREATE INDEX idx_batches_location ON batches(location);

-- =====================================================
-- VARIANCE DATA
-- =====================================================

CREATE TABLE variance_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stocktake_id UUID REFERENCES stocktakes(id) ON DELETE CASCADE,
  product_code TEXT,
  product_name TEXT NOT NULL,
  barcode TEXT,
  stock_group TEXT,
  theoretical_qty NUMERIC(10, 2) DEFAULT 0,
  counted_qty NUMERIC(10, 2) DEFAULT 0,
  qty_variance NUMERIC(10, 2) DEFAULT 0,
  unit_value NUMERIC(10, 2) DEFAULT 0,
  dollar_variance NUMERIC(10, 2) DEFAULT 0,
  variance_percentage NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variance_stocktake ON variance_data(stocktake_id);
CREATE INDEX idx_variance_stock_group ON variance_data(stock_group);
CREATE INDEX idx_variance_product_code ON variance_data(product_code);

-- =====================================================
-- THEORETICAL STOCK UPLOADS
-- =====================================================
-- Store uploaded theoretical stock data (from Excel)

CREATE TABLE theoretical_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stocktake_id UUID REFERENCES stocktakes(id) ON DELETE CASCADE,
  product_code TEXT,
  product_name TEXT NOT NULL,
  barcode TEXT,
  theoretical_qty NUMERIC(10, 2) NOT NULL,
  unit_value NUMERIC(10, 2) DEFAULT 0,
  stock_group TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_theoretical_stocktake ON theoretical_stock(stocktake_id);
CREATE INDEX idx_theoretical_product_code ON theoretical_stock(product_code);

-- =====================================================
-- ISSUES & NOTIFICATIONS
-- =====================================================

CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stocktake_id UUID REFERENCES stocktakes(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES profiles(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_issues_stocktake ON issues(stocktake_id);
CREATE INDEX idx_issues_acknowledged ON issues(acknowledged);

-- =====================================================
-- SETTINGS & CONFIGURATION
-- =====================================================

CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences (per-user settings)
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE kegs ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE variance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE theoretical_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles, but only admins can modify
CREATE POLICY "Allow read access to all authenticated users" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to update their own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Allow admins to insert/delete profiles" ON profiles
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Products: All authenticated users can read, only admins can modify
CREATE POLICY "Allow read access to products" ON products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to modify products" ON products
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Locations: All authenticated users can read, only admins can modify
CREATE POLICY "Allow read access to locations" ON locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to modify locations" ON locations
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Stocktakes: All authenticated users can read and create, admins can modify all
CREATE POLICY "Allow read access to stocktakes" ON stocktakes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to create stocktakes" ON stocktakes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow admins to modify stocktakes" ON stocktakes
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Scans: Users can read all and insert/update their own
CREATE POLICY "Allow read access to scans" ON scans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to insert scans" ON scans
  FOR INSERT TO authenticated WITH CHECK (scanned_by = auth.uid());

CREATE POLICY "Allow users to update their own scans" ON scans
  FOR UPDATE TO authenticated USING (scanned_by = auth.uid());

CREATE POLICY "Allow users to delete their own scans" ON scans
  FOR DELETE TO authenticated USING (scanned_by = auth.uid());

-- Manual Entries: Similar to scans
CREATE POLICY "Allow read access to manual entries" ON manual_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to insert manual entries" ON manual_entries
  FOR INSERT TO authenticated WITH CHECK (entered_by = auth.uid());

CREATE POLICY "Allow users to update their own manual entries" ON manual_entries
  FOR UPDATE TO authenticated USING (entered_by = auth.uid());

CREATE POLICY "Allow users to delete their own manual entries" ON manual_entries
  FOR DELETE TO authenticated USING (entered_by = auth.uid());

-- Kegs: Similar to scans
CREATE POLICY "Allow read access to kegs" ON kegs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to insert kegs" ON kegs
  FOR INSERT TO authenticated WITH CHECK (counted_by = auth.uid());

CREATE POLICY "Allow users to update their own kegs" ON kegs
  FOR UPDATE TO authenticated USING (counted_by = auth.uid());

-- Templates: All can read live, only admins can modify
CREATE POLICY "Allow read access to templates" ON templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to modify templates" ON templates
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Template Items: Follow template permissions
CREATE POLICY "Allow read access to template items" ON template_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to modify template items" ON template_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Recipes: Similar to templates
CREATE POLICY "Allow read access to recipes" ON recipes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to modify recipes" ON recipes
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Recipe Ingredients: Follow recipe permissions
CREATE POLICY "Allow read access to recipe ingredients" ON recipe_ingredients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to modify recipe ingredients" ON recipe_ingredients
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Batches: Users can read all and insert their own
CREATE POLICY "Allow read access to batches" ON batches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to insert batches" ON batches
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Allow users to update their own batches" ON batches
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- Variance Data: All can read, system inserts
CREATE POLICY "Allow read access to variance data" ON variance_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to modify variance data" ON variance_data
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Theoretical Stock: All can read, admins can upload
CREATE POLICY "Allow read access to theoretical stock" ON theoretical_stock
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to upload theoretical stock" ON theoretical_stock
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Issues: All can read, system inserts, users can acknowledge
CREATE POLICY "Allow read access to issues" ON issues
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow system to insert issues" ON issues
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow users to acknowledge issues" ON issues
  FOR UPDATE TO authenticated USING (true);

-- App Settings: All can read, only admins can modify
CREATE POLICY "Allow read access to app settings" ON app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to modify app settings" ON app_settings
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- User Preferences: Users can only access their own
CREATE POLICY "Allow users to access their own preferences" ON user_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stocktakes_updated_at BEFORE UPDATE ON stocktakes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON scans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_manual_entries_updated_at BEFORE UPDATE ON manual_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_kegs_updated_at BEFORE UPDATE ON kegs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_variance_data_updated_at BEFORE UPDATE ON variance_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default app settings
INSERT INTO app_settings (key, value, description) VALUES
  ('app_version', '"1.0.0"', 'Current application version'),
  ('lock_mode_enabled', 'false', 'Skip app selection screen when enabled'),
  ('default_folder_id', 'null', 'Default Google Drive folder ID (if still needed)');

-- =====================================================
-- VIEWS (Optional - for complex queries)
-- =====================================================

-- View: Stocktake Summary
CREATE VIEW stocktake_summary AS
SELECT
  s.id,
  s.name,
  s.stage,
  s.status,
  s.created_at,
  p.username AS created_by_username,
  COUNT(DISTINCT sc.id) AS total_scans,
  COUNT(DISTINCT me.id) AS total_manual_entries,
  COUNT(DISTINCT k.id) AS total_kegs,
  COUNT(DISTINCT b.id) AS total_batches
FROM stocktakes s
LEFT JOIN profiles p ON s.created_by = p.id
LEFT JOIN scans sc ON s.id = sc.stocktake_id
LEFT JOIN manual_entries me ON s.id = me.stocktake_id
LEFT JOIN kegs k ON s.id = k.stocktake_id
LEFT JOIN batches b ON s.id = b.stocktake_id
GROUP BY s.id, p.username;

-- View: Product Count Summary (counts per product across stocktake)
CREATE VIEW product_count_summary AS
SELECT
  sc.stocktake_id,
  sc.barcode,
  sc.product_name,
  sc.location,
  SUM(sc.quantity) AS total_quantity,
  COUNT(sc.id) AS scan_count,
  MIN(sc.scanned_at) AS first_scan,
  MAX(sc.scanned_at) AS last_scan
FROM scans sc
GROUP BY sc.stocktake_id, sc.barcode, sc.product_name, sc.location;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_scans_stocktake_location ON scans(stocktake_id, location);
CREATE INDEX idx_scans_stocktake_barcode ON scans(stocktake_id, barcode);
CREATE INDEX idx_batches_stocktake_recipe ON batches(stocktake_id, recipe_id);
CREATE INDEX idx_variance_stocktake_stock_group ON variance_data(stocktake_id, stock_group);

-- =====================================================
-- NOTES & MIGRATION GUIDE
-- =====================================================

/*
MIGRATION FROM GOOGLE SHEETS:

1. Export current Google Sheets data to CSV
2. Import products, locations, users into respective tables
3. Historical stocktakes can be imported if needed
4. Configure Supabase Auth with existing user credentials

OFFLINE-FIRST STRATEGY:

1. Use Supabase Realtime subscriptions for live updates
2. Implement local caching with Supabase client
3. Use optimistic updates for instant UI feedback
4. Sync status tracked via 'synced' boolean columns

STORAGE MIGRATION:

1. Move stocktake files from Google Drive to Supabase Storage
2. Update stocktakes.folder_id to storage bucket reference
3. Implement file upload/download via Supabase Storage API

EDGE FUNCTIONS (Optional):

1. Variance calculation can be implemented as Supabase Edge Function
2. Excel export can be handled server-side via Edge Function
3. Complex batch calculations can run on Edge Functions

*/
