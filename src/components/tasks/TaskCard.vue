<script setup>
import { ref, computed, nextTick } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import { useSettingsStore } from '../../stores/settings.js'
import { useHistoryStore } from '../../stores/history.js'
import { usePomodoroStore } from '../../stores/pomodoro.js'
import { useToast } from '../../composables/useToast.js'
import { useAI } from '../../composables/useAI.js'
import { hashColor, hashColorLight } from '../../stores/utils.js'
import { getUrlHostname, getFaviconUrl, parseTaskInput } from '../../composables/useTaskParser.js'
import RichText from './RichText.vue'
import TaskBlocks from './TaskBlocks.vue'
import {
  Check, Trash2, GripVertical, Tag, CalendarDays,
  ChevronDown, ChevronRight, Plus, RotateCw, Timer,
  StickyNote, Edit3, Focus, MoreHorizontal, X,
  AlertCircle, Circle, CheckCircle2, ExternalLink, Link2,
  Paperclip, Layers, Sparkles
} from 'lucide-vue-next'

const props = defineProps({ task: Object })

const tasks = useTaskStore()
const settings = useSettingsStore()
const history = useHistoryStore()
const pomodoro = usePomodoroStore()
const { undoToast } = useToast()
const { isAvailable: aiAvailable, generateSummary: aiSummarize } = useAI()

const generatingSummary = ref(false)

const isEditing = ref(false)
const editText = ref('')
const showMenu = ref(false)
const confirmingDelete = ref(false)
const showPriorityMenu = ref(false)
let confirmTimer = null
const editInput = ref(null)

const showBlocks = computed({
  get: () => tasks.expandedTaskId === props.task.id,
  set: (val) => { tasks.expandedTaskId = val ? props.task.id : null }
})

function reconstructFullText(task) {
  let parts = [task.text]
  if (task.links?.length) parts.push(...task.links)
  if (task.tags?.length) parts.push(...task.tags.map(t => `#${t}`))
  if (task.priority && task.priority !== 'none') parts.push(`!${task.priority}`)
  if (task.recurrence) parts.push(task.recurrence)
  return parts.join(' ')
}

function startEdit() {
  editText.value = reconstructFullText(props.task)
  isEditing.value = true
  showMenu.value = false
  nextTick(() => {
    editInput.value?.focus()
    editInput.value?.select()
  })
}

function saveEdit() {
  if (editText.value.trim()) {
    const parsed = parseTaskInput(editText.value)
    tasks.updateTask(props.task.id, {
      text: parsed.text,
      tags: parsed.tags,
      links: parsed.links,
      priority: parsed.priority,
      dueDate: parsed.dueDate || props.task.dueDate,
      recurrence: parsed.recurrence || props.task.recurrence,
    })
  }
  isEditing.value = false
}

function toggleComplete() {
  const oldState = props.task.completed
  tasks.toggleComplete(props.task.id)
  history.log(oldState ? 'uncompleted' : 'completed', { taskId: props.task.id, text: props.task.text })
}

function deleteTask() {
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => { confirmingDelete.value = false }, 2000)
    return
  }
  confirmingDelete.value = false
  const taskCopy = { ...props.task }
  const idx = tasks.items.findIndex(t => t.id === props.task.id)
  tasks.deleteTask(props.task.id)
  history.log('deleted', { taskId: taskCopy.id, text: taskCopy.text })
  history.pushUndo({ type: 'deleteTask', task: taskCopy, index: idx })
  undoToast(`Deleted "${taskCopy.text}"`, () => {
    tasks.items.splice(idx, 0, taskCopy)
  })
}


async function handleGenerateSummary() {
  if (generatingSummary.value) return
  generatingSummary.value = true
  try {
    const summary = await aiSummarize(props.task)
    const t = tasks.items.find(t => t.id === props.task.id)
    if (t) t.summary = summary
  } catch (err) {
    console.error('AI summary failed:', err)
  }
  generatingSummary.value = false
}

function startFocus() {
  pomodoro.activeTaskId = props.task.id
  settings.enterFocusMode(props.task.id)
}

function setPriority(p) {
  tasks.updateTask(props.task.id, { priority: p })
  showMenu.value = false
  showPriorityMenu.value = false
}

function setStatus(status) {
  tasks.updateTask(props.task.id, { status })
  showMenu.value = false
}

function toggleUrgent() {
  tasks.updateTask(props.task.id, { isUrgent: !props.task.isUrgent })
  showMenu.value = false
}

// Block-based computed properties
const textBlockProgress = computed(() => {
  const textBlocks = props.task.blocks?.filter(b => b.type === 'text') || []
  if (!textBlocks.length) return null
  const done = textBlocks.filter(b => b.completed).length
  return { done, total: textBlocks.length, pct: Math.round((done / textBlocks.length) * 100) }
})

const mediaBlockCount = computed(() => {
  return props.task.blocks?.filter(b => b.type !== 'text').length || 0
})

const blockCount = computed(() => {
  return props.task.blocks?.length || 0
})

function formatDueDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return `In ${diffDays}d`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function dueDateClass(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 2) return 'soon'
  return ''
}
</script>

<template>
  <div
    class="task-card"
    :class="{
      completed: task.completed,
      'has-notes': task.notes,
      'batch-selected': tasks.selectedTaskIds.includes(task.id),
      'menu-open': showMenu || showPriorityMenu,
      expanded: showBlocks,
      [`priority-${task.priority}`]: task.priority !== 'none',
    }"
  >
    <div class="task-main">
      <!-- Batch checkbox -->
      <div v-if="tasks.batchMode" class="batch-checkbox" @click="tasks.toggleTaskSelection(task.id)">
        <CheckCircle2 v-if="tasks.selectedTaskIds.includes(task.id)" :size="20" class="checked" />
        <Circle v-else :size="20" />
      </div>

      <!-- Drag handle -->
      <div v-if="!tasks.batchMode" class="drag-handle">
        <GripVertical :size="16" />
      </div>

      <!-- Complete button -->
      <button class="complete-btn" :class="{ done: task.completed }" @click="toggleComplete" title="Toggle complete">
        <CheckCircle2 v-if="task.completed" :size="20" />
        <Circle v-else :size="20" />
      </button>

      <!-- Task content -->
      <div class="task-content" @click="showBlocks = !showBlocks" @dblclick.stop="startEdit">
        <div v-if="isEditing" class="task-edit-row">
          <input
            v-model="editText"
            class="task-edit-input"
            @keydown.enter="saveEdit"
            @keydown.escape="isEditing = false"
            @blur="saveEdit"
            ref="editInput"
            autofocus
          />
        </div>
        <div v-else class="task-text-row">
          <RichText :text="task.text" :tags="task.tags" :links="task.links" :completed="task.completed" />
          <span v-if="task.summary" class="task-summary-inline">/ {{ task.summary }}</span>
        </div>

        <!-- Metadata row: date, tasks, files, links -->
        <div class="task-meta" v-if="task.tags?.length || task.dueDate || task.recurrence || textBlockProgress || task.links?.length || mediaBlockCount">
          <span v-if="task.priority !== 'none'" class="meta-badge priority" :class="task.priority">
            <AlertCircle :size="11" />
            {{ task.priority }}
          </span>
          <span
            v-for="tag in task.tags"
            :key="tag"
            class="meta-badge tag"
            :style="{ '--tc': hashColor(tag), '--tb': hashColorLight(tag) }"
          >
            #{{ tag }}
          </span>
          <span v-if="task.dueDate" class="meta-badge date" :class="dueDateClass(task.dueDate)">
            <CalendarDays :size="11" />
            {{ formatDueDate(task.dueDate) }}
          </span>
          <span v-if="task.recurrence" class="meta-badge recurrence">
            <RotateCw :size="11" />
            {{ task.recurrence }}
          </span>
          <span v-if="textBlockProgress" class="meta-badge subtask-progress" @click="showBlocks = !showBlocks" style="cursor: pointer;">
            {{ textBlockProgress.done }}/{{ textBlockProgress.total }}
            <div class="mini-progress">
              <div class="mini-progress-bar" :class="{ complete: textBlockProgress.pct === 100 }" :style="{ width: textBlockProgress.pct + '%' }" />
            </div>
          </span>
          <span v-if="mediaBlockCount" class="meta-badge attachment-count" @click="showBlocks = !showBlocks" style="cursor: pointer;">
            <Paperclip :size="11" />
            {{ mediaBlockCount }}
          </span>
          <a
            v-for="link in task.links"
            :key="link"
            :href="link"
            target="_blank"
            rel="noopener noreferrer"
            class="meta-badge link-badge"
            @click.stop
          >
            <img :src="getFaviconUrl(link)" width="12" height="12" class="link-favicon" alt="" />
            <span class="link-hostname">{{ getUrlHostname(link) }}</span>
            <ExternalLink :size="10" class="link-external-icon" />
          </a>
        </div>
      </div>

      <!-- Actions -->
      <div class="task-actions">
        <button
          v-if="aiAvailable"
          class="action-btn"
          :class="{ generating: generatingSummary }"
          @click.stop="handleGenerateSummary"
          :title="task.summary ? 'Regenerate summary' : 'Generate AI summary'"
        >
          <Sparkles :size="15" />
        </button>
        <button class="action-btn" @click="startFocus" title="Focus mode">
          <Focus :size="15" />
        </button>
        <button
          class="action-btn delete"
          :class="{ confirming: confirmingDelete }"
          @click="deleteTask"
          :title="confirmingDelete ? 'Click again to delete' : 'Delete'"
        >
          <Trash2 :size="15" />
        </button>
        <div class="priority-selector">
          <button
            class="action-btn priority-btn"
            :class="task.priority"
            @click.stop="showPriorityMenu = !showPriorityMenu"
            title="Set priority"
          >
            <AlertCircle :size="15" />
          </button>
          <Transition name="scale">
            <div v-if="showPriorityMenu" class="priority-menu" @mouseleave="showPriorityMenu = false">
              <button
                v-for="p in ['high', 'medium', 'low', 'none']"
                :key="p"
                class="priority-option"
                :class="[p, { active: task.priority === p }]"
                @click.stop="setPriority(p)"
              >
                <AlertCircle v-if="p !== 'none'" :size="12" />
                <Circle v-else :size="12" />
                {{ p === 'none' ? 'None' : p.charAt(0).toUpperCase() + p.slice(1) }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Blocks (unified subtasks + attachments) -->
    <Transition name="slide-down">
      <TaskBlocks
        v-if="showBlocks"
        :taskId="task.id"
        :blocks="task.blocks || []"
      />
    </Transition>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.task-card {
  @include glass-card;
  padding: 0;
  overflow: visible;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    border-radius: $radius-lg 0 0 $radius-lg;
    opacity: 0;
    transition: opacity $transition-fast;
  }

  &.priority-high::before { background: $priority-high; opacity: 1; }
  &.priority-medium::before { background: $priority-medium; opacity: 1; }
  &.priority-low::before { background: $priority-low; opacity: 1; }

  &.completed {
    opacity: 0.65;
    &::before { opacity: 0; }
  }

  &.batch-selected {
    border-color: $color-primary;
    box-shadow: $shadow-focus;
  }

  &.expanded {
    border-color: rgba($violet-500, 0.4);
    box-shadow: 0 0 0 2px rgba($violet-500, 0.08), $shadow-sm;
  }

  &:hover .task-actions { visibility: visible; }
  &:hover .drag-handle { visibility: visible; }

  &.menu-open {
    z-index: $z-dropdown;
  }
}

.task-main {
  display: flex;
  align-items: flex-start;
  gap: $space-2;
  padding: $space-3 $space-4;
}

.drag-handle {
  @include flex-center;
  padding: $space-1 0;
  color: $color-text-muted;
  cursor: grab;
  visibility: hidden;
  flex-shrink: 0;
  margin-top: 2px;

  &:active { cursor: grabbing; }
}

.batch-checkbox {
  @include flex-center;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 2px;
  color: $color-text-muted;

  .checked { color: $color-primary; }
}

.complete-btn {
  @include flex-center;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: $color-text-muted;
  flex-shrink: 0;
  margin-top: 2px;
  transition: all $transition-fast;

  &:hover { color: $color-success; transform: scale(1.15); }
  &.done { color: $color-success; }
}

.task-content {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.task-text {
  font-size: $font-size-base;
  line-height: $line-height-normal;
  color: $color-text-primary;

  &.line-through {
    text-decoration: line-through;
    color: $color-text-muted;
  }
}

.task-summary-inline {
  color: $color-text-muted;
  font-size: $font-size-sm;
  font-weight: $font-weight-normal;
  margin-left: $space-1;
  white-space: nowrap;
}

.action-btn.generating {
  color: $violet-500;
  animation: spin-sparkle 1s linear infinite;
}

@keyframes spin-sparkle {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.priority-selector {
  position: relative;
}

.priority-btn {
  &.high { color: $priority-high; }
  &.medium { color: $priority-medium; }
  &.low { color: $priority-low; }
  &.none { color: $color-text-muted; }
}

.priority-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: $space-1;
  background: $color-bg-elevated;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  box-shadow: $shadow-lg;
  padding: $space-1;
  min-width: 120px;
  z-index: $z-dropdown;
}

.priority-option {
  display: flex;
  align-items: center;
  gap: $space-2;
  width: 100%;
  padding: $space-2 $space-3;
  border: none;
  background: none;
  border-radius: $radius-sm;
  font-size: $font-size-xs;
  cursor: pointer;
  transition: all $transition-fast;

  &.high { color: $priority-high; }
  &.medium { color: $priority-medium; }
  &.low { color: $priority-low; }
  &.none { color: $color-text-muted; }

  &:hover { background: $color-bg-hover; }
  &.active { font-weight: $font-weight-semibold; background: $color-bg-hover; }
}

.task-edit-input {
  @include input-base;
  padding: $space-1 $space-2;
  font-size: $font-size-base;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  border-radius: $radius-full;
  font-size: 11px;
  font-weight: $font-weight-medium;
  line-height: 1.4;

  &.priority {
    &.high { background: rgba($priority-high, 0.1); color: $priority-high; }
    &.medium { background: rgba($priority-medium, 0.1); color: $priority-medium; }
    &.low { background: rgba($priority-low, 0.1); color: $priority-low; }
  }

  &.tag {
    background: var(--tb);
    color: var(--tc);
  }

  &.date {
    background: rgba($violet-500, 0.1);
    color: $violet-600;

    &.overdue { background: rgba($rose-500, 0.1); color: $rose-500; }
    &.today { background: rgba($amber-500, 0.1); color: $amber-500; }
    &.soon { background: rgba($orange-500, 0.1); color: $orange-500; }
  }

  &.recurrence {
    background: rgba($emerald-500, 0.08);
    color: $emerald-500;
  }

  &.subtask-progress {
    background: $gray-100;
    color: $color-text-secondary;
    gap: 6px;
    transition: all $transition-fast;
    
    &:hover {
      background: rgba($violet-500, 0.1);
      color: $color-primary;
    }
  }

  &.attachment-count {
    background: rgba($blue-500, 0.08);
    color: $blue-500;
    transition: all $transition-fast;
    
    &:hover {
      background: rgba($blue-500, 0.15);
    }
  }

  &.link-badge {
    background: rgba($blue-500, 0.08);
    color: $blue-500;
    text-decoration: none;
    cursor: pointer;
    transition: all $transition-fast;
    max-width: 200px;

    &:hover {
      background: rgba($blue-500, 0.16);
      transform: translateY(-1px);
    }
  }
}

.link-favicon {
  border-radius: 2px;
  flex-shrink: 0;
  object-fit: contain;
}

.link-hostname {
  @include truncate;
  max-width: 140px;
}

.link-external-icon {
  opacity: 0.5;
  flex-shrink: 0;
}

.mini-progress {
  width: 32px;
  height: 3px;
  border-radius: 2px;
  background: $gray-200;
  overflow: hidden;
}

.mini-progress-bar {
  height: 100%;
  background: $color-primary;
  border-radius: 2px;
  transition: width $transition-base;
  
  &.complete {
    background: $color-success;
  }
}

.task-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  visibility: hidden;
  transition: visibility 0s;
  flex-shrink: 0;
}

.action-btn {
  @include btn-icon(30px);
  color: $color-text-muted;

  &:hover { color: $color-text-primary; background: $color-bg-hover; }
  &.active { color: $color-primary; background: $color-primary-light; }
  &.delete:hover { color: $rose-500; background: rgba($rose-500, 0.1); }
  &.delete.confirming {
    color: white;
    background: $rose-500;
    opacity: 1;
    animation: pulse-delete 0.6s ease infinite alternate;
  }
}

.confirm-label {
  font-size: 10px;
  font-weight: $font-weight-bold;
  position: absolute;
  top: -2px;
  right: -2px;
}

@keyframes pulse-delete {
  from { transform: scale(1); }
  to { transform: scale(1.15); }
}

.action-menu-wrapper {
  position: relative;
}

.action-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 180px;
  padding: $space-1;
  background: $color-bg-elevated;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  z-index: $z-dropdown;

  button {
    display: flex;
    align-items: center;
    gap: $space-2;
    width: 100%;
    padding: $space-2 $space-3;
    border: none;
    border-radius: $radius-sm;
    background: none;
    font-size: $font-size-sm;
    color: $color-text-primary;
    cursor: pointer;
    text-align: left;

    &:hover { background: $color-bg-hover; }
    &.danger { color: $rose-500; &:hover { background: rgba($rose-500, 0.1); } }
  }

  hr {
    margin: $space-1 0;
    border: none;
    border-top: 1px solid $color-border;
  }
}
</style>
