<script setup>
import { computed } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import { useSettingsStore } from '../../stores/settings.js'
import TaskInput from '../tasks/TaskInput.vue'
import TaskCard from '../tasks/TaskCard.vue'
import BatchActionBar from '../ui/BatchActionBar.vue'
import EmptyState from '../ui/EmptyState.vue'
import {
  ArrowUpDown, ListChecks, CheckSquare
} from 'lucide-vue-next'

const tasks = useTaskStore()
const settings = useSettingsStore()

const sortOptions = [
  { id: 'createdAt', label: 'Date Added' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'priority', label: 'Priority' },
  { id: 'alpha', label: 'A-Z' },
]
</script>

<template>
  <div class="list-view">
    <TaskInput />

    <!-- Toolbar -->
    <div class="list-toolbar">
      <div class="toolbar-left">
        <span class="task-summary">
          {{ tasks.filteredTasks.length }} task{{ tasks.filteredTasks.length !== 1 ? 's' : '' }}
        </span>
      </div>
      <div class="toolbar-right">
        <button
          class="toolbar-btn"
          :class="{ active: tasks.batchMode }"
          @click="tasks.toggleBatchMode()"
          title="Batch select"
        >
          <CheckSquare :size="15" />
          Select
        </button>
        <div class="sort-group">
          <ArrowUpDown :size="14" class="sort-icon" />
          <select class="sort-select" :value="tasks.sortBy" @change="tasks.setSort($event.target.value)">
            <option v-for="opt in sortOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Task list -->
    <div class="task-list" v-if="tasks.filteredTasks.length > 0">
      <TransitionGroup name="list" tag="div" class="task-list-inner">
        <TaskCard
          v-for="task in tasks.filteredTasks"
          :key="task.id"
          :task="task"
        />
      </TransitionGroup>
    </div>

    <EmptyState v-else />

    <BatchActionBar v-if="tasks.batchMode && tasks.selectedTaskIds.length > 0" />
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.list-view {
  max-width: 800px;
  margin: 0 auto;
}

.list-toolbar {
  @include flex-between;
  margin-bottom: $space-4;
  padding: $space-2 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: $space-3;
}

.task-summary {
  font-size: $font-size-sm;
  color: $color-text-secondary;
  font-weight: $font-weight-medium;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: $space-2;
}

.toolbar-btn {
  @include btn-ghost;
  font-size: $font-size-sm;
  padding: $space-1 $space-3;
  border-radius: $radius-md;
  gap: $space-1;

  &.active {
    background: $color-primary-light;
    color: $color-primary;
  }
}

.sort-group {
  display: flex;
  align-items: center;
  gap: $space-1;
  padding: $space-1 $space-2;
  border-radius: $radius-md;
  background: $color-bg-elevated;
  border: 1px solid $color-border;
}

.sort-icon { color: $color-text-muted; }

.sort-select {
  border: none;
  background: transparent;
  font-size: $font-size-sm;
  color: $color-text-secondary;
  cursor: pointer;
  outline: none;
  padding-right: $space-2;
}

.task-list-inner {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  position: relative;
}
</style>
