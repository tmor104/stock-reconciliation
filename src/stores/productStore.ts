import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Product, Location } from '@/lib/types'

interface ProductState {
  products: Product[]
  locations: Location[]
  isLoading: boolean
  searchQuery: string
  selectedStockGroup: string | null

  // Actions
  fetchProducts: () => Promise<void>
  fetchLocations: () => Promise<void>
  addProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<Product>
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  addLocation: (location: Omit<Location, 'id' | 'created_at' | 'updated_at'>) => Promise<Location>
  updateLocation: (id: string, updates: Partial<Location>) => Promise<void>
  deleteLocation: (id: string) => Promise<void>
  setSearchQuery: (query: string) => void
  setSelectedStockGroup: (group: string | null) => void
  searchProducts: (barcode?: string, name?: string) => Promise<Product[]>
  getProductByBarcode: (barcode: string) => Product | undefined
}

export const useProductStore = create<ProductState>()((set, get) => ({
  products: [],
  locations: [],
  isLoading: false,
  searchQuery: '',
  selectedStockGroup: null,

  // =============== PRODUCTS ===============
  fetchProducts: async () => {
    try {
      set({ isLoading: true })

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('product_name')

      if (error) throw error

      set({ products: data || [] })
    } catch (error) {
      console.error('Error fetching products:', error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  addProduct: async (product) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        products: [...state.products, data].sort((a, b) =>
          a.product_name.localeCompare(b.product_name)
        ),
      }))

      return data
    } catch (error) {
      console.error('Error adding product:', error)
      throw error
    }
  },

  updateProduct: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      set((state) => ({
        products: state.products.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      }))
    } catch (error) {
      console.error('Error updating product:', error)
      throw error
    }
  },

  deleteProduct: async (id) => {
    try {
      // Soft delete - just set active to false
      const { error } = await supabase
        .from('products')
        .update({ active: false })
        .eq('id', id)

      if (error) throw error

      set((state) => ({
        products: state.products.filter((p) => p.id !== id),
      }))
    } catch (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  },

  searchProducts: async (barcode?: string, name?: string) => {
    try {
      let query = supabase
        .from('products')
        .select('*')
        .eq('active', true)

      if (barcode) {
        query = query.ilike('barcode', `%${barcode}%`)
      }

      if (name) {
        query = query.ilike('product_name', `%${name}%`)
      }

      const { data, error } = await query.limit(50)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error searching products:', error)
      throw error
    }
  },

  getProductByBarcode: (barcode: string) => {
    return get().products.find((p) => p.barcode === barcode)
  },

  // =============== LOCATIONS ===============
  fetchLocations: async () => {
    try {
      set({ isLoading: true })

      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('active', true)
        .order('sort_order')

      if (error) throw error

      set({ locations: data || [] })
    } catch (error) {
      console.error('Error fetching locations:', error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  addLocation: async (location) => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .insert(location)
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        locations: [...state.locations, data].sort(
          (a, b) => a.sort_order - b.sort_order
        ),
      }))

      return data
    } catch (error) {
      console.error('Error adding location:', error)
      throw error
    }
  },

  updateLocation: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('locations')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      set((state) => ({
        locations: state.locations.map((l) =>
          l.id === id ? { ...l, ...updates } : l
        ),
      }))
    } catch (error) {
      console.error('Error updating location:', error)
      throw error
    }
  },

  deleteLocation: async (id) => {
    try {
      // Soft delete
      const { error } = await supabase
        .from('locations')
        .update({ active: false })
        .eq('id', id)

      if (error) throw error

      set((state) => ({
        locations: state.locations.filter((l) => l.id !== id),
      }))
    } catch (error) {
      console.error('Error deleting location:', error)
      throw error
    }
  },

  // =============== FILTERS ===============
  setSearchQuery: (query) => set({ searchQuery: query }),

  setSelectedStockGroup: (group) => set({ selectedStockGroup: group }),
}))
