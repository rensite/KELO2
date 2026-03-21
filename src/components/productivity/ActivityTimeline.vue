<script setup>
import { computed } from 'vue'
import { useHistoryStore } from '../../stores/history.js'
import { Plus, CheckCircle2, Trash2, Edit3, RotateCcw } from 'lucide-vue-next'

const history = useHistoryStore()

const actionIcons = {
  created: Plus,
  completed: CheckCircle2,
  uncompleted: RotateCcw,
  deleted: Trash2,
  edited: Edit3,
}

const actionColors = {
  created: '#6366f1',
  completed: '#10b981',
  uncompleted: '#f59e0b',
  deleted: '#f43f5e',
  edited: '#3b82f6',
}

function relativeTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
</script>

<template>
  <div class="timeline">
    <h3 class="section-title">📜 Activity</h3>
    <div class="timeline-list" v-if="history.recentEntries.length > 0">
      <div
        v-for="entry in history.recentEntries.slice(0, 20)"
        :key="entry.id"
        class="timeline-item"
      >
        <div class="timeline-dot" :style="{ background: actionColors[entry.action] || '#94a3b8' }">
          <component :is="actionIcons[entry.action] || Plus" :size="10" style="color: white" />
        </div>
        <div class="timeline-content">
          <span class="timeline-action">{{ entry.action }}</span>
          <span class="timeline-text" v-if="entry.data?.text">{{ entry.data.text }}</span>
        </div>
        <span class="timeline-time">{{ relativeTime(entry.timestamp) }}</span>
      </div>
    </div>
    <div v-else class="timeline-empty">No activity yet</div>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.timeline {
  padding: $space-2 0;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: $space-3;
  padding: $space-2 $space-2;
  position: relative;

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 12px;
    top: 26px;
    bottom: -2px;
    width: 1px;
    background: $gray-200;
  }
}

.timeline-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  @include flex-center;
  flex-shrink: 0;
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-action {
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: $color-text-secondary;
  text-transform: capitalize;
  display: block;
}

.timeline-text {
  font-size: $font-size-xs;
  color: $color-text-muted;
  @include truncate;
  display: block;
}

.timeline-time {
  font-size: 10px;
  color: $color-text-muted;
  white-space: nowrap;
  flex-shrink: 0;
}

.timeline-empty {
  padding: $space-4;
  text-align: center;
  font-size: $font-size-sm;
  color: $color-text-muted;
  font-style: italic;
}
</style>
