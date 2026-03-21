<script setup>
import { computed } from 'vue'
import { hashColor, hashColorLight } from '../../stores/utils.js'
import { getUrlHostname, getFaviconUrl } from '../../composables/useTaskParser.js'
import { ExternalLink } from 'lucide-vue-next'

const props = defineProps({
  text: { type: String, default: '' },
  tags: { type: Array, default: () => [] },
  links: { type: Array, default: () => [] },
  completed: { type: Boolean, default: false },
})

/**
 * Parse the text and return an array of segments:
 * { type: 'text' | 'tag' | 'link', value: string, ... }
 */
const segments = computed(() => {
  let remaining = props.text
  const result = []
  
  // Build patterns for inline detection
  // We'll detect: #tags, and URLs (http/https/www)
  const tokenRegex = /(#[\w][\w-]*)|(?:https?:\/\/|www\.)[^\s<>"'`,;)}\]]+/gi
  
  let lastIndex = 0
  let match
  
  // Also check if the task's parsed tags/links are in the original text
  // since they might have been stripped from `task.text` during parsing.
  // In that case, we just render the plain text and let the meta badges handle it.

  // First try to find inline tokens
  const fullText = remaining
  tokenRegex.lastIndex = 0
  
  while ((match = tokenRegex.exec(fullText)) !== null) {
    // Add preceding text
    if (match.index > lastIndex) {
      const preceding = fullText.slice(lastIndex, match.index).trim()
      if (preceding) result.push({ type: 'text', value: preceding })
    }
    
    const token = match[0]
    if (token.startsWith('#')) {
      const tagName = token.slice(1).toLowerCase()
      result.push({
        type: 'tag',
        value: tagName,
        color: hashColor(tagName),
        bgColor: hashColorLight(tagName),
      })
    } else {
      let url = token
      if (url.startsWith('www.')) url = 'https://' + url
      url = url.replace(/[.,;:!?)]+$/, '')
      result.push({
        type: 'link',
        value: url,
        hostname: getUrlHostname(url),
        favicon: getFaviconUrl(url),
      })
    }
    
    lastIndex = match.index + match[0].length
  }
  
  // Remaining text
  if (lastIndex < fullText.length) {
    const tail = fullText.slice(lastIndex).trim()
    if (tail) result.push({ type: 'text', value: tail })
  }
  
  // If nothing parsed, just return the whole text
  if (result.length === 0 && fullText.trim()) {
    result.push({ type: 'text', value: fullText })
  }
  
  return result
})

// Whether the text itself contains inline tags/links
const hasInlineTokens = computed(() => {
  return segments.value.some(s => s.type !== 'text')
})
</script>

<template>
  <span class="rich-text" :class="{ completed }">
    <template v-for="(seg, i) in segments" :key="i">
      <span v-if="seg.type === 'text'" class="rt-text">{{ seg.value }}</span>
      <span
        v-else-if="seg.type === 'tag'"
        class="rt-tag"
        :style="{ '--tc': seg.color, '--tb': seg.bgColor }"
      >
        #{{ seg.value }}
      </span>
      <a
        v-else-if="seg.type === 'link'"
        :href="seg.value"
        target="_blank"
        rel="noopener noreferrer"
        class="rt-link"
        @click.stop
      >
        <img
          :src="seg.favicon"
          width="13"
          height="13"
          class="rt-link-favicon"
          alt=""
          loading="lazy"
        />
        <span class="rt-link-host">{{ seg.hostname }}</span>
        <ExternalLink :size="9" class="rt-link-external" />
      </a>
    </template>
  </span>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.rich-text {
  font-size: $font-size-base;
  line-height: $line-height-normal;
  color: $color-text-primary;
  
  &.completed {
    text-decoration: line-through;
    color: $color-text-muted;
    
    .rt-tag, .rt-link {
      opacity: 0.55;
    }
  }
}

.rt-text {
  word-break: break-word;
}

.rt-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: $radius-full;
  font-size: 12px;
  font-weight: $font-weight-medium;
  background: var(--tb);
  color: var(--tc);
  margin: 0 2px;
  vertical-align: baseline;
  line-height: 1.5;
  cursor: default;
  transition: all $transition-fast;
  
  &:hover {
    filter: brightness(0.95);
    transform: translateY(-1px);
  }
}

.rt-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px;
  border-radius: $radius-full;
  font-size: 12px;
  font-weight: $font-weight-medium;
  background: rgba($blue-500, 0.08);
  color: $blue-500;
  text-decoration: none;
  margin: 0 2px;
  vertical-align: baseline;
  line-height: 1.5;
  max-width: 200px;
  cursor: pointer;
  transition: all $transition-fast;
  
  &:hover {
    background: rgba($blue-500, 0.16);
    transform: translateY(-1px);
  }
}

.rt-link-favicon {
  border-radius: 2px;
  flex-shrink: 0;
  object-fit: contain;
}

.rt-link-host {
  @include truncate;
  max-width: 140px;
}

.rt-link-external {
  opacity: 0.5;
  flex-shrink: 0;
}
</style>
