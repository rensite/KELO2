<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import { useSettingsStore } from '../../stores/settings.js'
import {
  Search, List, Columns3, Calendar, Grid2x2,
  Download, Trash2, CheckCircle2, FileText, Keyboard,
  BarChart3
} from 'lucide-vue-next'

const tasks = useTaskStore()
const settings = useSettingsStore()
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref(null)

const commands = [
  { id: 'new-task', label: 'New Task', desc: 'Focus task input', icon: FileText, action: () => { settings.closeCommandPalette(); nextTick(() => document.getElementById('task-input')?.focus()) } },
  { id: 'view-list', label: 'Switch to List View', desc: 'Cmd+1', icon: List, action: () => { settings.setViewMode('list'); settings.closeCommandPalette() } },
  { id: 'view-kanban', label: 'Switch to Kanban View', desc: 'Cmd+2', icon: Columns3, action: () => { settings.setViewMode('kanban'); settings.closeCommandPalette() } },
  { id: 'view-calendar', label: 'Switch to Calendar View', desc: 'Cmd+3', icon: Calendar, action: () => { settings.setViewMode('calendar'); settings.closeCommandPalette() } },
  { id: 'view-eisenhower', label: 'Switch to Eisenhower Matrix', desc: 'Cmd+4', icon: Grid2x2, action: () => { settings.setViewMode('eisenhower'); settings.closeCommandPalette() } },
  { id: 'dashboard', label: 'Toggle Dashboard', desc: 'Stats panel', icon: BarChart3, action: () => { settings.toggleDashboard(); settings.closeCommandPalette() } },
  { id: 'export', label: 'Export / Import Data', desc: 'JSON format', icon: Download, action: () => { settings.toggleImportExport(); settings.closeCommandPalette() } },
  { id: 'clear-completed', label: 'Clear Completed Tasks', desc: 'Remove all done tasks', icon: Trash2, action: () => { tasks.items = tasks.items.filter(t => !t.completed); settings.closeCommandPalette() } },
  { id: 'complete-all', label: 'Complete All Tasks', desc: 'Mark all as done', icon: CheckCircle2, action: () => { tasks.items.forEach(t => { t.completed = true; t.completedAt = new Date().toISOString() }); settings.closeCommandPalette() } },
  { id: 'shortcuts', label: 'Show Keyboard Shortcuts', desc: '?', icon: Keyboard, action: () => { settings.toggleKeyboardHelp(); settings.closeCommandPalette() } },
]

const taskResults = computed(() => {
  if (!query.value.trim()) return []
  const q = query.value.toLowerCase()
  return tasks.items
    .filter(t => t.text.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q) || t.tags?.some(tag => tag.toLowerCase().includes(q)))
    .slice(0, 5)
})

const commandResults = computed(() => {
  if (!query.value.trim()) return commands
  const q = query.value.toLowerCase()
  return commands.filter(c => c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
})

const allResults = computed(() => {
  const results = []
  if (taskResults.value.length > 0) {
    results.push({ type: 'header', label: 'Tasks' })
    taskResults.value.forEach(t => results.push({ type: 'task', ...t }))
  }
  if (commandResults.value.length > 0) {
    results.push({ type: 'header', label: 'Commands' })
    commandResults.value.forEach(c => results.push({ type: 'command', ...c }))
  }
  return results
})

const selectableResults = computed(() => allResults.value.filter(r => r.type !== 'header'))

watch(query, () => { selectedIndex.value = 0 })

function onKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, selectableResults.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = selectableResults.value[selectedIndex.value]
    if (item?.action) item.action()
  }
}

watch(() => settings.commandPaletteOpen, (open) => {
  if (open) {
    query.value = ''
    nextTick(() => inputRef.value?.focus())
  }
})
</script>

<template>
  <div class="palette-backdrop" @click="settings.closeCommandPalette()">
    <div class="palette" @click.stop>
      <div class="palette-input-wrapper">
        <Search :size="18" class="palette-search-icon" />
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          placeholder="Search tasks or type a command..."
          class="palette-input"
          @keydown="onKeydown"
          autofocus
        />
      </div>

      <div class="palette-results" v-if="allResults.length > 0">
        <template v-for="(item, idx) in allResults" :key="idx">
          <div v-if="item.type === 'header'" class="palette-section">{{ item.label }}</div>
          <button
            v-else
            class="palette-item"
            :class="{ selected: selectableResults.indexOf(item) === selectedIndex }"
            @click="item.action?.()"
            @mouseenter="selectedIndex = selectableResults.indexOf(item)"
          >
            <component v-if="item.icon" :is="item.icon" :size="16" class="palette-item-icon" />
            <span v-if="item.type === 'task'" class="palette-item-icon task-icon">📝</span>
            <div class="palette-item-content">
              <span class="palette-item-label">{{ item.label || item.text }}</span>
              <span v-if="item.desc" class="palette-item-desc">{{ item.desc }}</span>
            </div>
          </button>
        </template>
      </div>

      <div class="palette-footer">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>↵</kbd> Select</span>
        <span><kbd>esc</kbd> Close</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.palette-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: $z-command-palette;
  @include flex-center;
  padding-top: 15vh;
  align-items: flex-start;
}

.palette {
  width: 560px;
  max-width: 90vw;
  max-height: 70vh;
  background: $color-bg-elevated;
  border-radius: $radius-xl;
  box-shadow: $shadow-xl;
  overflow: hidden;
  animation: scaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.palette-input-wrapper {
  display: flex;
  align-items: center;
  padding: $space-4 $space-5;
  border-bottom: 1px solid $color-border;
}

.palette-search-icon {
  color: $color-text-muted;
  margin-right: $space-3;
  flex-shrink: 0;
}

.palette-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: $font-size-md;
  color: $color-text-primary;
  outline: none;

  &::placeholder { color: $color-text-muted; }
}

.palette-results {
  max-height: 400px;
  overflow-y: auto;
  @include custom-scrollbar;
  padding: $space-2;
}

.palette-section {
  padding: $space-2 $space-3;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: $color-text-muted;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: $space-3;
  width: 100%;
  padding: $space-3 $space-4;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background $transition-fast;

  &:hover, &.selected {
    background: $color-bg-hover;
  }

  &.selected {
    background: $color-primary-light;
  }
}

.palette-item-icon {
  color: $color-text-muted;
  flex-shrink: 0;
}

.palette-item-content {
  flex: 1;
  min-width: 0;
}

.palette-item-label {
  display: block;
  font-size: $font-size-base;
  color: $color-text-primary;
  @include truncate;
}

.palette-item-desc {
  display: block;
  font-size: $font-size-xs;
  color: $color-text-muted;
  margin-top: 1px;
}

.palette-footer {
  display: flex;
  gap: $space-4;
  padding: $space-3 $space-5;
  border-top: 1px solid $color-border;
  font-size: $font-size-xs;
  color: $color-text-muted;

  kbd {
    padding: 1px 5px;
    border-radius: 3px;
    background: $gray-100;
    font-size: 11px;
    font-family: $font-family;
    border: 1px solid $gray-200;
  }
}
</style>
