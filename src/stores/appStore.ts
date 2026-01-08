import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  isOnline: boolean
  isSyncing: boolean
  unsyncedCount: number
  currentLocation: string | null
  lockMode: boolean
  darkMode: boolean

  // Actions
  setOnlineStatus: (isOnline: boolean) => void
  setSyncingStatus: (isSyncing: boolean) => void
  setUnsyncedCount: (count: number) => void
  setCurrentLocation: (location: string | null) => void
  setLockMode: (enabled: boolean) => void
  toggleDarkMode: () => void
  incrementUnsyncedCount: () => void
  decrementUnsyncedCount: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isOnline: navigator.onLine,
      isSyncing: false,
      unsyncedCount: 0,
      currentLocation: null,
      lockMode: false,
      darkMode: false,

      setOnlineStatus: (isOnline) => set({ isOnline }),

      setSyncingStatus: (isSyncing) => set({ isSyncing }),

      setUnsyncedCount: (count) => set({ unsyncedCount: count }),

      setCurrentLocation: (location) => set({ currentLocation: location }),

      setLockMode: (enabled) => set({ lockMode: enabled }),

      toggleDarkMode: () =>
        set((state) => {
          const newDarkMode = !state.darkMode
          // Update document class for Tailwind dark mode
          if (newDarkMode) {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
          return { darkMode: newDarkMode }
        }),

      incrementUnsyncedCount: () =>
        set((state) => ({ unsyncedCount: state.unsyncedCount + 1 })),

      decrementUnsyncedCount: () =>
        set((state) => ({
          unsyncedCount: Math.max(0, state.unsyncedCount - 1),
        })),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        currentLocation: state.currentLocation,
        lockMode: state.lockMode,
        darkMode: state.darkMode,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply dark mode class on hydration
        if (state?.darkMode) {
          document.documentElement.classList.add('dark')
        }
      },
    }
  )
)

// Setup online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAppStore.getState().setOnlineStatus(true)
  })

  window.addEventListener('offline', () => {
    useAppStore.getState().setOnlineStatus(false)
  })
}
