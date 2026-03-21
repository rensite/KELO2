<script setup>
import { useToast } from '../../composables/useToast.js'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-vue-next'

const { toasts, dismiss } = useToast()

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="[toast.type, { hiding: !toast.visible }]"
      >
        <component :is="icons[toast.type]" :size="16" class="toast-icon" />
        <span class="toast-message">{{ toast.message }}</span>
        <button
          v-if="toast.action"
          class="toast-action"
          @click="toast.action.callback(); dismiss(toast.id)"
        >
          {{ toast.action.label }}
        </button>
        <button class="toast-close" @click="dismiss(toast.id)">
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.toast-container {
  position: fixed;
  bottom: $space-6;
  right: $space-6;
  z-index: $z-toast;
  display: flex;
  flex-direction: column-reverse;
  gap: $space-2;
  pointer-events: none;
  max-width: 400px;

  @include mobile {
    left: $space-4;
    right: $space-4;
    max-width: none;
  }
}

.toast {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-3 $space-4;
  border-radius: $radius-lg;
  background: $color-bg-elevated;
  border: 1px solid $color-border;
  box-shadow: $shadow-lg;
  pointer-events: all;
  animation: slideInRight $transition-spring;

  &.success { border-left: 3px solid $color-success; .toast-icon { color: $color-success; } }
  &.error { border-left: 3px solid $color-error; .toast-icon { color: $color-error; } }
  &.warning { border-left: 3px solid $color-warning; .toast-icon { color: $color-warning; } }
  &.info { border-left: 3px solid $color-info; .toast-icon { color: $color-info; } }
}

.toast-icon { flex-shrink: 0; }

.toast-message {
  flex: 1;
  font-size: $font-size-sm;
  color: $color-text-primary;
}

.toast-action {
  padding: $space-1 $space-3;
  border-radius: $radius-sm;
  background: $color-primary-light;
  color: $color-primary;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  border: none;
  cursor: pointer;
  transition: all $transition-fast;
  white-space: nowrap;

  &:hover { background: $color-primary; color: white; }
}

.toast-close {
  @include btn-icon(24px);
  color: $color-text-muted;
  flex-shrink: 0;
}
</style>
