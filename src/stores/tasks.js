import { defineStore } from 'pinia'
import { v4 as uuidv4 } from './utils.js'

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    items: [],
    categories: [
      { id: 'inbox', name: 'Inbox', icon: '📥', color: '#6366f1', pinned: true },
      { id: 'work', name: 'Work', icon: '💼', color: '#7c3aed', pinned: false },
      { id: 'personal', name: 'Personal', icon: '🏠', color: '#10b981', pinned: false },
    ],
    tags: [],
    activeCategory: 'inbox',
    activeFilter: 'all',
    searchQuery: '',
    sortBy: 'createdAt',
    sortDirection: 'desc',
    selectedTaskIds: [],
    batchMode: false,
  }),

  getters: {
    allTags(state) {
      const tagSet = new Set()
      state.items.forEach(task => {
        task.tags?.forEach(t => tagSet.add(t))
      })
      return Array.from(tagSet).sort()
    },

    filteredTasks(state) {
      let tasks = [...state.items]

      // Category filter
      if (state.activeCategory && state.activeCategory !== 'all') {
        tasks = tasks.filter(t => t.categoryId === state.activeCategory)
      }

      // Status filter
      switch (state.activeFilter) {
        case 'active':
          tasks = tasks.filter(t => !t.completed)
          break
        case 'completed':
          tasks = tasks.filter(t => t.completed)
          break
        case 'today': {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)
          tasks = tasks.filter(t => {
            if (!t.dueDate) return false
            const due = new Date(t.dueDate)
            return due >= today && due < tomorrow
          })
          break
        }
        case 'upcoming': {
          const now = new Date()
          tasks = tasks.filter(t => {
            if (!t.dueDate) return false
            return new Date(t.dueDate) > now && !t.completed
          })
          break
        }
        case 'overdue': {
          const now = new Date()
          tasks = tasks.filter(t => {
            if (!t.dueDate) return false
            return new Date(t.dueDate) < now && !t.completed
          })
          break
        }
      }

      // Tag filter
      if (state.activeTagFilter) {
        tasks = tasks.filter(t => t.tags?.includes(state.activeTagFilter))
      }

      // Search filter
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase()
        tasks = tasks.filter(t =>
          t.text.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          t.tags?.some(tag => tag.toLowerCase().includes(q)) ||
          t.links?.some(link => link.toLowerCase().includes(q))
        )
      }

      // Sort
      tasks.sort((a, b) => {
        let cmp = 0
        switch (state.sortBy) {
          case 'createdAt':
            cmp = new Date(b.createdAt) - new Date(a.createdAt)
            break
          case 'dueDate':
            if (!a.dueDate && !b.dueDate) cmp = 0
            else if (!a.dueDate) cmp = 1
            else if (!b.dueDate) cmp = -1
            else cmp = new Date(a.dueDate) - new Date(b.dueDate)
            break
          case 'priority': {
            const order = { high: 0, medium: 1, low: 2, none: 3 }
            cmp = (order[a.priority] || 3) - (order[b.priority] || 3)
            break
          }
          case 'alpha':
            cmp = a.text.localeCompare(b.text)
            break
        }
        return state.sortDirection === 'desc' ? -cmp : cmp
      })

      // Move completed to bottom
      const active = tasks.filter(t => !t.completed)
      const completed = tasks.filter(t => t.completed)
      return [...active, ...completed]
    },

    taskCount(state) {
      return state.items.filter(t => !t.completed).length
    },

    completedToday(state) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return state.items.filter(t => {
        if (!t.completedAt) return false
        return new Date(t.completedAt) >= today
      }).length
    },

    totalCompleted(state) {
      return state.items.filter(t => t.completed).length
    },

    overdueTasks(state) {
      const now = new Date()
      return state.items.filter(t => t.dueDate && new Date(t.dueDate) < now && !t.completed)
    },

    tasksByCategory(state) {
      const byCategory = {}
      state.categories.forEach(cat => {
        byCategory[cat.id] = state.items.filter(t => t.categoryId === cat.id)
      })
      return byCategory
    },

    // For Kanban
    tasksByStatus(state) {
      return {
        todo: state.items.filter(t => !t.completed && t.status !== 'in_progress'),
        in_progress: state.items.filter(t => !t.completed && t.status === 'in_progress'),
        done: state.items.filter(t => t.completed),
      }
    },

    // For Eisenhower Matrix
    tasksByMatrix(state) {
      const active = state.items.filter(t => !t.completed)
      return {
        urgentImportant: active.filter(t => t.priority === 'high' && t.isUrgent),
        notUrgentImportant: active.filter(t => t.priority === 'high' && !t.isUrgent),
        urgentNotImportant: active.filter(t => t.priority !== 'high' && t.isUrgent),
        notUrgentNotImportant: active.filter(t => t.priority !== 'high' && !t.isUrgent),
      }
    },

    // Calendar tasks grouped by date
    tasksByDate(state) {
      const map = {}
      state.items.forEach(task => {
        if (task.dueDate) {
          const dateKey = new Date(task.dueDate).toISOString().split('T')[0]
          if (!map[dateKey]) map[dateKey] = []
          map[dateKey].push(task)
        }
      })
      return map
    },

    // Completion stats for heatmap
    completionHeatmap(state) {
      const map = {}
      state.items.forEach(task => {
        if (task.completedAt) {
          const dateKey = new Date(task.completedAt).toISOString().split('T')[0]
          map[dateKey] = (map[dateKey] || 0) + 1
        }
      })
      return map
    },

    // Streak: consecutive days with at least 1 completion
    completionStreak(state) {
      const dates = state.items
        .filter(t => t.completedAt)
        .map(t => new Date(t.completedAt).toISOString().split('T')[0])
      const uniqueDates = [...new Set(dates)].sort().reverse()

      let streak = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      for (let i = 0; i < uniqueDates.length; i++) {
        const expected = new Date(today)
        expected.setDate(expected.getDate() - i)
        const expectedKey = expected.toISOString().split('T')[0]
        if (uniqueDates[i] === expectedKey) {
          streak++
        } else {
          break
        }
      }
      return streak
    },
  },

  actions: {
    addTask(taskData) {
      const task = {
        id: uuidv4(),
        text: taskData.text || '',
        notes: taskData.notes || '',
        completed: false,
        completedAt: null,
        priority: taskData.priority || 'none',
        tags: taskData.tags || [],
        links: taskData.links || [],
        categoryId: taskData.categoryId || this.activeCategory || 'inbox',
        dueDate: taskData.dueDate || null,
        recurrence: taskData.recurrence || null,
        subtasks: taskData.subtasks || [],
        status: 'todo',
        isUrgent: taskData.isUrgent || false,
        focusTime: 0,
        pomodoroCount: 0,
        order: this.items.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.items.unshift(task)
      return task
    },

    updateTask(id, updates) {
      const idx = this.items.findIndex(t => t.id === id)
      if (idx !== -1) {
        this.items[idx] = {
          ...this.items[idx],
          ...updates,
          updatedAt: new Date().toISOString(),
        }
      }
    },

    toggleComplete(id) {
      const task = this.items.find(t => t.id === id)
      if (!task) return

      task.completed = !task.completed
      task.completedAt = task.completed ? new Date().toISOString() : null
      task.status = task.completed ? 'done' : 'todo'
      task.updatedAt = new Date().toISOString()

      // Handle recurring tasks
      if (task.completed && task.recurrence) {
        this.createNextRecurrence(task)
      }

      return task
    },

    deleteTask(id) {
      const idx = this.items.findIndex(t => t.id === id)
      if (idx !== -1) {
        const removed = this.items.splice(idx, 1)[0]
        return removed
      }
    },

    reorderTasks(newOrder) {
      this.items = newOrder
    },

    // Subtasks
    addSubtask(taskId, text) {
      const task = this.items.find(t => t.id === taskId)
      if (!task) return
      if (!task.subtasks) task.subtasks = []
      task.subtasks.push({
        id: uuidv4(),
        text,
        completed: false,
        createdAt: new Date().toISOString(),
      })
    },

    toggleSubtask(taskId, subtaskId) {
      const task = this.items.find(t => t.id === taskId)
      if (!task) return
      const sub = task.subtasks?.find(s => s.id === subtaskId)
      if (sub) sub.completed = !sub.completed
    },

    deleteSubtask(taskId, subtaskId) {
      const task = this.items.find(t => t.id === taskId)
      if (!task) return
      task.subtasks = task.subtasks?.filter(s => s.id !== subtaskId)
    },

    // Categories
    addCategory(name, icon = '📁', color = '#6366f1') {
      this.categories.push({
        id: uuidv4(),
        name,
        icon,
        color,
        pinned: false,
      })
    },

    updateCategory(id, updates) {
      const cat = this.categories.find(c => c.id === id)
      if (cat) Object.assign(cat, updates)
    },

    deleteCategory(id) {
      // Move tasks to inbox
      this.items.forEach(t => {
        if (t.categoryId === id) t.categoryId = 'inbox'
      })
      this.categories = this.categories.filter(c => c.id !== id)
      if (this.activeCategory === id) this.activeCategory = 'inbox'
    },

    // Recurrence
    createNextRecurrence(task) {
      const dueDate = task.dueDate ? new Date(task.dueDate) : new Date()
      let nextDate

      switch (task.recurrence) {
        case 'daily':
          nextDate = new Date(dueDate.setDate(dueDate.getDate() + 1))
          break
        case 'weekdays': {
          nextDate = new Date(dueDate)
          do {
            nextDate.setDate(nextDate.getDate() + 1)
          } while (nextDate.getDay() === 0 || nextDate.getDay() === 6)
          break
        }
        case 'weekly':
          nextDate = new Date(dueDate.setDate(dueDate.getDate() + 7))
          break
        case 'biweekly':
          nextDate = new Date(dueDate.setDate(dueDate.getDate() + 14))
          break
        case 'monthly':
          nextDate = new Date(dueDate.setMonth(dueDate.getMonth() + 1))
          break
        default:
          return
      }

      this.addTask({
        text: task.text,
        notes: task.notes,
        priority: task.priority,
        tags: [...task.tags],
        links: [...(task.links || [])],
        categoryId: task.categoryId,
        dueDate: nextDate.toISOString(),
        recurrence: task.recurrence,
        subtasks: task.subtasks?.map(s => ({ ...s, id: uuidv4(), completed: false })),
        isUrgent: task.isUrgent,
      })
    },

    // Filters
    setFilter(filter) { this.activeFilter = filter },
    setCategory(categoryId) { this.activeCategory = categoryId },
    setSearch(query) { this.searchQuery = query },
    setSort(by, direction) {
      this.sortBy = by
      if (direction) this.sortDirection = direction
    },

    // Batch
    toggleBatchMode() { this.batchMode = !this.batchMode; this.selectedTaskIds = [] },
    toggleTaskSelection(id) {
      const idx = this.selectedTaskIds.indexOf(id)
      if (idx === -1) this.selectedTaskIds.push(id)
      else this.selectedTaskIds.splice(idx, 1)
    },
    selectAll() { this.selectedTaskIds = this.filteredTasks.map(t => t.id) },
    deselectAll() { this.selectedTaskIds = [] },

    batchComplete() {
      this.selectedTaskIds.forEach(id => this.toggleComplete(id))
      this.selectedTaskIds = []
    },
    batchDelete() {
      this.items = this.items.filter(t => !this.selectedTaskIds.includes(t.id))
      this.selectedTaskIds = []
    },
    batchSetPriority(priority) {
      this.selectedTaskIds.forEach(id => this.updateTask(id, { priority }))
      this.selectedTaskIds = []
    },
    batchAddTag(tag) {
      this.selectedTaskIds.forEach(id => {
        const task = this.items.find(t => t.id === id)
        if (task && !task.tags.includes(tag)) {
          task.tags.push(tag)
        }
      })
      this.selectedTaskIds = []
    },
    batchMoveCategory(categoryId) {
      this.selectedTaskIds.forEach(id => this.updateTask(id, { categoryId }))
      this.selectedTaskIds = []
    },

    // Data management
    exportData() {
      return JSON.stringify({
        tasks: this.items,
        categories: this.categories,
        exportedAt: new Date().toISOString(),
        version: '2.0',
      }, null, 2)
    },

    importData(jsonString) {
      try {
        const data = JSON.parse(jsonString)
        if (data.tasks) this.items = data.tasks
        if (data.categories) this.categories = data.categories
        return true
      } catch (e) {
        console.error('Import failed:', e)
        return false
      }
    },

    clearAll() {
      this.items = []
      this.selectedTaskIds = []
      this.searchQuery = ''
      this.activeFilter = 'all'
    },
  },
})
