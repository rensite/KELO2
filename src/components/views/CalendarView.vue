<script setup>
import { ref, computed } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const tasks = useTaskStore()
const currentDate = ref(new Date())

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const currentMonth = computed(() => currentDate.value.getMonth())
const currentYear = computed(() => currentDate.value.getFullYear())

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const days = []

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: daysInPrev - i, inMonth: false, date: new Date(year, month - 1, daysInPrev - i) })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, inMonth: true, date: new Date(year, month, d) })
  }

  // Next month padding
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({ day: d, inMonth: false, date: new Date(year, month + 1, d) })
  }

  return days
})

function getTasksForDate(date) {
  const dateKey = date.toISOString().split('T')[0]
  return tasks.tasksByDate[dateKey] || []
}

function isToday(date) {
  const today = new Date()
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
}

function prevMonth() {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() - 1)
  currentDate.value = d
}

function nextMonth() {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() + 1)
  currentDate.value = d
}

function goToday() {
  currentDate.value = new Date()
}

function priorityDot(task) {
  const colors = { high: '#ef4444', medium: '#f97316', low: '#3b82f6', none: '#94a3b8' }
  return colors[task.priority] || colors.none
}
</script>

<template>
  <div class="calendar-view">
    <div class="calendar-header">
      <button class="cal-nav-btn" @click="prevMonth">
        <ChevronLeft :size="18" />
      </button>
      <div class="cal-title">
        <span class="cal-month">{{ monthNames[currentMonth] }}</span>
        <span class="cal-year">{{ currentYear }}</span>
      </div>
      <button class="cal-today-btn" @click="goToday">Today</button>
      <button class="cal-nav-btn" @click="nextMonth">
        <ChevronRight :size="18" />
      </button>
    </div>

    <div class="calendar-grid">
      <div class="cal-day-header" v-for="day in dayNames" :key="day">{{ day }}</div>
      <div
        v-for="(cell, i) in calendarDays"
        :key="i"
        class="cal-cell"
        :class="{
          'out-of-month': !cell.inMonth,
          'is-today': isToday(cell.date),
          'has-tasks': getTasksForDate(cell.date).length > 0,
        }"
      >
        <span class="cal-date">{{ cell.day }}</span>
        <div class="cal-tasks">
          <div
            v-for="task in getTasksForDate(cell.date).slice(0, 3)"
            :key="task.id"
            class="cal-task-dot"
            :class="{ completed: task.completed }"
            :title="task.text"
          >
            <span class="dot" :style="{ background: priorityDot(task) }"></span>
            <span class="cal-task-text">{{ task.text }}</span>
          </div>
          <div v-if="getTasksForDate(cell.date).length > 3" class="cal-more">
            +{{ getTasksForDate(cell.date).length - 3 }} more
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.calendar-view {
  max-width: 1000px;
  margin: 0 auto;
}

.calendar-header {
  display: flex;
  align-items: center;
  gap: $space-3;
  margin-bottom: $space-4;
}

.cal-nav-btn {
  @include btn-icon(36px);
  color: $color-text-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-md;
}

.cal-title {
  display: flex;
  align-items: baseline;
  gap: $space-2;
}

.cal-month {
  font-size: $font-size-xl;
  font-weight: $font-weight-bold;
}

.cal-year {
  font-size: $font-size-md;
  color: $color-text-secondary;
}

.cal-today-btn {
  @include btn-ghost;
  font-size: $font-size-sm;
  margin-left: auto;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $space-1 $space-4;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: $color-border;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  overflow: hidden;
}

.cal-day-header {
  padding: $space-2;
  text-align: center;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: $color-text-muted;
  text-transform: uppercase;
  background: $gray-50;
}

.cal-cell {
  min-height: 100px;
  padding: $space-2;
  background: $color-bg-elevated;
  transition: background $transition-fast;

  &:hover { background: $gray-50; }
  &.out-of-month {
    background: $gray-50;
    .cal-date { color: $color-text-muted; }
  }

  &.is-today .cal-date {
    background: $gradient-primary;
    color: white;
    border-radius: $radius-full;
    width: 26px;
    height: 26px;
    @include flex-center;
  }

  &.has-tasks { background: rgba($violet-500, 0.02); }
}

.cal-date {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $color-text-primary;
  display: inline-flex;
}

.cal-tasks {
  margin-top: $space-1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cal-task-dot {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10px;
  @include truncate;

  &.completed {
    opacity: 0.5;
    .cal-task-text { text-decoration: line-through; }
  }

  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .cal-task-text {
    @include truncate;
  }
}

.cal-more {
  font-size: 10px;
  color: $color-text-muted;
  padding: 1px 4px;
}
</style>
