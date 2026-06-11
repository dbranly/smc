import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export const THEMES = [
  { id: 'slate',    label: 'Slate',    desc: 'Clair · Gris-bleu',   icon: '◐' },
  { id: 'stone',    label: 'Stone',    desc: 'Clair · Chaud BTP',   icon: '◑' },
  { id: 'midnight', label: 'Midnight', desc: 'Sombre · Professionnel', icon: '●' },
]

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('smc_theme') || 'slate')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('smc_theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
