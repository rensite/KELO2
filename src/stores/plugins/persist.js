const STORAGE_KEYS = {
  tasks: 'kelo_tasks',
  categories: 'kelo_categories',
  settings: 'kelo_settings',
  templates: 'kelo_templates',
  history: 'kelo_history',
  pomodoro: 'kelo_pomodoro',
}

export function createPersistPlugin() {
  return ({ store }) => {
    const key = STORAGE_KEYS[store.$id]
    if (!key) return

    // Load from storage on init
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        store.$patch(parsed)
      } catch (e) {
        console.warn(`Failed to load ${key} from localStorage:`, e)
      }
    }

    // Save on every mutation (debounced)
    let timeout = null
    store.$subscribe(() => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        try {
          const state = JSON.parse(JSON.stringify(store.$state))
          // Remove non-serializable fields
          delete state._saveTimeout
          localStorage.setItem(key, JSON.stringify(state))
        } catch (e) {
          console.warn(`Failed to save ${key} to localStorage:`, e)
        }
      }, 300)
    })
  }
}
