<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import { useSettingsStore } from '../../stores/settings.js'
import { usePomodoroStore } from '../../stores/pomodoro.js'
import { X, Play, Pause, RotateCcw, Square, CheckCircle2 } from 'lucide-vue-next'

const tasks = useTaskStore()
const settings = useSettingsStore()
const pomodoro = usePomodoroStore()

const task = computed(() => tasks.items.find(t => t.id === settings.focusModeTaskId))

function close() {
  settings.exitFocusMode()
}

function toggleTimer() {
  if (pomodoro.isRunning) {
    pomodoro.pauseTimer()
  } else {
    pomodoro.startTimer(settings.focusModeTaskId)
  }
}

function completeAndExit() {
  if (task.value && !task.value.completed) {
    tasks.toggleComplete(task.value.id)
  }
  pomodoro.stopTimer()
  close()
}

const circumference = 2 * Math.PI * 90
const strokeDashoffset = computed(() => {
  return circumference * (1 - pomodoro.progress)
})
</script>

<template>
  <div class="focus-backdrop" v-if="task">
    <div class="focus-overlay">
      <button class="focus-close" @click="close">
        <X :size="24" />
      </button>

      <div class="focus-content">
        <!-- Timer ring -->
        <div class="focus-timer">
          <svg class="timer-ring" viewBox="0 0 200 200">
            <circle class="ring-bg" cx="100" cy="100" r="90" />
            <circle
              class="ring-progress"
              cx="100" cy="100" r="90"
              :style="{
                strokeDasharray: circumference,
                strokeDashoffset: strokeDashoffset,
              }"
              :class="{ break: pomodoro.isBreak }"
            />
          </svg>
          <div class="timer-display">
            <span class="timer-time">{{ pomodoro.formattedTime }}</span>
            <span class="timer-label">{{ pomodoro.isBreak ? 'Break' : 'Focus' }}</span>
          </div>
        </div>

        <!-- Task info -->
        <div class="focus-task-info">
          <h2 class="focus-task-text">{{ task.text }}</h2>
          <div class="focus-task-meta" v-if="task.tags?.length">
            <span v-for="tag in task.tags" :key="tag" class="focus-tag">#{{ tag }}</span>
          </div>
        </div>

        <!-- Subtasks -->
        <div class="focus-subtasks" v-if="task.subtasks?.length">
          <div
            v-for="sub in task.subtasks"
            :key="sub.id"
            class="focus-subtask"
            :class="{ done: sub.completed }"
            @click="tasks.toggleSubtask(task.id, sub.id)"
          >
            <CheckCircle2 v-if="sub.completed" :size="16" class="sub-icon done" />
            <span v-else class="sub-icon circle">○</span>
            <span>{{ sub.text }}</span>
          </div>
        </div>

        <!-- Notes -->
        <div class="focus-notes" v-if="task.notes">
          <p>{{ task.notes }}</p>
        </div>

        <!-- Controls -->
        <div class="focus-controls">
          <button class="focus-btn secondary" @click="pomodoro.resetTimer()" title="Reset">
            <RotateCcw :size="18" />
          </button>
          <button class="focus-btn primary" @click="toggleTimer">
            <Play v-if="!pomodoro.isRunning" :size="22" />
            <Pause v-else :size="22" />
          </button>
          <button class="focus-btn secondary" @click="pomodoro.stopTimer()" title="Stop">
            <Square :size="18" />
          </button>
        </div>

        <button class="focus-complete-btn" @click="completeAndExit">
          <CheckCircle2 :size="18" />
          Mark Complete & Exit
        </button>
      </div>

      <!-- Sessions counter -->
      <div class="focus-sessions" v-if="pomodoro.sessionsCompleted > 0">
        <span v-for="i in pomodoro.sessionsCompleted" :key="i" class="session-dot">🍅</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.focus-backdrop {
  position: fixed;
  inset: 0;
  z-index: $z-focus-mode;
  background: linear-gradient(135deg, #f5f3ff 0%, $gray-50 50%, #f0e7fe 100%);
  animation: fadeIn 300ms ease;
}

.focus-overlay {
  @include flex-center;
  @include flex-col;
  height: 100%;
  position: relative;
}

.focus-close {
  position: absolute;
  top: $space-6;
  right: $space-6;
  @include btn-icon(44px);
  color: $color-text-secondary;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  background: $color-bg-elevated;

  &:hover { background: $gray-100; }
}

.focus-content {
  @include flex-col;
  align-items: center;
  gap: $space-6;
  max-width: 500px;
  text-align: center;
}

.focus-timer {
  position: relative;
  width: 220px;
  height: 220px;
  @include flex-center;
}

.timer-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: $gray-200;
  stroke-width: 6;
}

.ring-progress {
  fill: none;
  stroke: url(#focusGradient);
  stroke: $violet-500;
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;

  &.break { stroke: $emerald-500; }
}

.timer-display {
  @include flex-col;
  align-items: center;
}

.timer-time {
  font-size: 3rem;
  font-weight: $font-weight-bold;
  font-family: $font-mono;
  color: $color-text-primary;
  letter-spacing: -0.02em;
}

.timer-label {
  font-size: $font-size-sm;
  color: $color-text-muted;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.focus-task-text {
  font-size: $font-size-2xl;
  font-weight: $font-weight-semibold;
  color: $color-text-primary;
}

.focus-task-meta {
  display: flex;
  gap: $space-2;
  justify-content: center;
}

.focus-tag {
  padding: 2px $space-3;
  border-radius: $radius-full;
  background: $violet-100;
  color: $violet-600;
  font-size: $font-size-sm;
}

.focus-subtasks {
  width: 100%;
  text-align: left;
  padding: $space-4;
  background: $color-bg-elevated;
  border-radius: $radius-lg;
  box-shadow: $shadow-sm;
}

.focus-subtask {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-2 $space-3;
  border-radius: $radius-sm;
  cursor: pointer;
  font-size: $font-size-base;
  transition: background $transition-fast;

  &:hover { background: $gray-50; }
  &.done {
    text-decoration: line-through;
    color: $color-text-muted;
  }

  .sub-icon {
    flex-shrink: 0;
    &.done { color: $color-success; }
    &.circle { color: $color-text-muted; font-size: $font-size-md; }
  }
}

.focus-notes {
  padding: $space-4;
  background: $color-bg-elevated;
  border-radius: $radius-lg;
  box-shadow: $shadow-sm;
  font-size: $font-size-sm;
  color: $color-text-secondary;
  text-align: left;
  width: 100%;
  white-space: pre-wrap;
}

.focus-controls {
  display: flex;
  align-items: center;
  gap: $space-4;
}

.focus-btn {
  @include flex-center;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all $transition-fast;

  &.primary {
    width: 64px;
    height: 64px;
    background: $gradient-primary;
    color: white;
    box-shadow: $shadow-md, $shadow-glow;

    &:hover { transform: scale(1.1); box-shadow: $shadow-lg, $shadow-glow; }
    &:active { transform: scale(0.95); }
  }

  &.secondary {
    width: 44px;
    height: 44px;
    background: $color-bg-elevated;
    color: $color-text-secondary;
    border: 1px solid $color-border;

    &:hover { background: $gray-100; color: $color-text-primary; }
  }
}

.focus-complete-btn {
  @include btn-primary;
  padding: $space-3 $space-6;
  border-radius: $radius-full;
  font-size: $font-size-base;
  gap: $space-2;
}

.focus-sessions {
  position: absolute;
  bottom: $space-8;
  display: flex;
  gap: $space-2;
  font-size: $font-size-lg;
}

.session-dot {
  animation: popIn 400ms ease backwards;
}
</style>
