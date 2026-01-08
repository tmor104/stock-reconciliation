import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { Stocktake, StocktakeStage } from '@/lib/types'

interface StocktakeState {
  currentStocktake: Stocktake | null
  stocktakes: Stocktake[]
  isLoading: boolean

  // Actions
  setCurrentStocktake: (stocktake: Stocktake | null) => void
  fetchStocktakes: () => Promise<void>
  createStocktake: (name: string) => Promise<Stocktake>
  updateStage: (stocktakeId: string, stage: StocktakeStage) => Promise<void>
  deleteStocktake: (stocktakeId: string) => Promise<void>
  refreshCurrentStocktake: () => Promise<void>
}

export const useStocktakeStore = create<StocktakeState>()(
  persist(
    (set, get) => ({
      currentStocktake: null,
      stocktakes: [],
      isLoading: false,

      setCurrentStocktake: (stocktake) => set({ currentStocktake: stocktake }),

      fetchStocktakes: async () => {
        try {
          set({ isLoading: true })

          const { data, error } = await supabase
            .from('stocktakes')
            .select('*')
            .order('created_at', { ascending: false })

          if (error) throw error

          set({ stocktakes: data || [] })
        } catch (error) {
          console.error('Error fetching stocktakes:', error)
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      createStocktake: async (name: string) => {
        try {
          set({ isLoading: true })

          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) throw new Error('User not authenticated')

          const { data, error } = await supabase
            .from('stocktakes')
            .insert({
              name,
              stage: 1,
              status: 'active',
              created_by: user.id,
            })
            .select()
            .single()

          if (error) throw error

          // Add to list and set as current
          set((state) => ({
            stocktakes: [data, ...state.stocktakes],
            currentStocktake: data,
          }))

          return data
        } catch (error) {
          console.error('Error creating stocktake:', error)
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      updateStage: async (stocktakeId: string, stage: StocktakeStage) => {
        try {
          const { error } = await supabase
            .from('stocktakes')
            .update({ stage })
            .eq('id', stocktakeId)

          if (error) throw error

          // Update local state
          set((state) => ({
            stocktakes: state.stocktakes.map((st) =>
              st.id === stocktakeId ? { ...st, stage } : st
            ),
            currentStocktake:
              state.currentStocktake?.id === stocktakeId
                ? { ...state.currentStocktake, stage }
                : state.currentStocktake,
          }))
        } catch (error) {
          console.error('Error updating stage:', error)
          throw error
        }
      },

      deleteStocktake: async (stocktakeId: string) => {
        try {
          const { error } = await supabase
            .from('stocktakes')
            .delete()
            .eq('id', stocktakeId)

          if (error) throw error

          // Remove from local state
          set((state) => ({
            stocktakes: state.stocktakes.filter((st) => st.id !== stocktakeId),
            currentStocktake:
              state.currentStocktake?.id === stocktakeId
                ? null
                : state.currentStocktake,
          }))
        } catch (error) {
          console.error('Error deleting stocktake:', error)
          throw error
        }
      },

      refreshCurrentStocktake: async () => {
        const { currentStocktake } = get()
        if (!currentStocktake) return

        try {
          const { data, error } = await supabase
            .from('stocktakes')
            .select('*')
            .eq('id', currentStocktake.id)
            .single()

          if (error) throw error

          set({ currentStocktake: data })
        } catch (error) {
          console.error('Error refreshing stocktake:', error)
          throw error
        }
      },
    }),
    {
      name: 'stocktake-storage',
      partialize: (state) => ({
        currentStocktake: state.currentStocktake,
      }),
    }
  )
)
