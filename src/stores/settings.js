import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    sidebarOpen: true,
    viewMode: 'list', // list, kanban, calendar, eisenhower
    listDensity: 'comfortable', // compact, comfortable
    showCompleted: true,
    showDashboard: false,
    showTimeline: false,
    commandPaletteOpen: false,
    focusModeTaskId: null,
    keyboardHelpOpen: false,
    importExportOpen: false,
  }),

  actions: {
    toggleSidebar() { this.sidebarOpen = !this.sidebarOpen },
    setViewMode(mode) { this.viewMode = mode },
    toggleDashboard() { this.showDashboard = !this.showDashboard },
    toggleTimeline() { this.showTimeline = !this.showTimeline },
    openCommandPalette() { this.commandPaletteOpen = true },
    closeCommandPalette() { this.commandPaletteOpen = false },
    toggleCommandPalette() { this.commandPaletteOpen = !this.commandPaletteOpen },
    enterFocusMode(taskId) { this.focusModeTaskId = taskId },
    exitFocusMode() { this.focusModeTaskId = null },
    toggleKeyboardHelp() { this.keyboardHelpOpen = !this.keyboardHelpOpen },
    toggleImportExport() { this.importExportOpen = !this.importExportOpen },
  },
})
