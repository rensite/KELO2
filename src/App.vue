<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useSettingsStore } from './stores/settings.js'
import { useTaskStore } from './stores/tasks.js'
import { useHistoryStore } from './stores/history.js'
import { useAuthStore } from './stores/auth.js'
import {
  startCloudSync,
  startAfterSignIn,
  isCloudEmpty,
  smartMerge,
  pushAllLocal,
  migrateMediaToStorage,
} from './stores/plugins/syncSupabase.js'
import { useTemplateStore } from './stores/templates.js'
import { useToast } from './composables/useToast.js'
import AuthModal from './components/ui/AuthModal.vue'
import SyncDialog from './components/ui/SyncDialog.vue'
import AppHeader from './components/layout/AppHeader.vue'
import Sidebar from './components/layout/Sidebar.vue'
import ListView from './components/views/ListView.vue'
import KanbanView from './components/views/KanbanView.vue'
import CalendarView from './components/views/CalendarView.vue'
import EisenhowerView from './components/views/EisenhowerView.vue'
import CommandPalette from './components/ui/CommandPalette.vue'
import FocusMode from './components/pomodoro/FocusMode.vue'
import ToastContainer from './components/ui/ToastContainer.vue'
import KeyboardHelp from './components/ui/KeyboardHelp.vue'
import ImportExport from './components/ui/ImportExport.vue'

const settings = useSettingsStore()
const tasks = useTaskStore()
const history = useHistoryStore()
const auth = useAuthStore()
const templates = useTemplateStore()
const toast = useToast()
const syncDialogOpen = ref(false)
const syncCloudEmpty = ref(false)
const syncConflicts = ref([])

watch(() => auth.user?.id, async (id, prev) => {
  if (!id || id === prev) return
  auth.closeAuthModal()

  try {
    const empty = await isCloudEmpty()
    syncCloudEmpty.value = empty

    // Case 1: cloud empty, nothing local → just start sync.
    if (empty && tasks.items.length === 0) {
      await startAfterSignIn()
      return
    }

    // Case 2: cloud empty, local has data → push local silently
    if (empty) {
      await migrateMediaToStorage()
      await pushAllLocal()
      await startAfterSignIn()
      toast.success(`Локальные данные загружены в облако (${tasks.items.length} задач)`)
      return
    }

    // Case 3: cloud has data, local empty → pull silently.
    if (tasks.items.length === 0) {
      await startAfterSignIn()
      toast.success('Данные загружены из облака')
      return
    }

    // Case 4: both have data → smart-merge in background.
    // Only surface the dialog if there are genuine conflicts LWW can't resolve.
    const localBackup = {
      tasks: JSON.parse(JSON.stringify(tasks.items)),
      categories: JSON.parse(JSON.stringify(tasks.categories)),
      templates: JSON.parse(JSON.stringify(templates.items)),
    }
    await migrateMediaToStorage()
    const s = await smartMerge(localBackup)

    if (s.conflicts && s.conflicts.length > 0) {
      syncConflicts.value = s.conflicts
      syncDialogOpen.value = true
      return
    }

    const parts = []
    if (s.tasks.added) parts.push(`+${s.tasks.added} задач`)
    if (s.tasks.updatedLocal) parts.push(`${s.tasks.updatedLocal} локальных новее`)
    if (s.tasks.updatedCloud) parts.push(`${s.tasks.updatedCloud} из облака новее`)
    if (s.categories.added) parts.push(`+${s.categories.added} категорий`)
    if (s.templates.added) parts.push(`+${s.templates.added} шаблонов`)
    if (parts.length) toast.success('Синхронизировано: ' + parts.join(', '))

    await startAfterSignIn()
  } catch (e) {
    console.warn('[sync] auto-merge failed, falling back to dialog', e)
    toast.error('Автосинхронизация не удалась — выберите вручную')
    syncConflicts.value = []
    syncDialogOpen.value = true
  }
})

async function onSyncDone() {
  syncDialogOpen.value = false
  syncConflicts.value = []
  await startAfterSignIn()
}

const viewComponents = {
  list: ListView,
  kanban: KanbanView,
  calendar: CalendarView,
  eisenhower: EisenhowerView,
}

function handleKeydown(e) {
  // Cmd/Ctrl + K — Command Palette
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    settings.toggleCommandPalette()
  }
  // Cmd/Ctrl + N — New Task
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    e.preventDefault()
    document.getElementById('task-input')?.focus()
  }
  // Cmd/Ctrl + Z — Undo
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
    if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault()
      const action = history.undo()
      if (action?.type === 'deleteTask' && action.task) {
        tasks.items.splice(action.index || 0, 0, action.task)
      }
    }
  }
  // Cmd/Ctrl + Shift + Z — Redo
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
    if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault()
      const action = history.redo()
      if (action?.type === 'deleteTask' && action.task) {
        tasks.deleteTask(action.task.id)
      }
    }
  }
  // Cmd/Ctrl + 1-4 — Switch view
  if ((e.metaKey || e.ctrlKey) && ['1', '2', '3', '4'].includes(e.key)) {
    e.preventDefault()
    const views = ['list', 'kanban', 'calendar', 'eisenhower']
    settings.setViewMode(views[parseInt(e.key) - 1])
  }
  // Cmd/Ctrl + Shift + F — Focus mode
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    // Implementation handled in FocusMode
  }
  // / — Focus search
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault()
    document.getElementById('search-input')?.focus()
  }
  // ? — Keyboard help
  if (e.key === '?' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault()
    settings.toggleKeyboardHelp()
  }
  // Escape
  if (e.key === 'Escape') {
    settings.closeCommandPalette()
    settings.keyboardHelpOpen = false
    settings.importExportOpen = false
    if (settings.focusModeTaskId) settings.exitFocusMode()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  tasks.migrateToBlocks()
  auth.init()
  startCloudSync()
  if (window.innerWidth <= 768) {
    settings.sidebarOpen = false
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="app" :class="{ 'sidebar-collapsed': !settings.sidebarOpen }">
    <AppHeader />
    <div class="app-body">
      <Sidebar />
      <main class="main-content">
        <component :is="viewComponents[settings.viewMode]" />
      </main>
    </div>

    <!-- Overlays -->
    <Transition name="fade">
      <CommandPalette v-if="settings.commandPaletteOpen" />
    </Transition>

    <Transition name="fade">
      <FocusMode v-if="settings.focusModeTaskId" />
    </Transition>

    <Transition name="fade">
      <KeyboardHelp v-if="settings.keyboardHelpOpen" />
    </Transition>

    <Transition name="fade">
      <ImportExport v-if="settings.importExportOpen" />
    </Transition>

    <Transition name="fade">
      <AuthModal v-if="auth.authModalOpen" />
    </Transition>

    <Transition name="fade">
      <SyncDialog
        v-if="syncDialogOpen"
        :cloud-empty="syncCloudEmpty"
        :conflicts="syncConflicts"
        @done="onSyncDone"
      />
    </Transition>

    <ToastContainer />
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: $color-bg;
}

.app-body {
  display: flex;
  flex: 1;
  padding-top: $header-height;
  min-height: 0;
}

.main-content {
  flex: 1;
  min-width: 0;
  padding: $space-6;
  margin-left: $sidebar-width;
  transition: margin-left $transition-base;
  @include custom-scrollbar;
  overflow-y: auto;
  height: calc(100vh - $header-height);

  .sidebar-collapsed & {
    margin-left: 0;
  }

  @include mobile {
    margin-left: 0;
    padding: $space-4;
  }
}
</style>
