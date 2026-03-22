<script setup>
import { computed, reactive, onMounted } from 'vue'
import { hashColor, hashColorLight } from '../../stores/utils.js'
import { getUrlHostname, getFaviconUrl } from '../../composables/useTaskParser.js'
import { ExternalLink, Music } from 'lucide-vue-next'

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
        telegramUser: getTelegramUsername(url),
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

// YouTube title cache
const ytTitles = reactive({})
const YT_CACHE_KEY = 'kelo_yt_titles'

function isYouTubeUrl(url) {
  return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/i.test(url)
}

function truncate(str, max = 30) {
  return str.length > max ? str.slice(0, max) + '…' : str
}

function getTelegramUsername(url) {
  const m = url.match(/(?:t\.me|telegram\.me|telegram\.org)\/([\w]+)/i)
  return m && m[1] !== 's' ? `@${m[1]}` : null
}

function getSmartLabel(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const path = u.pathname.replace(/^\//, '').replace(/\/$/, '')

    // Gemini
    if (host === 'gemini.google.com') return 'Gemini Chat'
    if (host === 'aistudio.google.com') return 'AI Studio'

    // GitHub
    if (host === 'github.com' && path) {
      const parts = path.split('/')
      if (parts.length >= 2) return truncate(`${parts[0]}/${parts[1]}`)
      return parts[0]
    }

    // Google Docs/Sheets/Slides
    if (host === 'docs.google.com') {
      if (path.startsWith('document')) return 'Google Doc'
      if (path.startsWith('spreadsheets')) return 'Google Sheet'
      if (path.startsWith('presentation')) return 'Google Slides'
      return 'Google Docs'
    }

    // Google Drive
    if (host === 'drive.google.com') return 'Google Drive'

    // VK
    if (host === 'vk.com') {
      if (path.startsWith('video')) return 'VK Video'
      if (path.startsWith('@')) return path
      return path ? truncate(path) : 'VK'
    }

    // Reddit
    if (host.includes('reddit.com') && path.includes('/r/')) {
      const sub = path.match(/r\/([\w]+)/)?.[1]
      return sub ? `r/${sub}` : 'Reddit'
    }

    // Wikipedia
    if (host.includes('wikipedia.org')) {
      const title = path.replace('wiki/', '').replace(/_/g, ' ')
      return title ? truncate(decodeURIComponent(title)) : 'Wikipedia'
    }

    // Figma
    if (host.includes('figma.com')) return 'Figma'

    // Kinopoisk / IMDB
    if (host.includes('kinopoisk.ru')) return 'Kinopoisk'
    if (host.includes('imdb.com')) return 'IMDB'

    return null
  } catch { return null }
}

function linkLabel(seg) {
  if (seg.telegramUser) return seg.telegramUser
  if (ytTitles[seg.value]) return truncate(ytTitles[seg.value])
  const smart = getSmartLabel(seg.value)
  if (smart) return smart
  return seg.hostname
}

function downloadMp3(url) {
  window.open(`https://cobalt.tools/?u=${encodeURIComponent(url)}`, '_blank')
}

onMounted(async () => {
  // Load cached titles
  try {
    const cached = JSON.parse(localStorage.getItem(YT_CACHE_KEY) || '{}')
    Object.assign(ytTitles, cached)
  } catch {}

  // Fetch missing YouTube titles
  const links = segments.value.filter(s => s.type === 'link' && isYouTubeUrl(s.value) && !ytTitles[s.value])
  for (const seg of links) {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(seg.value)}&format=json`)
      if (res.ok) {
        const data = await res.json()
        ytTitles[seg.value] = data.title
      }
    } catch {}
  }
  // Persist cache
  if (links.length) {
    try { localStorage.setItem(YT_CACHE_KEY, JSON.stringify(ytTitles)) } catch {}
  }
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
        <span class="rt-link-host">{{ linkLabel(seg) }}</span>
        <ExternalLink :size="9" class="rt-link-external" />
      </a>
      <button
        v-if="seg.type === 'link' && isYouTubeUrl(seg.value)"
        class="rt-mp3-btn"
        @click.stop="downloadMp3(seg.value)"
        title="Download MP3 via cobalt.tools"
      >
        <Music :size="10" />
      </button>
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
}

.rt-link-external {
  opacity: 0.5;
  flex-shrink: 0;
}

.rt-mp3-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: rgba(#e74c3c, 0.1);
  color: #e74c3c;
  border-radius: $radius-full;
  cursor: pointer;
  margin-left: 2px;
  vertical-align: middle;
  transition: all $transition-fast;

  &:hover {
    background: rgba(#e74c3c, 0.25);
    transform: scale(1.15);
  }
}
</style>
