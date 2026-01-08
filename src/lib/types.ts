// =====================================================
// CORE TYPES - Stock Reconciliation System
// =====================================================

export interface User {
  id: string
  username: string
  role: 'admin' | 'user'
  email?: string
}

export interface Profile {
  id: string
  username: string
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
}

// =====================================================
// PRODUCTS
// =====================================================

export interface Product {
  id: string
  barcode: string
  product_code?: string
  product_name: string
  current_stock: number
  unit_value: number
  stock_group?: string
  category?: string
  supplier?: string
  pack_size?: string
  active: boolean
  created_at: string
  updated_at: string
}

// =====================================================
// LOCATIONS
// =====================================================

export interface Location {
  id: string
  name: string
  description?: string
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// =====================================================
// STOCKTAKES
// =====================================================

export type StocktakeStage = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type StocktakeStatus = 'active' | 'completed' | 'archived'

export interface Stocktake {
  id: string
  name: string
  stage: StocktakeStage
  created_by: string
  folder_id?: string
  status: StocktakeStatus
  completed_at?: string
  created_at: string
  updated_at: string
}

// =====================================================
// SCANS
// =====================================================

export interface Scan {
  id: string
  stocktake_id: string
  barcode: string
  product_name: string
  quantity: number
  location?: string
  scanned_by: string
  scanned_at: string
  synced: boolean
  created_at: string
  updated_at: string
}

export interface ScanInput {
  barcode: string
  product_name: string
  quantity: number
  location?: string
}

// =====================================================
// MANUAL ENTRIES
// =====================================================

export interface ManualEntry {
  id: string
  stocktake_id: string
  product_name: string
  quantity: number
  location?: string
  entered_by: string
  entered_at: string
  synced: boolean
  created_at: string
  updated_at: string
}

export interface ManualEntryInput {
  product_name: string
  quantity: number
  location?: string
}

// =====================================================
// KEGS
// =====================================================

export interface Keg {
  id: string
  stocktake_id: string
  keg_name: string
  location: string
  count: number
  counted_by: string
  counted_at: string
  synced: boolean
  created_at: string
  updated_at: string
}

export interface KegInput {
  keg_name: string
  location: string
  count: number
}

// =====================================================
// TEMPLATES
// =====================================================

export type TemplateStatus = 'draft' | 'live'

export interface Template {
  id: string
  name: string
  location: string
  status: TemplateStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface TemplateItem {
  id: string
  template_id: string
  product_id?: string
  barcode: string
  product_name: string
  par_level: number
  sort_order: number
  created_at: string
}

export interface TemplateWithItems extends Template {
  items: TemplateItem[]
}

// =====================================================
// RECIPES & BATCHES
// =====================================================

export type RecipeStatus = 'draft' | 'live'

export interface Recipe {
  id: string
  name: string
  location: string
  status: RecipeStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  product_id?: string
  barcode?: string
  ingredient_name: string
  quantity_per_batch: number
  is_filler: boolean
  sort_order: number
  created_at: string
}

export interface RecipeWithIngredients extends Recipe {
  ingredients: RecipeIngredient[]
}

export interface Batch {
  id: string
  stocktake_id: string
  recipe_id: string
  recipe_name: string
  batch_count: number
  location?: string
  created_by: string
  created_at: string
  synced: boolean
  updated_at: string
}

export interface BatchInput {
  recipe_id: string
  recipe_name: string
  batch_count: number
  location?: string
}

// =====================================================
// VARIANCE
// =====================================================

export interface VarianceData {
  id: string
  stocktake_id: string
  product_code?: string
  product_name: string
  barcode?: string
  stock_group?: string
  theoretical_qty: number
  counted_qty: number
  qty_variance: number
  unit_value: number
  dollar_variance: number
  variance_percentage: number
  created_at: string
  updated_at: string
}

export interface TheoreticalStock {
  id: string
  stocktake_id: string
  product_code?: string
  product_name: string
  barcode?: string
  theoretical_qty: number
  unit_value: number
  stock_group?: string
  uploaded_by: string
  uploaded_at: string
}

export interface TheoreticalStockUpload {
  product_code?: string
  product_name: string
  barcode?: string
  theoretical_qty: number
  unit_value: number
  stock_group?: string
}

// =====================================================
// ISSUES
// =====================================================

export type IssueSeverity = 'info' | 'warning' | 'error'

export interface Issue {
  id: string
  stocktake_id: string
  issue_type: string
  description?: string
  severity: IssueSeverity
  acknowledged: boolean
  acknowledged_by?: string
  acknowledged_at?: string
  created_at: string
}

// =====================================================
// SETTINGS
// =====================================================

export interface AppSetting {
  id: string
  key: string
  value: unknown
  description?: string
  updated_by?: string
  updated_at: string
}

export interface UserPreferences {
  id: string
  user_id: string
  preferences: Record<string, unknown>
  updated_at: string
}

// =====================================================
// UI STATE
// =====================================================

export interface AppState {
  isOnline: boolean
  isSyncing: boolean
  unsyncedCount: number
  currentLocation?: string
  lockMode: boolean
}

export interface ScanningState {
  isScanning: boolean
  lastScan?: {
    barcode: string
    timestamp: Date
  }
}

// =====================================================
// API RESPONSES
// =====================================================

export interface ApiResponse<T = unknown> {
  data?: T
  error?: {
    message: string
    code?: string
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}
