<script setup>
import { ref, computed } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import { useSettingsStore } from '../../stores/settings.js'
import { useTemplateStore } from '../../stores/templates.js'
import { usePomodoroStore } from '../../stores/pomodoro.js'
import { hashColor, hashColorLight } from '../../stores/utils.js'
import {
  Inbox, FolderPlus, Plus, X, Pin, Trash2,
  CheckCircle2, Circle, Clock, CalendarClock, AlertTriangle,
  Filter, ChevronDown, ChevronRight, FileText, Activity
} from 'lucide-vue-next'
import Dashboard from '../productivity/Dashboard.vue'
import ActivityTimeline from '../productivity/ActivityTimeline.vue'

const tasks = useTaskStore()
const settings = useSettingsStore()
const templates = useTemplateStore()
const pomodoro = usePomodoroStore()

const showNewCategory = ref(false)
const newCategoryName = ref('')
const tagsExpanded = ref(true)
const templatesExpanded = ref(true)
const activeTagFilter = ref(null)

const quickFilters = [
  { id: 'all', label: 'All Tasks', icon: Circle, count: () => tasks.items.length },
  { id: 'active', label: 'Active', icon: Circle, count: () => tasks.taskCount },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, count: () => tasks.totalCompleted },
  { id: 'today', label: 'Today', icon: Clock, count: () => {
    const today = new Date(); today.setHours(0,0,0,0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1)
    return tasks.items.filter(t => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) < tomorrow).length
  }},
  { id: 'upcoming', label: 'Upcoming', icon: CalendarClock, count: () => {
    return tasks.items.filter(t => t.dueDate && new Date(t.dueDate) > new Date() && !t.completed).length
  }},
  { id: 'overdue', label: 'Overdue', icon: AlertTriangle, count: () => tasks.overdueTasks.length },
]

function addCategory() {
  if (newCategoryName.value.trim()) {
    tasks.addCategory(newCategoryName.value.trim())
    newCategoryName.value = ''
    showNewCategory.value = false
  }
}

function selectTag(tag) {
  if (activeTagFilter.value === tag) {
    activeTagFilter.value = null
    tasks.activeTagFilter = null
  } else {
    activeTagFilter.value = tag
    tasks.activeTagFilter = tag
  }
}

function insertTemplate(template) {
  const tpl = template.task
  tasks.addTask({
    text: tpl.text,
    priority: tpl.priority || 'none',
    tags: tpl.tags ? [...tpl.tags] : [],
    recurrence: tpl.recurrence || null,
    subtasks: tpl.subtasks ? tpl.subtasks.map(s => ({
      ...s,
      id: Math.random().toString(36).substr(2, 9),
      completed: false,
    })) : [],
  })
}

function categoryTaskCount(catId) {
  return tasks.items.filter(t => t.categoryId === catId && !t.completed).length
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: !settings.sidebarOpen }">
    <div class="sidebar-inner">
      <!-- Quick Filters -->
      <section class="sidebar-section">
        <h3 class="section-title">
          <Filter :size="14" />
          Filters
        </h3>
        <div class="filter-list">
          <button
            v-for="f in quickFilters"
            :key="f.id"
            class="filter-item"
            :class="{ active: tasks.activeFilter === f.id }"
            @click="tasks.setFilter(f.id)"
          >
            <component :is="f.icon" :size="16" class="filter-icon" />
            <span class="filter-label">{{ f.label }}</span>
            <span class="filter-count">{{ f.count() }}</span>
          </button>
        </div>
      </section>

      <!-- Categories -->
      <section class="sidebar-section">
        <h3 class="section-title">
          <Inbox :size="14" />
          Categories
          <button class="section-action" @click="showNewCategory = !showNewCategory" title="New category">
            <Plus :size="14" />
          </button>
        </h3>

        <Transition name="slide-down">
          <div v-if="showNewCategory" class="new-category">
            <input
              v-model="newCategoryName"
              placeholder="Category name..."
              class="new-category-input"
              @keydown.enter="addCategory"
              @keydown.escape="showNewCategory = false"
            />
            <button class="new-category-add" @click="addCategory">
              <Plus :size="14" />
            </button>
          </div>
        </Transition>

        <div class="category-list">
          <button
            v-for="cat in tasks.categories"
            :key="cat.id"
            class="category-item"
            :class="{ active: tasks.activeCategory === cat.id }"
            @click="tasks.setCategory(cat.id)"
          >
            <span class="category-icon">{{ cat.icon }}</span>
            <span class="category-name">{{ cat.name }}</span>
            <span class="category-count">{{ categoryTaskCount(cat.id) }}</span>
            <Pin v-if="cat.pinned" :size="12" class="category-pin" />
          </button>
        </div>
      </section>

      <!-- Tags -->
      <section class="sidebar-section" v-if="tasks.allTags.length > 0">
        <h3 class="section-title clickable" @click="tagsExpanded = !tagsExpanded">
          <component :is="tagsExpanded ? ChevronDown : ChevronRight" :size="14" />
          Tags
        </h3>
        <Transition name="slide-down">
          <div v-if="tagsExpanded" class="tag-cloud">
            <button
              v-for="tag in tasks.allTags"
              :key="tag"
              class="tag-pill"
              :class="{ active: activeTagFilter === tag }"
              :style="{
                '--tag-color': hashColor(tag),
                '--tag-bg': hashColorLight(tag),
              }"
              @click="selectTag(tag)"
            >
              #{{ tag }}
            </button>
          </div>
        </Transition>
      </section>

      <!-- Templates -->
      <section class="sidebar-section">
        <h3 class="section-title clickable" @click="templatesExpanded = !templatesExpanded">
          <component :is="templatesExpanded ? ChevronDown : ChevronRight" :size="14" />
          Templates
        </h3>
        <Transition name="slide-down">
          <div v-if="templatesExpanded" class="template-list">
            <button
              v-for="tpl in templates.items"
              :key="tpl.id"
              class="template-item"
              @click="insertTemplate(tpl)"
              :title="'Create task from: ' + tpl.name"
            >
              <span class="template-icon">{{ tpl.icon }}</span>
              <span class="template-name">{{ tpl.name }}</span>
              <FileText :size="13" class="template-use" />
            </button>
          </div>
        </Transition>
      </section>

      <!-- Dashboard Toggle -->
      <section class="sidebar-section" v-if="settings.showDashboard">
        <Dashboard />
      </section>

      <!-- Activity Timeline Toggle -->
      <section class="sidebar-section" v-if="settings.showTimeline">
        <ActivityTimeline />
      </section>

      <!-- Pomodoro Stats -->
      <section class="sidebar-section" v-if="pomodoro.todaySessions.length > 0">
        <h3 class="section-title">
          <Activity :size="14" />
          Today's Focus
        </h3>
        <div class="focus-stats">
          <div class="focus-stat">
            <span class="focus-stat-value">{{ pomodoro.todaySessions.length }} 🍅</span>
            <span class="focus-stat-label">Pomodoros</span>
          </div>
          <div class="focus-stat">
            <span class="focus-stat-value">{{ pomodoro.todayFocusMinutes }}m</span>
            <span class="focus-stat-label">Focused</span>
          </div>
        </div>
      </section>
    </div>

    <!-- Copyright -->
    <div class="sidebar-copyright">
      Made by <a href="https://rensite.ru" target="_blank" rel="noopener noreferrer">Rensite</a>
    </div>
  </aside>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.sidebar {
  position: fixed;
  top: $header-height;
  left: 0;
  bottom: 0;
  width: $sidebar-width;
  background: $color-bg-sidebar;
  border-right: 1px solid $color-border;
  z-index: $z-sidebar;
  display: flex;
  flex-direction: column;
  transition: transform $transition-base, width $transition-base;

  &.collapsed {
    transform: translateX(-100%);
    width: 0;
  }

  @include mobile {
    width: 85%;
    max-width: 320px;
    box-shadow: $shadow-xl;

    &.collapsed {
      transform: translateX(-100%);
    }
  }
}

.sidebar-inner {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: $space-4;
  display: flex;
  flex-direction: column;
  gap: $space-2;
  @include custom-scrollbar;
}

.sidebar-section {
  margin-bottom: $space-2;
}

.section-title {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: $space-2 $space-2;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: $color-text-muted;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  user-select: none;

  &.clickable {
    cursor: pointer;
    &:hover { color: $color-text-secondary; }
  }

  .section-action {
    margin-left: auto;
    @include btn-icon(22px);
    color: $color-text-muted;
    &:hover { color: $color-primary; background: $color-primary-light; }
  }
}

.filter-list, .category-list, .template-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.filter-item, .category-item, .template-item {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: $space-2 $space-3;
  border-radius: $radius-md;
  font-size: $font-size-sm;
  color: $color-text-secondary;
  cursor: pointer;
  transition: all $transition-fast;
  border: none;
  background: none;
  width: 100%;
  text-align: left;

  &:hover {
    background: $color-bg-hover;
    color: $color-text-primary;
  }

  &.active {
    background: $color-primary-light;
    color: $color-primary;
    font-weight: $font-weight-medium;
  }
}

.filter-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.filter-label, .category-name, .template-name {
  flex: 1;
  @include truncate;
}

.filter-count, .category-count {
  font-size: $font-size-xs;
  color: $color-text-muted;
  font-weight: $font-weight-medium;
  padding: 1px 6px;
  border-radius: $radius-full;
  background: $gray-100;
  min-width: 22px;
  text-align: center;
}

.category-icon {
  font-size: $font-size-md;
}

.category-pin {
  color: $color-text-muted;
  flex-shrink: 0;
}

.template-icon {
  font-size: $font-size-md;
}

.template-use {
  opacity: 0;
  color: $color-primary;
  transition: opacity $transition-fast;
}

.template-item:hover .template-use {
  opacity: 1;
}

// New Category
.new-category {
  display: flex;
  gap: $space-2;
  padding: $space-2;
}

.new-category-input {
  @include input-base;
  padding: $space-2 $space-3;
  font-size: $font-size-sm;
}

.new-category-add {
  @include btn-icon(32px);
  background: $color-primary-light;
  color: $color-primary;
  &:hover { background: $color-primary; color: white; }
}

// Tags
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: $space-1;
  padding: $space-2;
}

.tag-pill {
  padding: 2px $space-3;
  border-radius: $radius-full;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  border: 1px solid transparent;
  background: var(--tag-bg);
  color: var(--tag-color);
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  }

  &.active {
    border-color: var(--tag-color);
    box-shadow: 0 0 0 2px var(--tag-bg);
  }
}

// Focus Stats
.focus-stats {
  display: flex;
  gap: $space-3;
  padding: $space-2;
}

.focus-stat {
  @include flex-col;
  align-items: center;
  flex: 1;
  padding: $space-3;
  border-radius: $radius-md;
  background: $gray-50;
}

.focus-stat-value {
  font-size: $font-size-lg;
  font-weight: $font-weight-bold;
  color: $color-text-primary;
}

.focus-stat-label {
  font-size: $font-size-xs;
  color: $color-text-muted;
}

// Copyright
.sidebar-copyright {
  flex-shrink: 0;
  padding: $space-3;
  text-align: center;
  font-size: 11px;
  color: $color-text-muted;
  opacity: 0.45;
  border-top: 1px solid $color-border;

  a {
    color: inherit;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
