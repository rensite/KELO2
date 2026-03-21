import { defineStore } from 'pinia'

export const useHistoryStore = defineStore('history', {
  state: () => ({
    entries: [],
    undoStack: [],
    redoStack: [],
    maxEntries: 200,
  }),

  getters: {
    recentEntries(state) {
      return state.entries.slice(0, 50)
    },

    entriesByDate(state) {
      const grouped = {}
      state.entries.forEach(entry => {
        const dateKey = new Date(entry.timestamp).toISOString().split('T')[0]
        if (!grouped[dateKey]) grouped[dateKey] = []
        grouped[dateKey].push(entry)
      })
      return grouped
    },
  },

  actions: {
    log(action, data) {
      this.entries.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        action,
        data,
        timestamp: new Date().toISOString(),
      })
      if (this.entries.length > this.maxEntries) {
        this.entries = this.entries.slice(0, this.maxEntries)
      }
    },

    pushUndo(action) {
      this.undoStack.push(action)
      this.redoStack = [] // Clear redo on new action
      if (this.undoStack.length > 50) {
        this.undoStack.shift()
      }
    },

    undo() {
      if (this.undoStack.length === 0) return null
      const action = this.undoStack.pop()
      this.redoStack.push(action)
      return action
    },

    redo() {
      if (this.redoStack.length === 0) return null
      const action = this.redoStack.pop()
      this.undoStack.push(action)
      return action
    },

    canUndo() { return this.undoStack.length > 0 },
    canRedo() { return this.redoStack.length > 0 },
  },
})
