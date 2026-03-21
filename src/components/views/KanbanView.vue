<script setup>
import { computed } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import TaskCard from '../tasks/TaskCard.vue'
import TaskInput from '../tasks/TaskInput.vue'
import EmptyState from '../ui/EmptyState.vue'

const tasks = useTaskStore()

const columns = computed(() => [
  { id: 'todo', title: 'To Do', icon: '📋', tasks: tasks.items.filter(t => !t.completed && t.status !== 'in_progress') },
  { id: 'in_progress', title: 'In Progress', icon: '⚡', tasks: tasks.items.filter(t => !t.completed && t.status === 'in_progress') },
  { id: 'done', title: 'Done', icon: '✅', tasks: tasks.items.filter(t => t.completed) },
])

function moveTask(taskId, status) {
  if (status === 'done') {
    const task = tasks.items.find(t => t.id === taskId)
    if (task && !task.completed) tasks.toggleComplete(taskId)
  } else {
    tasks.updateTask(taskId, { status, completed: false, completedAt: null })
  }
}

function onDrop(e, column) {
  const taskId = e.dataTransfer.getData('taskId')
  if (taskId) moveTask(taskId, column.id === 'done' ? 'done' : column.id)
}

function onDragStart(e, taskId) {
  e.dataTransfer.setData('taskId', taskId)
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}
</script>

<template>
  <div class="kanban-view">
    <TaskInput />
    <div class="kanban-board">
      <div
        v-for="col in columns"
        :key="col.id"
        class="kanban-column"
        @drop="onDrop($event, col)"
        @dragover="onDragOver"
      >
        <div class="column-header">
          <span class="column-icon">{{ col.icon }}</span>
          <span class="column-title">{{ col.title }}</span>
          <span class="column-count">{{ col.tasks.length }}</span>
        </div>
        <div class="column-body">
          <div
            v-for="task in col.tasks"
            :key="task.id"
            draggable="true"
            @dragstart="onDragStart($event, task.id)"
            class="kanban-card-wrapper"
          >
            <TaskCard :task="task" />
          </div>
          <div v-if="col.tasks.length === 0" class="column-empty">
            No tasks
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.kanban-view {
  height: 100%;
}

.kanban-board {
  display: flex;
  gap: $space-4;
  overflow-x: auto;
  padding-bottom: $space-4;
  @include custom-scrollbar;
}

.kanban-column {
  flex: 1;
  min-width: 280px;
  max-width: 400px;
  background: $gray-50;
  border-radius: $radius-xl;
  padding: $space-3;
  border: 2px dashed transparent;
  transition: border-color $transition-fast;

  &:hover {
    border-color: rgba($violet-400, 0.3);
  }
}

.column-header {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: $space-2 $space-3;
  margin-bottom: $space-3;
}

.column-icon {
  font-size: $font-size-md;
}

.column-title {
  font-size: $font-size-base;
  font-weight: $font-weight-semibold;
  color: $color-text-primary;
}

.column-count {
  margin-left: auto;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  padding: 2px 8px;
  border-radius: $radius-full;
  background: $gray-200;
  color: $color-text-secondary;
}

.column-body {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  min-height: 100px;
}

.kanban-card-wrapper {
  cursor: grab;
  &:active { cursor: grabbing; }
}

.column-empty {
  @include flex-center;
  padding: $space-8;
  color: $color-text-muted;
  font-size: $font-size-sm;
  font-style: italic;
}
</style>
