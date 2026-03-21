<script setup>
import { useSettingsStore } from '../../stores/settings.js'
import { X } from 'lucide-vue-next'

const settings = useSettingsStore()

const shortcuts = [
  { keys: ['⌘', 'K'], desc: 'Command palette' },
  { keys: ['⌘', 'N'], desc: 'New task (focus input)' },
  { keys: ['⌘', 'Z'], desc: 'Undo' },
  { keys: ['⌘', '⇧', 'Z'], desc: 'Redo' },
  { keys: ['⌘', '1'], desc: 'List view' },
  { keys: ['⌘', '2'], desc: 'Kanban view' },
  { keys: ['⌘', '3'], desc: 'Calendar view' },
  { keys: ['⌘', '4'], desc: 'Eisenhower view' },
  { keys: ['⌘', '⇧', 'F'], desc: 'Focus mode' },
  { keys: ['/'], desc: 'Focus search' },
  { keys: ['?'], desc: 'Keyboard shortcuts' },
  { keys: ['Esc'], desc: 'Close overlay' },
]
</script>

<template>
  <div class="kb-backdrop" @click="settings.keyboardHelpOpen = false">
    <div class="kb-modal" @click.stop>
      <div class="kb-header">
        <h3>Keyboard Shortcuts</h3>
        <button class="kb-close" @click="settings.keyboardHelpOpen = false">
          <X :size="18" />
        </button>
      </div>
      <div class="kb-list">
        <div v-for="s in shortcuts" :key="s.desc" class="kb-item">
          <span class="kb-desc">{{ s.desc }}</span>
          <div class="kb-keys">
            <kbd v-for="k in s.keys" :key="k">{{ k }}</kbd>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.kb-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: $z-modal;
  @include flex-center;
}

.kb-modal {
  width: 420px;
  max-width: 90vw;
  background: $color-bg-elevated;
  border-radius: $radius-xl;
  box-shadow: $shadow-xl;
  overflow: hidden;
  animation: scaleIn 200ms ease;
}

.kb-header {
  @include flex-between;
  padding: $space-5;
  border-bottom: 1px solid $color-border;

  h3 {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
  }
}

.kb-close {
  @include btn-icon(32px);
  color: $color-text-muted;
}

.kb-list {
  padding: $space-4;
}

.kb-item {
  @include flex-between;
  padding: $space-2 $space-3;
  border-radius: $radius-sm;

  &:hover { background: $gray-50; }
}

.kb-desc {
  font-size: $font-size-sm;
  color: $color-text-secondary;
}

.kb-keys {
  display: flex;
  gap: 4px;

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    padding: 2px 6px;
    border-radius: $radius-sm;
    background: $gray-100;
    border: 1px solid $gray-200;
    font-size: $font-size-xs;
    font-family: $font-family;
    color: $color-text-secondary;
    box-shadow: 0 1px 0 $gray-200;
  }
}
</style>
