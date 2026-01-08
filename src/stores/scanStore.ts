import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type {
  Scan,
  ScanInput,
  ManualEntry,
  ManualEntryInput,
  Keg,
  KegInput,
} from '@/lib/types'

interface ScanState {
  scans: Scan[]
  manualEntries: ManualEntry[]
  kegs: Keg[]
  isLoading: boolean
  isScanning: boolean

  // Actions
  fetchScans: (stocktakeId: string) => Promise<void>
  addScan: (stocktakeId: string, scan: ScanInput) => Promise<void>
  updateScan: (scanId: string, quantity: number) => Promise<void>
  deleteScan: (scanId: string) => Promise<void>
  syncScans: (stocktakeId: string) => Promise<void>

  fetchManualEntries: (stocktakeId: string) => Promise<void>
  addManualEntry: (
    stocktakeId: string,
    entry: ManualEntryInput
  ) => Promise<void>
  updateManualEntry: (entryId: string, quantity: number) => Promise<void>
  deleteManualEntry: (entryId: string) => Promise<void>

  fetchKegs: (stocktakeId: string) => Promise<void>
  addKeg: (stocktakeId: string, keg: KegInput) => Promise<void>
  updateKeg: (kegId: string, count: number) => Promise<void>
  deleteKeg: (kegId: string) => Promise<void>

  setIsScanning: (isScanning: boolean) => void
  clearAll: () => void
}

export const useScanStore = create<ScanState>()((set, get) => ({
  scans: [],
  manualEntries: [],
  kegs: [],
  isLoading: false,
  isScanning: false,

  // =============== SCANS ===============
  fetchScans: async (stocktakeId: string) => {
    try {
      set({ isLoading: true })

      const { data, error } = await supabase
        .from('scans')
        .select('*')
        .eq('stocktake_id', stocktakeId)
        .order('scanned_at', { ascending: false })

      if (error) throw error

      set({ scans: data || [] })
    } catch (error) {
      console.error('Error fetching scans:', error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  addScan: async (stocktakeId: string, scan: ScanInput) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('scans')
        .insert({
          stocktake_id: stocktakeId,
          barcode: scan.barcode,
          product_name: scan.product_name,
          quantity: scan.quantity,
          location: scan.location,
          scanned_by: user.id,
          synced: true,
        })
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        scans: [data, ...state.scans],
      }))
    } catch (error) {
      console.error('Error adding scan:', error)
      throw error
    }
  },

  updateScan: async (scanId: string, quantity: number) => {
    try {
      const { error } = await supabase
        .from('scans')
        .update({ quantity })
        .eq('id', scanId)

      if (error) throw error

      set((state) => ({
        scans: state.scans.map((scan) =>
          scan.id === scanId ? { ...scan, quantity } : scan
        ),
      }))
    } catch (error) {
      console.error('Error updating scan:', error)
      throw error
    }
  },

  deleteScan: async (scanId: string) => {
    try {
      const { error } = await supabase.from('scans').delete().eq('id', scanId)

      if (error) throw error

      set((state) => ({
        scans: state.scans.filter((scan) => scan.id !== scanId),
      }))
    } catch (error) {
      console.error('Error deleting scan:', error)
      throw error
    }
  },

  syncScans: async (stocktakeId: string) => {
    // In Supabase, scans are synced in real-time
    // This function exists for compatibility and can trigger a refresh
    await get().fetchScans(stocktakeId)
  },

  // =============== MANUAL ENTRIES ===============
  fetchManualEntries: async (stocktakeId: string) => {
    try {
      set({ isLoading: true })

      const { data, error } = await supabase
        .from('manual_entries')
        .select('*')
        .eq('stocktake_id', stocktakeId)
        .order('entered_at', { ascending: false })

      if (error) throw error

      set({ manualEntries: data || [] })
    } catch (error) {
      console.error('Error fetching manual entries:', error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  addManualEntry: async (stocktakeId: string, entry: ManualEntryInput) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('manual_entries')
        .insert({
          stocktake_id: stocktakeId,
          product_name: entry.product_name,
          quantity: entry.quantity,
          location: entry.location,
          entered_by: user.id,
          synced: true,
        })
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        manualEntries: [data, ...state.manualEntries],
      }))
    } catch (error) {
      console.error('Error adding manual entry:', error)
      throw error
    }
  },

  updateManualEntry: async (entryId: string, quantity: number) => {
    try {
      const { error } = await supabase
        .from('manual_entries')
        .update({ quantity })
        .eq('id', entryId)

      if (error) throw error

      set((state) => ({
        manualEntries: state.manualEntries.map((entry) =>
          entry.id === entryId ? { ...entry, quantity } : entry
        ),
      }))
    } catch (error) {
      console.error('Error updating manual entry:', error)
      throw error
    }
  },

  deleteManualEntry: async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('manual_entries')
        .delete()
        .eq('id', entryId)

      if (error) throw error

      set((state) => ({
        manualEntries: state.manualEntries.filter(
          (entry) => entry.id !== entryId
        ),
      }))
    } catch (error) {
      console.error('Error deleting manual entry:', error)
      throw error
    }
  },

  // =============== KEGS ===============
  fetchKegs: async (stocktakeId: string) => {
    try {
      set({ isLoading: true })

      const { data, error } = await supabase
        .from('kegs')
        .select('*')
        .eq('stocktake_id', stocktakeId)
        .order('counted_at', { ascending: false })

      if (error) throw error

      set({ kegs: data || [] })
    } catch (error) {
      console.error('Error fetching kegs:', error)
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  addKeg: async (stocktakeId: string, keg: KegInput) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('kegs')
        .insert({
          stocktake_id: stocktakeId,
          keg_name: keg.keg_name,
          location: keg.location,
          count: keg.count,
          counted_by: user.id,
          synced: true,
        })
        .select()
        .single()

      if (error) throw error

      set((state) => ({
        kegs: [data, ...state.kegs],
      }))
    } catch (error) {
      console.error('Error adding keg:', error)
      throw error
    }
  },

  updateKeg: async (kegId: string, count: number) => {
    try {
      const { error } = await supabase
        .from('kegs')
        .update({ count })
        .eq('id', kegId)

      if (error) throw error

      set((state) => ({
        kegs: state.kegs.map((keg) =>
          keg.id === kegId ? { ...keg, count } : keg
        ),
      }))
    } catch (error) {
      console.error('Error updating keg:', error)
      throw error
    }
  },

  deleteKeg: async (kegId: string) => {
    try {
      const { error } = await supabase.from('kegs').delete().eq('id', kegId)

      if (error) throw error

      set((state) => ({
        kegs: state.kegs.filter((keg) => keg.id !== kegId),
      }))
    } catch (error) {
      console.error('Error deleting keg:', error)
      throw error
    }
  },

  // =============== UTILITIES ===============
  setIsScanning: (isScanning) => set({ isScanning }),

  clearAll: () =>
    set({
      scans: [],
      manualEntries: [],
      kegs: [],
    }),
}))
