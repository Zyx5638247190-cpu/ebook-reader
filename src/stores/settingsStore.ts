import { create } from 'zustand'
import type { FontSize, ReaderSettings, ReaderTheme } from '../types'
import { loadSettings, saveSettings } from '../lib/storage'

interface SettingsState extends ReaderSettings {
  setFontSize: (fontSize: FontSize) => void
  setTheme: (theme: ReaderTheme) => void
}

const initial = loadSettings()

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initial,

  setFontSize: (fontSize) => {
    const next: ReaderSettings = { fontSize, theme: get().theme }
    saveSettings(next)
    set(next)
  },

  setTheme: (theme) => {
    const next: ReaderSettings = { fontSize: get().fontSize, theme }
    saveSettings(next)
    set(next)
  },
}))
