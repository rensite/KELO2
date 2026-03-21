<script setup>
import { computed } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import { useSettingsStore } from '../../stores/settings.js'
import { usePomodoroStore } from '../../stores/pomodoro.js'
import {
  Search, Menu, List, Columns3, Calendar, Grid2x2,
  Keyboard, Download, BarChart3, Timer
} from 'lucide-vue-next'

const tasks = useTaskStore()
const settings = useSettingsStore()
const pomodoro = usePomodoroStore()

const viewModes = [
  { id: 'list', icon: List, label: 'List' },
  { id: 'kanban', icon: Columns3, label: 'Kanban' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'eisenhower', icon: Grid2x2, label: 'Matrix' },
]

function onSearch(e) {
  tasks.setSearch(e.target.value)
}
</script>

<template>
  <header class="header">
    <div class="header-left">
      <button class="menu-btn" @click="settings.toggleSidebar()" title="Toggle sidebar">
        <Menu :size="20" />
      </button>
      <div class="logo">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">KELO</span>
      </div>
    </div>

    <div class="header-center">
      <div class="search-wrapper">
        <Search :size="16" class="search-icon" />
        <input
          id="search-input"
          type="text"
          placeholder="Search tasks... (press / to focus)"
          :value="tasks.searchQuery"
          @input="onSearch"
          class="search-input"
        />
        <kbd class="search-kbd" @click="settings.openCommandPalette()">⌘K</kbd>
      </div>
    </div>

    <div class="header-right">
      <!-- Pomodoro mini widget -->
      <div v-if="pomodoro.activeTaskId" class="pomo-widget" :class="{ 'is-break': pomodoro.isBreak }">
        <Timer :size="15" />
        <span class="pomo-time">{{ pomodoro.formattedTime }}</span>
        <div class="pomo-progress">
          <div class="pomo-progress-bar" :style="{ width: (pomodoro.progress * 100) + '%' }" />
        </div>
      </div>

      <!-- View Switcher -->
      <div class="view-switcher">
        <button
          v-for="v in viewModes"
          :key="v.id"
          class="view-btn"
          :class="{ active: settings.viewMode === v.id }"
          @click="settings.setViewMode(v.id)"
          :title="v.label"
        >
          <component :is="v.icon" :size="16" />
        </button>
      </div>

      <!-- Stats -->
      <div class="header-stats">
        <div class="stat-item" title="Active tasks">
          <span class="stat-icon">🔥</span>
          <span class="stat-value">{{ tasks.taskCount }}</span>
        </div>
        <div class="stat-item" v-if="tasks.completedToday > 0" title="Completed today">
          <span class="stat-icon">✅</span>
          <span class="stat-value">{{ tasks.completedToday }}</span>
        </div>
        <div class="stat-item" v-if="tasks.completionStreak > 0" title="Day streak">
          <span class="stat-icon">⚡</span>
          <span class="stat-value">{{ tasks.completionStreak }}d</span>
        </div>
      </div>

      <!-- Action buttons -->
      <button class="header-icon-btn" @click="settings.toggleDashboard()" title="Dashboard">
        <BarChart3 :size="18" />
      </button>
      <button class="header-icon-btn" @click="settings.toggleImportExport()" title="Import/Export">
        <Download :size="18" />
      </button>
      <button class="header-icon-btn" @click="settings.toggleKeyboardHelp()" title="Keyboard shortcuts">
        <Keyboard :size="18" />
      </button>
    </div>
  </header>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: $header-height;
  display: flex;
  align-items: center;
  padding: 0 $space-4;
  background: $gradient-header;
  color: $color-text-inverse;
  z-index: $z-sticky;
  gap: $space-4;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: $space-3;
  flex-shrink: 0;
}

.menu-btn {
  @include btn-icon(36px);
  color: rgba(255, 255, 255, 0.8);
  &:hover { background: rgba(255, 255, 255, 0.15); color: white; }
}

.logo {
  display: flex;
  align-items: center;
  gap: $space-2;
  font-weight: $font-weight-bold;
  font-size: $font-size-lg;
  letter-spacing: 0.05em;

  .logo-icon {
    font-size: $font-size-xl;
  }
}

.header-center {
  flex: 1;
  max-width: 500px;
  margin: 0 auto;

  @include mobile {
    display: none;
  }
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: $space-3;
  color: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: $space-2 $space-4 $space-2 36px;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: $font-size-sm;
  outline: none;
  transition: all $transition-fast;

  &::placeholder { color: rgba(255, 255, 255, 0.5); }
  &:focus {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
  }
}

.search-kbd {
  position: absolute;
  right: $space-2;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.6);
  font-size: $font-size-xs;
  font-family: $font-family;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
    color: white;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex-shrink: 0;
}

.pomo-widget {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: $space-1 $space-3;
  border-radius: $radius-full;
  background: rgba(255, 255, 255, 0.15);
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  animation: glow 2s ease-in-out infinite;

  &.is-break {
    background: rgba($emerald-400, 0.3);
  }

  .pomo-time {
    font-family: $font-mono;
    font-size: $font-size-sm;
    min-width: 42px;
    text-align: center;
  }

  .pomo-progress {
    width: 40px;
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.2);
    overflow: hidden;
  }

  .pomo-progress-bar {
    height: 100%;
    border-radius: 2px;
    background: $amber-400;
    transition: width 1s linear;
  }
}

.view-switcher {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.1);
}

.view-btn {
  @include btn-icon(30px);
  color: rgba(255, 255, 255, 0.5);
  border-radius: $radius-sm;

  &:hover { background: rgba(255, 255, 255, 0.15); color: white; }
  &.active {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }
}

.header-stats {
  display: flex;
  align-items: center;
  gap: $space-2;

  @include mobile { display: none; }
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: $space-1 $space-2;
  border-radius: $radius-full;
  background: rgba(255, 255, 255, 0.1);
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;

  .stat-icon { font-size: 12px; }
  .stat-value { font-family: $font-mono; }
}

.header-icon-btn {
  @include btn-icon(34px);
  color: rgba(255, 255, 255, 0.7);
  &:hover { background: rgba(255, 255, 255, 0.15); color: white; }

  @include mobile { display: none; }
}
</style>
