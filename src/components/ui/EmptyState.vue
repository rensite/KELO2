<script setup>
</script>

<template>
  <div class="empty-state">
    <div class="empty-illustration">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
        <circle cx="60" cy="60" r="56" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="6 4" />
        <circle cx="60" cy="60" r="40" fill="#f5f3ff" />
        <text x="60" y="55" text-anchor="middle" font-size="32">✨</text>
        <text x="60" y="78" text-anchor="middle" font-size="11" fill="#94a3b8" font-family="Inter, sans-serif">All clear!</text>
      </svg>
    </div>
    <h3 class="empty-title">No tasks yet</h3>
    <p class="empty-desc">Start typing above to add your first task.<br />Try: <code>Buy milk #shopping !high tomorrow</code></p>
    <div class="empty-hints">
      <span class="hint"><kbd>#tag</kbd> Add tags</span>
      <span class="hint"><kbd>!high</kbd> Set priority</span>
      <span class="hint"><kbd>tomorrow</kbd> Due date</span>
      <span class="hint"><kbd>weekly</kbd> Recurrence</span>
    </div>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.empty-state {
  @include flex-col;
  align-items: center;
  text-align: center;
  padding: $space-16 $space-4;
  animation: fadeIn 500ms ease;
}

.empty-illustration {
  margin-bottom: $space-6;
  animation: float 4s ease-in-out infinite;

  svg {
    filter: drop-shadow(0 4px 8px rgba(139, 92, 246, 0.1));
  }
}

.empty-title {
  font-size: $font-size-xl;
  font-weight: $font-weight-semibold;
  color: $color-text-primary;
  margin-bottom: $space-2;
}

.empty-desc {
  font-size: $font-size-base;
  color: $color-text-secondary;
  line-height: $line-height-relaxed;
  max-width: 400px;

  code {
    padding: 2px 8px;
    border-radius: $radius-sm;
    background: $violet-50;
    color: $violet-600;
    font-family: $font-mono;
    font-size: $font-size-sm;
  }
}

.empty-hints {
  display: flex;
  flex-wrap: wrap;
  gap: $space-3;
  margin-top: $space-6;
  justify-content: center;
}

.hint {
  display: flex;
  align-items: center;
  gap: $space-1;
  font-size: $font-size-xs;
  color: $color-text-muted;

  kbd {
    padding: 2px 6px;
    border-radius: 4px;
    background: $gray-100;
    border: 1px solid $gray-200;
    font-family: $font-mono;
    font-size: 11px;
  }
}
</style>
