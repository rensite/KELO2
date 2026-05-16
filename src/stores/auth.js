import { defineStore } from 'pinia'
import { supabase, hasSupabase } from '../lib/supabase.js'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    session: null,
    loading: false,
    initialized: false,
    authModalOpen: false,
    lastError: null,
    magicLinkSentTo: null,
  }),

  getters: {
    isSignedIn: (s) => !!s.user,
    email: (s) => s.user?.email || null,
  },

  actions: {
    async init() {
      if (!hasSupabase || this.initialized) return
      this.initialized = true
      const { data } = await supabase.auth.getSession()
      this.session = data.session || null
      this.user = data.session?.user || null

      supabase.auth.onAuthStateChange((_event, session) => {
        this.session = session || null
        this.user = session?.user || null
      })
    },

    async sendMagicLink(email) {
      if (!hasSupabase) {
        this.lastError = 'Supabase не сконфигурирован (.env)'
        return false
      }
      this.loading = true
      this.lastError = null
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      this.loading = false
      if (error) {
        this.lastError = error.message
        return false
      }
      this.magicLinkSentTo = email
      return true
    },

    async signOut() {
      if (!hasSupabase) return
      await supabase.auth.signOut()
      this.user = null
      this.session = null
      this.magicLinkSentTo = null
    },

    openAuthModal() { this.authModalOpen = true; this.lastError = null; this.magicLinkSentTo = null },
    closeAuthModal() { this.authModalOpen = false },
  },
})
