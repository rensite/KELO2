<script setup>
import { useTaskStore } from '../../stores/tasks.js'
import { useToast } from '../../composables/useToast.js'
import {
  CheckCircle2, Trash2, Tag, AlertCircle, FolderOpen, X
} from 'lucide-vue-next'

const tasks = useTaskStore()
const { success } = useToast()

function batchComplete() {
  const count = tasks.selectedTaskIds.length
  tasks.batchComplete()
  success(`Completed ${count} tasks`)
}

function batchDelete() {
  const count = tasks.selectedTaskIds.length
  tasks.batchDelete()
  success(`Deleted ${count} tasks`)
}
</script>

<template>
  <div class="batch-bar">
    <div class="batch-info">
      <span class="batch-count">{{ tasks.selectedTaskIds.length }} selected</span>
      <button class="batch-select-all" @click="tasks.selectAll()">Select All</button>
    </div>
    <div class="batch-actions">
      <button class="batch-action" @click="batchComplete">
        <CheckCircle2 :size="16" />
        Complete
      </button>
      <button class="batch-action danger" @click="batchDelete">
        <Trash2 :size="16" />
        Delete
      </button>
      <button class="batch-action" @click="tasks.batchSetPriority('high')">
        <AlertCircle :size="16" style="color: #ef4444" />
        High
      </button>
      <button class="batch-action" @click="tasks.batchSetPriority('medium')">
        <AlertCircle :size="16" style="color: #f97316" />
        Medium
      </button>
    </div>
    <button class="batch-close" @click="tasks.toggleBatchMode()">
      <X :size="18" />
    </button>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.batch-bar {
  position: fixed;
  bottom: $space-6;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: $space-4;
  padding: $space-3 $space-5;
  background: $gray-800;
  color: white;
  border-radius: $radius-2xl;
  box-shadow: $shadow-xl;
  z-index: $z-modal;
  animation: slideInUp $transition-spring;
}

.batch-info {
  display: flex;
  align-items: center;
  gap: $space-3;
}

.batch-count {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
}

.batch-select-all {
  font-size: $font-size-xs;
  color: $violet-300;
  text-decoration: underline;
  background: none;
  border: none;
  cursor: pointer;
}

.batch-actions {
  display: flex;
  gap: $space-1;
}

.batch-action {
  display: flex;
  align-items: center;
  gap: $space-1;
  padding: $space-2 $space-3;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: $font-size-sm;
  border: none;
  cursor: pointer;
  transition: background $transition-fast;

  &:hover { background: rgba(255, 255, 255, 0.2); }
  &.danger:hover { background: rgba($rose-500, 0.4); }
}

.batch-close {
  @include btn-icon(32px);
  color: rgba(255, 255, 255, 0.6);
  &:hover { color: white; background: rgba(255, 255, 255, 0.1); }
}
</style>
