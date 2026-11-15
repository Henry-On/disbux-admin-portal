'use client'

import { create } from 'zustand'

type AdminStore = {
  email: string
  permissions: string[]
  menuOpen: boolean
  setIdentity: (email: string, permissions: string[]) => void
  clearIdentity: () => void
  toggleMenu: () => void
}

export const useAdminStore = create<AdminStore>((set) => ({
  email: '',
  permissions: [],
  menuOpen: false,
  setIdentity: (email, permissions) => set({ email, permissions }),
  clearIdentity: () => set({ email: '', permissions: [], menuOpen: false }),
  toggleMenu: () => set((state) => ({ menuOpen: !state.menuOpen })),
}))
