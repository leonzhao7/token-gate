import { ref, watch } from 'vue'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'token-gate-theme'

export function useTheme() {
  const theme = ref<Theme>((localStorage.getItem(STORAGE_KEY) as Theme) || 'system')

  const applyTheme = () => {
    const root = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const effectiveTheme = theme.value === 'system' ? (prefersDark ? 'dark' : 'light') : theme.value
    root.setAttribute('data-theme', effectiveTheme)
  }

  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme()
  }

  const toggleTheme = () => {
    const newTheme = theme.value === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  watch(() => theme.value, applyTheme, { immediate: true })

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)

  return { theme, setTheme, toggleTheme }
}
