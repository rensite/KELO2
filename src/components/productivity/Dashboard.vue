<script setup>
import { computed } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import { usePomodoroStore } from '../../stores/pomodoro.js'

const tasks = useTaskStore()
const pomodoro = usePomodoroStore()

// Calendar heatmap — last 16 weeks
const heatmapData = computed(() => {
  const weeks = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let w = 15; w >= 0; w--) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(today)
      date.setDate(date.getDate() - (w * 7 + (6 - d)))
      const key = date.toISOString().split('T')[0]
      const count = tasks.completionHeatmap[key] || 0
      week.push({ date: key, count, level: count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4 })
    }
    weeks.push(week)
  }
  return weeks
})

// Weekly chart
const weeklyData = computed(() => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const counts = new Array(7).fill(0)
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  weekStart.setHours(0, 0, 0, 0)

  tasks.items.forEach(t => {
    if (t.completedAt) {
      const d = new Date(t.completedAt)
      if (d >= weekStart) {
        counts[d.getDay()]++
      }
    }
  })

  const max = Math.max(...counts, 1)
  return days.map((name, i) => ({ name, count: counts[i], pct: (counts[i] / max) * 100 }))
})

const completionRate = computed(() => {
  const total = tasks.items.length
  if (total === 0) return 0
  return Math.round((tasks.totalCompleted / total) * 100)
})
</script>

<template>
  <div class="dashboard">
    <h3 class="section-title">📊 Productivity</h3>

    <!-- Quick stats -->
    <div class="dash-stats">
      <div class="dash-stat">
        <span class="dash-stat-value">{{ tasks.completedToday }}</span>
        <span class="dash-stat-label">Done Today</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-value">{{ tasks.completionStreak }}d</span>
        <span class="dash-stat-label">Streak</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-value">{{ completionRate }}%</span>
        <span class="dash-stat-label">Rate</span>
      </div>
    </div>

    <!-- Heatmap -->
    <div class="heatmap">
      <div class="heatmap-label">Activity</div>
      <div class="heatmap-grid">
        <div v-for="(week, wi) in heatmapData" :key="wi" class="heatmap-col">
          <div
            v-for="(day, di) in week"
            :key="di"
            class="heatmap-cell"
            :class="'level-' + day.level"
            :title="`${day.date}: ${day.count} tasks`"
            :style="{ animationDelay: `${(wi * 7 + di) * 10}ms` }"
          />
        </div>
      </div>
      <div class="heatmap-legend">
        <span>Less</span>
        <span class="heatmap-cell level-0 legend" />
        <span class="heatmap-cell level-1 legend" />
        <span class="heatmap-cell level-2 legend" />
        <span class="heatmap-cell level-3 legend" />
        <span class="heatmap-cell level-4 legend" />
        <span>More</span>
      </div>
    </div>

    <!-- Weekly chart -->
    <div class="weekly-chart">
      <div class="weekly-label">This Week</div>
      <div class="weekly-bars">
        <div v-for="d in weeklyData" :key="d.name" class="weekly-bar-group">
          <div class="weekly-bar-track">
            <div class="weekly-bar" :style="{ height: d.pct + '%' }" />
          </div>
          <div class="weekly-bar-label">{{ d.name.charAt(0) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.dashboard {
  padding: $space-2 0;
}

.dash-stats {
  display: flex;
  gap: $space-2;
  margin-bottom: $space-4;
}

.dash-stat {
  flex: 1;
  @include flex-col;
  align-items: center;
  padding: $space-3;
  border-radius: $radius-md;
  background: $gray-50;
}

.dash-stat-value {
  font-size: $font-size-lg;
  font-weight: $font-weight-bold;
  color: $color-primary;
}

.dash-stat-label {
  font-size: 10px;
  color: $color-text-muted;
  text-transform: uppercase;
}

// Heatmap
.heatmap {
  margin-bottom: $space-4;
}

.heatmap-label, .weekly-label {
  font-size: $font-size-xs;
  color: $color-text-muted;
  margin-bottom: $space-2;
  font-weight: $font-weight-medium;
}

.heatmap-grid {
  display: flex;
  gap: 2px;
  overflow-x: auto;
}

.heatmap-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.heatmap-cell {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  animation: heatmapFade 300ms ease backwards;

  &.level-0 { background: $gray-100; }
  &.level-1 { background: $violet-100; }
  &.level-2 { background: $violet-200; }
  &.level-3 { background: $violet-400; }
  &.level-4 { background: $violet-600; }

  &.legend {
    display: inline-block;
    animation: none;
  }
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: $space-2;
  font-size: 10px;
  color: $color-text-muted;
}

// Weekly chart
.weekly-bars {
  display: flex;
  gap: $space-2;
  align-items: flex-end;
  height: 60px;
}

.weekly-bar-group {
  flex: 1;
  @include flex-col;
  align-items: center;
  gap: 3px;
}

.weekly-bar-track {
  width: 100%;
  height: 50px;
  background: $gray-100;
  border-radius: 3px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.weekly-bar {
  width: 100%;
  background: $gradient-primary;
  border-radius: 3px;
  min-height: 2px;
  transition: height $transition-slow;
}

.weekly-bar-label {
  font-size: 10px;
  color: $color-text-muted;
  font-weight: $font-weight-medium;
}
</style>
