<script setup>
import { computed } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import TaskCard from '../tasks/TaskCard.vue'
import TaskInput from '../tasks/TaskInput.vue'

const tasks = useTaskStore()

const quadrants = computed(() => {
  const active = tasks.items.filter(t => !t.completed)
  return [
    {
      id: 'do',
      title: 'Do First',
      subtitle: 'Urgent & Important',
      icon: '🔴',
      color: '#ef4444',
      tasks: active.filter(t => t.priority === 'high' && t.isUrgent),
    },
    {
      id: 'schedule',
      title: 'Schedule',
      subtitle: 'Important, Not Urgent',
      icon: '🟡',
      color: '#f59e0b',
      tasks: active.filter(t => t.priority === 'high' && !t.isUrgent),
    },
    {
      id: 'delegate',
      title: 'Delegate',
      subtitle: 'Urgent, Not Important',
      icon: '🔵',
      color: '#3b82f6',
      tasks: active.filter(t => t.priority !== 'high' && t.isUrgent),
    },
    {
      id: 'eliminate',
      title: 'Eliminate',
      subtitle: 'Neither Urgent nor Important',
      icon: '⚪',
      color: '#94a3b8',
      tasks: active.filter(t => t.priority !== 'high' && !t.isUrgent),
    },
  ]
})
</script>

<template>
  <div class="eisenhower-view">
    <TaskInput />
    <div class="matrix-info">
      <p>Use <strong>!high</strong> in task input for Important. Use the <strong>⚡ Mark Urgent</strong> option in task menu for Urgent.</p>
    </div>
    <div class="matrix-grid">
      <div
        v-for="q in quadrants"
        :key="q.id"
        class="matrix-quadrant"
        :style="{ '--q-color': q.color }"
      >
        <div class="quadrant-header">
          <span class="quadrant-icon">{{ q.icon }}</span>
          <div class="quadrant-title-group">
            <span class="quadrant-title">{{ q.title }}</span>
            <span class="quadrant-subtitle">{{ q.subtitle }}</span>
          </div>
          <span class="quadrant-count">{{ q.tasks.length }}</span>
        </div>
        <div class="quadrant-body">
          <TaskCard
            v-for="task in q.tasks"
            :key="task.id"
            :task="task"
          />
          <div v-if="q.tasks.length === 0" class="quadrant-empty">
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

.eisenhower-view {
  max-width: 1100px;
  margin: 0 auto;
}

.matrix-info {
  margin-bottom: $space-4;
  padding: $space-3 $space-4;
  border-radius: $radius-md;
  background: $violet-50;
  color: $violet-600;
  font-size: $font-size-sm;

  strong { font-weight: $font-weight-semibold; }
}

.matrix-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $space-4;

  @include mobile {
    grid-template-columns: 1fr;
  }
}

.matrix-quadrant {
  background: $color-bg-elevated;
  border: 1px solid $color-border;
  border-radius: $radius-xl;
  padding: $space-4;
  border-top: 3px solid var(--q-color);
  min-height: 200px;
}

.quadrant-header {
  display: flex;
  align-items: center;
  gap: $space-2;
  margin-bottom: $space-4;
}

.quadrant-icon {
  font-size: $font-size-lg;
}

.quadrant-title-group {
  flex: 1;
}

.quadrant-title {
  display: block;
  font-size: $font-size-base;
  font-weight: $font-weight-semibold;
}

.quadrant-subtitle {
  display: block;
  font-size: $font-size-xs;
  color: $color-text-muted;
}

.quadrant-count {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  padding: $space-1 $space-3;
  border-radius: $radius-full;
  background: $gray-100;
  color: $color-text-secondary;
}

.quadrant-body {
  display: flex;
  flex-direction: column;
  gap: $space-2;
}

.quadrant-empty {
  @include flex-center;
  padding: $space-8;
  color: $color-text-muted;
  font-size: $font-size-sm;
  font-style: italic;
}
</style>
