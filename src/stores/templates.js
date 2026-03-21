import { defineStore } from 'pinia'
import { v4 as uuidv4 } from './utils.js'

export const useTemplateStore = defineStore('templates', {
  state: () => ({
    items: [
      {
        id: 'tpl-weekly-review',
        name: 'Weekly Review',
        icon: '📋',
        task: {
          text: 'Weekly Review',
          priority: 'medium',
          tags: ['review'],
          subtasks: [
            { text: 'Review completed tasks', completed: false },
            { text: 'Update project priorities', completed: false },
            { text: 'Plan next week goals', completed: false },
            { text: 'Clear inbox', completed: false },
          ],
        },
        builtIn: true,
      },
      {
        id: 'tpl-daily-standup',
        name: 'Daily Standup',
        icon: '🧑‍💻',
        task: {
          text: 'Daily Standup',
          priority: 'low',
          tags: ['work', 'daily'],
          recurrence: 'weekdays',
          subtasks: [
            { text: 'What I did yesterday', completed: false },
            { text: 'What I will do today', completed: false },
            { text: 'Any blockers?', completed: false },
          ],
        },
        builtIn: true,
      },
      {
        id: 'tpl-project-kickoff',
        name: 'Project Kickoff',
        icon: '🚀',
        task: {
          text: 'New Project Kickoff',
          priority: 'high',
          tags: ['project'],
          subtasks: [
            { text: 'Define project scope', completed: false },
            { text: 'Identify stakeholders', completed: false },
            { text: 'Set milestones', completed: false },
            { text: 'Create initial backlog', completed: false },
            { text: 'Schedule kickoff meeting', completed: false },
          ],
        },
        builtIn: true,
      },
    ],
  }),

  actions: {
    addTemplate(name, taskData, icon = '📝') {
      this.items.push({
        id: uuidv4(),
        name,
        icon,
        task: { ...taskData },
        builtIn: false,
      })
    },

    deleteTemplate(id) {
      this.items = this.items.filter(t => t.id !== id || t.builtIn)
    },

    getTemplate(id) {
      return this.items.find(t => t.id === id)
    },
  },
})
