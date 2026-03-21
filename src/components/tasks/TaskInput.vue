<script setup>
import { ref, computed, watch } from 'vue'
import { parseTaskInput, getUrlHostname } from '../../composables/useTaskParser.js'
import { useTaskStore } from '../../stores/tasks.js'
import { useHistoryStore } from '../../stores/history.js'
import { hashColor } from '../../stores/utils.js'
import {
  Plus, CalendarDays, Tag, AlertCircle, RotateCw, Link2
} from 'lucide-vue-next'

const tasks = useTaskStore()
const history = useHistoryStore()
const inputText = ref('')
const parsed = ref(null)

watch(inputText, (val) => {
  if (val.trim()) {
    parsed.value = parseTaskInput(val)
  } else {
    parsed.value = null
  }
})

function addTask() {
  if (!inputText.value.trim()) return
  const data = parseTaskInput(inputText.value)
  const task = tasks.addTask(data)
  history.log('created', { taskId: task.id, text: task.text })
  history.pushUndo({ type: 'addTask', task: { ...task } })
  inputText.value = ''
  parsed.value = null
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
  <div class="task-input-container">
    <div class="input-row">
      <div class="input-wrapper">
        <input
          id="task-input"
          v-model="inputText"
          type="text"
          placeholder="Add a task... (try: Buy milk #shopping !high tomorrow)"
          class="task-input"
          @keydown.enter="addTask"
        />
        <button class="add-btn" @click="addTask" :disabled="!inputText.trim()">
          <Plus :size="18" />
        </button>
      </div>
    </div>

    <!-- Parsing Preview -->
    <Transition name="slide-up">
      <div v-if="parsed && (parsed.tags.length || parsed.priority !== 'none' || parsed.dueDate || parsed.recurrence || parsed.links?.length)" class="parse-preview">
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
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.task-input-container {
  margin-bottom: $space-6;
}

.input-row {
  display: flex;
  gap: $space-3;
}

.input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
}

.task-input {
  width: 100%;
  padding: $space-4 56px $space-4 $space-5;
  border: 2px solid $color-border;
  border-radius: $radius-xl;
  background: $color-bg-elevated;
  color: $color-text-primary;
  font-size: $font-size-md;
  font-family: $font-family;
  box-shadow: $shadow-sm;
  transition: all $transition-base;

  &::placeholder {
    color: $color-text-muted;
    font-size: $font-size-base;
  }

  &:focus {
    outline: none;
    border-color: $color-primary;
    box-shadow: $shadow-focus, $shadow-md;
    transform: translateY(-1px);
  }
}

.add-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: $radius-lg;
  background: $gradient-primary;
  color: white;
  @include flex-center;
  border: none;
  cursor: pointer;
  transition: all $transition-fast;
  box-shadow: $shadow-sm;

  &:hover:not(:disabled) {
    transform: translateY(-50%) scale(1.05);
    box-shadow: $shadow-md, $shadow-glow;
  }

  &:active:not(:disabled) {
    transform: translateY(-50%) scale(0.95);
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
