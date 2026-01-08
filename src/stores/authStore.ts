import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (email: string, password: string) => {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (error) throw error

          if (data.user) {
            // Get user profile
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single()

            if (profileError) throw profileError

            set({
              user: {
                id: profile.id,
                username: profile.username,
                role: profile.role,
                email: data.user.email,
              },
              isAuthenticated: true,
            })
          }
        } catch (error) {
          console.error('Login error:', error)
          throw error
        }
      },

      logout: async () => {
        try {
          const { error } = await supabase.auth.signOut()
          if (error) throw error

          set({
            user: null,
            isAuthenticated: false,
          })
        } catch (error) {
          console.error('Logout error:', error)
          throw error
        }
      },

      checkAuth: async () => {
        try {
          set({ isLoading: true })

          const {
            data: { session },
          } = await supabase.auth.getSession()

          if (session?.user) {
            // Get user profile
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()

            if (profileError) throw profileError

            set({
              user: {
                id: profile.id,
                username: profile.username,
                role: profile.role,
                email: session.user.email,
              },
              isAuthenticated: true,
            })
          } else {
            set({
              user: null,
              isAuthenticated: false,
            })
          }
        } catch (error) {
          console.error('Check auth error:', error)
          set({
            user: null,
            isAuthenticated: false,
          })
        } finally {
          set({ isLoading: false })
        }
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
