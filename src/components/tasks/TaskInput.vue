<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { parseTaskInput, getUrlHostname } from '../../composables/useTaskParser.js'
import { useTaskStore } from '../../stores/tasks.js'
import { useHistoryStore } from '../../stores/history.js'
import { useAttachments } from '../../composables/useAttachments.js'
import { hashColor } from '../../stores/utils.js'
import {
  Plus, CalendarDays, Tag, AlertCircle, RotateCw, Link2,
  Image, Film, Music, FileText, Mic, Send
} from 'lucide-vue-next'

const tasks = useTaskStore()
const history = useHistoryStore()
const { pickFile, readFileAsDataURL } = useAttachments()

const inputText = ref('')
const parsed = ref(null)
const showMediaMenu = ref(false)
const fileInput = ref(null)

// Context: are we adding a subtask or a new task?
const isSubtaskMode = computed(() => !!tasks.expandedTaskId)
const expandedTask = computed(() =>
  tasks.expandedTaskId ? tasks.items.find(t => t.id === tasks.expandedTaskId) : null
)

watch(inputText, (val) => {
  if (!isSubtaskMode.value && val.trim()) {
    parsed.value = parseTaskInput(val)
  } else {
    parsed.value = null
  }
})

function submit(e) {
  if (!inputText.value.trim()) return
  if (isSubtaskMode.value) {
    addBlock(e)
  } else {
    addTask()
  }
}

function addTask() {
  const data = parseTaskInput(inputText.value)
  const task = tasks.addTask(data)
  history.log('created', { taskId: task.id, text: task.text })
  history.pushUndo({ type: 'addTask', task: { ...task } })
  inputText.value = ''
  parsed.value = null
  tasks.expandedTaskId = task.id
}

function addBlock(e) {
  tasks.addBlock(tasks.expandedTaskId, {
    type: 'text',
    text: inputText.value.trim(),
    completed: false
  })
  inputText.value = ''
  nextTick(() => { if (e?.target) e.target.style.height = 'auto' })
}

// Media file handling (subtask mode only)
const mediaItems = [
  { id: 'image', label: 'Image', icon: Image, accept: 'image/*' },
  { id: 'video', label: 'Video', icon: Film, accept: 'video/*' },
  { id: 'audio', label: 'Audio', icon: Music, accept: 'audio/*' },
  { id: 'file', label: 'File', icon: FileText, accept: '*/*' },
]

let currentAccept = '*/*'

function openFilePicker(accept) {
  currentAccept = accept
  showMediaMenu.value = false
  if (fileInput.value) {
    fileInput.value.accept = accept
    fileInput.value.click()
  }
}

async function handleFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return

  // If not in subtask mode, create a task first
  let targetTaskId = tasks.expandedTaskId
  if (!targetTaskId) {
    const text = inputText.value.trim() || file.name
    const data = parseTaskInput(text)
    const task = tasks.addTask(data)
    history.log('created', { taskId: task.id, text: task.text })
    tasks.expandedTaskId = task.id
    targetTaskId = task.id
    inputText.value = ''
    parsed.value = null
  }

  const url = await readFileAsDataURL(file)
  const type = file.type.startsWith('image') ? 'image'
    : file.type.startsWith('video') ? 'video'
    : file.type.startsWith('audio') ? 'audio'
    : 'file'
  tasks.addBlock(targetTaskId, {
    type,
    name: file.name,
    url,
    size: file.size,
    sizeFormatted: (file.size / 1024).toFixed(1) + ' KB',
    completed: false,
  })
  e.target.value = ''
}

function autoResizeTextarea(el) {
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

function priorityLabel(p) {
  return { high: 'High', medium: 'Medium', low: 'Low', none: '' }[p] || ''
}

function formatPreviewDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff < 7) return `In ${diff} days`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="task-input-container" :class="{ 'subtask-mode': isSubtaskMode }">
    <!-- Context label -->
    <div v-if="isSubtaskMode && expandedTask" class="input-context">
      ↳ {{ expandedTask.text }}
    </div>

    <div class="input-row">
      <div class="input-wrapper">
        <textarea
          id="task-input"
          v-model="inputText"
          :placeholder="isSubtaskMode ? 'Add subtask...' : 'Add a task... (try: Buy milk #shopping !high tomorrow)'"
          class="task-input"
          rows="1"
          @keydown.enter.exact.prevent="submit($event)"
          @input="autoResizeTextarea($event.target)"
        />
        <!-- Media button -->
        <div v-if="isSubtaskMode" class="input-media-wrapper">
          <button class="input-media-btn" @click="showMediaMenu = !showMediaMenu" title="Attach media">
            <Plus :size="16" :class="{ rotated: showMediaMenu }" />
          </button>
          <Transition name="scale">
            <div v-if="showMediaMenu" class="input-media-dropdown" @mouseleave="showMediaMenu = false">
              <button
                v-for="item in mediaItems"
                :key="item.id"
                class="input-media-option"
                @click="openFilePicker(item.accept)"
              >
                <component :is="item.icon" :size="14" />
                <span>{{ item.label }}</span>
              </button>
            </div>
          </Transition>
        </div>
        <button class="add-btn" @click="submit" :disabled="!inputText.trim()">
          <Send :size="16" />
        </button>
      </div>
    </div>

    <!-- Parsing Preview (task mode only) -->
    <Transition name="slide-up">
      <div v-if="!isSubtaskMode && parsed && (parsed.tags.length || parsed.priority !== 'none' || parsed.dueDate || parsed.recurrence || parsed.links?.length)" class="parse-preview">
        <span v-if="parsed.priority !== 'none'" class="preview-chip priority" :class="parsed.priority">
          <AlertCircle :size="12" />
          {{ priorityLabel(parsed.priority) }}
        </span>
        <span v-for="tag in parsed.tags" :key="tag" class="preview-chip tag" :style="{ '--tag-color': hashColor(tag) }">
          <Tag :size="12" />
          {{ tag }}
        </span>
        <span v-if="parsed.dueDate" class="preview-chip date">
          <CalendarDays :size="12" />
          {{ formatPreviewDate(parsed.dueDate) }}
        </span>
        <span v-if="parsed.recurrence" class="preview-chip recurrence">
          <RotateCw :size="12" />
          {{ parsed.recurrence }}
        </span>
        <span v-for="link in parsed.links" :key="link" class="preview-chip link">
          <Link2 :size="12" />
          {{ getUrlHostname(link) }}
        </span>
      </div>
    </Transition>

    <!-- Hidden file input -->
    <input ref="fileInput" type="file" style="display:none" @change="handleFileSelected" />
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.task-input-container {}

.input-context {
  font-size: $font-size-xs;
  color: $color-text-muted;
  padding: 0 $space-3 $space-1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.input-row {
  display: flex;
  gap: $space-3;
}

.input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: flex-end;
}

.task-input {
  width: 100%;
  padding: 14px 96px 14px $space-5;
  border: 2px solid $color-border;
  border-radius: $radius-xl;
  background: $color-bg-elevated;
  color: $color-text-primary;
  font-size: $font-size-base;
  font-family: $font-family;
  box-shadow: $shadow-sm;
  transition: all $transition-base;
  resize: none;
  line-height: $line-height-normal;
  max-height: 200px;
  overflow-y: auto;

  &::placeholder {
    color: $color-text-muted;
    font-size: $font-size-base;
  }

  &:focus {
    outline: none;
    border-color: $color-primary;
    box-shadow: $shadow-focus, $shadow-md;
  }
}

.input-media-wrapper {
  position: absolute;
  right: 52px;
  bottom: 8px;
}

.input-media-btn {
  @include btn-icon(32px);
  color: $color-text-muted;
  border-radius: $radius-md;
  transition: all $transition-fast;

  &:hover { color: $color-primary; background: rgba($violet-500, 0.08); }

  svg { transition: transform $transition-fast; }
  .rotated { transform: rotate(45deg); }
}

.input-media-dropdown {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: $space-1;
  background: $color-bg-elevated;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  box-shadow: $shadow-lg;
  padding: $space-1;
  min-width: 140px;
  z-index: $z-dropdown;
}

.input-media-option {
  display: flex;
  align-items: center;
  gap: $space-2;
  width: 100%;
  padding: $space-2 $space-3;
  border: none;
  background: none;
  border-radius: $radius-sm;
  font-size: $font-size-sm;
  color: $color-text-secondary;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    background: $color-bg-hover;
    color: $color-text-primary;
  }
}

.add-btn {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 36px;
  height: 36px;
  border-radius: $radius-lg;
  background: $gradient-primary;
  color: white;
  @include flex-center;
  border: none;
  cursor: pointer;
  transition: all $transition-fast;
  box-shadow: $shadow-sm;

  &:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: $shadow-md, $shadow-glow;
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

.parse-preview {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  margin-top: $space-2;
  padding: $space-2 $space-3;
}

.preview-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px $space-3;
  border-radius: $radius-full;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  animation: popIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1);

  &.priority {
    &.high { background: rgba($priority-high, 0.1); color: $priority-high; }
    &.medium { background: rgba($priority-medium, 0.1); color: $priority-medium; }
    &.low { background: rgba($priority-low, 0.1); color: $priority-low; }
  }

  &.tag {
    background: rgba(0,0,0,0.04);
    color: var(--tag-color);
  }

  &.date {
    background: rgba($violet-500, 0.1);
    color: $violet-600;
  }

  &.recurrence {
    background: rgba($emerald-500, 0.1);
    color: $emerald-500;
  }

  &.link {
    background: rgba($blue-500, 0.1);
    color: $blue-500;
  }
}
</style>
