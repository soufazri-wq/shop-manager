import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api.js'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({})

  useEffect(() => {
    api.get('/settings').then(setSettings).catch(() => {})
  }, [])

  const saveSettings = async (patch) => {
    const updated = await api.put('/settings', patch)
    setSettings(updated)
    return updated
  }

  return (
    <SettingsContext.Provider value={{ settings, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
