<script setup>
import { ref, computed, nextTick } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import { useSettingsStore } from '../../stores/settings.js'
import { useHistoryStore } from '../../stores/history.js'
import { usePomodoroStore } from '../../stores/pomodoro.js'
import { useToast } from '../../composables/useToast.js'
import { hashColor, hashColorLight } from '../../stores/utils.js'
import { getUrlHostname, getFaviconUrl, parseTaskInput } from '../../composables/useTaskParser.js'
import {
  Check, Trash2, GripVertical, Tag, CalendarDays,
  ChevronDown, ChevronRight, Plus, RotateCw, Timer,
  StickyNote, Edit3, Focus, MoreHorizontal, X,
  AlertCircle, Circle, CheckCircle2, ExternalLink, Link2
} from 'lucide-vue-next'

const props = defineProps({ task: Object })

const tasks = useTaskStore()
const settings = useSettingsStore()
const history = useHistoryStore()
const pomodoro = usePomodoroStore()
const { undoToast } = useToast()

const isEditing = ref(false)
const editText = ref('')
const showSubtasks = ref(false)
const showNotes = ref(false)
const newSubtaskText = ref('')
const editNotes = ref('')
const showMenu = ref(false)
const editInput = ref(null)

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
  const taskCopy = { ...props.task }
  const idx = tasks.items.findIndex(t => t.id === props.task.id)
  tasks.deleteTask(props.task.id)
  history.log('deleted', { taskId: taskCopy.id, text: taskCopy.text })
  history.pushUndo({ type: 'deleteTask', task: taskCopy, index: idx })
  undoToast(`Deleted "${taskCopy.text}"`, () => {
    tasks.items.splice(idx, 0, taskCopy)
  })
}

function addSubtask() {
  if (newSubtaskText.value.trim()) {
    tasks.addSubtask(props.task.id, newSubtaskText.value.trim())
    newSubtaskText.value = ''
  }
}

function toggleNotes() {
  showNotes.value = !showNotes.value
  if (showNotes.value) {
    editNotes.value = props.task.notes || ''
  }
}

function saveNotes() {
  tasks.updateTask(props.task.id, { notes: editNotes.value })
}

function startFocus() {
  pomodoro.activeTaskId = props.task.id
  settings.enterFocusMode(props.task.id)
}

function setPriority(p) {
  tasks.updateTask(props.task.id, { priority: p })
  showMenu.value = false
}

function setStatus(status) {
  tasks.updateTask(props.task.id, { status })
  showMenu.value = false
}

function toggleUrgent() {
  tasks.updateTask(props.task.id, { isUrgent: !props.task.isUrgent })
  showMenu.value = false
}

const subtaskProgress = computed(() => {
  if (!props.task.subtasks?.length) return null
  const done = props.task.subtasks.filter(s => s.completed).length
  return { done, total: props.task.subtasks.length, pct: Math.round((done / props.task.subtasks.length) * 100) }
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
      'menu-open': showMenu,
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
      <div class="task-content" @dblclick="startEdit">
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
          <span class="task-text" :class="{ 'line-through': task.completed }">{{ task.text }}</span>
        </div>

        <!-- Metadata row -->
        <div class="task-meta" v-if="task.tags?.length || task.dueDate || task.recurrence || subtaskProgress || task.links?.length">
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
          <span v-if="task.dueDate" class="meta-badge date" :class="dueDateClass(task.dueDate)">
            <CalendarDays :size="11" />
            {{ formatDueDate(task.dueDate) }}
          </span>
          <span v-if="task.recurrence" class="meta-badge recurrence">
            <RotateCw :size="11" />
            {{ task.recurrence }}
          </span>
          <span v-if="subtaskProgress" class="meta-badge subtask-progress">
            {{ subtaskProgress.done }}/{{ subtaskProgress.total }}
            <div class="mini-progress">
              <div class="mini-progress-bar" :style="{ width: subtaskProgress.pct + '%' }" />
            </div>
          </span>
          <span v-if="task.notes" class="meta-badge notes-indicator" @click="toggleNotes">
            <StickyNote :size="11" />
          </span>
        </div>
      </div>

      <!-- Actions -->
      <div class="task-actions">
        <button class="action-btn" @click="startFocus" title="Focus mode">
          <Focus :size="15" />
        </button>
        <button class="action-btn" @click="showSubtasks = !showSubtasks" title="Subtasks">
          <component :is="showSubtasks ? ChevronDown : ChevronRight" :size="15" />
        </button>
        <button class="action-btn" @click="toggleNotes" title="Notes" :class="{ active: showNotes }">
          <StickyNote :size="15" />
        </button>
        <div class="action-menu-wrapper">
          <button class="action-btn" @click="showMenu = !showMenu" title="More">
            <MoreHorizontal :size="15" />
          </button>
          <Transition name="scale">
            <div v-if="showMenu" class="action-dropdown" @mouseleave="showMenu = false">
              <button @click="startEdit"><Edit3 :size="14" /> Edit</button>
              <button @click="setPriority('high')"><AlertCircle :size="14" style="color: #ef4444" /> High Priority</button>
              <button @click="setPriority('medium')"><AlertCircle :size="14" style="color: #f97316" /> Medium Priority</button>
              <button @click="setPriority('low')"><AlertCircle :size="14" style="color: #3b82f6" /> Low Priority</button>
              <button @click="setPriority('none')"><Circle :size="14" /> No Priority</button>
              <hr />
              <button @click="setStatus('in_progress')"><Timer :size="14" /> In Progress</button>
              <button @click="toggleUrgent">⚡ {{ task.isUrgent ? 'Remove Urgent' : 'Mark Urgent' }}</button>
              <hr />
              <button class="danger" @click="deleteTask"><Trash2 :size="14" /> Delete</button>
            </div>
          </Transition>
        </div>
        <button class="action-btn delete" @click="deleteTask" title="Delete">
          <Trash2 :size="15" />
        </button>
      </div>
    </div>

    <!-- Subtasks -->
    <Transition name="slide-down">
      <div v-if="showSubtasks" class="subtasks-section">
        <div
          v-for="sub in task.subtasks"
          :key="sub.id"
          class="subtask-item"
          :class="{ done: sub.completed }"
        >
          <button class="subtask-check" @click="tasks.toggleSubtask(task.id, sub.id)">
            <CheckCircle2 v-if="sub.completed" :size="16" />
            <Circle v-else :size="16" />
          </button>
          <span class="subtask-text" :class="{ 'line-through': sub.completed }">{{ sub.text }}</span>
          <button class="subtask-delete" @click="tasks.deleteSubtask(task.id, sub.id)">
            <X :size="13" />
          </button>
        </div>
        <div class="subtask-add">
          <input
            v-model="newSubtaskText"
            placeholder="Add subtask..."
            class="subtask-input"
            @keydown.enter="addSubtask"
          />
          <button class="subtask-add-btn" @click="addSubtask" :disabled="!newSubtaskText.trim()">
            <Plus :size="14" />
          </button>
        </div>
      </div>
    </Transition>

    <!-- Notes -->
    <Transition name="slide-down">
      <div v-if="showNotes" class="notes-section">
        <textarea
          v-model="editNotes"
          placeholder="Write notes in Markdown..."
          class="notes-textarea"
          @blur="saveNotes"
          rows="4"
        />
      </div>
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

  &:hover .task-actions { opacity: 1; }
  &:hover .drag-handle { opacity: 1; }

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
  opacity: 0;
  transition: opacity $transition-fast;
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
  cursor: default;
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
  }

  &.notes-indicator {
    background: rgba($amber-500, 0.1);
    color: $amber-500;
    cursor: pointer;
    &:hover { background: rgba($amber-500, 0.2); }
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
  background: $color-success;
  border-radius: 2px;
  transition: width $transition-base;
}

.task-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity $transition-fast;
  flex-shrink: 0;
}

.action-btn {
  @include btn-icon(30px);
  color: $color-text-muted;

  &:hover { color: $color-text-primary; background: $color-bg-hover; }
  &.active { color: $color-primary; background: $color-primary-light; }
  &.delete:hover { color: $rose-500; background: rgba($rose-500, 0.1); }
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

// Subtasks section
.subtasks-section {
  padding: 0 $space-4 $space-3;
  border-top: 1px solid $color-border;
  margin: 0 $space-3;
}

.subtask-item {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: $space-2 0;

  &.done .subtask-text { text-decoration: line-through; color: $color-text-muted; }
}

.subtask-check {
  @include flex-center;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: $color-text-muted;
  flex-shrink: 0;

  &:hover { color: $color-success; }
}

.subtask-item.done .subtask-check { color: $color-success; }

.subtask-text {
  flex: 1;
  font-size: $font-size-sm;
}

.subtask-delete {
  @include btn-icon(22px);
  opacity: 0;
  color: $color-text-muted;
  &:hover { color: $rose-500; }
  .subtask-item:hover & { opacity: 1; }
}

.subtask-add {
  display: flex;
  gap: $space-2;
  margin-top: $space-2;
}

.subtask-input {
  flex: 1;
  padding: $space-1 $space-2;
  border: 1px dashed $color-border;
  border-radius: $radius-sm;
  font-size: $font-size-sm;
  background: transparent;
  transition: all $transition-fast;

  &:focus {
    outline: none;
    border-color: $color-primary;
    border-style: solid;
  }
}

.subtask-add-btn {
  @include btn-icon(26px);
  color: $color-primary;
  background: $color-primary-light;
  &:hover { background: $color-primary; color: white; }
  &:disabled { opacity: 0.3; }
}

// Notes section
.notes-section {
  padding: 0 $space-4 $space-3;
  border-top: 1px solid $color-border;
  margin: 0 $space-3;
}

.notes-textarea {
  width: 100%;
  margin-top: $space-3;
  padding: $space-3;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-family: $font-mono;
  font-size: $font-size-sm;
  line-height: $line-height-relaxed;
  resize: vertical;
  min-height: 80px;
  transition: border-color $transition-fast;

  &:focus {
    outline: none;
    border-color: $color-primary;
  }
}
</style>
