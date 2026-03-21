<script setup>
import { ref } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import { useSettingsStore } from '../../stores/settings.js'
import { useToast } from '../../composables/useToast.js'
import { X, Download, Upload, FileJson, FileText, Trash2 } from 'lucide-vue-next'

const tasks = useTaskStore()
const settings = useSettingsStore()
const { success, error } = useToast()
const importData = ref('')
const tab = ref('export')

function exportJSON() {
  const json = tasks.exportData()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kelo-backup-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  success('Data exported successfully')
}

function exportMarkdown() {
  let md = '# Kelo Tasks\n\n'
  const categories = tasks.categories
  categories.forEach(cat => {
    const catTasks = tasks.items.filter(t => t.categoryId === cat.id)
    if (catTasks.length === 0) return
    md += `## ${cat.icon} ${cat.name}\n\n`
    catTasks.forEach(t => {
      md += `- [${t.completed ? 'x' : ' '}] ${t.text}`
      if (t.priority !== 'none') md += ` (!${t.priority})`
      if (t.tags?.length) md += ` ${t.tags.map(tag => '#' + tag).join(' ')}`
      if (t.dueDate) md += ` (due: ${new Date(t.dueDate).toLocaleDateString()})`
      md += '\n'
      t.subtasks?.forEach(s => {
        md += `  - [${s.completed ? 'x' : ' '}] ${s.text}\n`
      })
    })
    md += '\n'
  })

  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kelo-tasks-${new Date().toISOString().split('T')[0]}.md`
  a.click()
  URL.revokeObjectURL(url)
  success('Markdown exported')
}

function doImport() {
  if (!importData.value.trim()) return
  const result = tasks.importData(importData.value)
  if (result) {
    success('Data imported successfully')
    importData.value = ''
    settings.importExportOpen = false
  } else {
    error('Import failed: invalid JSON')
  }
}

function handleFileUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (evt) => {
    importData.value = evt.target.result
  }
  reader.readAsText(file)
}

function clearAllData() {
  if (confirm('Are you sure? This will delete ALL tasks permanently.')) {
    tasks.clearAll()
    success('All data cleared')
    settings.importExportOpen = false
  }
}
</script>

<template>
  <div class="ie-backdrop" @click="settings.importExportOpen = false">
    <div class="ie-modal" @click.stop>
      <div class="ie-header">
        <h3>Import / Export</h3>
        <button class="ie-close" @click="settings.importExportOpen = false">
          <X :size="18" />
        </button>
      </div>

      <div class="ie-tabs">
        <button :class="{ active: tab === 'export' }" @click="tab = 'export'">Export</button>
        <button :class="{ active: tab === 'import' }" @click="tab = 'import'">Import</button>
      </div>

      <div class="ie-body">
        <template v-if="tab === 'export'">
          <p class="ie-desc">Download your data as a backup file.</p>
          <div class="ie-actions">
            <button class="ie-btn" @click="exportJSON">
              <FileJson :size="18" />
              Export as JSON
            </button>
            <button class="ie-btn" @click="exportMarkdown">
              <FileText :size="18" />
              Export as Markdown
            </button>
          </div>
        </template>
        <template v-else>
          <p class="ie-desc">Import data from a JSON backup file.</p>
          <div class="ie-upload">
            <input type="file" accept=".json" @change="handleFileUpload" />
          </div>
          <textarea
            v-model="importData"
            placeholder="Or paste JSON data here..."
            class="ie-textarea"
            rows="6"
          />
          <button class="ie-btn primary" @click="doImport" :disabled="!importData.trim()">
            <Upload :size="16" />
            Import Data
          </button>
        </template>
      </div>

      <div class="ie-footer">
        <button class="ie-danger-btn" @click="clearAllData">
          <Trash2 :size="14" />
          Clear All Data
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.ie-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: $z-modal;
  @include flex-center;
}

.ie-modal {
  width: 480px;
  max-width: 90vw;
  background: $color-bg-elevated;
  border-radius: $radius-xl;
  box-shadow: $shadow-xl;
  overflow: hidden;
  animation: scaleIn 200ms ease;
}

.ie-header {
  @include flex-between;
  padding: $space-5;
  border-bottom: 1px solid $color-border;

  h3 { font-size: $font-size-lg; font-weight: $font-weight-semibold; }
}

.ie-close {
  @include btn-icon(32px);
  color: $color-text-muted;
}

.ie-tabs {
  display: flex;
  border-bottom: 1px solid $color-border;

  button {
    flex: 1;
    padding: $space-3;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-secondary;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all $transition-fast;

    &.active {
      color: $color-primary;
      border-bottom-color: $color-primary;
    }
  }
}

.ie-body {
  padding: $space-5;
}

.ie-desc {
  font-size: $font-size-sm;
  color: $color-text-secondary;
  margin-bottom: $space-4;
}

.ie-actions {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.ie-btn {
  @include btn-ghost;
  width: 100%;
  padding: $space-3 $space-4;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  justify-content: flex-start;
  gap: $space-3;

  &.primary {
    background: $gradient-primary;
    color: white;
    border: none;
    justify-content: center;
    &:hover { box-shadow: $shadow-md, $shadow-glow; }
    &:disabled { opacity: 0.5; }
  }
}

.ie-upload {
  margin-bottom: $space-3;
}

.ie-textarea {
  width: 100%;
  padding: $space-3;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-family: $font-mono;
  font-size: $font-size-sm;
  resize: vertical;
  margin-bottom: $space-3;

  &:focus { outline: none; border-color: $color-primary; }
}

.ie-footer {
  padding: $space-4 $space-5;
  border-top: 1px solid $color-border;
  display: flex;
  justify-content: center;
}

.ie-danger-btn {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: $space-2 $space-4;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: $rose-500;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: background $transition-fast;

  &:hover { background: rgba($rose-500, 0.1); }
}
</style>
